import React from "react";
import Context from "../../context";
import { formatPKR } from "../../utils/currency";

const MyBets = () => {
  const { state } = React.useContext(Context);

  return (
    <div className="bets-list">
      <div className="bets-table-head my-bets-head">
        <span>Round</span>
        <span>Bet<br />PKR</span>
        <span>Outcome</span>
        <span>Profit<br />PKR</span>
      </div>
      <div className="bets-table-body">
        {state.myBets.length ? state.myBets.map((bet) => {
          const outcome = bet.cashouted
            ? `CASHED ${Number(bet.cashoutAt).toFixed(2)}x`
            : bet.resolved
              ? `CRASHED ${Number(bet.flyAway).toFixed(2)}x`
              : "PENDING";
          const profit = bet.resolved ? Number(bet.profit || 0) : null;

          return (
            <div className="bets-table-row my-bets-row" key={bet._id}>
              <span title={new Date(bet.createdAt).toLocaleString()}>
                #{bet.roundId || bet.flyDetailID}
              </span>
              <span className="bets-amount">{formatPKR(bet.betAmount)}</span>
              <span className={`bets-multiplier ${bet.cashouted ? "won" : ""}`}>
                {outcome}
              </span>
              <span className={`bets-profit ${profit !== null && profit > 0 ? "positive" : ""} ${profit !== null && profit < 0 ? "negative" : ""}`}>
                {profit === null ? "—" : formatPKR(profit)}
              </span>
            </div>
          );
        }) : (
          <div className="bets-empty">Your wagers will appear here after you bet.</div>
        )}
      </div>
    </div>
  );
};

export default MyBets;
