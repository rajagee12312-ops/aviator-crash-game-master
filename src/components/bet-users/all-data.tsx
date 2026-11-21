import React from "react";
import { BettedUserType } from "../../utils/interfaces";
import { formatPKR } from "../../utils/currency";

interface AllDataProps {
  allData: BettedUserType[];
  simulatedRows: BettedUserType[];
  emptyMessage: string;
}

export default function AllData({ allData, simulatedRows, emptyMessage }: AllDataProps) {
  const renderWager = (bet: BettedUserType, index: number) => {
    const name = bet.name || "Player";
    const multiplier = bet.cashouted
      ? `${Number(bet.cashOut).toFixed(2)}x`
      : bet.resolved
        ? `${Number(bet.target).toFixed(2)}x`
        : "—";
    const profit = bet.resolved ? Number(bet.profit || 0) : null;

    return (
      <div
        className={`bets-table-row ${bet.isSimulated ? "simulated-bet-row" : ""}`}
        key={bet.id || `${bet.playerId || name}-${bet.side || index}`}
      >
        <div className="bets-player">
          <span aria-hidden="true" className="bets-avatar">{name.charAt(0).toUpperCase()}</span>
          <span className="bets-player-name" title={name}>{name}</span>
          {bet.isSimulated && <span className="simulated-bet-tag">SIM</span>}
        </div>
        <span className="bets-amount">{formatPKR(bet.betAmount)}</span>
        <span className={bet.cashouted ? "bets-multiplier won" : "bets-multiplier"}>
          {multiplier}
        </span>
        <span className={`bets-profit ${profit !== null && profit > 0 ? "positive" : ""} ${profit !== null && profit < 0 ? "negative" : ""}`}>
          {profit === null ? "—" : formatPKR(profit)}
        </span>
      </div>
    );
  };

  return (
    <div className="bets-list">
      <div className="bets-table-head">
        <span>Player</span>
        <span>Bet<br />PKR</span>
        <span>Mult.</span>
        <span>Profit<br />PKR</span>
      </div>
      <div className="bets-table-body">
        {!allData.length && <div className="bets-empty">{emptyMessage}</div>}
        {allData.map(renderWager)}
        {simulatedRows.length > 0 && (
          <>
            <div className="simulated-feed-divider">
              <strong>SIMULATED SAMPLE WAGERS</strong>
              <span>Demo sample wagers; excluded from totals.</span>
            </div>
            {simulatedRows.map(renderWager)}
          </>
        )}
      </div>
    </div>
  );
}
