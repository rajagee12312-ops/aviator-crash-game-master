const express = require("express");
const cors = require("cors");
const http = require("http");
const { Server } = require("socket.io");
const crypto = require("crypto");
const { MongoClient } = require("mongodb");
require("dotenv").config();
const app = express();
const server = http.createServer(app);
let mongoClient = null;
let accountsCollection = null;
let sessionsCollection = null;
const accountOperationQueues = new Map();
const configuredOrigins = (process.env.FRONTEND_ORIGIN || "")
  .split(",")
  .map((origin) => origin.trim())
  .filter(Boolean);
const localOrigins = process.env.NODE_ENV === "production"
  ? []
  : ["http://localhost:3000", "http://127.0.0.1:3000"];
const allowedOrigins = new Set([...configuredOrigins, ...localOrigins]);

function safeErrorMessage(error) {
  if (!(error instanceof Error)) return "Unknown error";
  return error.message.replace(
    /(mongodb(?:\+srv)?:\/\/)[^@\s]+@/gi,
    "$1[redacted]@"
  );
}

function getMongoConnectionOptions(uri) {
  let parsedUri;
  try {
    parsedUri = new URL(uri);
  } catch {
    throw new Error("MONGODB_URI must be a valid mongodb:// or mongodb+srv:// URI.");
  }

  const protocol = parsedUri.protocol.toLowerCase();
  if (protocol !== "mongodb:" && protocol !== "mongodb+srv:") {
    throw new Error("MONGODB_URI must use mongodb:// or mongodb+srv://.");
  }

  const hostname = parsedUri.hostname.toLowerCase().replace(/^\[|\]$/g, "");
  const isLoopback = ["localhost", "127.0.0.1", "::1"].includes(hostname);
  const uriOptions = new Map(
    Array.from(parsedUri.searchParams.entries(), ([key, value]) => [
      key.toLowerCase(),
      value.toLowerCase(),
    ])
  );
  const insecureTlsOption = [
    "tlsinsecure",
    "tlsallowinvalidcertificates",
    "tlsallowinvalidhostnames",
  ].find((option) => ["true", "1", "yes"].includes(uriOptions.get(option)));
  if (insecureTlsOption) {
    throw new Error(
      "MongoDB certificate validation cannot be disabled. Configure a trusted CA instead."
    );
  }

  const uriTlsSetting = uriOptions.get("tls") || uriOptions.get("ssl");
  const tlsRequired = process.env.NODE_ENV === "production"
    || protocol === "mongodb+srv:"
    || !isLoopback;
  if (tlsRequired && uriTlsSetting === "false") {
    throw new Error("TLS must remain enabled for remote or production MongoDB connections.");
  }

  const tls = tlsRequired || uriTlsSetting === "true";
  return {
    profile: `protocol=${protocol.slice(0, -1)}; endpoint=${isLoopback ? "loopback" : "remote (redacted)"}; tls=${tls ? "enabled" : "disabled for loopback"}; certificateValidation=enabled`,
    options: {
      serverSelectionTimeoutMS: 10000,
      connectTimeoutMS: 10000,
      tls,
      tlsAllowInvalidCertificates: false,
      tlsAllowInvalidHostnames: false,
    },
  };
}

function isAllowedOrigin(origin) {
  return !origin || allowedOrigins.has(origin);
}

const io = new Server(server, {
  cors: {
    origin: (origin, callback) => {
      if (isAllowedOrigin(origin)) {
        callback(null, true);
      } else {
        callback(new Error("Origin not allowed"));
      }
    },
    credentials: true,
  },
});

app.use(cors({
  origin: (origin, callback) => {
    if (isAllowedOrigin(origin)) {
      callback(null, true);
    } else {
      callback(new Error("Origin not allowed"));
    }
  },
  credentials: true,
}));
app.use(express.json({ limit: "10kb" }));

app.get("/health", (req, res) => res.status(200).json({
  status: "ok",
  storage: accountsCollection ? "mongodb" : "memory",
}));

function publicAccount(account) {
  return {
    id: account.id,
    username: account.username,
    email: account.email,
    balance: account.balance,
  };
}

function withAccountLock(accountId, operation) {
  const previous = accountOperationQueues.get(accountId) || Promise.resolve();
  let release;
  const current = new Promise((resolve) => {
    release = resolve;
  });
  accountOperationQueues.set(accountId, current);
  return previous
    .then(operation)
    .finally(() => {
      release();
      if (accountOperationQueues.get(accountId) === current) {
        accountOperationQueues.delete(accountId);
      }
    });
}

function findSession(token) {
  return getSession(token);
}

async function getSession(token) {
  let session = demoSessions.get(token);
  if (!session && sessionsCollection) {
    const storedSession = await sessionsCollection.findOne({
      tokenHash: crypto.createHash("sha256").update(token).digest("hex"),
      expiresAt: { $gt: new Date() },
    });
    if (storedSession) {
      session = {
        accountId: storedSession.accountId,
        expiresAt: new Date(storedSession.expiresAt).getTime(),
      };
      demoSessions.set(token, session);
    }
  }
  if (!session) return null;
  if (session.expiresAt <= Date.now()) {
    demoSessions.delete(token);
    if (sessionsCollection) {
      await sessionsCollection.deleteOne({
        tokenHash: crypto.createHash("sha256").update(token).digest("hex"),
      });
    }
    return null;
  }
  return session;
}

async function createSession(account) {
  const token = crypto.randomBytes(32).toString("base64url");
  const session = {
    accountId: account.id,
    expiresAt: Date.now() + 7 * 24 * 60 * 60 * 1000,
  };
  if (sessionsCollection) {
    await sessionsCollection.insertOne({
      tokenHash: crypto.createHash("sha256").update(token).digest("hex"),
      accountId: session.accountId,
      expiresAt: new Date(session.expiresAt),
    });
  }
  demoSessions.set(token, session);
  return token;
}

async function requireDemoAccount(req, res, next) {
  const authorization = req.get("authorization") || "";
  const match = authorization.match(/^Bearer\s+(.+)$/i);
  const session = match && await findSession(match[1]);
  const account = session && await getAccountById(session.accountId);
  if (!account) {
    return res.status(401).json({ message: "Please sign in to your account." });
  }
  req.demoAccount = account;
  req.demoToken = match[1];
  next();
}

function normalizeAmount(value) {
  const amount = Number(value);
  if (!Number.isFinite(amount) || amount <= 0 || amount > 10000) return null;
  return Math.round(amount * 100) / 100;
}

function serializeAccount(account) {
  return {
    ...account,
    passwordSalt: account.passwordSalt.toString("hex"),
    passwordHash: account.passwordHash.toString("hex"),
  };
}

function deserializeAccount(document) {
  const { _id, ...account } = document;
  return {
    ...account,
    passwordSalt: Buffer.from(account.passwordSalt, "hex"),
    passwordHash: Buffer.from(account.passwordHash, "hex"),
  };
}

async function getAccountByEmail(email) {
  const cachedAccount = demoAccounts.get(email);
  if (cachedAccount || !accountsCollection) return cachedAccount || null;
  const document = await accountsCollection.findOne({ email });
  if (!document) return null;
  const account = deserializeAccount(document);
  demoAccounts.set(email, account);
  return account;
}

async function getAccountById(id) {
  const cachedAccount = Array.from(demoAccounts.values()).find(
    (candidate) => candidate.id === id
  );
  if (cachedAccount || !accountsCollection) return cachedAccount || null;
  const document = await accountsCollection.findOne({ id });
  if (!document) return null;
  const account = deserializeAccount(document);
  demoAccounts.set(account.email, account);
  return account;
}

async function persistAccount(account) {
  if (!accountsCollection) return;
  await accountsCollection.updateOne(
    { id: account.id },
    { $set: serializeAccount(account) },
    { upsert: true }
  );
}

async function recordWalletAction(account, type, amount) {
  await withAccountLock(account.id, async () => {
    const previousBalance = account.balance;
    const previousTransactions = account.transactions;
    account.transactions = [...account.transactions];
    account.balance = Math.round(
      (account.balance + (type === "deposit" ? amount : -amount)) * 100
    ) / 100;
    account.transactions.unshift({
      id: crypto.randomUUID(),
      type,
      amount,
      balanceAfter: account.balance,
      createdAt: new Date().toISOString(),
      mode: "demo",
    });
    account.transactions.splice(20);

    try {
      await persistAccount(account);
    } catch (error) {
      account.balance = previousBalance;
      account.transactions = previousTransactions;
      throw error;
    }

    for (const [socketId, player] of playerBets.entries()) {
      if (playerAccountIds.get(socketId) !== account.id) continue;
      player.balance = account.balance;
      const activeSocket = io.sockets.sockets.get(socketId);
      if (activeSocket) activeSocket.emit("myInfo", player);
    }
  });
}

function syncAccountPlayers(account) {
  for (const [socketId, player] of playerBets.entries()) {
    if (playerAccountIds.get(socketId) !== account.id) continue;
    player.balance = account.balance;
    const activeSocket = io.sockets.sockets.get(socketId);
    if (activeSocket) activeSocket.emit("myInfo", player);
  }
}

app.post("/api/auth/register", async (req, res) => {
  const username = typeof req.body.username === "string" ? req.body.username.trim() : "";
  const email = typeof req.body.email === "string" ? req.body.email.trim().toLowerCase() : "";
  const password = typeof req.body.password === "string" ? req.body.password : "";

  if (username.length < 2 || username.length > 24) {
    return res.status(400).json({ message: "Username must be 2–24 characters." });
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 254) {
    return res.status(400).json({ message: "Enter a valid email address." });
  }
  if (password.length < 10 || password.length > 128) {
    return res.status(400).json({ message: "Password must be 10–128 characters." });
  }
  if (await getAccountByEmail(email)) {
    return res.status(409).json({ message: "An account with that email already exists." });
  }

  const salt = crypto.randomBytes(16);
  const account = {
    id: crypto.randomUUID(),
    username,
    email,
    passwordSalt: salt,
    passwordHash: crypto.scryptSync(password, salt, 64),
    balance: 1000,
    transactions: [],
  };
  if (accountsCollection) {
    try {
      await accountsCollection.insertOne(serializeAccount(account));
    } catch (error) {
      if (error.code === 11000) {
        return res.status(409).json({ message: "An account with that email already exists." });
      }
      throw error;
    }
  }
  demoAccounts.set(email, account);
  const token = await createSession(account);
  return res.status(201).json({ token, user: publicAccount(account) });
});

app.post("/api/auth/login", async (req, res) => {
  const email = typeof req.body.email === "string" ? req.body.email.trim().toLowerCase() : "";
  const password = typeof req.body.password === "string" ? req.body.password : "";
  const account = await getAccountByEmail(email);
  if (!account || password.length > 128) {
    return res.status(401).json({ message: "Email or password is incorrect." });
  }
  const passwordHash = crypto.scryptSync(password, account.passwordSalt, 64);
  if (!crypto.timingSafeEqual(passwordHash, account.passwordHash)) {
    return res.status(401).json({ message: "Email or password is incorrect." });
  }
  const token = await createSession(account);
  return res.json({ token, user: publicAccount(account) });
});

app.get("/api/auth/me", requireDemoAccount, (req, res) => {
  res.json({ user: publicAccount(req.demoAccount) });
});

app.post("/api/auth/logout", requireDemoAccount, async (req, res) => {
  demoSessions.delete(req.demoToken);
  if (sessionsCollection) {
    await sessionsCollection.deleteOne({
      tokenHash: crypto.createHash("sha256").update(req.demoToken).digest("hex"),
    });
  }
  res.json({ status: "ok" });
});

app.get("/api/wallet", requireDemoAccount, (req, res) => {
  res.json({
    balance: req.demoAccount.balance,
    transactions: req.demoAccount.transactions,
    mode: "demo",
  });
});

app.post("/api/wallet/deposit", requireDemoAccount, async (req, res) => {
  const amount = normalizeAmount(req.body.amount);
  if (amount === null) {
    return res.status(400).json({ message: "Enter an amount between 0.01 and 10000 virtual credits." });
  }
  await recordWalletAction(req.demoAccount, "deposit", amount);
  res.json({
    balance: req.demoAccount.balance,
    transactions: req.demoAccount.transactions,
    mode: "demo",
  });
});

app.post("/api/wallet/withdraw", requireDemoAccount, async (req, res) => {
  const amount = normalizeAmount(req.body.amount);
  if (amount === null) {
    return res.status(400).json({ message: "Enter an amount between 0.01 and 10000 virtual credits." });
  }
  if (amount > req.demoAccount.balance) {
    return res.status(400).json({ message: "Your virtual balance is too low for this withdrawal." });
  }
  await recordWalletAction(req.demoAccount, "withdraw", amount);
  res.json({
    balance: req.demoAccount.balance,
    transactions: req.demoAccount.transactions,
    mode: "demo",
  });
});

const history = [];
const playerBets = new Map();
const playerAccountIds = new Map();
const chat = [];
const demoAccounts = new Map();
const demoSessions = new Map();
const roundWagers = new Map();
const personalBetHistories = new Map();
const wagerHistoryOwners = new Map();
const pendingBetSlots = new Set();
const pendingCashOutSlots = new Set();
const GAME_MIN_BET = 1;
const GAME_MAX_BET = 1000;
const WAITING_DURATION_MS = 1000;
const BET_DURATION_MS = 10000;
const CRASHED_DURATION_MS = 3000;
const NEXT_ROUND_DURATION_MS = 3000;
const GAME_TICK_MS = 100;
const MULTIPLIER_RATE = 0.22;
let lastRoundParticipants = [];
let roundId = 1000;
let phase = "WAITING";
let phaseStartedAt = Date.now();
let crashAt = 1.25;
let roundStartAt = Date.now();

function makeUser(socketId, account, token) {
  return {
    balance: account ? account.balance : 1000,
    userType: false,
    avatar: "",
    userId: account ? account.id : socketId,
    currency: "PKR",
    userName: account ? account.username : "Guest Player",
    ipAddress: "",
    platform: "web",
    token: token || "",
    Session_Token: token || "",
    isSoundEnable: true,
    isMusicEnable: true,
    msgVisible: true,
    f: { auto: false, autocashout: false, betid: "", betted: false, cashouted: false, betAmount: 20, cashAmount: 0, target: 2 },
    s: { auto: false, autocashout: false, betid: "", betted: false, cashouted: false, betAmount: 20, cashAmount: 0, target: 2 },
  };
}

io.use(async (socket, next) => {
  try {
    const token = socket.handshake.auth && socket.handshake.auth.token;
    const session = token && await findSession(token);
    const account = session && await getAccountById(session.accountId);
    socket.data.account = account || null;
    socket.data.sessionToken = account ? token : "";
    next();
  } catch (error) {
    next(error);
  }
});

function randomCrash() {
  const roll = Math.random();
  return Number(Math.max(1.25, Math.min(25, 1 / (1 - roll * 0.82))).toFixed(2));
}

function getCrashPoint() {
  const testCrashAt = Number(process.env.DEMO_TEST_CRASH_AT);
  if (
    process.env.NODE_ENV === "test"
    && Number.isFinite(testCrashAt)
    && testCrashAt >= 1.25
    && testCrashAt <= 25
  ) {
    return testCrashAt;
  }
  return randomCrash();
}

function roundMoney(value) {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

function currentMultiplier(now = Date.now()) {
  if (phase !== "FLYING") return 0;
  const elapsed = Math.max(0, (now - roundStartAt) / 1000);
  return Math.min(crashAt, 1 + elapsed * MULTIPLIER_RATE);
}

function currentWagerRows() {
  return Array.from(roundWagers.values(), (wager) => ({ ...wager }));
}

function personalHistoryKey(socket) {
  return socket.data.account
    ? `account:${socket.data.account.id}`
    : `socket:${socket.id}`;
}

function savePersonalBetHistory(wager) {
  const historyKey = wagerHistoryOwners.get(wager.id);
  if (!historyKey) return;

  const record = {
    _id: wager.id,
    name: wager.name,
    betAmount: wager.betAmount,
    cashoutAt: wager.cashOut,
    cashouted: wager.cashouted,
    createdAt: wager.createdAt,
    flyAway: wager.target,
    flyDetailID: wager.roundId,
    roundId: wager.roundId,
    profit: wager.profit,
    result: !wager.resolved ? "PENDING" : wager.cashouted ? "CASHED OUT" : "CRASHED",
    resolved: wager.resolved,
  };
  const records = personalBetHistories.get(historyKey) || [];
  const existingIndex = records.findIndex((entry) => entry._id === record._id);
  const nextRecords = records.slice();
  if (existingIndex >= 0) nextRecords[existingIndex] = record;
  else nextRecords.unshift(record);
  personalBetHistories.set(historyKey, nextRecords.slice(0, 100));
}

function emitPersonalBetHistory(socket) {
  socket.emit("myBets", personalBetHistories.get(personalHistoryKey(socket)) || []);
}

function emitPersonalBetHistoryForWager(wager) {
  const historyKey = wagerHistoryOwners.get(wager.id);
  if (!historyKey) return;
  for (const socket of io.sockets.sockets.values()) {
    if (personalHistoryKey(socket) === historyKey) emitPersonalBetHistory(socket);
  }
}

function emitBettedUsers() {
  io.emit("bettedUserInfo", currentWagerRows());
}

function emitGameState() {
  const serverTime = Date.now();
  const durationMs = phase === "COUNTDOWN"
    ? BET_DURATION_MS
    : phase === "WAITING"
      ? WAITING_DURATION_MS
      : phase === "NEXT ROUND"
        ? NEXT_ROUND_DURATION_MS
        : 0;
  const currentValue = phase === "FLYING"
    ? currentMultiplier(serverTime)
    : phase === "CRASHED"
      ? crashAt
      : 0;
  io.emit("gameState", {
    currentNum: currentValue.toFixed(2),
    currentSecondNum: currentValue,
    GameState: phase,
    time: phase === "FLYING" || phase === "CRASHED" ? roundStartAt : phaseStartedAt,
    serverTime,
    multiplierRate: phase === "FLYING" ? MULTIPLIER_RATE : 0,
    durationMs,
    roundId,
  });
}

function startCountdown() {
  phase = "COUNTDOWN";
  phaseStartedAt = Date.now();
  roundId += 1;
  roundWagers.clear();
  wagerHistoryOwners.clear();
  pendingBetSlots.clear();
  pendingCashOutSlots.clear();
  for (const player of playerBets.values()) {
    for (const side of ["f", "s"]) {
      player[side].betted = false;
      player[side].cashouted = false;
      player[side].cashAmount = 0;
    }
  }
  io.emit("history", history);
  emitBettedUsers();
  emitGameState();
}

function startWaiting() {
  phase = "WAITING";
  phaseStartedAt = Date.now();
  emitGameState();
  setTimeout(startCountdown, WAITING_DURATION_MS);
}

function startPlaying() {
  if (phase !== "COUNTDOWN") return;
  phase = "FLYING";
  roundStartAt = Date.now();
  crashAt = getCrashPoint();
  emitGameState();
}

function finishRound() {
  if (phase !== "FLYING") return;
  phase = "CRASHED";
  history.unshift(crashAt);
  history.splice(20);
  for (const wager of roundWagers.values()) {
    if (!wager.cashouted) {
      wager.profit = -wager.betAmount;
      wager.target = crashAt;
    }
    wager.resolved = true;
    savePersonalBetHistory(wager);
  }
  lastRoundParticipants = currentWagerRows();
  io.emit("history", history);
  io.emit("previousHand", lastRoundParticipants);

  for (const [socketId, player] of playerBets.entries()) {
    const socket = io.sockets.sockets.get(socketId);
    if (!socket) continue;
    if (player.f.betted) {
      player.f.betted = false;
    }
    if (player.s.betted) {
      player.s.betted = false;
    }
    socket.emit("finishGame", player);
    emitPersonalBetHistory(socket);
  }

  emitBettedUsers();
  emitGameState();
  setTimeout(() => {
    phase = "NEXT ROUND";
    phaseStartedAt = Date.now();
    emitGameState();
    setTimeout(startWaiting, NEXT_ROUND_DURATION_MS);
  }, CRASHED_DURATION_MS);
}

setInterval(() => {
  if (
    phase === "COUNTDOWN"
    && Date.now() - phaseStartedAt >= BET_DURATION_MS
    && pendingBetSlots.size === 0
  ) {
    startPlaying();
  } else if (phase === "FLYING") {
    const multiplier = currentMultiplier();
    emitGameState();
    if (multiplier >= crashAt) {
      finishRound();
      return;
    }
    for (const [socketId, player] of playerBets.entries()) {
      const socket = io.sockets.sockets.get(socketId);
      if (!socket) continue;
      for (const side of ["f", "s"]) {
        const bet = player[side];
        if (bet.betted && !bet.cashouted && bet.autocashout && multiplier >= bet.target) {
          settleCashOut(socket, player, side).catch((error) => {
            console.error("Could not complete demo auto cashout:", safeErrorMessage(error));
          });
        }
      }
    }
  }
}, GAME_TICK_MS);

function betSlotKey(socket, side) {
  const playerId = socket.data.account
    ? `account:${socket.data.account.id}`
    : `socket:${socket.id}`;
  return `${playerId}:${side}`;
}

function emitBetError(socket, player, side, message, alreadyPlaced = false) {
  if (socket.data.account) player.balance = socket.data.account.balance;
  socket.emit("myInfo", player);
  socket.emit("myBetState", player);
  socket.emit("error", { index: side, message, alreadyPlaced });
}

async function settleCashOut(socket, player, side) {
  const slot = betSlotKey(socket, side);
  const wager = roundWagers.get(slot);
  if (!wager || pendingCashOutSlots.has(slot)) return false;
  pendingCashOutSlots.add(slot);
  const settle = async () => {
    if (phase !== "FLYING" || !player[side].betted || player[side].cashouted) return false;
    const multiplier = currentMultiplier();
    if (multiplier >= crashAt) {
      finishRound();
      return false;
    }

    const bet = player[side];
    const payoutMultiplier = roundMoney(multiplier);
    const payout = roundMoney(bet.betAmount * payoutMultiplier);
    const previousBalance = socket.data.account
      ? socket.data.account.balance
      : player.balance;
    const previousWager = { ...wager };
    bet.cashouted = true;
    bet.cashAmount = payout;
    wager.cashouted = true;
    wager.cashOut = payoutMultiplier;
    wager.target = payoutMultiplier;
    wager.profit = roundMoney(payout - bet.betAmount);

    try {
      if (socket.data.account) {
        socket.data.account.balance = roundMoney(previousBalance + payout);
        try {
          await persistAccount(socket.data.account);
        } catch (error) {
          socket.data.account.balance = previousBalance;
          throw error;
        }
        player.balance = socket.data.account.balance;
        syncAccountPlayers(socket.data.account);
      } else {
        player.balance = roundMoney(previousBalance + payout);
        socket.emit("myInfo", player);
      }

      socket.emit("myBetState", player);
      savePersonalBetHistory(wager);
      emitPersonalBetHistoryForWager(wager);
      socket.emit("success", "Cash out successful");
      emitBettedUsers();
      return true;
    } catch (error) {
      bet.cashouted = false;
      bet.cashAmount = 0;
      Object.assign(wager, previousWager);
      if (socket.data.account) player.balance = socket.data.account.balance;
      console.error("Could not save cash-out balance:", safeErrorMessage(error));
      socket.emit("myInfo", player);
      socket.emit("error", {
        index: side,
        message: "Could not save your cash-out. Please try again.",
      });
      return false;
    }
  };

  try {
    return socket.data.account
      ? await withAccountLock(socket.data.account.id, settle)
      : await settle();
  } finally {
    pendingCashOutSlots.delete(slot);
  }
}

app.get("/api/my-info", (req, res) => res.json({ status: true, data: [] }));
app.post("/api/my-info", (req, res) => res.json({ status: true, data: [] }));
app.get("/api/game/seed/:id", (req, res) => res.json({
  createdAt: new Date().toISOString(),
  serverSeed: "demo-server-seed",
  seedOfUsers: [],
  flyDetailID: Number(req.params.id),
}));
app.get("/api/get-day-history", (req, res) => res.json({ status: true, data: history }));
app.get("/api/get-week-history", (req, res) => res.json({ status: true, data: history }));
app.get("/api/get-month-history", (req, res) => res.json({ status: true, data: history }));
app.post("/api/get-all-chat", (req, res) => res.json({ status: true, data: chat }));

io.on("connection", (socket) => {
  const player = makeUser(socket.id, socket.data.account, socket.data.sessionToken);
  playerBets.set(socket.id, player);
  if (socket.data.account) {
    playerAccountIds.set(socket.id, socket.data.account.id);
  }

  socket.on("enterRoom", () => {
    socket.emit("myInfo", player);
    socket.emit("myBetState", player);
    socket.emit("history", history);
    socket.emit("bettedUserInfo", currentWagerRows());
    socket.emit("previousHand", lastRoundParticipants);
    emitPersonalBetHistory(socket);
    socket.emit("getBetLimits", { max: 1000, min: 1 });
    emitGameState();
  });

  socket.on("getMyBets", () => {
    emitPersonalBetHistory(socket);
  });

  socket.on("playBet", async (bet) => {
    const side = bet && (bet.type === "f" || bet.type === "s") ? bet.type : null;
    if (!side) {
      emitBetError(socket, player, "f", "Invalid bet type");
      return;
    }
    if (phase !== "COUNTDOWN") {
      emitBetError(socket, player, side, "Betting is closed for this round");
      return;
    }
    const slot = betSlotKey(socket, side);
    if (roundWagers.has(slot) || pendingBetSlots.has(slot)) {
      emitBetError(
        socket,
        player,
        side,
        "A bet is already placed for this panel this round",
        true
      );
      return;
    }
    const rawAmount = Number(bet.betAmount);
    const amount = Number.isFinite(rawAmount) ? roundMoney(rawAmount) : NaN;
    if (!Number.isFinite(amount) || amount < GAME_MIN_BET || amount > GAME_MAX_BET) {
      emitBetError(socket, player, side, "Enter a valid bet between 1 and 1000 PKR");
      return;
    }
    const target = Number(bet.target);
    if (!Number.isFinite(target) || target < 1.01 || target > 25) {
      emitBetError(socket, player, side, "Auto cashout must be between 1.01x and 25x");
      return;
    }
    pendingBetSlots.add(slot);
    let previousBalance = player.balance;
    const placeBet = async () => {
      if (phase !== "COUNTDOWN") {
        emitBetError(socket, player, side, "Betting is closed for this round");
        return;
      }
      const balance = socket.data.account ? socket.data.account.balance : player.balance;
      if (amount > balance) {
        emitBetError(socket, player, side, "Your virtual balance is too low for this bet");
        return;
      }
      previousBalance = balance;
      player[side].betted = true;
      player[side].betAmount = amount;
      player[side].cashouted = false;
      player[side].cashAmount = 0;
      player[side].target = target;
      player[side].auto = Boolean(bet.auto);
      player[side].autocashout = Boolean(bet.autocashout);
      if (socket.data.account) {
        socket.data.account.balance = roundMoney(balance - amount);
        try {
          await persistAccount(socket.data.account);
        } catch (error) {
          socket.data.account.balance = previousBalance;
          throw error;
        }
        player.balance = socket.data.account.balance;
        syncAccountPlayers(socket.data.account);
      } else {
        player.balance = roundMoney(balance - amount);
        socket.emit("myInfo", player);
      }
      const wager = {
        id: `${roundId}:${slot}`,
        playerId: socket.data.account ? socket.data.account.id : socket.id,
        name: player.userName || "Guest Player",
        betAmount: amount,
        cashOut: 0,
        cashouted: false,
        target: 0,
        img: "",
        profit: 0,
        side,
        resolved: false,
        roundId,
        createdAt: new Date().toISOString(),
      };
      roundWagers.set(slot, wager);
      wagerHistoryOwners.set(wager.id, personalHistoryKey(socket));
      savePersonalBetHistory(wager);
      emitPersonalBetHistoryForWager(wager);
      socket.emit("myBetState", player);
      socket.emit("success", "Bet placed");
      emitBettedUsers();
    };

    try {
      if (socket.data.account) {
        await withAccountLock(socket.data.account.id, placeBet);
      } else {
        await placeBet();
      }
    } catch (error) {
      player[side].betted = false;
      player.balance = previousBalance;
      if (socket.data.account) socket.data.account.balance = previousBalance;
      console.error("Could not save bet balance:", safeErrorMessage(error));
      emitBetError(socket, player, side, "Could not save your bet. Please try again.");
    } finally {
      pendingBetSlots.delete(slot);
    }
  });

  socket.on("cashOut", async (request) => {
    if (!request || (request.type !== "f" && request.type !== "s")) {
      socket.emit("error", { index: "f", message: "Invalid bet panel" });
      return;
    }
    await settleCashOut(socket, player, request.type);
  });

  socket.on("sendMsg", (message) => {
    chat.unshift({
      _id: String(Date.now()),
      userId: socket.id,
      userName: socket.data.account?.username || message.userInfo?.userName || "Guest Player",
      avatar: "",
      message: message.msgContent,
      img: message.msgType === "gif" ? message.msgContent : "",
      likes: 0,
      likesIDs: [],
      disLikes: 0,
      disLikesIDs: [],
    });
    io.emit("msgData", chat);
  });

  socket.on("disconnect", () => {
    playerBets.delete(socket.id);
    playerAccountIds.delete(socket.id);
    if (!socket.data.account) personalBetHistories.delete(`socket:${socket.id}`);
  });
});

startWaiting();

const port = Number(process.env.PORT || 5000);

async function initializeStorage() {
  if (process.env.DEMO_STORAGE === "memory") {
    if (process.env.NODE_ENV === "production") {
      throw new Error("DEMO_STORAGE=memory is disabled in production.");
    }
    console.warn("DEMO_STORAGE=memory; using in-memory demo account storage.");
    return;
  }

  const uri = process.env.MONGODB_URI;
  if (!uri) {
    throw new Error(
      "MONGODB_URI is required. Set DEMO_STORAGE=memory explicitly for local demo mode."
    );
  }

  const connection = getMongoConnectionOptions(uri);
  console.info(`MongoDB connection profile: ${connection.profile}`);
  mongoClient = new MongoClient(uri, connection.options);
  await mongoClient.connect();
  const database = mongoClient.db(process.env.MONGODB_DB || "aviator_crash");
  accountsCollection = database.collection("demo_accounts");
  sessionsCollection = database.collection("demo_sessions");

  await Promise.all([
    accountsCollection.createIndex({ email: 1 }, { unique: true }),
    sessionsCollection.createIndex({ tokenHash: 1 }, { unique: true }),
    sessionsCollection.createIndex({ expiresAt: 1 }, { expireAfterSeconds: 0 }),
  ]);

  const accounts = await accountsCollection.find({}).toArray();
  for (const document of accounts) {
    const account = deserializeAccount(document);
    demoAccounts.set(account.email, account);
  }
}

app.use((error, req, res, next) => {
  if (res.headersSent) return next(error);
  console.error("Backend request failed:", safeErrorMessage(error));
  const status = Number(error.status || error.statusCode) || 500;
  res.status(status).json({
    message: status >= 500
      ? "The demo backend could not complete the request."
      : error.message,
  });
});

initializeStorage()
  .then(() => {
    server.listen(port, "0.0.0.0", () => {
      console.log(`Demo game backend listening on http://localhost:${port}`);
    });
  })
  .catch((error) => {
    const message = safeErrorMessage(error);
    console.error(
      "Could not initialize demo backend storage. Verify MONGODB_URI and MongoDB network access.",
      message
    );
    if (/tlsv1 alert internal error|ssl routines/i.test(message)) {
      console.error(
        "MongoDB rejected the TLS handshake. Verify the redacted endpoint, provider TLS support, and any required trusted CA; certificate verification was not disabled."
      );
    }
    process.exit(1);
  });
