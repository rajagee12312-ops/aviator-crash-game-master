import React from "react";
// import { useCrashContext } from "../Main/context";
import { FiChevronLeft, FiChevronRight } from "react-icons/fi";
import AllData from "./all-data";
import MyBets from "./my-bets";
import TopHistory from "./top-history";
import Context from "../../context";
import { BettedUserType } from "../../utils/interfaces";
import { formatPKR } from "../../utils/currency";
import { getSimulatedPlayerCount, getSimulatedRoundWagers } from "../../utils/simulated-activity";

export default function BetsUsers() {
  const {
    previousHand,
    bettedUsers,
    getMyBets,
    history,
    roundId,
    GameState,
    currentNum,
  } = React.useContext(Context);
  const [headerType, setHeaderType] = React.useState("all");
  const [allData, setAllData] = React.useState<BettedUserType[]>([]);
  const [pre, setPre] = React.useState(false);
  const [collapsed, setCollapsed] = React.useState(false);

  const header = [
    { type: "all", value: "All Bets" },
    { type: "my", value: "My Bets", onClick: "myBet" },
    { type: "cashouts", value: "Cashouts" },
    { type: "players", value: "Players" },
    { type: "history", value: "History" },
  ];

  const getData = (e) => {
    if (e === "myBet") getMyBets();
  };

  React.useEffect(() => {
    setAllData(pre ? previousHand : bettedUsers);
  }, [pre, bettedUsers, previousHand]);

  const totalBet = allData.reduce((total, bet) => total + Number(bet.betAmount || 0), 0);
  const playerCount = new Set(allData.map((bet) => bet.playerId || bet.name)).size;
  const currentRoundId = Number(roundId) || 1000;
  const currentRoundComplete = ["CRASHED", "NEXT ROUND", "WAITING"].includes(GameState);
  const simulatedRoundId = pre
    ? Math.max(1000, currentRoundId - (currentRoundComplete ? 0 : 1))
    : currentRoundId;
  const simulatedFinalMultiplier = pre
    ? history[0]
    : currentRoundComplete && history.length > 0
      ? history[0]
      : undefined;
  const simulatedRows = React.useMemo(
    () => getSimulatedRoundWagers(
      simulatedRoundId,
      pre ? "CRASHED" : GameState,
      Number(currentNum) || 1,
      simulatedFinalMultiplier
    ),
    [currentNum, GameState, pre, simulatedFinalMultiplier, simulatedRoundId]
  );
  const simulatedPlayerCount = getSimulatedPlayerCount(simulatedRoundId);
  const visibleData = headerType === "cashouts"
    ? allData.filter((bet) => bet.cashouted)
    : headerType === "players"
      ? allData.filter((bet) => !bet.cashouted && !bet.resolved)
    : allData;
  const visibleSimulatedRows = headerType === "cashouts"
    ? simulatedRows.filter((bet) => bet.cashouted)
    : headerType === "players"
      ? simulatedRows.filter((bet) => !bet.cashouted && !bet.resolved)
      : simulatedRows;
  const sectionTitle = header.find((item) => item.type === headerType)?.value || "All Bets";

  return (
    <div className={`info-board ${collapsed ? "collapsed" : ""}`}>
      <div className="bets-block">
        <div className="bets-sidebar-header">
          {!collapsed && <h2>{sectionTitle}</h2>}
          <button
            aria-label={collapsed ? "Expand bets sidebar" : "Collapse bets sidebar"}
            className="bets-collapse-button"
            onClick={() => setCollapsed((value) => !value)}
            type="button"
          >
            {collapsed ? <FiChevronRight aria-hidden="true" /> : <FiChevronLeft aria-hidden="true" />}
          </button>
        </div>
        {!collapsed && (
          <>
            <div className="bets-summary">
              <div><span>Total bet</span><strong>{formatPKR(totalBet)}</strong></div>
              <div><span>Players</span><strong>{playerCount}</strong></div>
              <div className="simulated-activity-summary" role="note">
                <span>Simulated players</span>
                <strong>{simulatedPlayerCount}</strong>
                <small>Demo activity only; excluded from totals.</small>
              </div>
              <button
                className={`previous-hand-button ${pre ? "selected" : ""}`}
                onClick={() => setPre((value) => !value)}
                type="button"
              >
                {pre ? "Previous hand" : "Current round"}
              </button>
            </div>
            <div className="bet-block-nav">
            <div className="navigation-switcher">
              {header.map((item, index) => (
                <button
                  key={item.type}
                  className={`tab ${headerType === item.type ? "click" : ""}`}
                  onClick={() => {
                    setHeaderType(item.type);
                    item.onClick && getData(item.onClick);
                  }}
                  type="button"
                >
                  {item.value}
                </button>
              ))}
            </div>
          </div>
            <div className="data-list">
              {headerType === "all" || headerType === "cashouts" || headerType === "players" ? (
                <AllData
                  allData={visibleData}
                  simulatedRows={visibleSimulatedRows}
                  emptyMessage={headerType === "cashouts"
                    ? "No cashouts yet."
                    : headerType === "players"
                      ? "No active wagers right now."
                      : "No connected-player wagers yet."}
                />
              ) : headerType === "my" ? (
                <MyBets />
              ) : (
                <TopHistory />
              )}
            </div>
          </>
        )}
        {/* <div className="bets-footer">
          <div className="provably-fair-block">
            <span>This game is </span>
            <div className="provably-fair">
              <div className="i-fair"></div>
              <span className="text-provably-fair">Provably Fair</span>
            </div>
          </div>
          <div className="logo-block">
            <span>Powered by</span>
            <a target="_blank" href="https://spribe.co" rel="noreferrer">
              <div className="i-logo"></div>
            </a>
          </div>
        </div> */}
      </div>
    </div>
  );
}
