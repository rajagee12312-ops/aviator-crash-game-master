const assert = require("node:assert/strict");
const { spawn } = require("node:child_process");
const { once } = require("node:events");
const path = require("node:path");
const { test } = require("node:test");
const { io } = require("socket.io-client");

function waitForGamePhase(socket, phase, timeoutMs = 15000) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      socket.off("gameState", onState);
      reject(new Error(`Timed out waiting for ${phase}`));
    }, timeoutMs);
    const onState = (state) => {
      if (state.GameState !== phase) return;
      clearTimeout(timer);
      socket.off("gameState", onState);
      resolve(state);
    };
    socket.on("gameState", onState);
  });
}

function waitForPersonalHistory(socket, getHistory, predicate, timeoutMs = 5000) {
  return new Promise((resolve, reject) => {
    const existingHistory = getHistory();
    if (predicate(existingHistory)) {
      resolve(existingHistory);
      return;
    }

    const timer = setTimeout(() => {
      socket.off("myBets", onHistory);
      reject(new Error("Timed out waiting for the expected personal bet update"));
    }, timeoutMs);
    const onHistory = (history) => {
      if (!predicate(history)) return;
      clearTimeout(timer);
      socket.off("myBets", onHistory);
      resolve(history);
    };
    socket.on("myBets", onHistory);
  });
}

test("demo accounts, wallet actions, and authenticated game sessions", async (t) => {
  const port = 5100 + Math.floor(Math.random() * 1000);
  const baseUrl = `http://127.0.0.1:${port}`;
  const child = spawn(process.execPath, [path.join(__dirname, "server.js")], {
    cwd: __dirname,
    env: {
      ...process.env,
      NODE_ENV: "test",
      DEMO_STORAGE: "memory",
      DEMO_TEST_CRASH_AT: "1.25",
      PORT: String(port),
      FRONTEND_ORIGIN: "http://localhost:3000",
    },
    stdio: ["ignore", "pipe", "pipe"],
  });
  let serverOutput = "";
  child.stdout.on("data", (chunk) => { serverOutput += chunk.toString(); });
  child.stderr.on("data", (chunk) => { serverOutput += chunk.toString(); });

  t.after(async () => {
    if (child.exitCode !== null) return;
    const exited = once(child, "exit");
    child.kill();
    await exited;
  });

  let ready = false;
  for (let attempt = 0; attempt < 50; attempt += 1) {
    if (child.exitCode !== null) break;
    try {
      const response = await fetch(`${baseUrl}/health`);
      ready = response.ok;
      if (ready) break;
    } catch {
      await new Promise((resolve) => setTimeout(resolve, 100));
    }
  }
  assert.equal(ready, true, `demo server did not start: ${serverOutput}`);
  const healthResponse = await fetch(`${baseUrl}/health`);
  assert.deepEqual(await healthResponse.json(), { status: "ok", storage: "memory" });

  const email = `player-${Date.now()}@example.test`;
  const password = "PracticePass!123";
  const registerResponse = await fetch(`${baseUrl}/api/auth/register`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ username: "Test Pilot", email, password }),
  });
  assert.equal(registerResponse.status, 201);
  const registered = await registerResponse.json();
  assert.equal(registered.user.balance, 1000);
  assert.equal("passwordHash" in registered.user, false);

  const duplicate = await fetch(`${baseUrl}/api/auth/register`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ username: "Test Pilot", email, password }),
  });
  assert.equal(duplicate.status, 409);

  const invalidPassword = await fetch(`${baseUrl}/api/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password: "wrong-password" }),
  });
  assert.equal(invalidPassword.status, 401);

  const walletHeaders = {
    Authorization: `Bearer ${registered.token}`,
    "Content-Type": "application/json",
  };
  const unauthenticatedWallet = await fetch(`${baseUrl}/api/wallet`);
  assert.equal(unauthenticatedWallet.status, 401);

  const deposit = await fetch(`${baseUrl}/api/wallet/deposit`, {
    method: "POST",
    headers: walletHeaders,
    body: JSON.stringify({ amount: 125.5 }),
  });
  assert.equal((await deposit.json()).balance, 1125.5);

  const rejectedWithdrawal = await fetch(`${baseUrl}/api/wallet/withdraw`, {
    method: "POST",
    headers: walletHeaders,
    body: JSON.stringify({ amount: 2000 }),
  });
  assert.equal(rejectedWithdrawal.status, 400);

  const withdraw = await fetch(`${baseUrl}/api/wallet/withdraw`, {
    method: "POST",
    headers: walletHeaders,
    body: JSON.stringify({ amount: 25.25 }),
  });
  assert.equal((await withdraw.json()).balance, 1100.25);

  const socket = io(baseUrl, {
    auth: { token: registered.token },
    transports: ["websocket"],
  });
  t.after(() => socket.disconnect());
  const gamePhases = [];
  let latestPersonalHistory = [];
  let latestWagers = [];
  socket.on("gameState", (state) => gamePhases.push(state.GameState));
  socket.on("myBets", (history) => { latestPersonalHistory = history; });
  socket.on("bettedUserInfo", (wagers) => { latestWagers = wagers; });
  await once(socket, "connect");
  const playerInfoPromise = once(socket, "myInfo");
  socket.emit("enterRoom");
  const [playerInfo] = await playerInfoPromise;
  assert.equal(playerInfo.userName, "Test Pilot");
  assert.equal(playerInfo.balance, 1100.25);
  assert.equal(playerInfo.currency, "PKR");

  const betDeadline = Date.now() + 15000;
  while (Date.now() < betDeadline && !gamePhases.includes("COUNTDOWN")) {
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  assert.equal(gamePhases.includes("WAITING"), true);
  assert.equal(gamePhases.includes("COUNTDOWN"), true);
  assert.deepEqual(latestWagers, []);

  const betPlaced = once(socket, "success");
  const firstPersonalBet = once(socket, "myBets");
  socket.emit("playBet", { betAmount: 100, target: 2, type: "f", auto: false });
  const [[betMessage], [firstBetHistory]] = await Promise.all([betPlaced, firstPersonalBet]);
  assert.equal(betMessage, "Bet placed");
  assert.equal(firstBetHistory.length, 1);
  assert.equal(firstBetHistory[0].result, "PENDING");
  const duplicateBet = once(socket, "error");
  socket.emit("playBet", { betAmount: 100, target: 2, type: "f", auto: false });
  const [duplicateError] = await duplicateBet;
  assert.equal(duplicateError.alreadyPlaced, true);

  const invalidBet = once(socket, "error");
  socket.emit("playBet", { betAmount: 0.5, target: 2, type: "s", auto: false });
  const [invalidError] = await invalidBet;
  assert.match(invalidError.message, /between 1 and 1000 PKR/);

  const activeWagers = once(socket, "bettedUserInfo");
  const secondBet = once(socket, "success");
  const secondPersonalBet = once(socket, "myBets");
  socket.emit("playBet", {
    betAmount: 50,
    target: 1.1,
    type: "s",
    auto: true,
    autocashout: true,
  });
  const [[secondBetMessage], [wagers], [personalHistory]] = await Promise.all([
    secondBet,
    activeWagers,
    secondPersonalBet,
  ]);
  assert.equal(secondBetMessage, "Bet placed");
  assert.equal(personalHistory.length, 2);
  assert.equal(wagers.length, 2);
  assert.ok(wagers.every((wager) => wager.name === "Test Pilot"));
  assert.equal(wagers.reduce((total, wager) => total + wager.betAmount, 0), 150);

  const walletAfterBet = await fetch(`${baseUrl}/api/wallet`, {
    headers: walletHeaders,
  });
  assert.equal((await walletAfterBet.json()).balance, 950.25);

  const guestSocket = io(baseUrl, { transports: ["websocket"] });
  t.after(() => guestSocket.disconnect());
  await once(guestSocket, "connect");
  const guestInfoPromise = once(guestSocket, "myInfo");
  guestSocket.emit("enterRoom");
  const [guestInfo] = await guestInfoPromise;
  assert.equal(guestInfo.balance, 1000);
  assert.equal(guestInfo.userName, "Guest Player");
  const guestBetAccepted = once(guestSocket, "success");
  guestSocket.emit("playBet", { betAmount: 50, target: 2, type: "f", auto: false });
  const [guestBetMessage] = await guestBetAccepted;
  assert.equal(guestBetMessage, "Bet placed");
  assert.equal(guestInfo.currency, "PKR");

  const flyingState = await waitForGamePhase(socket, "FLYING");
  const crashedStatePromise = waitForGamePhase(socket, "CRASHED", 30000);
  const guestFinish = once(guestSocket, "finishGame");
  assert.equal(flyingState.roundId > 1000, true);
  assert.equal(flyingState.multiplierRate, 0.22);
  assert.equal(
    flyingState.currentSecondNum,
    1 + ((flyingState.serverTime - flyingState.time) / 1000) * flyingState.multiplierRate
  );
  await new Promise((resolve) => setTimeout(resolve, 100));
  const manualCashout = once(socket, "success");
  const manualCashoutHistory = waitForPersonalHistory(
    socket,
    () => latestPersonalHistory,
    (history) => history.some(
      (entry) => entry._id.includes(":f") && entry.result === "CASHED OUT"
    )
  );
  const autoCashoutHistory = waitForPersonalHistory(
    socket,
    () => latestPersonalHistory,
    (history) => history.some(
      (entry) => entry._id.includes(":s") && entry.result === "CASHED OUT"
    )
  );
  socket.emit("cashOut", { type: "f", endTarget: 1.01 });
  const [manualCashoutMessage] = await manualCashout;
  assert.equal(manualCashoutMessage, "Cash out successful");
  const manualCashoutEntry = (await manualCashoutHistory)
    .find((entry) => entry._id.includes(":f"));
  assert.ok(manualCashoutEntry.cashoutAt > 1);
  assert.ok(manualCashoutEntry.profit > 0);
  const autoCashoutEntry = (await autoCashoutHistory)
    .find((entry) => entry._id.includes(":s"));
  assert.ok(autoCashoutEntry.cashoutAt >= 1.1);

  const finalPersonalHistory = waitForPersonalHistory(
    socket,
    () => latestPersonalHistory,
    (history) => history.length === 2 && history.every((entry) => entry.resolved)
  );
  const crashedState = await crashedStatePromise;
  const completedHistory = await finalPersonalHistory;
  assert.ok(completedHistory.every((entry) => entry.resolved));
  const [guestResult] = await guestFinish;
  assert.equal(guestResult.balance, 950);
  assert.ok(Number(crashedState.currentNum) >= 1.25);
  const historyResponse = await fetch(`${baseUrl}/api/get-day-history`);
  const roundHistory = await historyResponse.json();
  assert.equal(roundHistory.data[0], Number(crashedState.currentNum));
  assert.equal(latestWagers.length, 3);
  assert.ok(latestWagers.every((wager) => wager.resolved));
  assert.equal(latestWagers.filter((wager) => wager.profit > 0).length, 2);
  assert.equal(latestWagers.filter((wager) => wager.profit < 0).length, 1);
  const walletAfterRound = await fetch(`${baseUrl}/api/wallet`, {
    headers: walletHeaders,
  });
  assert.ok((await walletAfterRound.json()).balance > 1100.25);
  await waitForGamePhase(socket, "NEXT ROUND");

  const login = await fetch(`${baseUrl}/api/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password }),
  });
  assert.equal(login.status, 200);
  const loginResult = await login.json();
  assert.equal(loginResult.user.id, registered.user.id);

  const logout = await fetch(`${baseUrl}/api/auth/logout`, {
    method: "POST",
    headers: { Authorization: `Bearer ${registered.token}` },
  });
  assert.equal(logout.status, 200);
  const expiredSession = await fetch(`${baseUrl}/api/wallet`, {
    headers: { Authorization: `Bearer ${registered.token}` },
  });
  assert.equal(expiredSession.status, 401);
});

test("production refuses in-memory demo storage", async () => {
  const port = 6000 + Math.floor(Math.random() * 1000);
  const child = spawn(process.execPath, [path.join(__dirname, "server.js")], {
    cwd: __dirname,
    env: {
      ...process.env,
      NODE_ENV: "production",
      DEMO_STORAGE: "memory",
      PORT: String(port),
    },
    stdio: ["ignore", "pipe", "pipe"],
  });
  let serverOutput = "";
  child.stdout.on("data", (chunk) => { serverOutput += chunk.toString(); });
  child.stderr.on("data", (chunk) => { serverOutput += chunk.toString(); });

  let timer;
  const timeout = new Promise((_, reject) => {
    timer = setTimeout(() => {
      child.kill();
      reject(new Error("production server did not reject in-memory storage"));
    }, 5000);
  });
  try {
    const [exitCode] = await Promise.race([once(child, "exit"), timeout]);
    assert.equal(exitCode, 1, serverOutput);
    assert.match(serverOutput, /DEMO_STORAGE=memory is disabled in production/);
  } finally {
    clearTimeout(timer);
  }
});

test("MongoDB TLS verification cannot be disabled in the URI", async () => {
  const port = 7000 + Math.floor(Math.random() * 1000);
  const child = spawn(process.execPath, [path.join(__dirname, "server.js")], {
    cwd: __dirname,
    env: {
      ...process.env,
      NODE_ENV: "development",
      DEMO_STORAGE: "",
      MONGODB_URI: "mongodb+srv://cluster.example/demo?tlsAllowInvalidCertificates=true",
      PORT: String(port),
    },
    stdio: ["ignore", "pipe", "pipe"],
  });
  let serverOutput = "";
  child.stdout.on("data", (chunk) => { serverOutput += chunk.toString(); });
  child.stderr.on("data", (chunk) => { serverOutput += chunk.toString(); });

  let timer;
  const timeout = new Promise((_, reject) => {
    timer = setTimeout(() => {
      child.kill();
      reject(new Error("MongoDB TLS validation was not enforced"));
    }, 5000);
  });
  try {
    const [exitCode] = await Promise.race([once(child, "exit"), timeout]);
    assert.equal(exitCode, 1, serverOutput);
    assert.match(serverOutput, /certificate validation cannot be disabled/);
  } finally {
    clearTimeout(timer);
  }
});
