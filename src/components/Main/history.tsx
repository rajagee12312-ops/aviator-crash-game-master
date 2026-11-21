import React from "react";
import Context from "../../context";

export default function History() {
  const { history } = React.useContext(Context);
  const [showHistory, setShowHistory] = React.useState(false);

  return (
    <>
      <div className="history-bar" aria-label="Recent round history">
        <div className="history-content">
          <span className="history-label">RECENT</span>
          <div className="history-items-container">
            {history.slice(0, 8).map((item, key) => {
              const num = Number(item);
              const color = num < 2 ? '#00ffff' : num <= 10 ? '#c80000' : '#ff69b4';
              return (
                <span key={key} className="history-item" style={{ color }}>
                  {Number(item).toFixed(2)}x
                </span>
              );
            })}
          </div>
        </div>
        <i 
          className="fas fa-clock-rotate-left history-icon" 
          onClick={() => setShowHistory(!showHistory)}
        ></i>
      </div>

      <div className={`history-popup ${showHistory ? 'show' : ''}`}>
        <div className="popup-header">
          <span>Crash History</span>
          <button className="close-popup" onClick={() => setShowHistory(false)}>x</button>
        </div>
        <div className="popup-body">
          {history.length === 0 ? (
            <div style={{ color: '#666', fontSize: '12px' }}>No rounds yet</div>
          ) : (
            history.map((item, key) => {
              const num = Number(item);
              const className = num < 2 ? 'low' : num <= 10 ? 'mid' : 'high';
              return (
                <div key={key} className={`popup-item ${className}`}>
                  {Number(item).toFixed(2)}x
                </div>
              );
            })
          )}
        </div>
      </div>
    </>
  );
}
