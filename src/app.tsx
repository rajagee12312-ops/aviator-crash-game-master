import React from "react";
import {
  FiArrowUpRight,
  FiChevronRight,
  FiCircle,
  FiCompass,
  FiCreditCard,
  FiGrid,
  FiHeadphones,
  FiHome,
  FiLayers,
  FiLogOut,
  FiShield,
  FiTarget,
  FiTrendingUp,
  FiUser,
  FiZap,
} from "react-icons/fi";
import { toast } from "react-toastify";
import AccountPage, { AccountMode } from "./components/Account";
import WalletPage from "./components/Wallet";
import BetsUsers from "./components/bet-users";
import Header from "./components/header";
import Main from "./components/Main";
import Context, { reconnectSocketSession } from "./context";
import rocket from "./assets/images/rocket5.gif";
import { ApiRequestError, apiRequest } from "./utils/api";
import {
  DemoAccount,
  GameStatusType,
  UserType,
  init_userInfo,
} from "./utils/interfaces";
import { formatPKR } from "./utils/currency";
import "./lobby.scss";

type AppPage = "home" | "game" | "wallet" | "login" | "register" | "profile" | "support";
type GameCategory = "All" | "Crash" | "Cards" | "Instant";

interface GameCardData {
  id: string;
  name: string;
  description: string;
  category: Exclude<GameCategory, "All">;
  payout: string;
  accent: string;
  icon: React.ReactNode;
  playable?: boolean;
}

const gameCards: GameCardData[] = [
  {
    id: "aviator",
    name: "Aviator",
    description: "Track the flight and cash out before the crash.",
    category: "Crash",
    payout: "Live round",
    accent: "coral",
    icon: <FiTrendingUp aria-hidden="true" />,
    playable: true,
  },
  {
    id: "dice",
    name: "Dice 3D",
    description: "Pick a range and roll for a quick result.",
    category: "Instant",
    payout: "Preview",
    accent: "blue",
    icon: <FiTarget aria-hidden="true" />,
  },
  {
    id: "coin-flip",
    name: "Coin Flip",
    description: "Heads or tails. One simple call.",
    category: "Instant",
    payout: "Preview",
    accent: "gold",
    icon: <FiCircle aria-hidden="true" />,
  },
  {
    id: "limbo",
    name: "Limbo",
    description: "Set a target and see where the round lands.",
    category: "Instant",
    payout: "Preview",
    accent: "violet",
    icon: <FiZap aria-hidden="true" />,
  },
  {
    id: "hi-lo",
    name: "Hi-Lo",
    description: "Read the next card and choose a direction.",
    category: "Cards",
    payout: "Preview",
    accent: "mint",
    icon: <FiLayers aria-hidden="true" />,
  },
  {
    id: "mines",
    name: "Mines",
    description: "Choose your path through a field of tiles.",
    category: "Instant",
    payout: "Preview",
    accent: "orange",
    icon: <FiGrid aria-hidden="true" />,
  },
  {
    id: "dragon-tower",
    name: "Dragon Tower",
    description: "Climb one level at a time in this preview.",
    category: "Instant",
    payout: "Preview",
    accent: "red",
    icon: <FiCompass aria-hidden="true" />,
  },
  {
    id: "plinko",
    name: "Plinko",
    description: "Drop a puck through a field of pegs.",
    category: "Instant",
    payout: "Preview",
    accent: "cyan",
    icon: <FiTarget aria-hidden="true" />,
  },
  {
    id: "andar-bahar",
    name: "Andar Bahar",
    description: "A classic card-table format, coming soon.",
    category: "Cards",
    payout: "Preview",
    accent: "violet",
    icon: <FiLayers aria-hidden="true" />,
  },
  {
    id: "keno",
    name: "Keno",
    description: "Choose numbers for a quick draw preview.",
    category: "Instant",
    payout: "Preview",
    accent: "blue",
    icon: <FiGrid aria-hidden="true" />,
  },
];

interface LobbyProps {
  balance: number;
  gameState: GameStatusType;
  playerName: string;
  signedIn: boolean;
  onNavigate: (page: AppPage) => void;
  onPlay: () => void;
  onLogout: () => void;
}

function Lobby({
  balance,
  gameState,
  playerName,
  signedIn,
  onNavigate,
  onPlay,
  onLogout,
}: LobbyProps) {
  const [category, setCategory] = React.useState<GameCategory>("All");
  const roundIsLive = gameState.GameState === "FLYING";
  const visibleGames = gameCards.filter(
    (game) => category === "All" || game.category === category
  );
  const multiplier = roundIsLive
    ? `${Number(gameState.currentNum).toFixed(2)}×`
    : "1.00×";

  const openGame = (game: GameCardData) => {
    if (game.playable) {
      onPlay();
      return;
    }
    toast.info(`${game.name} is a lobby preview. Aviator is ready to play.`);
  };

  return (
    <div className="lobby-shell">
      <header className="lobby-header">
        <button
          aria-label="Aviator Crash home"
          className="brand-lockup"
          onClick={() => onNavigate("home")}
          type="button"
        >
          <span className="brand-mark">AC</span>
          <span className="brand-wordmark">AVIATOR <b>CRASH</b></span>
        </button>

        <nav aria-label="Main navigation" className="desktop-nav">
          <button className="selected" onClick={() => onNavigate("home")} type="button">Lobby</button>
          <button onClick={() => onNavigate("home")} type="button">Games</button>
          <button onClick={() => onNavigate("support")} type="button">Support</button>
        </nav>

        <div className="header-account">
          <button
            className="header-wallet"
            onClick={() => onNavigate("wallet")}
            type="button"
          >
            <FiCreditCard aria-hidden="true" />
            <span>{formatPKR(balance)}</span>
          </button>
          {signedIn ? (
            <>
              <button
                className="profile-chip"
                onClick={() => onNavigate("profile")}
                type="button"
              >
                <span className="profile-avatar">{playerName.slice(0, 1).toUpperCase()}</span>
                <span>{playerName}</span>
              </button>
              <button aria-label="Sign out" className="icon-button signout-button" onClick={onLogout} type="button">
                <FiLogOut aria-hidden="true" />
              </button>
            </>
          ) : (
            <>
              <button className="header-login" onClick={() => onNavigate("login")} type="button">Log in</button>
              <button className="header-register" onClick={() => onNavigate("register")} type="button">Create account</button>
            </>
          )}
        </div>
      </header>

      <main className="lobby-content">
        <div className="welcome-row">
          <div>
            <p className="eyebrow">THE AVIATOR CRASH LOBBY</p>
            <h1>Find your next <span>flight.</span></h1>
            <p className="welcome-copy">A crash arcade built around an Aviator-style flight.</p>
          </div>
          <div className="welcome-tag"><FiShield aria-hidden="true" /> VIRTUAL CREDITS · NO REAL PAYMENTS</div>
        </div>

        <section aria-label="Featured game: Aviator" className="featured-game">
          <div className="featured-grid">
            <div className="featured-copy">
              <div className="featured-status">
                <span className="featured-tag">FEATURED GAME</span>
                <span className={`round-indicator ${roundIsLive ? "active" : ""}`}>
                  <i /> {roundIsLive ? "ROUND LIVE" : "NEXT ROUND"}
                </span>
              </div>
              <h2>Aviator</h2>
              <p>Watch the flight climb. Cash out before the round ends.</p>
              <div className="featured-multiplier">
                <strong>{multiplier}</strong>
                <span>{roundIsLive ? "CURRENT MULTIPLIER" : "NEXT ROUND"}</span>
              </div>
              <button className="primary-play" onClick={onPlay} type="button">
                <FiTrendingUp aria-hidden="true" />
                Play Aviator
                <FiArrowUpRight aria-hidden="true" />
              </button>
            </div>
            <div className="flight-art" aria-hidden="true">
              <div className="flight-orbit orbit-one" />
              <div className="flight-orbit orbit-two" />
              <div className="flight-path" />
              <div className="flight-glow" />
              <img src={rocket} alt="" />
              <span className="flight-art-label">AC / 01</span>
            </div>
          </div>
          <div className="featured-foot">
            <span><i className="status-dot" /> Real-time rounds</span>
            <span>Original game · Original sounds</span>
          </div>
        </section>

        <section aria-label="Virtual wallet summary" className="wallet-teaser">
          <div className="wallet-teaser-icon"><FiCreditCard aria-hidden="true" /></div>
          <div className="wallet-teaser-copy">
            <span>YOUR PRACTICE WALLET</span>
            <strong>{formatPKR(balance)} <small>credits</small></strong>
          </div>
          <p>Use virtual credits only. No payments or payouts are connected.</p>
          <div className="wallet-teaser-actions">
            <button onClick={() => onNavigate("wallet")} type="button">Open wallet <FiChevronRight aria-hidden="true" /></button>
          </div>
        </section>

        <section aria-labelledby="games-title" className="games-section">
          <div className="games-heading">
            <div>
              <p className="eyebrow">PICK A GAME</p>
              <h2 id="games-title">The game room</h2>
            </div>
            <span className="game-count">{gameCards.length} games in the arcade</span>
          </div>

          <div aria-label="Game categories" className="game-filters" role="tablist">
            {(["All", "Crash", "Cards", "Instant"] as GameCategory[]).map((item) => (
              <button
                aria-selected={category === item}
                className={category === item ? "active" : ""}
                key={item}
                onClick={() => setCategory(item)}
                role="tab"
                type="button"
              >
                {item}
              </button>
            ))}
          </div>

          <div className="game-grid">
            {visibleGames.map((game) => (
              <button
                className={`game-tile accent-${game.accent} ${game.playable ? "game-ready" : ""}`}
                key={game.id}
                onClick={() => openGame(game)}
                type="button"
              >
                <span className="game-tile-top">
                  <span className="game-icon">{game.icon}</span>
                  <span className={`game-state ${game.playable ? "ready" : ""}`}>
                    {game.playable ? "PLAYABLE" : "COMING SOON"}
                  </span>
                </span>
                <span className="game-tile-title">{game.name}</span>
                <span className="game-tile-description">{game.description}</span>
                <span className="game-tile-bottom">
                  <span>{game.category}</span>
                  <span>{game.payout}<FiChevronRight aria-hidden="true" /></span>
                </span>
              </button>
            ))}
          </div>
        </section>

        <section className="lobby-safety">
          <FiShield aria-hidden="true" />
          <p><strong>Practice play only.</strong> Credits have no cash value. No deposits, withdrawals, or payment services move real money.</p>
          <button onClick={() => onNavigate("support")} type="button">About virtual credits <FiChevronRight aria-hidden="true" /></button>
        </section>
      </main>

      <nav aria-label="Mobile navigation" className="mobile-bottom-nav">
        <button className="active" onClick={() => onNavigate("home")} type="button"><FiHome /><span>Home</span></button>
        <button onClick={() => onNavigate("wallet")} type="button"><FiCreditCard /><span>Wallet</span></button>
        <button className="mobile-play" onClick={onPlay} type="button"><FiTrendingUp /><span>Play</span></button>
        <button onClick={() => onNavigate("support")} type="button"><FiHeadphones /><span>Support</span></button>
        <button onClick={() => onNavigate("profile")} type="button"><FiUser /><span>Profile</span></button>
      </nav>
    </div>
  );
}

interface PlayerPageProps {
  account: DemoAccount | null;
  onBack: () => void;
  onLogin: () => void;
  onLogout: () => void;
  onWallet: () => void;
}

function ProfilePage({ account, onBack, onLogin, onLogout, onWallet }: PlayerPageProps) {
  return (
    <main className="info-page">
      <button className="info-back" onClick={onBack} type="button">← Back to lobby</button>
      <section className="info-card">
        <div className="profile-large-avatar">{account?.username.slice(0, 1).toUpperCase() || <FiUser />}</div>
        <p className="eyebrow">PLAYER PROFILE</p>
        <h1>{account ? account.username : "Guest player"}</h1>
        <p>{account ? account.email : "You are playing with a temporary virtual balance."}</p>
        <div className="profile-balance"><span>Virtual wallet balance</span><strong>{(account?.balance ?? 1000).toFixed(2)} credits</strong></div>
        <div className="profile-actions">
          <button className="primary-play" onClick={account ? onWallet : onLogin} type="button">
            {account ? "Open wallet" : "Sign in or create account"}
          </button>
          {account && <button className="secondary-action" onClick={onLogout} type="button">Sign out <FiLogOut /></button>}
        </div>
        <small>Virtual credits have no cash value.</small>
      </section>
    </main>
  );
}

function SupportPage({ onBack }: { onBack: () => void }) {
  return (
    <main className="info-page">
      <button className="info-back" onClick={onBack} type="button">← Back to lobby</button>
      <section className="support-intro">
        <span className="support-icon"><FiHeadphones /></span>
        <p className="eyebrow">PLAYER HELP</p>
        <h1>Game support</h1>
        <p>Quick answers about the Aviator Crash practice arcade.</p>
      </section>
      <section aria-label="Frequently asked questions" className="support-faq">
        <details>
          <summary>Are the wallet credits real money?</summary>
          <p>No. Credits are virtual and have no cash value. No payment or payout services are connected.</p>
        </details>
        <details>
          <summary>Which game is playable?</summary>
          <p>Aviator is connected to the real-time game server. Other tiles are previews for future game modes.</p>
        </details>
        <details>
          <summary>Will my account and wallet stay forever?</summary>
          <p>Registered accounts and wallets persist when MongoDB is configured. Local fallback mode without MONGODB_URI stores them in server memory and resets on restart.</p>
        </details>
        <details>
          <summary>How do I keep playing as a guest?</summary>
          <p>Return to the lobby and choose Play Aviator. A virtual balance is available without signing in.</p>
        </details>
      </section>
    </main>
  );
}

function GameRoom({
  onLobby,
  onWallet,
}: {
  onLobby: () => void;
  onWallet: () => void;
}) {
  const { rechargeState, errorBackend, clearRechargeState } = React.useContext(Context);

  return (
    <div className="main-container">
      {errorBackend && (
        <div className="game-connection-alert" role="status">
          Connection to the game server was lost. Reconnecting...
        </div>
      )}
      {rechargeState && (
        <div className="recharge credit-recharge">
          <div aria-labelledby="credit-recharge-title" aria-modal="true" className="recharge-body" role="dialog">
            <button aria-label="Close virtual balance notice" className="credit-recharge-close" onClick={clearRechargeState} type="button">×</button>
            <div className="recharge-body-font" id="credit-recharge-title">Virtual credits are low</div>
            <p>This game uses virtual credits only. No payment is needed.</p>
            <button className="credit-recharge-button" onClick={() => {
              clearRechargeState();
              onWallet();
            }} type="button">
              Open wallet
            </button>
          </div>
        </div>
      )}
      <Header onLobby={onLobby} onWallet={onWallet} />
      <div className="game-container">
        <BetsUsers />
        <Main />
      </div>
    </div>
  );
}

function updateContextUser(updateUserInfo: (attrs: Partial<UserType>) => void, user: DemoAccount, token: string) {
  updateUserInfo({
    balance: user.balance,
    userName: user.username,
    userId: user.id,
    token,
    Session_Token: token,
  });
}

function resetContextUser(
  updateUserInfo: (attrs: Partial<UserType>) => void,
  update: (attrs: { userInfo: UserType }) => void
) {
  const guestUser: UserType = {
    ...init_userInfo,
    balance: 1000,
    userName: "Guest Player",
    f: { ...init_userInfo.f },
    s: { ...init_userInfo.s },
  };
  updateUserInfo(guestUser);
  update({ userInfo: guestUser });
}

function App() {
  const {
    userInfo,
    updateUserInfo,
    update,
    currentNum,
    currentSecondNum,
    GameState,
    time,
    durationMs,
    roundId,
  } = React.useContext(Context);
  const gameState: GameStatusType = {
    currentNum,
    currentSecondNum,
    GameState,
    time,
    durationMs,
    roundId,
  };
  const [page, setPage] = React.useState<AppPage>("home");
  const [account, setAccount] = React.useState<DemoAccount | null>(null);
  const [sessionToken, setSessionToken] = React.useState<string | null>(() =>
    window.sessionStorage.getItem("aviator.demo-session")
  );
  const updateUserInfoRef = React.useRef(updateUserInfo);
  updateUserInfoRef.current = updateUserInfo;
  const updateStateRef = React.useRef(update);
  updateStateRef.current = update;
  const gameUserInfoRef = React.useRef(userInfo);
  gameUserInfoRef.current = userInfo;

  React.useEffect(() => {
    if (!sessionToken) return;
    let active = true;
    apiRequest<{ user: DemoAccount }>("/auth/me", {
      headers: { Authorization: `Bearer ${sessionToken}` },
    })
      .then((result) => {
        if (active) {
          setAccount(result.user as DemoAccount);
          updateContextUser(updateUserInfoRef.current, result.user as DemoAccount, sessionToken);
        }
      })
      .catch((requestError: unknown) => {
        if (!active) return;
        if (requestError instanceof ApiRequestError && requestError.status === 401) {
          window.sessionStorage.removeItem("aviator.demo-session");
          setSessionToken(null);
          setAccount(null);
          resetContextUser(updateUserInfoRef.current, updateStateRef.current);
          reconnectSocketSession(null);
          toast.info("Your account session expired. Please sign in again.");
          return;
        }
        toast.error(
          requestError instanceof Error
            ? requestError.message
            : "Could not verify the account session."
        );
      });
    return () => {
      active = false;
    };
  }, [sessionToken]);

  React.useEffect(() => {
    setAccount((previous) =>
      previous && previous.balance !== userInfo.balance
        ? { ...previous, balance: userInfo.balance }
        : previous
    );
  }, [userInfo.balance]);

  const updateAccountBalance = React.useCallback((balance: number) => {
    setAccount((previous) => previous ? { ...previous, balance } : previous);
    updateUserInfoRef.current({ balance });
    updateStateRef.current({
      userInfo: { ...gameUserInfoRef.current, balance },
    });
  }, []);

  const handleAuthSuccess = (user: DemoAccount, token: string) => {
    window.sessionStorage.setItem("aviator.demo-session", token);
    setSessionToken(token);
    setAccount(user);
    updateContextUser(updateUserInfoRef.current, user, token);
    reconnectSocketSession(token);
    setPage("home");
    toast.success(`Welcome, ${user.username}. Your account is ready.`);
  };

  const logout = async () => {
    if (sessionToken) {
      try {
        await apiRequest<{ status: string }>("/auth/logout", {
          method: "POST",
          headers: { Authorization: `Bearer ${sessionToken}` },
        });
      } catch {
        toast.error("Could not reach the server; this device will still sign out.");
      }
    }
    window.sessionStorage.removeItem("aviator.demo-session");
    setSessionToken(null);
    setAccount(null);
    resetContextUser(updateUserInfoRef.current, updateStateRef.current);
    reconnectSocketSession(null);
    setPage("home");
  };

  if (page === "login" || page === "register") {
    return (
      <AccountPage
        mode={page as AccountMode}
        onBack={() => setPage("home")}
        onSuccess={handleAuthSuccess}
        onSwitch={(mode) => setPage(mode)}
      />
    );
  }

  if (page === "wallet") {
    return (
      <WalletPage
        guestBalance={userInfo.balance}
        onBack={() => setPage("home")}
        onBalanceChange={updateAccountBalance}
        onLogin={() => setPage("login")}
        token={sessionToken}
        user={account}
      />
    );
  }

  if (page === "profile") {
    return (
      <ProfilePage
        account={account}
        onBack={() => setPage("home")}
        onLogin={() => setPage("login")}
        onLogout={logout}
        onWallet={() => setPage("wallet")}
      />
    );
  }

  if (page === "support") {
    return <SupportPage onBack={() => setPage("home")} />;
  }

  if (page === "game") {
    return (
      <GameRoom
        onLobby={() => setPage("home")}
        onWallet={() => setPage("wallet")}
      />
    );
  }

  return (
    <Lobby
      balance={account?.balance ?? userInfo.balance}
      gameState={gameState}
      onLogout={logout}
      onNavigate={setPage}
      onPlay={() => setPage("game")}
      playerName={account?.username || userInfo.userName || "Guest"}
      signedIn={Boolean(account)}
    />
  );
}

export default App;
