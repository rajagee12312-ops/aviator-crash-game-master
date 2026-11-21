import React from "react";
import {
  FiArrowDownLeft,
  FiArrowLeft,
  FiArrowUpRight,
  FiCreditCard,
  FiPlus,
  FiShield,
} from "react-icons/fi";
import { apiRequest } from "../../utils/api";
import { DemoAccount, DemoWalletTransaction } from "../../utils/interfaces";
import { formatPKR } from "../../utils/currency";
import "./wallet.scss";

type WalletAction = "deposit" | "withdraw";

interface WalletPageProps {
  user: DemoAccount | null;
  token: string | null;
  guestBalance: number;
  onBack: () => void;
  onLogin: () => void;
  onBalanceChange: (balance: number) => void;
}

interface WalletResponse {
  balance: number;
  transactions: DemoWalletTransaction[];
  message?: string;
}

export default function WalletPage({
  user,
  token,
  guestBalance,
  onBack,
  onLogin,
  onBalanceChange,
}: WalletPageProps) {
  const [action, setAction] = React.useState<WalletAction | null>(null);
  const [amount, setAmount] = React.useState("");
  const [transactions, setTransactions] = React.useState<DemoWalletTransaction[]>([]);
  const [loading, setLoading] = React.useState(Boolean(user));
  const [submitting, setSubmitting] = React.useState(false);
  const [error, setError] = React.useState("");
  const [notice, setNotice] = React.useState("");

  React.useEffect(() => {
    if (!user || !token) {
      setLoading(false);
      setTransactions([]);
      return;
    }

    let active = true;
    apiRequest<WalletResponse>("/wallet", {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then((result) => {
        if (active) {
          setTransactions(result.transactions);
          onBalanceChange(result.balance);
        }
      })
      .catch((requestError: unknown) => {
        if (active) {
          setError(
            requestError instanceof Error
              ? requestError.message
              : "Could not load the wallet."
          );
        }
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, [onBalanceChange, token, user]);

  const submitAction = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!user || !token || !action) {
      onLogin();
      return;
    }
    setError("");
    setNotice("");
    setSubmitting(true);

    try {
      const result = await apiRequest<WalletResponse>(`/wallet/${action}`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ amount: Number(amount) }),
      });
      setTransactions(result.transactions);
      onBalanceChange(result.balance);
      setNotice(
        `${action === "deposit" ? "Added" : "Removed"} ${formatPKR(Number(amount))} in virtual credits.`
      );
      setAction(null);
      setAmount("");
    } catch (requestError) {
      setError(
        requestError instanceof Error
          ? requestError.message
          : "Could not reach the wallet."
      );
    } finally {
      setSubmitting(false);
    }
  };

  const openAction = (nextAction: WalletAction) => {
    setNotice("");
    setError("");
    if (!user) {
      onLogin();
      return;
    }
    setAction(nextAction);
  };

  const balance = user ? user.balance : guestBalance;

  return (
    <main className="wallet-page">
      <header className="wallet-topbar">
        <button className="wallet-back" onClick={onBack} type="button">
          <FiArrowLeft aria-hidden="true" />
          <span>Back to lobby</span>
        </button>
        <span className="wallet-top-brand">AVIATOR CRASH</span>
      </header>

      <div className="wallet-content">
        <div className="wallet-title-row">
          <div>
            <p className="wallet-eyebrow">PLAYER AREA</p>
            <h1>Wallet</h1>
          </div>
          <span className="virtual-credits-pill"><FiShield aria-hidden="true" /> VIRTUAL CREDITS</span>
        </div>

        <section className="wallet-balance-card" aria-label="Virtual wallet balance">
          <div className="wallet-balance-copy">
            <span>Available balance (PKR)</span>
            <strong>{formatPKR(Number(balance))}</strong>
            <small>No cash value · no payments are processed</small>
          </div>
          <div className="wallet-balance-icon"><FiCreditCard aria-hidden="true" /></div>
        </section>

        <section className="wallet-actions" aria-label="Virtual wallet actions">
          <button className="wallet-action-card deposit" onClick={() => openAction("deposit")} type="button">
            <span className="wallet-action-icon"><FiArrowDownLeft aria-hidden="true" /></span>
            <span><strong>Add credits</strong><small>Virtual balance only</small></span>
            <FiPlus className="wallet-action-arrow" aria-hidden="true" />
          </button>
          <button className="wallet-action-card withdraw" onClick={() => openAction("withdraw")} type="button">
            <span className="wallet-action-icon"><FiArrowUpRight aria-hidden="true" /></span>
            <span><strong>Remove credits</strong><small>Virtual balance only</small></span>
            <FiArrowUpRight className="wallet-action-arrow" aria-hidden="true" />
          </button>
        </section>

        {!user && (
          <div className="wallet-login-note">
            <p>Guest credits are for play only. Sign in to save your balance during this server session.</p>
            <button onClick={onLogin} type="button">Sign in</button>
          </div>
        )}
        {notice && <p className="wallet-notice" role="status">{notice}</p>}
        {error && <p className="wallet-error" role="alert">{error}</p>}

        <section className="wallet-history">
          <div className="wallet-section-heading">
            <div><p className="wallet-eyebrow">RECENT ACTIVITY</p><h2>Transactions</h2></div>
            <span>{transactions.length} entries</span>
          </div>
          {loading ? (
            <p className="wallet-empty">Loading wallet activity...</p>
          ) : transactions.length ? (
            <ul>
              {transactions.map((transaction) => (
                <li key={transaction.id}>
                  <span className={`transaction-type ${transaction.type}`}>
                    {transaction.type === "deposit"
                      ? <FiArrowDownLeft aria-hidden="true" />
                      : <FiArrowUpRight aria-hidden="true" />}
                  </span>
                  <span className="transaction-copy">
                    <strong>{transaction.type === "deposit" ? "Credit addition" : "Credit removal"}</strong>
                    <small>{new Date(transaction.createdAt).toLocaleString()}</small>
                  </span>
                  <span className="transaction-amount">
                    {transaction.type === "deposit" ? "+" : "−"}{formatPKR(transaction.amount)}
                    <small>Balance {formatPKR(transaction.balanceAfter)}</small>
                  </span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="wallet-empty">
              {user ? "Your wallet activity will appear here." : "Sign in to record wallet activity."}
            </p>
          )}
        </section>
      </div>

      {action && (
        <div className="wallet-modal-backdrop" onMouseDown={(event) => {
          if (event.target === event.currentTarget) setAction(null);
        }}>
          <section aria-labelledby="wallet-modal-title" aria-modal="true" className="wallet-modal" role="dialog">
            <button
              aria-label="Close wallet form"
              className="wallet-modal-close"
              onClick={() => setAction(null)}
              type="button"
            >
              ×
            </button>
            <span className="wallet-action-icon">
              {action === "deposit"
                ? <FiArrowDownLeft aria-hidden="true" />
                : <FiArrowUpRight aria-hidden="true" />}
            </span>
            <p className="wallet-eyebrow">VIRTUAL CREDITS</p>
            <h2 id="wallet-modal-title">
              {action === "deposit" ? "Add credits" : "Remove credits"}
            </h2>
            <p>These credits have no cash value. No payment or payout service is connected.</p>
            <form onSubmit={submitAction}>
              <label htmlFor="wallet-amount">Amount</label>
              <div className="wallet-amount-input">
                <input
                  autoFocus
                  id="wallet-amount"
                  max="10000"
                  min="0.01"
                  onChange={(event) => setAmount(event.target.value)}
                  placeholder="0.00"
                  required
                  step="0.01"
                  type="number"
                  value={amount}
                />
                <span>PKR</span>
              </div>
              {error && <p className="wallet-error" role="alert">{error}</p>}
              <button disabled={submitting} type="submit">
                {submitting ? "Updating..." : action === "deposit" ? "Add credits" : "Confirm removal"}
              </button>
            </form>
          </section>
        </div>
      )}
    </main>
  );
}
