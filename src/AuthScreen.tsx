import { useId, useState, type FormEvent } from "react";
import { supabase } from "./lib/supabase";

type Mode = "sign-in" | "sign-up";
const safeAuthMessage = (message: string) => {
  const value = message.toLowerCase();
  if (value.includes("invalid login"))
    return "The email or password is incorrect.";
  if (value.includes("email not confirmed"))
    return "Confirm your email before signing in.";
  if (value.includes("already registered"))
    return "An account already exists for this email.";
  if (value.includes("password"))
    return "Check that your password meets the requirements and try again.";
  return "Authentication could not be completed. Please try again.";
};

export function AuthScreen() {
  const [mode, setMode] = useState<Mode>("sign-in"),
    [email, setEmail] = useState(""),
    [password, setPassword] = useState(""),
    [displayName, setDisplayName] = useState(""),
    [message, setMessage] = useState(""),
    [kind, setKind] = useState<"error" | "success">("error"),
    [busy, setBusy] = useState(false),
    [showPassword, setShowPassword] = useState(false);
  const messageId = useId();
  async function submit(event: FormEvent) {
    event.preventDefault();
    if (busy || !supabase) return;
    setBusy(true);
    setMessage("");
    try {
      const result =
        mode === "sign-in"
          ? await supabase.auth.signInWithPassword({
              email: email.trim(),
              password,
            })
          : await supabase.auth.signUp({
              email: email.trim(),
              password,
              options: { data: { display_name: displayName.trim() || null } },
            });
      if (result.error) {
        setKind("error");
        setMessage(safeAuthMessage(result.error.message));
      } else if (mode === "sign-up" && !result.data.session) {
        setKind("success");
        setMessage(
          "Check your email for a confirmation link, then return here to sign in.",
        );
      }
    } catch {
      setKind("error");
      setMessage(
        "Authentication could not be completed. Check your connection and try again.",
      );
    } finally {
      setBusy(false);
    }
  }
  const changeMode = () => {
    if (busy) return;
    setMode(mode === "sign-in" ? "sign-up" : "sign-in");
    setMessage("");
    setShowPassword(false);
  };
  return (
    <main className="auth-shell">
      <section className="auth-card" aria-labelledby="auth-title">
        <div className="auth-brand" aria-label="Progressive Overload">
          <img className="auth-mark" src="/brand-icon.svg" alt="" />
          <span>
            Progressive <strong>Overload</strong>
          </span>
        </div>
        <header className="auth-heading">
          <p className="eyebrow">BUILD CONSISTENCY. SEE PROGRESS.</p>
          <h1 id="auth-title">
            {mode === "sign-in" ? "Sign in" : "Create your account"}
          </h1>
          <p>
            {mode === "sign-in"
              ? "Welcome back. Your next entry starts here."
              : "Start tracking lifts, cardio, stretches, and weigh-ins."}
          </p>
        </header>
        <form
          className="auth-form"
          onSubmit={submit}
          aria-describedby={message ? messageId : undefined}
          aria-busy={busy}
        >
          {mode === "sign-up" && (
            <label className="auth-label" htmlFor="auth-name">
              Display name <span>Optional</span>
              <input
                id="auth-name"
                className="auth-input"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                autoComplete="name"
                maxLength={80}
                disabled={busy}
                inputMode="text"
              />
            </label>
          )}
          <label className="auth-label" htmlFor="auth-email">
            Email
            <input
              id="auth-email"
              className="auth-input"
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              autoComplete="email"
              inputMode="email"
              autoCapitalize="none"
              spellCheck={false}
              disabled={busy}
              aria-invalid={kind === "error" && Boolean(message)}
            />
          </label>
          <label className="auth-label" htmlFor="auth-password">
            Password
            <div className="auth-password">
              <input
                id="auth-password"
                className="auth-input"
                type={showPassword ? "text" : "password"}
                minLength={8}
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete={
                  mode === "sign-in" ? "current-password" : "new-password"
                }
                disabled={busy}
                aria-invalid={kind === "error" && Boolean(message)}
              />
              <button
                type="button"
                onClick={() => setShowPassword((value) => !value)}
                disabled={busy}
                aria-label={showPassword ? "Hide password" : "Show password"}
              >
                {showPassword ? "Hide" : "Show"}
              </button>
            </div>
            {mode === "sign-up" && <small>Use at least 8 characters.</small>}
          </label>
          {message && (
            <div
              id={messageId}
              role={kind === "error" ? "alert" : "status"}
              className={`auth-message auth-message-${kind}`}
            >
              <span aria-hidden="true">{kind === "error" ? "!" : "✓"}</span>
              <p>{message}</p>
            </div>
          )}
          <button disabled={busy} className="auth-submit" type="submit">
            {busy ? (
              <>
                <span className="auth-spinner" aria-hidden="true" />{" "}
                {mode === "sign-in" ? "Signing in…" : "Creating account…"}
              </>
            ) : mode === "sign-in" ? (
              "Sign in"
            ) : (
              "Create account"
            )}
          </button>
        </form>
        <div className="auth-switch">
          <span>
            {mode === "sign-in"
              ? "New to Progressive Overload?"
              : "Already have an account?"}
          </span>
          <button type="button" onClick={changeMode} disabled={busy}>
            {mode === "sign-in" ? "Create an account" : "Sign in instead"}
          </button>
        </div>
      </section>
    </main>
  );
}

export function ConfigurationScreen() {
  return (
    <main className="auth-shell">
      <section
        className="auth-card auth-configuration"
        aria-labelledby="configuration-title"
      >
        <div className="auth-brand">
          <img className="auth-mark" src="/brand-icon.svg" alt="" />
          <span>
            Progressive <strong>Overload</strong>
          </span>
        </div>
        <p className="eyebrow">LOCAL SETUP REQUIRED</p>
        <h1 id="configuration-title">Connect your Supabase project</h1>
        <p>
          The app is missing its local public connection settings. Copy{" "}
          <code>.env.example</code> to <code>.env.local</code>, add the project
          URL and publishable/anon key, then restart the development server.
        </p>
        <p className="auth-security-note">
          Never place a service-role key in the frontend.
        </p>
      </section>
    </main>
  );
}
