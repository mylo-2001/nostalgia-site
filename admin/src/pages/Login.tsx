import { useEffect, useRef, useState } from "react";
import { api } from "../api/client";

interface TurnstileApi {
  render: (el: HTMLElement, opts: {
    sitekey: string;
    callback: (token: string) => void;
    "error-callback"?: () => void;
    "expired-callback"?: () => void;
  }) => string;
  reset: (id?: string) => void;
  getResponse: (id?: string) => string | undefined;
}
declare global {
  interface Window { turnstile?: TurnstileApi }
}

const TURNSTILE_SRC = "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit";

function loadTurnstileScript(): Promise<boolean> {
  if (window.turnstile) return Promise.resolve(true);
  return new Promise((resolve) => {
    const existing = document.querySelector<HTMLScriptElement>(`script[src="${TURNSTILE_SRC}"]`);
    if (existing) { existing.addEventListener("load", () => resolve(true)); return; }
    const s = document.createElement("script");
    s.src = TURNSTILE_SRC; s.async = true; s.defer = true;
    s.onload = () => resolve(true);
    s.onerror = () => resolve(false);
    document.head.appendChild(s);
  });
}

export function Login({ onLoggedIn }: { onLoggedIn: () => void }) {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [code, setCode] = useState("");
  const [needsMfa, setNeedsMfa] = useState(false);
  const [remember, setRemember] = useState(false);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const [siteKey, setSiteKey] = useState<string | null>(null);
  const captchaRef = useRef<HTMLDivElement>(null);
  const widgetId = useRef<string | null>(null);
  const token = useRef<string>("");

  /* Discover whether Turnstile is configured on the server. */
  useEffect(() => {
    api.get("/api/public-config").then((res) => {
      const key = (res.turnstileSiteKey as string) || "";
      if (key) setSiteKey(key);
    }).catch(() => {});
  }, []);

  /* Render the widget once the site key + container are ready. */
  useEffect(() => {
    if (!siteKey || !captchaRef.current) return;
    let cancelled = false;
    loadTurnstileScript().then((ok) => {
      if (!ok || cancelled || !captchaRef.current || !window.turnstile || widgetId.current) return;
      widgetId.current = window.turnstile.render(captchaRef.current, {
        sitekey: siteKey,
        callback: (t) => { token.current = t; },
        "error-callback": () => { token.current = ""; },
        "expired-callback": () => { token.current = ""; },
      });
    });
    return () => { cancelled = true; };
  }, [siteKey]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    if (siteKey && !token.current) { setError("Ολοκληρώστε την επαλήθευση captcha."); return; }
    setBusy(true);
    const res = await api.post("/api/admin/login", {
      username, password, code, rememberDevice: remember, captchaToken: token.current,
    });
    setBusy(false);
    // A Turnstile token is single-use — reset the widget after every attempt.
    if (siteKey && window.turnstile && widgetId.current) {
      window.turnstile.reset(widgetId.current); token.current = "";
    }
    if (res.ok) { onLoggedIn(); return; }
    if (res.error === "mfa_required") { setNeedsMfa(true); setError("Εισάγετε τον κωδικό 2FA."); return; }
    if (res.error === "invalid_mfa") { setNeedsMfa(true); setError("Λάθος κωδικός 2FA."); return; }
    if (res.error === "captcha_failed") { setError("Απέτυχε η επαλήθευση captcha — δοκιμάστε ξανά."); return; }
    if (res.error === "too_many_attempts") { setError("Πολλές προσπάθειες — δοκίμασε αργότερα."); return; }
    setError("Λάθος στοιχεία σύνδεσης.");
  }

  return (
    <div className="login">
      <form className="login__card" onSubmit={submit}>
        <img className="login__logo" src="/logo/logo.png" alt="Nostalgia Collection" />
        <h1 className="login__title">Πίνακας Διαχείρισης</h1>
        <label className="field"><span>Όνομα χρήστη</span>
          <input value={username} onChange={(e) => setUsername(e.target.value)} autoComplete="username" required />
        </label>
        <label className="field"><span>Κωδικός</span>
          <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="current-password" required />
        </label>
        {needsMfa && (
          <>
            <label className="field"><span>Κωδικός επαλήθευσης (2FA)</span>
              <input value={code} onChange={(e) => setCode(e.target.value)} inputMode="numeric" maxLength={6} placeholder="123456" />
            </label>
            <label className="field" style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
              <input type="checkbox" checked={remember} onChange={(e) => setRemember(e.target.checked)} style={{ width: "auto" }} />
              <span>Να θυμάσαι τη συσκευή για 30 μέρες</span>
            </label>
          </>
        )}
        {siteKey && <div className="login__captcha" ref={captchaRef} />}
        <button className="btn btn--primary" type="submit" disabled={busy}>{busy ? "…" : "Σύνδεση"}</button>
        {error && <p className="error">{error}</p>}
      </form>
    </div>
  );
}
