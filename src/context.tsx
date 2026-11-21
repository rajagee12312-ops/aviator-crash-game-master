/* eslint-disable react-hooks/exhaustive-deps */
import React, { useEffect } from "react";
import { UnityContext } from "react-unity-webgl";
import { io, Socket } from "socket.io-client";
import { toast } from "react-toastify";
import { config } from "./config";
import { apiRequest } from "./utils/api";
import {
  UserType,
  BettedUserType,
  GameHistory,
  ContextType,
  ContextDataType,
  MsgUserType,
  GameBetLimit,
  UserStatusType,
  GameStatusType,
  LoadingType,
  SeedDetailsType,
  unityContext as sharedUnityContext,
  init_state as sharedInitState,
  init_userInfo,
} from "./utils/interfaces";

export interface PlayerType {
  auto: boolean;
  betted: boolean;
  cashouted: boolean;
  betAmount: number;
  cashAmount: number;
  target: number;
}

const Context = React.createContext<ContextType>(null!);

let socketTokenOverride: string | null | undefined;

const socket: Socket = io(config.wss || window.location.origin, {
  auth: (callback) => {
    const savedToken = socketTokenOverride === undefined
      ? window.sessionStorage.getItem("aviator.demo-session")
      : socketTokenOverride;
    const urlToken = socketTokenOverride === undefined
      ? new URLSearchParams(window.location.search).get("cert")
      : null;
    callback({ token: savedToken || urlToken });
  },
  transports: ['websocket', 'polling'],
  autoConnect: Boolean(config.wss),
  timeout: 20000,
  forceNew: false
});

export function reconnectSocketSession(token: string | null) {
  socketTokenOverride = token;
  socket.disconnect();
  if (config.wss) socket.connect();
}

export const callCashOut = (at: number, index: "f" | "s") => {
  let data = { type: index, endTarget: at };
  socket.emit("cashOut", data);
};

let fIncreaseAmount = 0;
let fDecreaseAmount = 0;
let sIncreaseAmount = 0;
let sDecreaseAmount = 0;

let newState;
let newBetState;

export const Provider = ({ children }: any) => {
  const [state, setState] = React.useState<ContextDataType>(sharedInitState);
  const [userInfo, setUserInfo] = React.useState<UserType>(init_userInfo);
  const [msgData, setMsgData] = React.useState<MsgUserType[]>([]);
  const [msgTab, setMsgTab] = React.useState<boolean>(false);
  const [msgReceived, setMsgReceived] = React.useState<boolean>(false);
  const [platformLoading, setPlatformLoading] = React.useState<boolean>(false);
  const [errorBackend, setErrorBackend] = React.useState<boolean>(!config.backendUrl);
  const [secure, setSecure] = React.useState<boolean>(false);
  const [userSeedText, setUserSeedText] = React.useState<string>("");
  const [globalUserInfo, setGlobalUserInfo] = React.useState<UserType>(init_userInfo);
  const [fLoading, setFLoading] = React.useState<boolean>(false);
  const [sLoading, setSLoading] = React.useState<boolean>(false);

  newState = state;
  const [unity, setUnity] = React.useState({
    unityState: false,
    unityLoading: false,
    currentProgress: 0,
  });
  const [gameState, setGameState] = React.useState<GameStatusType>({
    currentNum: "0",
    currentSecondNum: 0,
    GameState: "WAITING",
    time: 0,
    durationMs: 1000,
    roundId: 1000,
  });

  const [bettedUsers, setBettedUsers] = React.useState<BettedUserType[]>([]);
  const update = (attrs: Partial<ContextDataType>) => {
    setState((previous) => ({ ...previous, ...attrs }));
  };
  const [previousHand, setPreviousHand] = React.useState<BettedUserType[]>([]);
  const [history, setHistory] = React.useState<number[]>([]);
  const [userBetState, setUserBetState] = React.useState<UserStatusType>({
    fbetState: false,
    fbetted: false,
    sbetState: false,
    sbetted: false,
  });
  newBetState = userBetState;
  const [rechargeState, setRechargeState] = React.useState(false);
  const [currentTarget, setCurrentTarget] = React.useState(0);
  const updateUserBetState = (attrs: Partial<UserStatusType>) => {
    setUserBetState((previous) => ({ ...previous, ...attrs }));
  };

  const [betLimit, setBetLimit] = React.useState<GameBetLimit>({
    maxBet: 1000,
    minBet: 1,
  });
  React.useEffect(function () {
    // Unity loading event handlers
    sharedUnityContext.on("loaded", () => {
      console.log("✅ Unity WebGL loaded successfully");
      setUnity({
        currentProgress: 100,
        unityLoading: true,
        unityState: true,
      });
    });

    sharedUnityContext.on("error", (error) => {
      console.error("🔴 Unity WebGL error:", error);
      setUnity({
        currentProgress: 0,
        unityLoading: false,
        unityState: false,
      });
    });

    sharedUnityContext.on("GameController", function (message) {
      console.log("🎮 Unity message:", message);
      if (message === "Ready") {
        setUnity({
          currentProgress: 100,
          unityLoading: true,
          unityState: true,
        });
      }
    });

    sharedUnityContext.on("progress", (progression) => {
      const currentProgress = progression * 100;
      console.log(`📊 Unity loading progress: ${currentProgress.toFixed(1)}%`);
      if (progression === 1) {
        setUnity({ currentProgress, unityLoading: true, unityState: true });
      } else {
        setUnity({ currentProgress, unityLoading: false, unityState: false });
      }
    });

    return () => sharedUnityContext.removeAllEventListeners();
  }, []);

  React.useEffect(() => {
    // Socket connection event handlers
    socket.on("connect", () => {
      console.log("✅ Connected to backend server");
      setErrorBackend(false);
      socket.emit("enterRoom");
    });

    socket.on("disconnect", () => {
      console.log("❌ Disconnected from backend server");
      setErrorBackend(true);
    });

    socket.on("connect_error", (error) => {
      console.error("🔴 Connection error:", error);
      setErrorBackend(true);
    });

    socket.on("bettedUserInfo", (bettedUsers: BettedUserType[]) => {
      setBettedUsers(bettedUsers);
    });

    socket.on("myBetState", (user: UserType) => {
      setUserBetState((previous) => ({
        ...previous,
        fbetState: false,
        fbetted: user.f.betted,
        sbetState: false,
        sbetted: user.s.betted,
      }));
    });

    socket.on("myInfo", (user: UserType) => {
      setUserInfo(user);
      setState((previous) => ({
        ...previous,
        userInfo: {
          ...previous.userInfo,
          ...user,
          f: { ...previous.userInfo.f, ...user.f },
          s: { ...previous.userInfo.s, ...user.s },
        },
      }));
    });

    socket.on("history", (history: any) => {
      setHistory(history);
    });

    socket.on("myBets", (myBets: GameHistory[]) => {
      update({ myBets });
    });

    socket.on("gameState", (gameState: GameStatusType) => {
      setGameState(gameState);
    });

    socket.on("previousHand", (previousHand: BettedUserType[]) => {
      setPreviousHand(previousHand);
    });

    socket.on("finishGame", (user: UserType) => {
      let attrs = newState;
      let fauto = attrs.userInfo.f.auto;
      let sauto = attrs.userInfo.s.auto;
      let fbetAmount = attrs.userInfo.f.betAmount;
      let sbetAmount = attrs.userInfo.s.betAmount;
      let betStatus = newBetState;
      attrs.userInfo = user;
      attrs.userInfo.f.betAmount = fbetAmount;
      attrs.userInfo.s.betAmount = sbetAmount;
      attrs.userInfo.f.auto = fauto;
      attrs.userInfo.s.auto = sauto;
      if (!user.f.betted) {
        betStatus.fbetted = false;
        if (attrs.userInfo.f.auto) {
          if (user.f.cashouted) {
            fIncreaseAmount += user.f.cashAmount;
            if (attrs.finState && attrs.fincrease - fIncreaseAmount <= 0) {
              attrs.userInfo.f.auto = false;
              betStatus.fbetState = false;
              fIncreaseAmount = 0;
            } else if (
              attrs.fsingle &&
              attrs.fsingleAmount <= user.f.cashAmount
            ) {
              attrs.userInfo.f.auto = false;
              betStatus.fbetState = false;
            } else {
              attrs.userInfo.f.auto = true;
              betStatus.fbetState = true;
            }
          } else {
            fDecreaseAmount += user.f.betAmount;
            if (attrs.fdeState && attrs.fdecrease - fDecreaseAmount <= 0) {
              attrs.userInfo.f.auto = false;
              betStatus.fbetState = false;
              fDecreaseAmount = 0;
            } else {
              attrs.userInfo.f.auto = true;
              betStatus.fbetState = true;
            }
          }
        }
      }
      if (!user.s.betted) {
        betStatus.sbetted = false;
        if (user.s.auto) {
          if (user.s.cashouted) {
            sIncreaseAmount += user.s.cashAmount;
            if (attrs.sinState && attrs.sincrease - sIncreaseAmount <= 0) {
              attrs.userInfo.s.auto = false;
              betStatus.sbetState = false;
              sIncreaseAmount = 0;
            } else if (
              attrs.ssingle &&
              attrs.ssingleAmount <= user.s.cashAmount
            ) {
              attrs.userInfo.s.auto = false;
              betStatus.sbetState = false;
            } else {
              attrs.userInfo.s.auto = true;
              betStatus.sbetState = true;
            }
          } else {
            sDecreaseAmount += user.s.betAmount;
            if (attrs.sdeState && attrs.sdecrease - sDecreaseAmount <= 0) {
              attrs.userInfo.s.auto = false;
              betStatus.sbetState = false;
              sDecreaseAmount = 0;
            } else {
              attrs.userInfo.s.auto = true;
              betStatus.sbetState = true;
            }
          }
        }
      }
      update(attrs);
      setUserInfo(user);
      setUserBetState(betStatus);
    });

    socket.on("getBetLimits", (betAmounts: { max: number; min: number }) => {
      setBetLimit({ maxBet: betAmounts.max, minBet: betAmounts.min });
    });

    socket.on("recharge", () => {
      setRechargeState(true);
    });

    socket.on("error", (data) => {
      if (!data.alreadyPlaced) {
        setUserBetState((previous) => ({
          ...previous,
          [`${data.index}betState`]: false,
          [`${data.index}betted`]: false,
        }));
      }
      toast.error(data.message);
    });

    socket.on("success", (data) => {
      toast.success(data);
    });
    if (socket.connected) socket.emit("enterRoom");
    return () => {
      socket.off("connect");
      socket.off("disconnect");
      socket.off("myBetState");
      socket.off("myInfo");
      socket.off("history");
      socket.off("myBets");
      socket.off("gameState");
      socket.off("previousHand");
      socket.off("finishGame");
      socket.off("getBetLimits");
      socket.off("recharge");
      socket.off("error");
      socket.off("success");
    };
  }, [socket]);

  React.useEffect(() => {
    if (gameState.GameState !== "COUNTDOWN") return;

    (["f", "s"] as const).forEach((side) => {
      const betStateKey = `${side}betState` as "fbetState" | "sbetState";
      const bettedKey = `${side}betted` as "fbetted" | "sbetted";
      if (!userBetState[betStateKey]) return;

      const bet = state.userInfo[side];
      const autoCount = side === "f" ? state.fautoCound : state.sautoCound;
      if (bet.auto && autoCount <= 0) {
        update({
          userInfo: {
            ...state.userInfo,
            [side]: { ...bet, auto: false },
          },
        });
        updateUserBetState({ [betStateKey]: false });
        return;
      }

      const amount = Number(bet.betAmount);
      if (!Number.isFinite(amount) || amount < betLimit.minBet || amount > betLimit.maxBet) {
        updateUserBetState({ [betStateKey]: false });
        toast.error(`Enter a bet between ${betLimit.minBet} and ${betLimit.maxBet} PKR`);
        return;
      }
      if (amount > state.userInfo.balance) {
        updateUserBetState({ [betStateKey]: false });
        toast.error("Your PKR balance is not enough");
        return;
      }

      if (bet.auto) {
        update(side === "f"
          ? { fautoCound: autoCount - 1 }
          : { sautoCound: autoCount - 1 });
      }
      socket.emit("playBet", {
        betAmount: amount,
        target: bet.target,
        type: side,
        auto: bet.auto,
        autocashout: bet.autocashout,
      });
      updateUserBetState({
        [betStateKey]: false,
        [bettedKey]: true,
      });
    });
  }, [gameState.GameState, userBetState.fbetState, userBetState.sbetState]);

  const getMyBets = () => {
    socket.emit("getMyBets");
  };

  useEffect(() => {
    if (gameState.GameState === "COUNTDOWN") getMyBets();
  }, [gameState.GameState]);

  const updateUserInfo = (attrs: Partial<UserType>) => {
    setUserInfo((prev) => ({ ...prev, ...attrs }));
  };
  const handleGetSeed = () => {/* implement or stub */};
  const handleGetSeedOfRound = async (id: number): Promise<SeedDetailsType> => {
    return apiRequest<SeedDetailsType>(`/game/seed/${id}`, {
      headers: { Authorization: `Bearer ${userInfo.token}` },
    });
  };
  const handlePlaceBet = () => {/* implement or stub */};
  const toggleMsgTab = () => setMsgTab((prev) => !prev);
  const handleChangeUserSeed = (seed: string) => {/* implement or stub */};

  return (
    <Context.Provider
      value={{
        ...state,
        ...gameState,
        ...userBetState,
        ...betLimit,
        userInfo,
        state, // add state for consumers expecting state
        socket,
        msgData,
        msgTab,
        msgReceived,
        setMsgReceived,
        platformLoading,
        errorBackend,
        unityState: unity.unityState,
        unityLoading: unity.unityLoading,
        currentProgress: unity.currentProgress,
        globalUserInfo,
        bettedUsers,
        previousHand,
        history,
        rechargeState,
        clearRechargeState: () => setRechargeState(false),
        secure,
        myUnityContext: sharedUnityContext,
        userSeedText,
        currentTarget,
        fLoading,
        setFLoading,
        sLoading,
        setSLoading,
        setCurrentTarget,
        update: (attrs) => setState((prev) => ({ ...prev, ...attrs })),
        updateUserInfo,
        getMyBets,
        updateUserBetState,
        setMsgData,
        handleGetSeed,
        handleGetSeedOfRound,
        handlePlaceBet,
        toggleMsgTab,
        handleChangeUserSeed,
      }}
    >
      {children}
    </Context.Provider>
  );
};

export default Context;
