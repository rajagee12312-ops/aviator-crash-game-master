import React from "react";
import { FiArrowLeft, FiLock, FiMail, FiUser } from "react-icons/fi";
import { apiRequest } from "../../utils/api";
import { DemoAccount } from "../../utils/interfaces";
import "./account.scss";

export type AccountMode = "login" | "register";

interface AccountPageProps {
  mode: AccountMode;
  onBack: () => void;
  onSwitch: (mode: AccountMode) => void;
  onSuccess: (user: DemoAccount, token: string) => void;
}

interface AuthResponse {
  token?: string;
  user?: DemoAccount;
  message?: string;
}

export default function AccountPage({
  mode,
  onBack,
  onSwitch,
  onSuccess,
}: AccountPageProps) {
  const [username, setUsername] = React.useState("");
  const [email, setEmail] = React.useState("");
  const [password, setPassword] = React.useState("");
  const [error, setError] = React.useState("");
  const [submitting, setSubmitting] = React.useState(false);
  const isRegister = mode === "register";

  const submit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError("");
    setSubmitting(true);

    try {
      const result = await apiRequest<AuthResponse>(`/auth/${mode}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, email, password }),
      });
      if (!result.user || !result.token) {
        throw new Error("The backend returned an incomplete account response.");
      }
      onSuccess(result.user, result.token);
    } catch (requestError) {
      setError(
        requestError instanceof Error
          ? requestError.message
          : "Could not reach the account service."
      );
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <main className="account-page">
      <button className="account-back" type="button" onClick={onBack}>
        <FiArrowLeft aria-hidden="true" />
        Back to lobby
      </button>

      <section className="account-card" aria-labelledby="account-title">
        <div className="account-mark" aria-hidden="true">AC</div>
        <p className="account-eyebrow">AVIATOR CRASH · PLAYER ACCOUNT</p>
        <h1 id="account-title">{isRegister ? "Create your account" : "Welcome back"}</h1>
        <p className="account-intro">
          {isRegister
            ? "Join the lobby and start with 1,000 virtual credits."
            : "Sign in to pick up your profile and wallet."}
        </p>

        <form className="account-form" onSubmit={submit}>
          {isRegister && (
            <label>
              <span>Player name</span>
              <div className="account-input-wrap">
                <FiUser aria-hidden="true" />
                <input
                  autoComplete="nickname"
                  maxLength={24}
                  minLength={2}
                  onChange={(event) => setUsername(event.target.value)}
                  placeholder="Your player name"
                  required
                  value={username}
                />
              </div>
            </label>
          )}
          <label>
            <span>Email address</span>
            <div className="account-input-wrap">
              <FiMail aria-hidden="true" />
              <input
                autoComplete="email"
                onChange={(event) => setEmail(event.target.value)}
                placeholder="you@example.com"
                required
                type="email"
                value={email}
              />
            </div>
          </label>
          <label>
            <span>Password</span>
            <div className="account-input-wrap">
              <FiLock aria-hidden="true" />
              <input
                autoComplete={isRegister ? "new-password" : "current-password"}
                minLength={isRegister ? 10 : undefined}
                onChange={(event) => setPassword(event.target.value)}
                placeholder={isRegister ? "At least 10 characters" : "Your password"}
                required
                type="password"
                value={password}
              />
            </div>
          </label>

          {error && <p className="account-error" role="alert">{error}</p>}

          <button className="account-submit" disabled={submitting} type="submit">
            {submitting
              ? "Please wait..."
              : isRegister
                ? "Create account"
                : "Sign in"}
          </button>
        </form>

        <p className="account-switch">
          {isRegister ? "Already have an account?" : "New to Aviator?"}{" "}
          <button
            onClick={() => onSwitch(isRegister ? "login" : "register")}
            type="button"
          >
            {isRegister ? "Sign in" : "Create account"}
          </button>
        </p>
        <p className="account-credit-note">
          Passwords are hashed. Virtual credits are simulated and have no cash value.
        </p>
      </section>
    </main>
  );
}
