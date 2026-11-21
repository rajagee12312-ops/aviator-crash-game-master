import React from "react";
import Context from "../../context";

const RoundHistory = () => {
  const { history, roundId, GameState } = React.useContext(Context);
  const currentRoundIsComplete = ["CRASHED", "NEXT ROUND", "WAITING"].includes(GameState);
  const newestRoundId = (Number(roundId) || 1000) - (currentRoundIsComplete ? 0 : 1);

  return (
    <div className="round-history-list" aria-label="Completed round history">
      {history.length ? history.map((value, index) => {
        const multiplier = Number(value);
        const tier = multiplier < 2 ? "low" : multiplier <= 10 ? "mid" : "high";
        return (
          <div className="round-history-row" key={`${newestRoundId - index}-${value}`}>
            <span>ROUND #{newestRoundId - index}</span>
            <strong className={`round-history-badge ${tier}`}>{multiplier.toFixed(2)}x</strong>
          </div>
        );
      }) : (
        <div className="bets-empty">Completed rounds will appear here.</div>
      )}
    </div>
  );
};

export default RoundHistory;
