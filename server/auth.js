"use strict";

/**
 * Password hashing (scrypt) and stateless signed session tokens (HMAC-SHA256).
 * No external dependencies — Node crypto only.
 */

const crypto = require("crypto");
const argon2 = require("argon2");

const SESSION_DAYS = 30;
const ADMIN_SESSION_HOURS = 12;

let SECRET = null;

/** Called once at startup with the secret loaded from the database. */
function setSecret(secret) {
  SECRET = secret;
}

function getSecret() {
  if (!SECRET) throw new Error("auth secret not initialised");
  return SECRET;
}

/* ---------- passwords ----------
 * New hashes use Argon2id (OWASP's first recommendation). Accounts created
 * under the previous scrypt scheme ("salt:hexhash") are still verified, so
 * nobody is locked out, and are transparently re-hashed to Argon2id on their
 * next successful login (see needsRehash + the login handlers). */

/* OWASP minimum for Argon2id: m=19 MiB, t=2, p=1. */
const ARGON2_OPTS = {
  type: argon2.argon2id,
  memoryCost: 19456,
  timeCost: 2,
  parallelism: 1,
};

async function hashPassword(password) {
  const p = String(password);
  if (p.length > 128) throw new Error("password_too_long");
  return argon2.hash(p, ARGON2_OPTS);
}

/* Old scrypt format is "hexsalt:hexhash" (no '$'); Argon2 is "$argon2id$...". */
function isLegacyHash(stored) {
  const s = String(stored || "");
  return s.indexOf("$") === -1 && s.indexOf(":") !== -1;
}

function verifyLegacy(password, stored) {
  const [salt, hash] = String(stored).split(":");
  if (!salt || !hash) return false;
  const candidate = crypto.scryptSync(String(password), salt, 64);
  const expected = Buffer.from(hash, "hex");
  return (
    candidate.length === expected.length &&
    crypto.timingSafeEqual(candidate, expected)
  );
}

async function verifyPassword(password, stored) {
  if (!stored) return false;
  if (isLegacyHash(stored)) return verifyLegacy(password, stored);
  try {
    return await argon2.verify(String(stored), String(password));
  } catch (e) {
    return false;
  }
}

/* True when the stored hash is in an old scheme and should be upgraded. */
function needsRehash(stored) {
  return isLegacyHash(stored);
}

/* Keyed hash for short-lived email codes — never store the code in plaintext. */
function codeHash(code) {
  return crypto.createHmac("sha256", getSecret()).update(String(code)).digest("hex");
}

function verifyCodeHash(code, stored) {
  if (!stored) return false;
  const candidate = Buffer.from(codeHash(code), "hex");
  const expected = Buffer.from(String(stored), "hex");
  return (
    candidate.length === expected.length &&
    crypto.timingSafeEqual(candidate, expected)
  );
}

/* Cryptographically-random 6-digit code (000000–999999). */
function generateCode() {
  return String(crypto.randomInt(0, 1000000)).padStart(6, "0");
}

/* ---------- TOTP (RFC 6238) for admin MFA ----------
 * SHA1 / 30s step / 6 digits — the defaults every authenticator app
 * (Google Authenticator, Microsoft Authenticator, Authy, 1Password) uses.
 * No external dependency: base32 + HOTP built on Node crypto. */

const BASE32_ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";

function base32Encode(buf) {
  let bits = 0;
  let value = 0;
  let out = "";
  for (let i = 0; i < buf.length; i++) {
    value = (value << 8) | buf[i];
    bits += 8;
    while (bits >= 5) {
      out += BASE32_ALPHABET[(value >>> (bits - 5)) & 31];
      bits -= 5;
    }
  }
  if (bits > 0) out += BASE32_ALPHABET[(value << (5 - bits)) & 31];
  return out;
}

function base32Decode(str) {
  const clean = String(str || "").toUpperCase().replace(/[^A-Z2-7]/g, "");
  let bits = 0;
  let value = 0;
  const out = [];
  for (const ch of clean) {
    const idx = BASE32_ALPHABET.indexOf(ch);
    if (idx === -1) continue;
    value = (value << 5) | idx;
    bits += 5;
    if (bits >= 8) {
      out.push((value >>> (bits - 8)) & 0xff);
      bits -= 8;
    }
  }
  return Buffer.from(out);
}

/* A fresh 160-bit base32 secret to hand to the authenticator app. */
function generateTotpSecret() {
  return base32Encode(crypto.randomBytes(20));
}

/* HOTP for a specific counter (RFC 4226 dynamic truncation). */
function hotp(secretBuf, counter) {
  const msg = Buffer.alloc(8);
  msg.writeUInt32BE(Math.floor(counter / 0x100000000), 0);
  msg.writeUInt32BE(counter >>> 0, 4);
  const digest = crypto.createHmac("sha1", secretBuf).update(msg).digest();
  const offset = digest[digest.length - 1] & 0x0f;
  const bin =
    ((digest[offset] & 0x7f) << 24) |
    ((digest[offset + 1] & 0xff) << 16) |
    ((digest[offset + 2] & 0xff) << 8) |
    (digest[offset + 3] & 0xff);
  return String(bin % 1000000).padStart(6, "0");
}

function totpAt(secret, timeMs) {
  const counter = Math.floor((timeMs || Date.now()) / 1000 / 30);
  return hotp(base32Decode(secret), counter);
}

/* Verify a submitted code against ±window steps (default ±1 = ±30s) to
   tolerate clock drift. Constant-time per candidate. */
function verifyTotp(secret, token, window) {
  const t = String(token || "").replace(/\s/g, "");
  if (!/^\d{6}$/.test(t)) return false;
  const w = Number.isInteger(window) ? window : 1;
  const secretBuf = base32Decode(secret);
  if (!secretBuf.length) return false;
  const now = Math.floor(Date.now() / 1000 / 30);
  const b = Buffer.from(t);
  for (let i = -w; i <= w; i++) {
    const counter = now + i;
    if (counter < 0) continue;
    const a = Buffer.from(hotp(secretBuf, counter));
    if (a.length === b.length && crypto.timingSafeEqual(a, b)) return true;
  }
  return false;
}

/* otpauth:// URI for the QR code / manual entry in the authenticator app. */
function otpauthURL(secret, label, issuer) {
  const iss = issuer || "Nostalgia";
  const lbl = (iss + ":" + (label || "admin"))
    .split("/")
    .map(encodeURIComponent)
    .join("/");
  return (
    "otpauth://totp/" +
    lbl +
    "?secret=" +
    encodeURIComponent(secret) +
    "&issuer=" +
    encodeURIComponent(iss) +
    "&algorithm=SHA1&digits=6&period=30"
  );
}

/* ---------- tokens ---------- */

function b64url(buf) {
  return Buffer.from(buf)
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

function fromB64url(str) {
  str = str.replace(/-/g, "+").replace(/_/g, "/");
  while (str.length % 4) str += "=";
  return Buffer.from(str, "base64").toString("utf8");
}

function sign(payloadB64) {
  return b64url(
    crypto.createHmac("sha256", getSecret()).update(payloadB64).digest()
  );
}

function createToken(payload, maxAgeMs) {
  const body = Object.assign({}, payload, { exp: Date.now() + maxAgeMs });
  const payloadB64 = b64url(JSON.stringify(body));
  return payloadB64 + "." + sign(payloadB64);
}

function verifyToken(token) {
  if (!token || typeof token !== "string") return null;
  const dot = token.lastIndexOf(".");
  if (dot < 1) return null;
  const payloadB64 = token.slice(0, dot);
  const sig = token.slice(dot + 1);
  const expected = sign(payloadB64);
  const a = Buffer.from(sig);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return null;
  let payload;
  try {
    payload = JSON.parse(fromB64url(payloadB64));
  } catch (e) {
    return null;
  }
  if (!payload || typeof payload.exp !== "number" || payload.exp < Date.now()) {
    return null;
  }
  return payload;
}

/* ---------- cookies ---------- */

const USER_COOKIE = "nostalgia_sid";
const ADMIN_COOKIE = "nostalgia_admin_sid";

function parseCookies(req) {
  const header = req.headers.cookie || "";
  const out = {};
  header.split(";").forEach((part) => {
    const i = part.indexOf("=");
    if (i === -1) return;
    out[part.slice(0, i).trim()] = decodeURIComponent(part.slice(i + 1).trim());
  });
  return out;
}

/* maxAgeMs: > 0 → persistent cookie with that lifetime; 0 → delete the cookie;
   < 0 → session cookie (no Max-Age → the browser drops it when it closes). */
function setCookie(res, name, value, maxAgeMs, opts) {
  const parts = [
    name + "=" + encodeURIComponent(value),
    "Path=/",
    "HttpOnly",
    "SameSite=" + ((opts && opts.sameSite) || "Lax"),
  ];
  if (maxAgeMs > 0) {
    parts.push("Max-Age=" + Math.floor(maxAgeMs / 1000));
  } else if (maxAgeMs === 0) {
    parts.push("Max-Age=0");
  }
  /* maxAgeMs < 0 → omit Max-Age entirely → session cookie */
  const secure =
    (opts && opts.secure) ||
    process.env.FORCE_SECURE_COOKIES === "true" ||
    process.env.NODE_ENV === "production" ||
    (process.env.SITE_URL || "").trim().startsWith("https://");
  if (secure) parts.push("Secure");
  res.append("Set-Cookie", parts.join("; "));
}

/* ---------- sessions ---------- */

const USER_SESSION_MS = SESSION_DAYS * 24 * 60 * 60 * 1000;
const ADMIN_SESSION_MS = ADMIN_SESSION_HOURS * 60 * 60 * 1000;
const ADMIN_TRUST_DAYS = 30;
const ADMIN_TRUST_MS = ADMIN_TRUST_DAYS * 24 * 60 * 60 * 1000;
const ADMIN_TRUST_COOKIE = "nostalgia_admin_trust";

/* remember=false → session cookie (logs out when the browser closes).
   The token itself still carries a 30-day exp; the cookie lifetime is what
   the "remember me" checkbox actually controls. */
function startUserSession(res, email, remember) {
  const token = createToken({ sub: email, role: "user" }, USER_SESSION_MS);
  setCookie(res, USER_COOKIE, token, remember === false ? -1 : USER_SESSION_MS);
}

function endUserSession(res) {
  setCookie(res, USER_COOKIE, "", 0);
}

function getUserSession(req) {
  const payload = verifyToken(parseCookies(req)[USER_COOKIE]);
  return payload && payload.role === "user" ? payload : null;
}

function startAdminSession(res, username, options) {
  const csrfToken = crypto.randomBytes(32).toString("base64url");
  const sessionId = crypto.randomUUID();
  const sessionFamilyId = crypto.randomUUID();
  const token = createToken({
    sub: username,
    role: "admin",
    sid: sessionId,
    sfid: sessionFamilyId,
    mfa: !!(options && options.mfaVerified),
    csrfHash: crypto.createHash("sha256").update(csrfToken).digest("hex"),
  }, ADMIN_SESSION_MS);
  setCookie(res, ADMIN_COOKIE, token, ADMIN_SESSION_MS, { sameSite: "Strict" });
  return {
    csrfToken,
    csrfHash: crypto.createHash("sha256").update(csrfToken).digest("hex"),
    sessionId,
    sessionFamilyId,
    expiresAt: new Date(Date.now() + ADMIN_SESSION_MS),
  };
}

function endAdminSession(res) {
  setCookie(res, ADMIN_COOKIE, "", 0, { sameSite: "Strict" });
}

function getAdminSession(req) {
  const payload = verifyToken(parseCookies(req)[ADMIN_COOKIE]);
  return payload && payload.role === "admin" ? payload : null;
}

/* ---------- admin "trust this device" (skip 2FA) ----------
 * A separate signed cookie, bound to the admin username, that lets a known
 * device skip the TOTP step for 30 days. It is NOT a session — it only
 * satisfies the second factor; the password is still required every login. */
function startAdminTrust(res, username) {
  const token = createToken({ sub: username, kind: "admin_trust" }, ADMIN_TRUST_MS);
  setCookie(res, ADMIN_TRUST_COOKIE, token, ADMIN_TRUST_MS, { sameSite: "Strict" });
}

function hasAdminTrust(req, username) {
  const payload = verifyToken(parseCookies(req)[ADMIN_TRUST_COOKIE]);
  return !!(payload && payload.kind === "admin_trust" && payload.sub === username);
}

function clearAdminTrust(res) {
  setCookie(res, ADMIN_TRUST_COOKIE, "", 0, { sameSite: "Strict" });
}

/* ---------- simple login rate limiting ---------- */

const attempts = new Map(); // key -> { count, resetAt }
const WINDOW_MS = 10 * 60 * 1000;
const MAX_ATTEMPTS = 8;

function rateLimited(key) {
  const now = Date.now();
  const entry = attempts.get(key);
  if (!entry || entry.resetAt < now) {
    attempts.set(key, { count: 1, resetAt: now + WINDOW_MS });
    return false;
  }
  entry.count += 1;
  return entry.count > MAX_ATTEMPTS;
}

function clearRateLimit(key) {
  attempts.delete(key);
}

module.exports = {
  setSecret,
  hashPassword,
  verifyPassword,
  needsRehash,
  codeHash,
  verifyCodeHash,
  generateCode,
  generateTotpSecret,
  totpAt,
  verifyTotp,
  otpauthURL,
  startUserSession,
  endUserSession,
  getUserSession,
  /* Exported for the Google OAuth flow, which needs a short-lived state cookie
     with exactly these semantics (HttpOnly, SameSite=Lax so it survives the
     top-level redirect back from Google, Secure in production). Reimplementing
     that in server.js would be a second, subtly different cookie policy. */
  setCookie,
  parseCookies,
  startAdminSession,
  endAdminSession,
  getAdminSession,
  startAdminTrust,
  hasAdminTrust,
  clearAdminTrust,
  rateLimited,
  clearRateLimit,
};
