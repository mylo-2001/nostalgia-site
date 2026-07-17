"use strict";

/**
 * HTTP hardening — MITM mitigation (HTTPS/HSTS/Secure cookies), security headers,
 * CSRF-style Origin checks on mutating API calls, and input helpers.
 */

const MAX_PASSWORD_LEN = 128;
const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const rateBuckets = new Map();

function intEnv(name, fallback) {
  const n = parseInt(process.env[name], 10);
  return Number.isFinite(n) && n > 0 ? n : fallback;
}

function isProduction() {
  return process.env.NODE_ENV === "production";
}

/** True when cookies must be Secure and HSTS is enabled. */
function isSecureEnv() {
  return (
    isProduction() ||
    process.env.FORCE_SECURE_COOKIES === "true" ||
    (process.env.SITE_URL || "").trim().startsWith("https://")
  );
}

function cookiesSecure() {
  return isSecureEnv();
}

function trustProxyEnabled() {
  return process.env.TRUST_PROXY === "true" || isProduction();
}

function allowedOrigins() {
  const out = [];
  const site = (process.env.SITE_URL || "").trim().replace(/\/$/, "");
  if (site) out.push(site);
  (process.env.ALLOWED_ORIGINS || "")
    .split(",")
    .map((s) => s.trim().replace(/\/$/, ""))
    .filter(Boolean)
    .forEach((o) => {
      if (!out.includes(o)) out.push(o);
    });
  return out;
}

function isLocalOrigin(value) {
  return /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?(\/|$)/i.test(String(value || ""));
}

function originMatches(value) {
  if (!value) return false;
  const v = String(value).replace(/\/$/, "");
  const allowed = allowedOrigins();
  if (allowed.some((a) => v === a || v.startsWith(a + "/"))) return true;
  if (!isProduction() && isLocalOrigin(v)) return true;
  return false;
}

/* Lenient gate used at LOGIN only — a length sanity check so a giant body
   can't reach the KDF. It intentionally stays permissive so accounts created
   under the old 6-char rule can still sign in; the real check is the hash. */
function validatePassword(password) {
  const p = String(password || "");
  return p.length >= 6 && p.length <= MAX_PASSWORD_LEN;
}

const MIN_STRONG_PASSWORD_LEN = 8;

/* Strong policy enforced whenever a NEW password is set (register, change,
   reset, admin). Requires 8+ chars with lower + upper + digit. Returns an
   error slug (or null when the password is acceptable) so callers can relay
   a specific reason to the UI. */
function passwordStrengthError(password) {
  const p = String(password || "");
  if (p.length < MIN_STRONG_PASSWORD_LEN) return "password_too_short";
  if (p.length > MAX_PASSWORD_LEN) return "password_too_long";
  if (!/[a-z]/.test(p)) return "password_needs_lowercase";
  if (!/[A-Z]/.test(p)) return "password_needs_uppercase";
  if (!/[0-9]/.test(p)) return "password_needs_digit";
  return null;
}

function validatePasswordStrength(password) {
  return passwordStrengthError(password) === null;
}

function isUuid(v) {
  return UUID_RE.test(String(v || ""));
}

/* ---------- Cloudflare Turnstile (CAPTCHA) ----------
 * Entirely optional: inert until TURNSTILE_SECRET_KEY is configured, so the
 * login/register flows keep working with no keys. Once a secret is set,
 * verification fails closed (a missing/invalid token is rejected). */
function turnstileSiteKey() {
  return (process.env.TURNSTILE_SITE_KEY || "").trim();
}

function turnstileConfigured() {
  return !!(process.env.TURNSTILE_SECRET_KEY || "").trim();
}

async function verifyTurnstile(token, ip) {
  const secret = (process.env.TURNSTILE_SECRET_KEY || "").trim();
  if (!secret) return true; // not configured → skip the check entirely
  if (!token) return false;
  try {
    const body = new URLSearchParams();
    body.set("secret", secret);
    body.set("response", String(token));
    if (ip) body.set("remoteip", String(ip));
    const r = await fetch(
      "https://challenges.cloudflare.com/turnstile/v0/siteverify",
      {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: body.toString(),
      }
    );
    const data = await r.json();
    return !!(data && data.success);
  } catch (e) {
    console.error("[turnstile] verify failed:", e.message);
    return false; // fail closed when a secret is configured
  }
}

function enforceHttps(req, res, next) {
  if (!isSecureEnv()) return next();
  const secure =
    req.secure || String(req.headers["x-forwarded-proto"] || "").split(",")[0].trim() === "https";
  if (secure) return next();
  const host = req.get("host");
  if (!host) return res.status(400).end();
  return res.redirect(301, "https://" + host + req.originalUrl);
}

function securityHeaders(req, res, next) {
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("X-Frame-Options", "DENY");
  res.setHeader("Referrer-Policy", "strict-origin-when-cross-origin");
  res.setHeader("Permissions-Policy", "geolocation=(), microphone=(), camera=()");
  res.setHeader("Cross-Origin-Opener-Policy", "same-origin");
  res.setHeader("Cross-Origin-Resource-Policy", "same-site");

  if (isSecureEnv()) {
    res.setHeader("Strict-Transport-Security", "max-age=31536000; includeSubDomains");
    res.setHeader(
      "Content-Security-Policy",
      [
        "default-src 'self'",
        // No 'unsafe-inline' for scripts: all inline scripts were externalised
        // (js/theme-boot.js etc.), so injected inline JS cannot execute (XSS hardening).
        "script-src 'self' https://www.googletagmanager.com https://www.google-analytics.com https://challenges.cloudflare.com",
        // style-src keeps 'unsafe-inline' — the pages still use inline style="" attributes;
        // CSS injection is far lower severity than script injection.
        "style-src 'self' 'unsafe-inline'",
        "img-src 'self' data: https: https://res.cloudinary.com",
        "font-src 'self'",
        "connect-src 'self' https://www.google-analytics.com https://region1.google-analytics.com https://api.stripe.com https://challenges.cloudflare.com",
        "frame-src https://checkout.stripe.com https://js.stripe.com https://challenges.cloudflare.com",
        "form-action 'self' https://checkout.stripe.com",
        "base-uri 'self'",
        "object-src 'none'",
        "upgrade-insecure-requests",
      ].join("; ")
    );
  }

  next();
}

/** Reject cross-site POST/PUT/PATCH/DELETE to /api/* (CSRF mitigation). */
function checkApiOrigin(req, res, next) {
  if (!["POST", "PUT", "PATCH", "DELETE"].includes(req.method)) return next();
  if (!req.path.startsWith("/api/")) return next();
  if (req.path === "/api/stripe/webhook") return next();
  if (req.path.startsWith("/api/cron/")) return next();

  const origin = req.headers.origin;
  const referer = req.headers.referer;

  if (origin && originMatches(origin)) return next();
  if (!origin && referer && originMatches(referer)) return next();

  if (!isSecureEnv()) {
    if (!origin && !referer) return next();
    return next();
  }

  return res.status(403).json({ ok: false, error: "forbidden_origin" });
}

function assertStrongSessionSecret(secret) {
  if (!isSecureEnv()) return;
  const s = String(secret || "").trim();
  if (s.length < 32 || /change-me|example|test/i.test(s)) {
    throw new Error(
      "SESSION_SECRET / NEXTAUTH_SECRET must be a strong random string (32+ chars) in production"
    );
  }
}

function rateLimit(req, res, next) {
  if (req.path === "/api/stripe/webhook") return next();
  if (req.path.startsWith("/admin/assets/")) return next();

  const now = Date.now();
  const windowMs = intEnv("RATE_LIMIT_WINDOW_MS", 60 * 1000);
  const isApi = req.path.startsWith("/api/");
  const mutating = ["POST", "PUT", "PATCH", "DELETE"].includes(req.method);
  const limit = mutating
    ? intEnv("RATE_LIMIT_WRITE_MAX", 60)
    : isApi
      ? intEnv("RATE_LIMIT_API_MAX", 180)
      : intEnv("RATE_LIMIT_PUBLIC_MAX", 600);
  const ip = req.ip || req.socket.remoteAddress || "unknown";
  const key = ip + ":" + (isApi ? "api" : "public") + ":" + (mutating ? "write" : "read");
  let bucket = rateBuckets.get(key);

  if (!bucket || bucket.resetAt <= now) {
    bucket = { count: 0, resetAt: now + windowMs };
    rateBuckets.set(key, bucket);
  }
  bucket.count += 1;

  if (bucket.count > limit) {
    const retryAfter = Math.max(1, Math.ceil((bucket.resetAt - now) / 1000));
    res.setHeader("Retry-After", String(retryAfter));
    res.setHeader("X-RateLimit-Limit", String(limit));
    res.setHeader("X-RateLimit-Remaining", "0");
    res.setHeader("X-RateLimit-Reset", String(Math.ceil(bucket.resetAt / 1000)));
    return res.status(429).json({ ok: false, error: "too_many_requests" });
  }

  res.setHeader("X-RateLimit-Limit", String(limit));
  res.setHeader("X-RateLimit-Remaining", String(Math.max(0, limit - bucket.count)));
  res.setHeader("X-RateLimit-Reset", String(Math.ceil(bucket.resetAt / 1000)));

  if (rateBuckets.size > 10000) {
    for (const [k, v] of rateBuckets) {
      if (v.resetAt <= now) rateBuckets.delete(k);
    }
  }

  next();
}

module.exports = {
  MAX_PASSWORD_LEN,
  MIN_STRONG_PASSWORD_LEN,
  isProduction,
  isSecureEnv,
  cookiesSecure,
  trustProxyEnabled,
  validatePassword,
  validatePasswordStrength,
  passwordStrengthError,
  turnstileSiteKey,
  turnstileConfigured,
  verifyTurnstile,
  isUuid,
  enforceHttps,
  securityHeaders,
  checkApiOrigin,
  assertStrongSessionSecret,
  rateLimit,
};
