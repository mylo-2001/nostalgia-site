import { useCallback, useEffect, useState } from "react";
import { api, clearAdminClientSession } from "../api/client";

interface SettingsData {
  stripe: { configured: boolean; keyHint: string | null; fromEnv: boolean; publishableFromEnv: boolean; webhookFromEnv: boolean };
  analytics: { configured: boolean };
  email: { resend: boolean; smtp: boolean };
  cron: { configured: boolean };
}

interface MfaStatus {
  required: boolean;
  enabled: boolean;
}

function Dot({ on }: { on: boolean }) {
  return <span className={"obadge obadge--" + (on ? "green" : "grey")}>{on ? "Ναι" : "Όχι"}</span>;
}

export function Settings() {
  const [data, setData] = useState<SettingsData | null>(null);
  const [mfaStatus, setMfaStatus] = useState<MfaStatus | null>(null);
  const load = useCallback(async () => {
    const [settingsResult, mfaResult] = await Promise.all([
      api.get("/api/admin/settings"),
      api.get("/api/admin/mfa/status"),
    ]);
    if (settingsResult.ok) setData(settingsResult as unknown as SettingsData);
    if (mfaResult.ok) setMfaStatus({ required: !!mfaResult.required, enabled: !!mfaResult.enabled });
  }, []);
  useEffect(() => { load(); }, [load]);

  /* Stripe key */
  const [stripeKey, setStripeKey] = useState("");
  const [stripeMsg, setStripeMsg] = useState("");
  async function saveStripe(e: React.FormEvent) {
    e.preventDefault();
    setStripeMsg("");
    const res = await api.post("/api/admin/settings/stripe", { secretKey: stripeKey });
    if (res.ok) { setStripeMsg("Αποθηκεύτηκε."); setStripeKey(""); load(); }
    else setStripeMsg("Σφάλμα: " + (res.error || res.status));
  }

  /* Password change */
  const [curPw, setCurPw] = useState("");
  const [newPw, setNewPw] = useState("");
  const [pwMsg, setPwMsg] = useState("");
  async function savePassword(e: React.FormEvent) {
    e.preventDefault();
    setPwMsg("");
    const res = await api.post("/api/admin/password", { current: curPw, next: newPw });
    if (res.ok) { setPwMsg("Ο κωδικός άλλαξε."); setCurPw(""); setNewPw(""); }
    else setPwMsg("Σφάλμα: " + (res.error || res.status));
  }

  /* MFA */
  const [mfa, setMfa] = useState<{ secret: string; otpauth: string } | null>(null);
  const [mfaCode, setMfaCode] = useState("");
  const [mfaMsg, setMfaMsg] = useState("");
  const [disablePassword, setDisablePassword] = useState("");
  const [disableCode, setDisableCode] = useState("");
  async function startMfa() {
    setMfaMsg("");
    const res = await api.post("/api/admin/mfa/setup", {});
    if (res.ok) setMfa({ secret: res.secret as string, otpauth: res.otpauth as string });
    else setMfaMsg(res.error === "already_enabled" ? "Το 2FA είναι ήδη ενεργό." : "Σφάλμα: " + (res.error || res.status));
  }
  async function enableMfa(e: React.FormEvent) {
    e.preventDefault();
    setMfaMsg("");
    const res = await api.post("/api/admin/mfa/enable", { code: mfaCode });
    if (res.ok) { setMfaMsg("Το 2FA ενεργοποιήθηκε."); setMfa(null); setMfaCode(""); await load(); }
    else setMfaMsg("Λάθος κωδικός 2FA.");
  }

  async function disableMfa(e: React.FormEvent) {
    e.preventDefault();
    if (!window.confirm("Να απενεργοποιηθεί το 2FA για τον διαχειριστή;")) return;
    setMfaMsg("");
    const res = await api.post("/api/admin/mfa/disable", { password: disablePassword, code: disableCode });
    if (res.ok) {
      setMfaMsg("Το 2FA απενεργοποιήθηκε.");
      setDisablePassword("");
      setDisableCode("");
      await load();
    } else if (res.error === "admin_2fa_required") {
      setMfaMsg("Η απενεργοποίηση δεν επιτρέπεται από το περιβάλλον. Χρειάζεται ALLOW_ADMIN_2FA_DISABLE=true.");
    } else {
      setMfaMsg("Η απενεργοποίηση απέτυχε. Έλεγξε τον κωδικό και τον κωδικό 2FA.");
    }
  }

  async function logoutEverywhere() {
    if (!window.confirm("Να αποσυνδεθούν όλες οι ενεργές συσκευές διαχειριστή, μαζί με αυτή;")) return;
    const res = await api.post("/api/v2/admin/logout-all", {});
    if (!res.ok) {
      setPwMsg(`Η αποσύνδεση όλων των συσκευών απέτυχε (${res.error || res.status}).`);
      return;
    }
    clearAdminClientSession();
    window.location.reload();
  }

  if (!data) return <p className="empty">Φόρτωση…</p>;

  return (
    <div>
      <h2 className="main__title">Ρυθμίσεις</h2>

      <section className="card" style={{ marginBottom: 18 }}>
        <h3 className="card__title">Κατάσταση συστήματος</h3>
        <table className="tbl">
          <tbody>
            <tr><td>Stripe πληρωμές</td><td><Dot on={data.stripe.configured} /> {data.stripe.keyHint ? <span className="muted">({data.stripe.keyHint}{data.stripe.fromEnv ? " · env" : ""})</span> : null}</td></tr>
            <tr><td>Stripe webhook (env)</td><td><Dot on={data.stripe.webhookFromEnv} /></td></tr>
            <tr><td>Google Analytics</td><td><Dot on={data.analytics.configured} /></td></tr>
            <tr><td>Email — Resend</td><td><Dot on={data.email.resend} /></td></tr>
            <tr><td>Email — SMTP</td><td><Dot on={data.email.smtp} /></td></tr>
            <tr><td>Cron token</td><td><Dot on={data.cron.configured} /></td></tr>
          </tbody>
        </table>
      </section>

      <section className="card" style={{ marginBottom: 18 }}>
        <h3 className="card__title">Stripe κλειδί</h3>
        {data.stripe.fromEnv ? (
          <p className="muted">Το κλειδί ορίζεται από μεταβλητή περιβάλλοντος (STRIPE_SECRET_KEY) και δεν μπορεί να αλλάξει από εδώ.</p>
        ) : (
          <form onSubmit={saveStripe} style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "flex-end" }}>
            <label className="field" style={{ flex: "1 1 320px" }}><span>Secret key (sk_…)</span>
              <input type="password" value={stripeKey} onChange={(e) => setStripeKey(e.target.value)} placeholder="sk_live_…" autoComplete="off" /></label>
            <button className="btn btn--primary" type="submit">Αποθήκευση</button>
            {stripeMsg && <p className="muted" style={{ width: "100%" }}>{stripeMsg}</p>}
          </form>
        )}
      </section>

      <section className="card" style={{ marginBottom: 18 }}>
        <h3 className="card__title">Αλλαγή κωδικού</h3>
        <form onSubmit={savePassword} style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "flex-end" }}>
          <label className="field" style={{ flex: "1 1 200px" }}><span>Τρέχων κωδικός</span>
            <input type="password" value={curPw} onChange={(e) => setCurPw(e.target.value)} autoComplete="current-password" /></label>
          <label className="field" style={{ flex: "1 1 200px" }}><span>Νέος κωδικός</span>
            <input type="password" value={newPw} onChange={(e) => setNewPw(e.target.value)} autoComplete="new-password" /></label>
          <button className="btn btn--primary" type="submit">Αλλαγή</button>
          {pwMsg && <p className="muted" style={{ width: "100%" }}>{pwMsg}</p>}
        </form>
      </section>

      <section className="card" style={{ marginBottom: 18 }}>
        <h3 className="card__title">Ενεργές συνδέσεις διαχειριστή</h3>
        <p className="muted">Ακυρώνει όλες τις ενεργές συνεδρίες και ζητά νέα σύνδεση σε κάθε συσκευή.</p>
        <button className="btn" type="button" onClick={() => void logoutEverywhere()}>Αποσύνδεση από όλες τις συσκευές</button>
      </section>

      <section className="card">
        <h3 className="card__title">Έλεγχος ταυτότητας 2 βημάτων (2FA)</h3>
        <p style={{ marginTop: 0 }}>
          <span className={`obadge obadge--${mfaStatus?.enabled ? "green" : "grey"}`}>{mfaStatus?.enabled ? "Ενεργό" : "Ανενεργό"}</span>{" "}
          <span className="muted">{mfaStatus?.required ? "Υποχρεωτικό στο τρέχον περιβάλλον" : "Προαιρετικό στο τρέχον περιβάλλον"}</span>
        </p>
        {!mfaStatus?.enabled && !mfa ? (
          <>
            <p className="muted">Ενεργοποιήστε το 2FA με εφαρμογή authenticator (Google Authenticator, Authy, κ.λπ.).</p>
            <button className="btn btn--primary" onClick={startMfa}>Ρύθμιση 2FA</button>
          </>
        ) : mfa ? (
          <form onSubmit={enableMfa}>
            <p>Σαρώστε ή εισάγετε αυτό το μυστικό στην εφαρμογή authenticator:</p>
            <p style={{ fontFamily: "monospace", fontSize: 15, background: "var(--bg)", padding: "8px 12px", borderRadius: 6, wordBreak: "break-all" }}>{mfa.secret}</p>
            <p className="muted" style={{ fontSize: 12, wordBreak: "break-all" }}>{mfa.otpauth}</p>
            <label className="field" style={{ maxWidth: 220 }}><span>Κωδικός επιβεβαίωσης</span>
              <input value={mfaCode} onChange={(e) => setMfaCode(e.target.value.replace(/\D/g, ""))} maxLength={6} inputMode="numeric" placeholder="123456" /></label>
            <button className="btn btn--primary" type="submit" style={{ marginTop: 8 }}>Ενεργοποίηση</button>
          </form>
        ) : (
          <form onSubmit={disableMfa} className="settings-inline-form">
            <p className="muted settings-inline-form__intro">Για απενεργοποίηση απαιτούνται ο τρέχων κωδικός και ένας ζωντανός κωδικός authenticator. Η ενέργεια λειτουργεί μόνο όταν το επιτρέπει το env.</p>
            <label className="field"><span>Τρέχων κωδικός</span><input type="password" autoComplete="current-password" value={disablePassword} onChange={(event) => setDisablePassword(event.target.value)} required /></label>
            <label className="field"><span>Κωδικός 2FA</span><input inputMode="numeric" pattern="[0-9]{6}" maxLength={6} value={disableCode} onChange={(event) => setDisableCode(event.target.value.replace(/\D/g, ""))} required /></label>
            <button className="btn" type="submit">Απενεργοποίηση 2FA</button>
          </form>
        )}
        {mfaMsg && <p className="muted" style={{ marginTop: 8 }}>{mfaMsg}</p>}
      </section>
    </div>
  );
}
