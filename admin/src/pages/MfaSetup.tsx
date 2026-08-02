import { useState } from "react";
import { api } from "../api/client";

interface MfaSetupProps {
  onComplete: () => void;
  onLogout: () => void;
}

export function MfaSetup({ onComplete, onLogout }: MfaSetupProps) {
  const [setup, setSetup] = useState<{ secret: string; otpauth: string } | null>(null);
  const [code, setCode] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function beginSetup() {
    setBusy(true);
    setError("");
    const res = await api.post("/api/admin/mfa/setup", {});
    setBusy(false);
    if (res.ok) {
      setSetup({ secret: String(res.secret || ""), otpauth: String(res.otpauth || "") });
      return;
    }
    setError(res.error === "already_enabled"
      ? "Το 2FA είναι ήδη ενεργό. Αποσυνδεθείτε και συνδεθείτε ξανά."
      : "Δεν ήταν δυνατή η δημιουργία 2FA. Δοκιμάστε ξανά.");
  }

  async function enable(e: React.FormEvent) {
    e.preventDefault();
    if (!/^\d{6}$/.test(code)) {
      setError("Εισάγετε τον εξαψήφιο κωδικό της εφαρμογής authenticator.");
      return;
    }
    setBusy(true);
    setError("");
    const res = await api.post("/api/admin/mfa/enable", { code });
    setBusy(false);
    if (res.ok) {
      onComplete();
      return;
    }
    setError(res.error === "invalid_mfa"
      ? "Ο κωδικός δεν είναι σωστός ή έχει λήξει."
      : "Δεν ήταν δυνατή η ενεργοποίηση 2FA.");
  }

  return (
    <div className="login">
      <form className="login__card" onSubmit={enable}>
        <img className="login__logo" src="/images/logo/logo.png" alt="Nostalgia Collection" />
        <h1 className="login__title">Υποχρεωτική ενεργοποίηση 2FA</h1>
        <p className="muted">
          Για την προστασία του διαχειριστικού, συνδέστε μια εφαρμογή authenticator
          πριν συνεχίσετε.
        </p>

        {!setup ? (
          <button className="btn btn--primary" type="button" onClick={beginSetup} disabled={busy}>
            {busy ? "Προετοιμασία..." : "Ρύθμιση 2FA"}
          </button>
        ) : (
          <>
            <p className="muted">Εισάγετε αυτό το κλειδί στην εφαρμογή authenticator:</p>
            <p style={{ fontFamily: "monospace", fontSize: 15, background: "var(--bg)", padding: "8px 12px", borderRadius: 6, wordBreak: "break-all" }}>
              {setup.secret}
            </p>
            <a href={setup.otpauth} className="muted" style={{ wordBreak: "break-all" }}>
              Άνοιγμα στην εφαρμογή authenticator
            </a>
            <label className="field">
              <span>Κωδικός επιβεβαίωσης</span>
              <input
                value={code}
                onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
                maxLength={6}
                inputMode="numeric"
                autoComplete="one-time-code"
                placeholder="123456"
                required
              />
            </label>
            <button className="btn btn--primary" type="submit" disabled={busy}>
              {busy ? "Έλεγχος..." : "Ενεργοποίηση και συνέχεια"}
            </button>
          </>
        )}

        {error && <p className="error" role="alert">{error}</p>}
        <button className="btn" type="button" onClick={onLogout}>Αποσύνδεση</button>
      </form>
    </div>
  );
}
