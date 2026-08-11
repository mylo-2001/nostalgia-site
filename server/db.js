"use strict";

/**
 * PostgreSQL data layer.
 *
 * Connection comes from the root .env (see .env.example) — never hardcoded:
 *   DATABASE_URL  (production — takes priority)
 *   PGHOST  PGPORT  PGUSER  PGPASSWORD  PGDATABASE  (local dev fallback)
 *
 * On first start it creates the database + schema and imports any legacy
 * data from server/data/db.json (the old JSON store), then renames it.
 */

const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const { Pool, Client } = require("pg");
const catalog = require("./catalog");
const priceHistory = require("./services/price-history-service");

const DATA_DIR = path.join(__dirname, "data");

/* host/port/user/database have safe non-secret defaults; the password has
   no default on purpose — it must be supplied via .env (PGPASSWORD). */
const CFG = {
  host: process.env.PGHOST || "localhost",
  port: parseInt(process.env.PGPORT, 10) || 5432,
  user: process.env.PGUSER || "postgres",
  password: process.env.PGPASSWORD || "",
  database: process.env.PGDATABASE || "nostalgia",
};

/* Pool sizing. Every concurrent request borrows a connection and returns it
   when its query finishes, so `max` caps how many queries run against
   PostgreSQL at once — the rest queue for a few ms. It must stay BELOW the
   server's own connection limit:
     Supabase free tier → ~15-20 total, so keep the default 10.
     Own Postgres on a VPS → default limit 100, so 20-25 is comfortable.
   Override with DB_POOL_MAX in .env when we move off Supabase. */
function poolTuning() {
  const max = parseInt(process.env.DB_POOL_MAX, 10);
  return {
    max: Number.isFinite(max) && max > 0 ? max : 10,
    /* Fail fast instead of hanging forever when the pool is saturated —
       a clear 500 beats a request that never answers. */
    connectionTimeoutMillis: 10000,
    /* Release idle connections so we don't hold slots we aren't using. */
    idleTimeoutMillis: 30000,
  };
}

let pool = null;
let readPool = null;

function q(text, params) {
  return pool.query(text, params);
}

function qRead(text, params) {
  return (readPool || pool).query(text, params);
}

function getPool() {
  if (!pool) throw new Error("database_not_initialised");
  return pool;
}

function pageOpts(opts, fallbackLimit) {
  opts = opts || {};
  const page = Math.max(1, parseInt(opts.page, 10) || 1);
  const limit = Math.max(1, Math.min(100, parseInt(opts.limit, 10) || fallbackLimit || 50));
  return { page, limit, offset: (page - 1) * limit };
}

function pagination(total, page, limit) {
  return {
    page,
    limit,
    total,
    pages: Math.max(1, Math.ceil(total / limit)),
  };
}

/* ---------- bootstrap ---------- */

/** Prefer app DATABASE_URL; accept Vercel/Supabase integration aliases. */
function resolveDatabaseUrl() {
  return String(
    process.env.DATABASE_URL ||
      process.env.POSTGRES_PRISMA_URL ||
      process.env.POSTGRES_URL ||
      ""
  ).trim();
}

async function ensureDatabase() {
  if (resolveDatabaseUrl()) return; // remote URL — assume the DB exists
  const admin = new Client({
    host: CFG.host,
    port: CFG.port,
    user: CFG.user,
    password: CFG.password,
    database: "postgres",
  });
  await admin.connect();
  const exists = await admin.query("SELECT 1 FROM pg_database WHERE datname = $1", [
    CFG.database,
  ]);
  if (!exists.rowCount) {
    await admin.query('CREATE DATABASE "' + CFG.database + '"');
  }
  await admin.end();
}

const SCHEMA = `
CREATE TABLE IF NOT EXISTS settings (
  key   TEXT PRIMARY KEY,
  value JSONB NOT NULL
);

CREATE TABLE IF NOT EXISTS users (
  email             TEXT PRIMARY KEY,
  firstname         TEXT NOT NULL,
  lastname          TEXT NOT NULL,
  birth_date        TEXT NOT NULL DEFAULT '',
  newsletter_optin  BOOLEAN NOT NULL DEFAULT FALSE,
  pass_hash         TEXT NOT NULL,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS products (
  id          TEXT PRIMARY KEY,
  cat_id      TEXT NOT NULL,
  title       TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  price       NUMERIC(10,2),
  image       TEXT,
  active      BOOLEAN NOT NULL DEFAULT TRUE,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ
);

/* stock & price overrides for the static catalog and stock for custom products */
CREATE TABLE IF NOT EXISTS catalog_overrides (
  id    TEXT PRIMARY KEY,
  stock INTEGER,
  price NUMERIC(10,2)
);

CREATE TABLE IF NOT EXISTS coupons (
  code       TEXT PRIMARY KEY,
  type       TEXT NOT NULL CHECK (type IN ('percent','fixed')),
  value      NUMERIC(10,2) NOT NULL,
  active     BOOLEAN NOT NULL DEFAULT TRUE,
  expires_at DATE,
  uses       INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS orders (
  id                TEXT PRIMARY KEY,
  number            TEXT UNIQUE NOT NULL,
  status            TEXT NOT NULL DEFAULT 'new',
  payment           TEXT NOT NULL DEFAULT 'stripe',
  payment_status    TEXT NOT NULL DEFAULT 'pending',
  stripe_session_id TEXT,
  coupon            TEXT NOT NULL DEFAULT '',
  discount          NUMERIC(10,2) NOT NULL DEFAULT 0,
  total             NUMERIC(10,2) NOT NULL DEFAULT 0,
  lang              TEXT NOT NULL DEFAULT 'el',
  user_email        TEXT,
  customer          JSONB NOT NULL,
  gift              JSONB,
  items             JSONB NOT NULL,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at        TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS orders_email_idx ON orders ((customer->>'email'));
CREATE INDEX IF NOT EXISTS orders_user_email_idx ON orders (user_email);
CREATE INDEX IF NOT EXISTS orders_created_at_idx ON orders (created_at DESC);
CREATE INDEX IF NOT EXISTS orders_status_idx ON orders (status);
CREATE INDEX IF NOT EXISTS orders_stripe_session_idx ON orders (stripe_session_id);

CREATE TABLE IF NOT EXISTS newsletter (
  email      TEXT PRIMARY KEY,
  firstname  TEXT NOT NULL DEFAULT '',
  lastname   TEXT NOT NULL DEFAULT '',
  source     TEXT NOT NULL DEFAULT 'site',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS newsletter_created_at_idx ON newsletter (created_at DESC);

CREATE TABLE IF NOT EXISTS messages (
  id         TEXT PRIMARY KEY,
  last_name  TEXT NOT NULL DEFAULT '',
  first_name TEXT NOT NULL DEFAULT '',
  email      TEXT NOT NULL,
  phone      TEXT NOT NULL DEFAULT '',
  country    TEXT NOT NULL DEFAULT '',
  subject    TEXT NOT NULL DEFAULT '',
  message    TEXT NOT NULL,
  lang       TEXT NOT NULL DEFAULT 'el',
  attachment_name TEXT NOT NULL DEFAULT '',
  attachment_mime TEXT NOT NULL DEFAULT '',
  attachment_size INTEGER NOT NULL DEFAULT 0,
  attachment_storage_name TEXT NOT NULL DEFAULT '',
  is_read    BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS messages_created_at_idx ON messages (created_at DESC);
CREATE INDEX IF NOT EXISTS messages_unread_idx ON messages (created_at DESC) WHERE is_read = FALSE;

CREATE TABLE IF NOT EXISTS reviews (
  id          TEXT PRIMARY KEY,
  product_id  TEXT NOT NULL,
  name        TEXT NOT NULL,
  rating      INTEGER NOT NULL CHECK (rating BETWEEN 1 AND 5),
  text        TEXT NOT NULL DEFAULT '',
  user_email  TEXT,
  status      TEXT NOT NULL DEFAULT 'pending'
              CHECK (status IN ('pending','approved','rejected')),
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS reviews_product_idx ON reviews (product_id, status);
CREATE INDEX IF NOT EXISTS reviews_status_created_at_idx ON reviews (status, created_at DESC);
CREATE INDEX IF NOT EXISTS reviews_status_rating_idx ON reviews (status, rating DESC, created_at DESC);

CREATE SEQUENCE IF NOT EXISTS order_number_seq;
CREATE SEQUENCE IF NOT EXISTS product_id_seq;
CREATE SEQUENCE IF NOT EXISTS variant_id_seq;

/* sale price (discount) — added after the original schema shipped */
ALTER TABLE products          ADD COLUMN IF NOT EXISTS sale_price NUMERIC(10,2);
ALTER TABLE catalog_overrides ADD COLUMN IF NOT EXISTS sale_price NUMERIC(10,2);
/* optional sale expiry — when set, the discount auto-ends at this instant */
ALTER TABLE products          ADD COLUMN IF NOT EXISTS sale_until TIMESTAMPTZ;
ALTER TABLE catalog_overrides ADD COLUMN IF NOT EXISTS sale_until TIMESTAMPTZ;
ALTER TABLE coupons              ADD COLUMN IF NOT EXISTS name TEXT NOT NULL DEFAULT '';
ALTER TABLE coupons              ADD COLUMN IF NOT EXISTS max_uses INTEGER;
ALTER TABLE coupons              ADD COLUMN IF NOT EXISTS free_shipping BOOLEAN NOT NULL DEFAULT FALSE;
/* saved default shipping address for the account (single address, as JSON) */
ALTER TABLE users                ADD COLUMN IF NOT EXISTS address JSONB;
ALTER TABLE reviews              ADD COLUMN IF NOT EXISTS title TEXT NOT NULL DEFAULT '';
/* gallery: extra product photos (JSON array of URLs); image stays the thumbnail */
ALTER TABLE products             ADD COLUMN IF NOT EXISTS images TEXT;
/* English (bilingual) counterparts for custom-product name & short description.
   Empty = fall back to the Greek value on the storefront. */
ALTER TABLE products             ADD COLUMN IF NOT EXISTS title_en TEXT NOT NULL DEFAULT '';
ALTER TABLE products             ADD COLUMN IF NOT EXISTS description_en TEXT NOT NULL DEFAULT '';
/* order fulfillment / operations fields — added after the original schema shipped */
ALTER TABLE orders               ADD COLUMN IF NOT EXISTS tracking TEXT NOT NULL DEFAULT '';
ALTER TABLE orders               ADD COLUMN IF NOT EXISTS courier  TEXT NOT NULL DEFAULT '';
ALTER TABLE orders               ADD COLUMN IF NOT EXISTS assignee TEXT NOT NULL DEFAULT '';
ALTER TABLE orders               ADD COLUMN IF NOT EXISTS notes    TEXT NOT NULL DEFAULT '';
ALTER TABLE orders               ADD COLUMN IF NOT EXISTS events   JSONB NOT NULL DEFAULT '[]'::jsonb;
/* shipping status is a separate axis from order status and payment status */
ALTER TABLE orders               ADD COLUMN IF NOT EXISTS shipping_status TEXT NOT NULL DEFAULT 'not_ready';
/* random capability token for guest order tracking (no login, no guessable id) */
ALTER TABLE orders               ADD COLUMN IF NOT EXISTS access_token TEXT;
CREATE INDEX IF NOT EXISTS orders_access_token_idx ON orders (access_token);
CREATE INDEX IF NOT EXISTS users_created_at_idx ON users (created_at DESC);
CREATE INDEX IF NOT EXISTS products_active_created_at_idx ON products (active, created_at ASC);
CREATE INDEX IF NOT EXISTS coupons_created_at_idx ON coupons (created_at DESC);

CREATE TABLE IF NOT EXISTS auth_codes (
  email      TEXT PRIMARY KEY,
  code_hash  TEXT NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  attempts   INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

/* Security audit trail: logins, admin actions, orders, account changes.
   Never stores passwords or full card data — only who/what/when. */
CREATE TABLE IF NOT EXISTS audit_log (
  id         BIGSERIAL PRIMARY KEY,
  type       TEXT NOT NULL,
  actor      TEXT,
  ip         TEXT,
  meta       JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS audit_log_created_at_idx ON audit_log (created_at DESC);
CREATE INDEX IF NOT EXISTS audit_log_type_idx ON audit_log (type, created_at DESC);

/* Rich product page content (static + custom products) */
CREATE TABLE IF NOT EXISTS product_details (
  id         TEXT PRIMARY KEY,
  details    JSONB NOT NULL DEFAULT '{}'::jsonb,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

/* Colour variants of a base product. product_id points at either a static
   catalog id (e.g. cat1-1) or a custom product id (cu-N). Each variant is an
   independently purchasable unit with its own SKU, stock, price and images;
   name/description/category/content stay on the base product. */
CREATE TABLE IF NOT EXISTS product_variants (
  id          TEXT PRIMARY KEY,
  product_id  TEXT NOT NULL,
  color       TEXT NOT NULL DEFAULT '',
  color_en    TEXT NOT NULL DEFAULT '',
  color_hex   TEXT NOT NULL DEFAULT '',
  sku         TEXT NOT NULL DEFAULT '',
  price       NUMERIC(10,2),
  sale_price  NUMERIC(10,2),
  sale_until  TIMESTAMPTZ,
  stock       INTEGER,
  images      TEXT,
  available   BOOLEAN NOT NULL DEFAULT TRUE,
  position    INTEGER NOT NULL DEFAULT 0,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS product_variants_product_id_idx ON product_variants (product_id, position);
`;

async function seedDefaultStock() {
  for (const id of Object.keys(catalog.DEFAULT_STOCK)) {
    await q(
      "INSERT INTO catalog_overrides (id, stock) VALUES ($1, $2) ON CONFLICT (id) DO NOTHING",
      [id, catalog.DEFAULT_STOCK[id]]
    );
  }
}

/* One-time import of the old JSON store, so nothing already saved is lost. */
async function importLegacyJson() {
  const legacyFile = path.join(DATA_DIR, "db.json");
  if (!fs.existsSync(legacyFile)) return;
  let legacy;
  try {
    legacy = JSON.parse(fs.readFileSync(legacyFile, "utf8"));
  } catch (e) {
    return;
  }

  if (legacy.secret) {
    await setSettingIfMissing("secret", legacy.secret);
  }
  if (legacy.admin && legacy.admin.passHash) {
    await setSettingIfMissing("admin", legacy.admin);
  }
  for (const u of legacy.users || []) {
    await q(
      `INSERT INTO users (email, firstname, lastname, birth_date, newsletter_optin, pass_hash, created_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7) ON CONFLICT (email) DO NOTHING`,
      [u.email, u.firstname, u.lastname, u.birthDate || "", !!u.newsletterOptin, u.passHash, u.createdAt || new Date().toISOString()]
    );
  }
  for (const n of legacy.newsletter || []) {
    await q(
      `INSERT INTO newsletter (email, firstname, lastname, source, created_at)
       VALUES ($1,$2,$3,$4,$5) ON CONFLICT (email) DO NOTHING`,
      [n.email, n.firstname || "", n.lastname || "", n.source || "site", n.at || new Date().toISOString()]
    );
  }
  for (const m of legacy.messages || []) {
    await q(
      `INSERT INTO messages (id, last_name, first_name, email, phone, country, subject, message, lang, is_read, created_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11) ON CONFLICT (id) DO NOTHING`,
      [m.id, m.lastName || "", m.firstName || "", m.email, m.phone || "", m.country || "", m.subject || "", m.message, m.lang || "el", !!m.read, m.at || new Date().toISOString()]
    );
  }
  for (const p of legacy.products || []) {
    await q(
      `INSERT INTO products (id, cat_id, title, description, price, image, active, created_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8) ON CONFLICT (id) DO NOTHING`,
      [p.id, p.catId, p.title, p.description || "", p.price, p.image, p.active !== false, p.createdAt || new Date().toISOString()]
    );
  }
  for (const id of Object.keys(legacy.stock || {})) {
    await q(
      `INSERT INTO catalog_overrides (id, stock) VALUES ($1,$2)
       ON CONFLICT (id) DO UPDATE SET stock = EXCLUDED.stock`,
      [id, legacy.stock[id]]
    );
  }
  for (const o of legacy.orders || []) {
    await q(
      `INSERT INTO orders (id, number, status, payment, payment_status, coupon, discount, total, lang, user_email, customer, gift, items, created_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14) ON CONFLICT (id) DO NOTHING`,
      [o.id, o.number, o.status, o.payment, "pending", o.coupon || "", 0, o.total || 0, o.lang || "el", o.userEmail, JSON.stringify(o.customer), JSON.stringify(o.gift || null), JSON.stringify(o.items), o.createdAt]
    );
  }
  if ((legacy.orders || []).length) {
    await q("SELECT setval('order_number_seq', $1, true)", [legacy.orderSeq || legacy.orders.length]);
  }
  if (legacy.productSeq) {
    await q("SELECT setval('product_id_seq', $1, true)", [legacy.productSeq]);
  }
  fs.renameSync(legacyFile, legacyFile + ".imported");
  console.log("[db] imported legacy server/data/db.json into PostgreSQL");
}

async function init() {
  await ensureDatabase();
  const databaseUrl = resolveDatabaseUrl();
  const poolOpts = databaseUrl
    ? { connectionString: databaseUrl, ...poolTuning() }
    : { ...CFG, ...poolTuning() };
  if (
    databaseUrl &&
    !/localhost|127\.0\.0\.1/i.test(databaseUrl)
  ) {
    const sslFlag = String(process.env.PG_SSL_REJECT_UNAUTHORIZED || "").trim().toLowerCase();
    let rejectUnauthorized = process.env.NODE_ENV === "production";
    if (sslFlag === "true") rejectUnauthorized = true;
    if (sslFlag === "false") rejectUnauthorized = false;
    /* pg v8 treats sslmode=require like verify-full — strip it so our ssl opts apply */
    poolOpts.connectionString = String(poolOpts.connectionString).replace(
      /([?&])sslmode=[^&]*&?/,
      "$1"
    ).replace(/[?&]$/, "");
    poolOpts.ssl = { rejectUnauthorized };
  }
  pool = new Pool(poolOpts);
  if (process.env.READ_DATABASE_URL) {
    const readPoolOpts = {
      connectionString: process.env.READ_DATABASE_URL,
      ...poolTuning(),
    };
    if (!/localhost|127\.0\.0\.1/i.test(process.env.READ_DATABASE_URL)) {
      const sslFlag = String(process.env.PG_SSL_REJECT_UNAUTHORIZED || "").trim().toLowerCase();
      let rejectUnauthorized = process.env.NODE_ENV === "production";
      if (sslFlag === "true") rejectUnauthorized = true;
      if (sslFlag === "false") rejectUnauthorized = false;
      readPoolOpts.connectionString = String(readPoolOpts.connectionString).replace(
        /([?&])sslmode=[^&]*&?/,
        "$1"
      ).replace(/[?&]$/, "");
      readPoolOpts.ssl = { rejectUnauthorized };
    }
    readPool = new Pool(readPoolOpts);
  }
  await applyBootstrapSchema();
  await seedDefaultStock();
  await importLegacyJson();
}

/* On Vercel, many cold starts hit / (and favicon/health) at once. Each runs
   CREATE TABLE/INDEX IF NOT EXISTS. Concurrent DDL on the same relations
   deadlocks in Postgres (40P01) and the whole site returns 500. One advisory
   lock serializes bootstrap; short retries cover the rare race that remains. */
async function applyBootstrapSchema() {
  const lockKey = 87231405; /* stable int — nostalgia bootstrap schema */
  const maxAttempts = 5;
  let lastError = null;
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    const client = await pool.connect();
    try {
      await client.query("BEGIN");
      await client.query("SELECT pg_advisory_xact_lock($1)", [lockKey]);
      await client.query(SCHEMA);
      await client.query("COMMIT");
      return;
    } catch (error) {
      try {
        await client.query("ROLLBACK");
      } catch (_) {}
      lastError = error;
      const code = error && error.code;
      const msg = String((error && error.message) || "");
      const isDeadlock = code === "40P01" || /deadlock detected/i.test(msg);
      if (!isDeadlock || attempt === maxAttempts) throw error;
      await new Promise(function (resolve) {
        setTimeout(resolve, 80 * attempt + Math.floor(Math.random() * 120));
      });
    } finally {
      client.release();
    }
  }
  throw lastError || new Error("schema_bootstrap_failed");
}

/* ---------- settings ---------- */

async function getSetting(key) {
  const r = await q("SELECT value FROM settings WHERE key = $1", [key]);
  return r.rowCount ? r.rows[0].value : null;
}

async function setSetting(key, value) {
  await q(
    `INSERT INTO settings (key, value) VALUES ($1, $2)
     ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value`,
    [key, JSON.stringify(value)]
  );
}

async function setSettingIfMissing(key, value) {
  await q(
    "INSERT INTO settings (key, value) VALUES ($1, $2) ON CONFLICT (key) DO NOTHING",
    [key, JSON.stringify(value)]
  );
}

/* ---------- users ---------- */

function rowToUser(r) {
  return {
    email: r.email,
    firstname: r.firstname,
    lastname: r.lastname,
    birthDate: r.birth_date || "",
    newsletterOptin: r.newsletter_optin,
    address: r.address || null,
    passHash: r.pass_hash,
    googleSub: r.google_sub || null,
    authProvider: r.auth_provider || "password",
    active: r.active !== false,
    orderCount: r.order_count != null ? Number(r.order_count) : 0,
    lastOrderAt: r.last_order_at || null,
    createdAt: r.created_at,
  };
}

/* Every order is matched to a customer by email — guest checkouts store it in
   customer->>'email', account checkouts also set user_email. Shared by the
   users list (bulk) and the single-customer detail lookup below. */
const ORDER_STATS_BY_EMAIL_SQL = `
  SELECT lower(btrim(coalesce(customer->>'email', user_email, ''))) AS email,
         COUNT(*)::int AS order_count,
         MAX(created_at) AS last_order_at
    FROM orders
   WHERE lower(btrim(coalesce(customer->>'email', user_email, ''))) <> ''
   GROUP BY 1
`;

async function getUser(email) {
  const r = await q("SELECT * FROM users WHERE email = $1", [email]);
  return r.rowCount ? rowToUser(r.rows[0]) : null;
}

async function createUser(u) {
  await q(
    `INSERT INTO users (email, firstname, lastname, birth_date, newsletter_optin, pass_hash,
                        google_sub, auth_provider)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8)`,
    [
      u.email,
      u.firstname,
      u.lastname,
      u.birthDate,
      u.newsletterOptin,
      u.passHash,
      u.googleSub || null,
      u.authProvider || "password",
    ]
  );
}

/* ---------- Google identities ----------
   The subject id, not the email, is the lasting link: a Google account's email
   can be changed by its owner, and matching on that alone would silently
   detach them from their own order history. */

async function getUserByGoogleSub(sub) {
  if (!sub) return null;
  const r = await q("SELECT * FROM users WHERE google_sub = $1", [String(sub)]);
  return r.rowCount ? rowToUser(r.rows[0]) : null;
}

/* Attaches a Google identity to an account that already exists under the same
   email — the person who registered with a password and later pressed the
   Google button. Guarded so a sub already claimed by another row cannot be
   moved: that would hand one person's account to another. */
async function linkGoogleAccount(email, sub) {
  const r = await q(
    `UPDATE users
        SET google_sub = $2
      WHERE email = $1
        AND (google_sub IS NULL OR google_sub = $2)
        AND NOT EXISTS (SELECT 1 FROM users WHERE google_sub = $2 AND email <> $1)
      RETURNING *`,
    [email, String(sub)]
  );
  return r.rowCount ? rowToUser(r.rows[0]) : null;
}

/* Birth date is optional for Google accounts; it is offered after the first
   sign-in and may stay empty forever. */
async function setUserBirthDate(email, birthDate) {
  const r = await q(
    "UPDATE users SET birth_date = $2 WHERE email = $1 RETURNING *",
    [email, String(birthDate || "")]
  );
  return r.rowCount ? rowToUser(r.rows[0]) : null;
}

async function listUsers() {
  const r = await q("SELECT * FROM users ORDER BY created_at DESC");
  return r.rows.map(rowToUser);
}

async function listUsersPage(opts) {
  const p = pageOpts(opts, 50);
  const total = await q("SELECT COUNT(*)::int AS total FROM users");
  const r = await q(
    `SELECT u.*, o.order_count, o.last_order_at
       FROM (SELECT * FROM users ORDER BY created_at DESC LIMIT $1 OFFSET $2) u
       LEFT JOIN (${ORDER_STATS_BY_EMAIL_SQL}) o ON o.email = lower(btrim(u.email))
      ORDER BY u.created_at DESC`,
    [p.limit, p.offset]
  );
  return {
    users: r.rows.map(rowToUser),
    pagination: pagination(total.rows[0].total, p.page, p.limit),
  };
}

async function setUserActive(email, active) {
  const r = await q("UPDATE users SET active = $2 WHERE email = $1", [email, !!active]);
  return r.rowCount > 0;
}

/* Partial update of an account's own profile. Only whitelisted fields. */
async function updateUser(email, fields) {
  const cols = {
    firstname: "firstname",
    lastname: "lastname",
    newsletterOptin: "newsletter_optin",
    address: "address",
  };
  const sets = [];
  const vals = [email];
  let i = 2;
  for (const [key, col] of Object.entries(cols)) {
    if (Object.prototype.hasOwnProperty.call(fields, key)) {
      sets.push(col + " = $" + i++);
      vals.push(
        col === "address"
          ? fields[key] == null
            ? null
            : JSON.stringify(fields[key])
          : fields[key]
      );
    }
  }
  if (!sets.length) return;
  await q("UPDATE users SET " + sets.join(", ") + " WHERE email = $1", vals);
}

async function setUserPassword(email, passHash) {
  await q("UPDATE users SET pass_hash = $2 WHERE email = $1", [email, passHash]);
}

/* ---------- one-time password codes (reset / change via email) ---------- */

async function setAuthCode(email, codeHash, expiresAt) {
  await q(
    `INSERT INTO auth_codes (email, code_hash, expires_at, attempts)
     VALUES ($1, $2, $3, 0)
     ON CONFLICT (email) DO UPDATE
       SET code_hash = EXCLUDED.code_hash,
           expires_at = EXCLUDED.expires_at,
           attempts = 0,
           created_at = now()`,
    [email, codeHash, expiresAt]
  );
}

async function getAuthCode(email) {
  const r = await q("SELECT * FROM auth_codes WHERE email = $1", [email]);
  if (!r.rowCount) return null;
  const x = r.rows[0];
  return {
    email: x.email,
    codeHash: x.code_hash,
    expiresAt: x.expires_at,
    attempts: x.attempts,
  };
}

async function bumpAuthCodeAttempts(email) {
  await q("UPDATE auth_codes SET attempts = attempts + 1 WHERE email = $1", [email]);
}

async function deleteAuthCode(email) {
  await q("DELETE FROM auth_codes WHERE email = $1", [email]);
}

/* ---------- newsletter ---------- */

/* Records (or RE-records) consent. A returning subscriber — someone who had
   previously unsubscribed and opts in again — must show up as fresh consent
   (status back to 'subscribed', consented_at bumped to now), not be silently
   ignored. Keeps any already-known name if this submission didn't supply one. */
function rowToSubscriber(x) {
  return {
    email: x.email,
    firstname: x.firstname,
    lastname: x.lastname,
    source: x.source,
    status: x.status,
    consentedAt: x.consented_at,
    unsubscribedAt: x.unsubscribed_at,
    confirmedAt: x.confirmed_at,
    consentPolicyVersion: x.consent_policy_version,
    consentNotice: x.consent_notice,
    createdAt: x.created_at,
  };
}

async function listSubscribers() {
  const r = await q("SELECT * FROM newsletter ORDER BY created_at DESC");
  return r.rows.map(rowToSubscriber);
}

/* ---------- cookie consent log ----------
   Append-only: every choice is a new row, never an update. A consent record
   that can be overwritten proves nothing about what was agreed and when, and
   the history is exactly what a regulator asks for. */

async function recordCookieConsent(c) {
  const r = await q(
    `INSERT INTO cookie_consents (visitor_id, analytics, marketing, policy_version, source, ip_hash, user_agent)
     VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING id, created_at`,
    [
      String(c.visitorId || "").slice(0, 64),
      !!c.analytics,
      !!c.marketing,
      String(c.policyVersion || "v1").slice(0, 20),
      ["banner", "settings", "revoked"].indexOf(c.source) >= 0 ? c.source : "banner",
      c.ipHash || null,
      String(c.userAgent || "").slice(0, 300) || null,
    ]
  );
  return r.rows[0];
}

/** Latest choice per visitor, newest first — the admin's evidence view. */
async function listCookieConsents(limit) {
  const r = await q(
    `SELECT id, visitor_id, analytics, marketing, policy_version, source, created_at
       FROM cookie_consents ORDER BY created_at DESC LIMIT $1`,
    [Math.min(Math.max(parseInt(limit, 10) || 100, 1), 500)]
  );
  return r.rows.map((x) => ({
    id: x.id,
    visitorId: x.visitor_id,
    analytics: x.analytics,
    marketing: x.marketing,
    policyVersion: x.policy_version,
    source: x.source,
    createdAt: x.created_at,
  }));
}

/** Every record for one browser — what you produce if a visitor disputes. */
async function cookieConsentHistory(visitorId) {
  const r = await q(
    `SELECT analytics, marketing, policy_version, source, created_at
       FROM cookie_consents WHERE visitor_id = $1 ORDER BY created_at DESC LIMIT 100`,
    [String(visitorId || "").slice(0, 64)]
  );
  return r.rows;
}

/* ---------- mass-mail audiences ----------
   Two audiences on two different legal bases — see the comment at the top of
   migrations/033_announcements.up.sql. Both queries are the ONLY sanctioned
   way to build a bulk recipient list; anything else risks mailing people who
   opted out. */

/** Consented marketing audience: newsletter rows still in 'subscribed'. */
async function listMarketingRecipients() {
  const r = await q(
    `SELECT email, firstname FROM newsletter
      WHERE status = 'subscribed' AND email IS NOT NULL AND btrim(email) <> ''
      ORDER BY email`
  );
  return r.rows.map((x) => ({ email: x.email, firstname: x.firstname || "" }));
}

async function listCampaignRecipients(audience) {
  const a = audience || {};
  if (a.type === "specific_email") {
    const email = String(a.email || "").trim().toLowerCase();
    if (!email) return [];
    const r = await q(`SELECT email, firstname FROM newsletter
      WHERE lower(email) = $1 AND status = 'subscribed'`, [email]);
    return r.rows.map((x) => ({ email: x.email, firstname: x.firstname || "" }));
  }
  /* Purchase history and an account flag are not standalone marketing
     permission. Every bulk segment is restricted to verified newsletter
     subscribers. */
  return listMarketingRecipients();
}

function rowToMarketingCampaign(r) {
  return { id: r.id, eventId: r.event_id, kind: r.kind, sourceId: r.source_id, subject: r.subject, snapshot: r.snapshot, audience: r.audience, status: r.status, recipientCount: r.recipient_count, sentCount: r.sent_count, failedCount: r.failed_count, createdBy: r.created_by, createdAt: r.created_at, finishedAt: r.finished_at };
}

async function createMarketingCampaign(campaign, recipients) {
  const existing = await q("SELECT * FROM marketing_campaigns WHERE event_id = $1", [campaign.eventId]);
  if (existing.rowCount) return { campaign: rowToMarketingCampaign(existing.rows[0]), created: false };
  const unique = new Map((recipients || []).map((r) => [String(r.email || "").trim().toLowerCase(), r])).entries();
  const list = [...unique].filter(([email]) => email).map(([, r]) => ({ email: String(r.email).trim().toLowerCase(), firstname: r.firstname || "" }));
  let inserted;
  try {
    inserted = await q(`INSERT INTO marketing_campaigns (id,event_id,kind,source_id,subject,snapshot,audience,recipient_count,created_by) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING *`, [campaign.id, campaign.eventId, campaign.kind, campaign.sourceId, campaign.subject, JSON.stringify(campaign.snapshot), JSON.stringify(campaign.audience), list.length, campaign.createdBy || null]);
  } catch (error) {
    if (error && error.code === "23505") {
      const race = await q("SELECT * FROM marketing_campaigns WHERE event_id = $1", [campaign.eventId]);
      if (race.rowCount) return { campaign: rowToMarketingCampaign(race.rows[0]), created: false };
    }
    throw error;
  }
  for (const r of list) await q("INSERT INTO marketing_campaign_recipients (campaign_id,email,firstname) VALUES ($1,$2,$3) ON CONFLICT DO NOTHING", [campaign.id, r.email, r.firstname]);
  return { campaign: rowToMarketingCampaign(inserted.rows[0]), created: true };
}

async function claimMarketingRecipient(campaignId) {
  const r = await q(`UPDATE marketing_campaign_recipients SET status='sending', attempts=attempts+1 WHERE id = (SELECT id FROM marketing_campaign_recipients WHERE campaign_id=$1 AND status='queued' ORDER BY id FOR UPDATE SKIP LOCKED LIMIT 1) RETURNING *`, [campaignId]);
  return r.rows[0] || null;
}

async function requeueMarketingRecipients(campaignId) {
  await q("UPDATE marketing_campaign_recipients SET status='queued' WHERE campaign_id=$1 AND status='sending'", [campaignId]);
}

async function finishMarketingRecipient(id, ok, error) {
  const r = await q("UPDATE marketing_campaign_recipients SET status=$2, last_error=$3, sent_at=CASE WHEN $2='sent' THEN now() ELSE sent_at END WHERE id=$1 RETURNING *", [id, ok ? "sent" : "failed", error ? String(error).slice(0, 1000) : null]);
  if (r.rows[0]) {
    await q("UPDATE marketing_campaigns SET sent_count = sent_count + CASE WHEN $2='sent' THEN 1 ELSE 0 END, failed_count = failed_count + CASE WHEN $2='failed' THEN 1 ELSE 0 END WHERE id = $1", [r.rows[0].campaign_id, ok ? "sent" : "failed"]);
  }
  return r.rows[0] || null;
}

async function finishMarketingCampaign(id) {
  const r = await q(`UPDATE marketing_campaigns SET status=CASE WHEN failed_count=0 AND sent_count=recipient_count THEN 'sent' WHEN sent_count > 0 THEN 'partial' ELSE 'failed' END, finished_at=now() WHERE id=$1 RETURNING *`, [id]);
  return r.rows[0] ? rowToMarketingCampaign(r.rows[0]) : null;
}

async function listQueuedMarketingCampaigns(limit) {
  const r = await q("SELECT * FROM marketing_campaigns WHERE status IN ('queued','sending') ORDER BY created_at ASC LIMIT $1", [Math.min(Math.max(parseInt(limit, 10) || 10, 1), 50)]);
  return r.rows.map(rowToMarketingCampaign);
}

/** Service-notice audience: active account holders. */
async function listServiceRecipients() {
  const r = await q(
    `SELECT email, firstname FROM users
      WHERE active = TRUE AND email IS NOT NULL AND btrim(email) <> ''
      ORDER BY created_at DESC`
  );
  return r.rows.map((x) => ({ email: x.email, firstname: x.firstname || "" }));
}

function rowToAnnouncement(r) {
  return {
    id: r.id,
    kind: r.kind,
    subject: r.subject,
    body: r.body,
    segments: r.segments || [],
    status: r.status,
    recipientCount: r.recipient_count,
    sentCount: r.sent_count,
    failedCount: r.failed_count,
    failures: r.failures || [],
    createdBy: r.created_by,
    createdAt: r.created_at,
    sentAt: r.sent_at,
  };
}

/* Written BEFORE the first message goes out, so an interrupted send still
   leaves a record of what was attempted. */
async function createAnnouncement(a) {
  const r = await q(
    `INSERT INTO announcements (id, kind, subject, body, segments, status, recipient_count, created_by)
     VALUES ($1,$2,$3,$4,$5,'sending',$6,$7) RETURNING *`,
    [a.id, a.kind, a.subject, a.body, JSON.stringify(a.segments || []), a.recipientCount || 0, a.createdBy || null]
  );
  return rowToAnnouncement(r.rows[0]);
}

async function finishAnnouncement(id, res) {
  const r = await q(
    `UPDATE announcements
        SET status = $2, sent_count = $3, failed_count = $4, failures = $5, sent_at = now()
      WHERE id = $1 RETURNING *`,
    [id, res.status, res.sent || 0, res.failed || 0, JSON.stringify((res.failures || []).slice(0, 20))]
  );
  return r.rows[0] ? rowToAnnouncement(r.rows[0]) : null;
}

async function listAnnouncements(limit) {
  const r = await q(
    "SELECT * FROM announcements ORDER BY created_at DESC LIMIT $1",
    [Math.min(Math.max(parseInt(limit, 10) || 25, 1), 100)]
  );
  return r.rows.map(rowToAnnouncement);
}

async function listSubscribersPage(opts) {
  const p = pageOpts(opts, 50);
  const total = await q("SELECT COUNT(*)::int AS total FROM newsletter");
  const r = await q("SELECT * FROM newsletter ORDER BY created_at DESC LIMIT $1 OFFSET $2", [
    p.limit,
    p.offset,
  ]);
  return {
    subscribers: r.rows.map(rowToSubscriber),
    pagination: pagination(total.rows[0].total, p.page, p.limit),
  };
}

/* Soft opt-out — keeps the row (and its original consent history) instead of
   deleting it, so a stray re-signup can't happen without fresh consent and
   the opt-in/opt-out trail stays intact. */
async function unsubscribeSubscriber(email) {
  const r = await q(
    `UPDATE newsletter SET status='unsubscribed', unsubscribed_at=now(),
       confirmation_token_hash=NULL, confirmation_expires_at=NULL
     WHERE lower(email)=lower($1) AND status IN ('pending','subscribed')`,
    [email]
  );
  await q("UPDATE users SET newsletter_optin=FALSE WHERE lower(email)=lower($1)", [email]);
  return r.rowCount > 0;
}

/* True hard delete — reserved for GDPR erasure (deleteUserAccount), never a
   plain admin "remove from newsletter" action (that's unsubscribeSubscriber). */
async function deleteSubscriber(email) {
  const r = await q("DELETE FROM newsletter WHERE email = $1", [email]);
  return r.rowCount > 0;
}

/* ---------- messages ---------- */

async function addMessage(m) {
  await q(
    `INSERT INTO messages (id, last_name, first_name, email, phone, country, subject, message, lang, attachment_name, attachment_mime, attachment_size, attachment_storage_name)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)`,
    [m.id, m.lastName, m.firstName, m.email, m.phone, m.country, m.subject, m.message, m.lang, m.attachmentName || "", m.attachmentMime || "", m.attachmentSize || 0, m.attachmentStorageName || ""]
  );
}

async function listMessages() {
  const r = await q("SELECT * FROM messages ORDER BY created_at DESC");
  return r.rows.map((x) => ({
    id: x.id,
    lastName: x.last_name,
    firstName: x.first_name,
    email: x.email,
    phone: x.phone,
    country: x.country,
    subject: x.subject,
    message: x.message,
    lang: x.lang,
    attachmentName: x.attachment_name || "",
    attachmentMime: x.attachment_mime || "",
    attachmentSize: Number(x.attachment_size || 0),
    attachmentStorageName: x.attachment_storage_name || "",
    read: x.is_read,
    at: x.created_at,
  }));
}

async function getMessage(id) {
  const r = await q("SELECT * FROM messages WHERE id = $1 LIMIT 1", [id]);
  return r.rows[0] ? rowToMessage(r.rows[0]) : null;
}

function rowToMessage(x) {
  return {
    id: x.id,
    lastName: x.last_name,
    firstName: x.first_name,
    email: x.email,
    phone: x.phone,
    country: x.country,
    subject: x.subject,
    message: x.message,
    lang: x.lang,
    attachmentName: x.attachment_name || "",
    attachmentMime: x.attachment_mime || "",
    attachmentSize: Number(x.attachment_size || 0),
    attachmentStorageName: x.attachment_storage_name || "",
    read: x.is_read,
    at: x.created_at,
  };
}

async function listMessagesPage(opts) {
  const p = pageOpts(opts, 50);
  const total = await q("SELECT COUNT(*)::int AS total FROM messages");
  const r = await q("SELECT * FROM messages ORDER BY created_at DESC LIMIT $1 OFFSET $2", [
    p.limit,
    p.offset,
  ]);
  return {
    messages: r.rows.map(rowToMessage),
    pagination: pagination(total.rows[0].total, p.page, p.limit),
  };
}

async function setMessageRead(id, read) {
  const r = await q("UPDATE messages SET is_read = $2 WHERE id = $1", [id, read]);
  return r.rowCount > 0;
}

async function deleteMessage(id) {
  const r = await q("DELETE FROM messages WHERE id = $1", [id]);
  return r.rowCount > 0;
}

/* ---------- custom products ---------- */

function parseImages(raw, fallbackImage) {
  if (Array.isArray(raw)) return raw.filter(Boolean);
  if (typeof raw === "string" && raw.trim()) {
    try {
      const arr = JSON.parse(raw);
      if (Array.isArray(arr)) return arr.filter(Boolean);
    } catch (e) {}
  }
  return fallbackImage ? [fallbackImage] : [];
}

function rowToProduct(r) {
  return {
    id: r.id,
    catId: r.cat_id,
    title: r.title,
    titleEn: r.title_en || "",
    description: r.description,
    descriptionEn: r.description_en || "",
    price: r.price != null ? parseFloat(r.price) : null,
    salePrice: r.sale_price != null ? parseFloat(r.sale_price) : null,
    saleUntil: r.sale_until || null,
    image: r.image,
    images: parseImages(r.images, r.image),
    active: r.active,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
  };
}

async function listCustomProducts(activeOnly, opts) {
  const query = opts && opts.read ? qRead : q;
  const r = await query(
    "SELECT * FROM products" +
      (activeOnly ? " WHERE active = TRUE" : "") +
      " ORDER BY created_at ASC"
  );
  return r.rows.map(rowToProduct);
}

async function getCustomProduct(id) {
  const r = await q("SELECT * FROM products WHERE id = $1", [id]);
  return r.rowCount ? rowToProduct(r.rows[0]) : null;
}

async function nextProductId() {
  const r = await q("SELECT nextval('product_id_seq') AS n");
  return "cu-" + r.rows[0].n;
}

async function createCustomProduct(p) {
  await q(
    `INSERT INTO products (id, cat_id, title, title_en, description, description_en, price, sale_price, sale_until, image, images, active)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)`,
    [
      p.id,
      p.catId,
      p.title,
      p.titleEn || "",
      p.description,
      p.descriptionEn || "",
      p.price,
      p.salePrice != null ? p.salePrice : null,
      p.saleUntil != null ? p.saleUntil : null,
      p.image,
      Array.isArray(p.images) && p.images.length ? JSON.stringify(p.images) : null,
      p.active !== false,
    ]
  );
}

async function updateCustomProduct(id, fields) {
  const sets = [];
  const vals = [id];
  let i = 2;
  for (const [col, val] of Object.entries(fields)) {
    sets.push(col + " = $" + i++);
    vals.push(val);
  }
  sets.push("updated_at = now()");
  await q("UPDATE products SET " + sets.join(", ") + " WHERE id = $1", vals);
}

async function deleteCustomProduct(id) {
  const r = await q("DELETE FROM products WHERE id = $1 RETURNING image, images", [id]);
  if (!r.rowCount) return null;
  const row = r.rows[0];
  row.imageList = parseImages(row.images, row.image);
  return row;
}

/* ---------- catalog overrides (stock & static prices) ---------- */

async function getOverrides(opts) {
  const query = opts && opts.read ? qRead : q;
  const r = await query("SELECT * FROM catalog_overrides");
  const map = {};
  r.rows.forEach((x) => {
    map[x.id] = {
      stock: x.stock,
      price: x.price != null ? parseFloat(x.price) : null,
      salePrice: x.sale_price != null ? parseFloat(x.sale_price) : null,
      saleUntil: x.sale_until || null,
    };
  });
  return map;
}

function rowToProductDetails(r) {
  const details = r.details && typeof r.details === "object" ? r.details : {};
  return { id: r.id, details, updatedAt: r.updated_at };
}

async function getAllProductDetails(opts) {
  const query = opts && opts.read ? qRead : q;
  const r = await query("SELECT id, details, updated_at FROM product_details");
  const map = {};
  r.rows.forEach((row) => {
    map[row.id] = rowToProductDetails(row).details;
  });
  return map;
}

async function getProductDetails(id) {
  const r = await q("SELECT id, details, updated_at FROM product_details WHERE id = $1", [id]);
  return r.rowCount ? rowToProductDetails(r.rows[0]) : null;
}

async function setProductDetails(id, details) {
  await q(
    `INSERT INTO product_details (id, details, updated_at) VALUES ($1, $2::jsonb, now())
     ON CONFLICT (id) DO UPDATE SET details = EXCLUDED.details, updated_at = now()`,
    [id, JSON.stringify(details || {})]
  );
}

/* ---------- product variants (colours) ---------- */

function rowToVariant(r) {
  return {
    id: r.id,
    productId: r.product_id,
    color: r.color || "",
    colorEn: r.color_en || "",
    colorHex: r.color_hex || "",
    sku: r.sku || "",
    price: r.price != null ? parseFloat(r.price) : null,
    salePrice: r.sale_price != null ? parseFloat(r.sale_price) : null,
    saleUntil: r.sale_until || null,
    stock: r.stock != null ? r.stock : null,
    images: parseImages(r.images, null),
    available: r.available !== false,
    position: r.position != null ? r.position : 0,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
  };
}

async function nextVariantId() {
  const r = await q("SELECT nextval('variant_id_seq') AS n");
  return "pv-" + r.rows[0].n;
}

async function getVariant(id) {
  const r = await q("SELECT * FROM product_variants WHERE id = $1", [id]);
  return r.rowCount ? rowToVariant(r.rows[0]) : null;
}

async function listVariants(productId, opts) {
  const query = opts && opts.read ? qRead : q;
  const r = await query(
    "SELECT * FROM product_variants WHERE product_id = $1 ORDER BY position ASC, created_at ASC",
    [productId]
  );
  return r.rows.map(rowToVariant);
}

/* All variants grouped by their base product id. */
async function getAllVariants(opts) {
  const query = opts && opts.read ? qRead : q;
  const r = await query(
    "SELECT * FROM product_variants ORDER BY product_id ASC, position ASC, created_at ASC"
  );
  const map = {};
  r.rows.forEach((row) => {
    const v = rowToVariant(row);
    (map[v.productId] = map[v.productId] || []).push(v);
  });
  return map;
}

/* True when the base already has a variant with the same colour (case-insensitive).
   excludeId lets an update skip its own row. */
async function variantColorExists(productId, color, excludeId) {
  const norm = String(color || "").trim().toLowerCase();
  if (!norm) return false;
  const r = await q(
    "SELECT id FROM product_variants WHERE product_id = $1 AND lower(trim(color)) = $2 AND ($3::text IS NULL OR id <> $3) LIMIT 1",
    [productId, norm, excludeId || null]
  );
  return r.rowCount > 0;
}

/* SKU identifies the exact purchasable unit, so it must be unique across all
   variants. Matching is case-insensitive to avoid visually duplicate SKUs. */
async function variantSkuExists(sku, excludeId) {
  const norm = String(sku || "").trim().toLowerCase();
  if (!norm) return false;
  const r = await q(
    "SELECT id FROM product_variants WHERE lower(trim(sku)) = $1 AND ($2::text IS NULL OR id <> $2) LIMIT 1",
    [norm, excludeId || null]
  );
  return r.rowCount > 0;
}

async function createVariant(v) {
  const r = await q(
    "SELECT COALESCE(MAX(position), -1) + 1 AS pos FROM product_variants WHERE product_id = $1",
    [v.productId]
  );
  const position = v.position != null ? v.position : r.rows[0].pos;
  await q(
    `INSERT INTO product_variants
       (id, product_id, color, color_en, color_hex, sku, price, sale_price, sale_until, stock, images, available, position)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)`,
    [
      v.id,
      v.productId,
      v.color || "",
      v.colorEn || "",
      v.colorHex || "",
      v.sku || "",
      v.price != null ? v.price : null,
      v.salePrice != null ? v.salePrice : null,
      v.saleUntil != null ? v.saleUntil : null,
      v.stock != null ? v.stock : null,
      Array.isArray(v.images) && v.images.length ? JSON.stringify(v.images) : null,
      v.available !== false,
      position,
    ]
  );
  return getVariant(v.id);
}

async function updateVariant(id, fields) {
  const sets = [];
  const vals = [id];
  let i = 2;
  for (const [col, val] of Object.entries(fields)) {
    sets.push(col + " = $" + i++);
    vals.push(val);
  }
  if (!sets.length) return getVariant(id);
  sets.push("updated_at = now()");
  await q("UPDATE product_variants SET " + sets.join(", ") + " WHERE id = $1", vals);
  return getVariant(id);
}

async function deleteVariant(id) {
  const r = await q("DELETE FROM product_variants WHERE id = $1 RETURNING images, product_id", [id]);
  if (!r.rowCount) return null;
  const row = r.rows[0];
  return { productId: row.product_id, imageList: parseImages(row.images, null) };
}

/* Remove every variant of a base product (used when the base is deleted). */
async function deleteVariantsForProduct(productId) {
  const r = await q("DELETE FROM product_variants WHERE product_id = $1 RETURNING images", [productId]);
  const imgs = [];
  r.rows.forEach((row) => parseImages(row.images, null).forEach((u) => imgs.push(u)));
  return imgs;
}

async function setOverride(id, fields) {
  const stockGiven = Object.prototype.hasOwnProperty.call(fields, "stock");
  const priceGiven = Object.prototype.hasOwnProperty.call(fields, "price");
  const saleGiven = Object.prototype.hasOwnProperty.call(fields, "salePrice");
  const untilGiven = Object.prototype.hasOwnProperty.call(fields, "saleUntil");
  await q(
    `INSERT INTO catalog_overrides (id, stock, price, sale_price, sale_until) VALUES ($1, $2, $3, $4, $5)
     ON CONFLICT (id) DO UPDATE SET
       stock = CASE WHEN $6 THEN EXCLUDED.stock ELSE catalog_overrides.stock END,
       price = CASE WHEN $7 THEN EXCLUDED.price ELSE catalog_overrides.price END,
       sale_price = CASE WHEN $8 THEN EXCLUDED.sale_price ELSE catalog_overrides.sale_price END,
       sale_until = CASE WHEN $9 THEN EXCLUDED.sale_until ELSE catalog_overrides.sale_until END`,
    [
      id,
      stockGiven ? fields.stock : null,
      priceGiven ? fields.price : null,
      saleGiven ? fields.salePrice : null,
      untilGiven ? fields.saleUntil : null,
      stockGiven,
      priceGiven,
      saleGiven,
      untilGiven,
    ]
  );
}

/* ---------- price-reduction history (Directive 98/6/EC as amended) ---------- */

async function reconcilePriceHistory(rawObservations, observedAt) {
  const observations = (rawObservations || []).map(priceHistory.normalizeObservation).filter(Boolean);
  const result = {};
  if (!observations.length) return result;
  const now = observedAt ? new Date(observedAt) : new Date();
  const client = await getPool().connect();
  try {
    await client.query("BEGIN");
    for (const observation of observations) {
      await client.query("SELECT pg_advisory_xact_lock(hashtext($1))", [observation.itemId]);
      let latestResult = await client.query(
        `SELECT * FROM product_price_history
          WHERE item_id = $1 AND valid_to IS NULL
          FOR UPDATE`,
        [observation.itemId]
      );
      let latest = latestResult.rows[0] || null;
      const sameState = latest &&
        Number(latest.price) === observation.price &&
        Number(latest.regular_price) === observation.regularPrice &&
        (latest.source_type || null) === observation.sourceType &&
        (latest.source_id || null) === observation.sourceId;

      if (sameState) {
        const storedStart = latest.source_started_at ? new Date(latest.source_started_at).getTime() : null;
        const storedEnd = latest.source_ends_at ? new Date(latest.source_ends_at).getTime() : null;
        const observedStart = observation.sourceStartedAt ? observation.sourceStartedAt.getTime() : null;
        const observedEnd = observation.sourceEndsAt ? observation.sourceEndsAt.getTime() : null;
        if (storedStart !== observedStart || storedEnd !== observedEnd) {
          latestResult = await client.query(
            `UPDATE product_price_history
                SET source_started_at = $2, source_ends_at = $3
              WHERE id = $1
              RETURNING *`,
            [latest.id, observation.sourceStartedAt, observation.sourceEndsAt]
          );
          latest = latestResult.rows[0];
        }
      } else {
        const changedAt = priceHistory.transitionTime(latest, observation, now);
        if (latest) {
          await client.query(
            "UPDATE product_price_history SET valid_to = $2 WHERE id = $1",
            [latest.id, changedAt]
          );
        }
        latestResult = await client.query(
          `INSERT INTO product_price_history
             (item_id, price, regular_price, source_type, source_id,
              source_started_at, source_ends_at, valid_from)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8)
           RETURNING *`,
          [
            observation.itemId, observation.price, observation.regularPrice,
            observation.sourceType, observation.sourceId,
            observation.sourceStartedAt, observation.sourceEndsAt, changedAt,
          ]
        );
        latest = latestResult.rows[0];
      }

      if (!priceHistory.isPriceReduction(observation)) {
        result[observation.itemId] = null;
        continue;
      }
      const startedAt = new Date(latest.valid_from);
      const minimum = await client.query(
        `SELECT MIN(price)::numeric AS prior_price
           FROM product_price_history
          WHERE item_id = $1
            AND id <> $2
            AND valid_from < $3
            AND COALESCE(valid_to, $3) > $4`,
        [observation.itemId, latest.id, startedAt, priceHistory.referenceWindowStart(startedAt)]
      );
      const prior = minimum.rows[0] && minimum.rows[0].prior_price;
      /* A newly marketed item with no earlier applied price cannot acquire a
         fictitious crossed-out reference price merely from its regular_price
         field. Its current price is the only defensible reference. */
      result[observation.itemId] = prior == null ? observation.price : parseFloat(prior);
    }
    await client.query("COMMIT");
    return result;
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

async function listProductPriceHistory(itemId, days) {
  const windowDays = Math.max(30, Math.min(730, parseInt(days, 10) || 90));
  const r = await q(
    `SELECT id, item_id, price, regular_price, source_type, source_id,
            source_started_at, source_ends_at, valid_from, valid_to
       FROM product_price_history
      WHERE item_id = $1
        AND COALESCE(valid_to, now()) >= now() - ($2::text || ' days')::interval
      ORDER BY valid_from DESC`,
    [String(itemId), String(windowDays)]
  );
  return r.rows.map((row) => ({
    id: Number(row.id),
    itemId: row.item_id,
    price: parseFloat(row.price),
    regularPrice: parseFloat(row.regular_price),
    sourceType: row.source_type || null,
    sourceId: row.source_id || null,
    sourceStartedAt: row.source_started_at || null,
    sourceEndsAt: row.source_ends_at || null,
    validFrom: row.valid_from,
    validTo: row.valid_to || null,
  }));
}

/* ---------- coupons ---------- */

function rowToCoupon(r) {
  return {
    code: r.code,
    name: r.name || "",
    type: r.type,
    value: parseFloat(r.value),
    active: r.active,
    expiresAt: r.expires_at,
    uses: r.uses,
    maxUses: r.max_uses == null ? null : r.max_uses,
    freeShipping: !!r.free_shipping,
    firstOrderOnly: !!r.first_order_only,
    oncePerCustomer: !!r.once_per_customer,
    autoIssued: !!r.auto_issued,
    createdAt: r.created_at,
  };
}

async function listCoupons() {
  const r = await q("SELECT * FROM coupons ORDER BY created_at DESC");
  return r.rows.map(rowToCoupon);
}

async function getCoupon(code) {
  const r = await q("SELECT * FROM coupons WHERE code = $1", [code]);
  return r.rowCount ? rowToCoupon(r.rows[0]) : null;
}

async function createCoupon(c) {
  await q(
    `INSERT INTO coupons
       (code, type, value, expires_at, name, max_uses, free_shipping, once_per_customer, first_order_only)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
    [
      c.code, c.type, c.value, c.expiresAt, c.name || "", c.maxUses ?? null,
      !!c.freeShipping, !!c.oncePerCustomer, !!c.firstOrderOnly,
    ]
  );
}

async function updateCoupon(code, fields) {
  const sets = [];
  const vals = [code];
  let i = 2;
  for (const [col, val] of Object.entries(fields)) {
    sets.push(col + " = $" + i++);
    vals.push(val);
  }
  const r = await q(
    "UPDATE coupons SET " + sets.join(", ") + " WHERE code = $1",
    vals
  );
  return r.rowCount > 0;
}

async function deleteCoupon(code) {
  const r = await q("DELETE FROM coupons WHERE code = $1", [code]);
  return r.rowCount > 0;
}

async function incrementCouponUse(code) {
  await q("UPDATE coupons SET uses = uses + 1 WHERE code = $1", [code]);
}

/* ---------- coupon redemptions (welcome offer rules) ---------- */

/* Has this email ever placed an order? Drives "first order only" coupons.
   Matches both guest orders (customer->>'email') and account orders. */
async function hasPreviousOrder(email) {
  const e = String(email || "").trim().toLowerCase();
  if (!e) return false;
  const r = await q(
    `SELECT 1 FROM orders
      WHERE lower(btrim(coalesce(customer->>'email', ''))) = $1
         OR lower(btrim(coalesce(user_email, ''))) = $1
      LIMIT 1`,
    [e]
  );
  return r.rowCount > 0;
}

async function hasRedeemedCoupon(code, email) {
  const e = String(email || "").trim().toLowerCase();
  if (!e || !code) return false;
  const r = await q(
    "SELECT 1 FROM welcome_coupon_redemptions WHERE code = $1 AND lower(btrim(email)) = $2 LIMIT 1",
    [code, e]
  );
  return r.rowCount > 0;
}

/* Records a redemption. Returns false when the unique index rejects a repeat,
   which is the authoritative "already used" answer under concurrency. */
async function recordCouponRedemption({ code, email, orderId, discount }) {
  const e = String(email || "").trim().toLowerCase();
  if (!e || !code) return false;
  const r = await q(
    `INSERT INTO welcome_coupon_redemptions (code, email, order_id, discount)
     VALUES ($1, $2, $3, $4)
     ON CONFLICT (code, lower(btrim(email))) DO NOTHING`,
    [code, e, orderId || null, discount || 0]
  );
  return r.rowCount > 0;
}

/* ---------- promotions engine ---------- */

function rowToPromotion(r) {
  return {
    /* BIGSERIAL comes back from pg as a string; promotion counts will never
       approach Number.MAX_SAFE_INTEGER, and callers (incl. tie-break sorting
       in promotions.js) need a real number. */
    id: Number(r.id),
    name: r.name,
    code: r.code || "",
    discountType: r.discount_type,
    discountValue: parseFloat(r.discount_value),
    maxDiscountPerProduct: r.max_discount_per_product == null ? null : parseFloat(r.max_discount_per_product),
    status: r.status,
    startsAt: r.starts_at,
    endsAt: r.ends_at,
    timezone: r.timezone,
    priority: r.priority,
    sendMarketingEmail: !!r.send_marketing_email,
    createdBy: r.created_by,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
  };
}

async function listPromotionTargets(promotionId) {
  const r = await q(
    "SELECT target_type, target_id FROM promotion_targets WHERE promotion_id = $1",
    [promotionId]
  );
  return r.rows.map((t) => ({ type: t.target_type, id: t.target_id }));
}

async function listPromotionExclusions(promotionId) {
  const r = await q(
    "SELECT exclusion_type, exclusion_id FROM promotion_exclusions WHERE promotion_id = $1",
    [promotionId]
  );
  return r.rows.map((e) => ({ type: e.exclusion_type, id: e.exclusion_id }));
}

async function listPromotions() {
  const r = await q("SELECT * FROM promotions ORDER BY created_at DESC");
  const promos = r.rows.map(rowToPromotion);
  if (!promos.length) return [];
  const ids = promos.map((p) => p.id);
  const [targetRows, exclusionRows] = await Promise.all([
    q("SELECT promotion_id, target_type, target_id FROM promotion_targets WHERE promotion_id = ANY($1)", [ids]),
    q("SELECT promotion_id, exclusion_type, exclusion_id FROM promotion_exclusions WHERE promotion_id = ANY($1)", [ids]),
  ]);
  const targetsBy = {};
  for (const t of targetRows.rows) {
    (targetsBy[t.promotion_id] = targetsBy[t.promotion_id] || []).push({ type: t.target_type, id: t.target_id });
  }
  const exclusionsBy = {};
  for (const e of exclusionRows.rows) {
    (exclusionsBy[e.promotion_id] = exclusionsBy[e.promotion_id] || []).push({ type: e.exclusion_type, id: e.exclusion_id });
  }
  return promos.map((p) => ({
    ...p,
    targets: targetsBy[p.id] || [],
    exclusions: exclusionsBy[p.id] || [],
  }));
}

/* Candidates that could POSSIBLY be live right now (draft/paused/cancelled/
   expired can never apply) — effectiveStatus() in server/promotions.js does
   the final scheduled/active/expired-by-date resolution. Used for pricing on
   every product read, so keep it cheap; callers should cache briefly. */
async function listCandidatePromotions() {
  const r = await q("SELECT * FROM promotions WHERE status IN ('scheduled', 'active')");
  const promos = r.rows.map(rowToPromotion);
  if (!promos.length) return [];
  const ids = promos.map((p) => p.id);
  const [targetRows, exclusionRows] = await Promise.all([
    q("SELECT promotion_id, target_type, target_id FROM promotion_targets WHERE promotion_id = ANY($1)", [ids]),
    q("SELECT promotion_id, exclusion_type, exclusion_id FROM promotion_exclusions WHERE promotion_id = ANY($1)", [ids]),
  ]);
  const targetsBy = {};
  for (const t of targetRows.rows) {
    (targetsBy[t.promotion_id] = targetsBy[t.promotion_id] || []).push({ type: t.target_type, id: t.target_id });
  }
  const exclusionsBy = {};
  for (const e of exclusionRows.rows) {
    (exclusionsBy[e.promotion_id] = exclusionsBy[e.promotion_id] || []).push({ type: e.exclusion_type, id: e.exclusion_id });
  }
  return promos.map((p) => ({
    ...p,
    targets: targetsBy[p.id] || [],
    exclusions: exclusionsBy[p.id] || [],
  }));
}

async function getPromotion(id) {
  const r = await q("SELECT * FROM promotions WHERE id = $1", [id]);
  if (!r.rowCount) return null;
  const [targets, exclusions] = await Promise.all([
    listPromotionTargets(id),
    listPromotionExclusions(id),
  ]);
  return { ...rowToPromotion(r.rows[0]), targets, exclusions };
}

/* Creates a promotion with its targets/exclusions in one transaction. */
async function createPromotion(p) {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const ins = await client.query(
      `INSERT INTO promotions
         (name, code, discount_type, discount_value, max_discount_per_product,
         status, starts_at, ends_at, timezone, priority, send_marketing_email, created_by)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)
       RETURNING id`,
      [
        p.name, p.code || null, p.discountType, p.discountValue,
        p.maxDiscountPerProduct ?? null, p.status || "draft",
        p.startsAt || null, p.endsAt || null, p.timezone || "Europe/Athens",
        p.priority ?? 100, !!p.sendMarketingEmail, p.createdBy || null,
      ]
    );
    const id = ins.rows[0].id;
    for (const t of p.targets || []) {
      await client.query(
        "INSERT INTO promotion_targets (promotion_id, target_type, target_id) VALUES ($1,$2,$3)",
        [id, t.type, t.id ?? null]
      );
    }
    for (const e of p.exclusions || []) {
      await client.query(
        "INSERT INTO promotion_exclusions (promotion_id, exclusion_type, exclusion_id) VALUES ($1,$2,$3)",
        [id, e.type, e.id ?? null]
      );
    }
    await client.query("COMMIT");
    return id;
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
  }
}

/* Partial update of scalar promotion fields (targets/exclusions are replaced
   separately via replacePromotionTargeting, since they're not 1:1 columns). */
async function updatePromotion(id, fields) {
  const colMap = {
    name: "name", code: "code", discountType: "discount_type", discountValue: "discount_value",
    maxDiscountPerProduct: "max_discount_per_product", status: "status", startsAt: "starts_at",
    endsAt: "ends_at", timezone: "timezone", priority: "priority", sendMarketingEmail: "send_marketing_email",
  };
  const sets = [];
  const vals = [id];
  let i = 2;
  for (const [key, col] of Object.entries(colMap)) {
    if (Object.prototype.hasOwnProperty.call(fields, key)) {
      sets.push(col + " = $" + i++);
      vals.push(fields[key]);
    }
  }
  if (!sets.length) return true;
  sets.push("updated_at = now()");
  const r = await q("UPDATE promotions SET " + sets.join(", ") + " WHERE id = $1", vals);
  return r.rowCount > 0;
}

/* Replaces a promotion's targets and/or exclusions wholesale (delete +
   re-insert), in one transaction. Pass `null` for a list to leave it as-is. */
async function replacePromotionTargeting(id, targets, exclusions) {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    if (targets != null) {
      await client.query("DELETE FROM promotion_targets WHERE promotion_id = $1", [id]);
      for (const t of targets) {
        await client.query(
          "INSERT INTO promotion_targets (promotion_id, target_type, target_id) VALUES ($1,$2,$3)",
          [id, t.type, t.id ?? null]
        );
      }
    }
    if (exclusions != null) {
      await client.query("DELETE FROM promotion_exclusions WHERE promotion_id = $1", [id]);
      for (const e of exclusions) {
        await client.query(
          "INSERT INTO promotion_exclusions (promotion_id, exclusion_type, exclusion_id) VALUES ($1,$2,$3)",
          [id, e.type, e.id ?? null]
        );
      }
    }
    await client.query("COMMIT");
    return true;
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
  }
}

/* Hard delete — only ever offered to the admin UI for `draft` promotions
   (anything that went live is cancelled instead, never deleted, to preserve
   history). Enforced by the caller, not here. */
async function deletePromotion(id) {
  const r = await q("DELETE FROM promotions WHERE id = $1", [id]);
  return r.rowCount > 0;
}

async function listPromotionAuditLog(promotionId) {
  const r = await q(
    `SELECT id, type, actor, meta, created_at FROM audit_log
      WHERE type LIKE 'promotion.%' AND meta->>'promotionId' = $1
      ORDER BY created_at DESC`,
    [String(promotionId)]
  );
  return r.rows;
}

/* ---------- reviews ---------- */

function rowToReview(r) {
  return {
    id: r.id,
    productId: r.product_id,
    name: r.name,
    rating: r.rating,
    title: r.title || "",
    text: r.text,
    userEmail: r.user_email,
    orderId: r.order_id || null,
    orderItemId: r.order_item_id || null,
    isVerifiedPurchase: !!r.is_verified_purchase,
    status: r.status,
    moderationReason: r.moderation_reason || null,
    moderatedBy: r.moderated_by || null,
    moderatedAt: r.moderated_at || null,
    helpfulCount: r.helpful_count || 0,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
    reply: r.reply_body
      ? { body: r.reply_body, createdAt: r.reply_created_at, updatedAt: r.reply_updated_at }
      : null,
  };
}

const REVIEW_WITH_REPLY_SELECT = `
  SELECT r.*, rr.body AS reply_body, rr.created_at AS reply_created_at, rr.updated_at AS reply_updated_at
    FROM reviews r
    LEFT JOIN review_replies rr ON rr.review_id = r.id
`;

/** A duplicate-review conflict — the unique index on order_item_id is the
   real guard (race-safe); this error class lets callers give a clean 409. */
class DuplicateReviewError extends Error {
  constructor() {
    super("duplicate_review");
    this.code = "duplicate_review";
  }
}

async function createReview(rev) {
  try {
    await q(
      `INSERT INTO reviews
         (id, product_id, name, rating, title, text, user_email, order_id, order_item_id, is_verified_purchase, status)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,'pending')`,
      [
        rev.id, rev.productId, rev.name, rev.rating, rev.title || "", rev.text, rev.userEmail,
        rev.orderId || null, rev.orderItemId || null, !!rev.isVerifiedPurchase,
      ]
    );
  } catch (e) {
    if (e.code === "23505") throw new DuplicateReviewError();
    throw e;
  }
}

/* Has this specific purchased line item already been reviewed? The unique
   index enforces this atomically at INSERT time; this is only used to give
   the shopper an earlier, friendlier "already reviewed" message. */
async function hasReviewedOrderItem(orderItemId) {
  if (!orderItemId) return false;
  const r = await q("SELECT 1 FROM reviews WHERE order_item_id = $1 LIMIT 1", [orderItemId]);
  return r.rowCount > 0;
}

/* Verified-purchase lookup. Two entry points:
     - accessToken: the same guest order-tracking token already emailed to
       guests (server.js resolveOrderByAccessToken) — no new email flow needed.
     - email: a logged-in shopper's own delivered orders.
   Returns { orderId, orderItemId } when the product was actually delivered
   in that order, else null (review can still be submitted, just unverified). */
async function findReviewableOrderItem({ email, accessToken, productId }) {
  let order = null;
  if (accessToken) {
    const r = await q(
      "SELECT id, items, shipping_status FROM orders WHERE access_token = $1",
      [accessToken]
    );
    order = r.rows[0] || null;
  } else if (email) {
    const e = String(email).trim().toLowerCase();
    const r = await q(
      `SELECT id, items, shipping_status FROM orders
        WHERE shipping_status = 'delivered'
          AND (lower(btrim(coalesce(customer->>'email',''))) = $1 OR lower(btrim(coalesce(user_email,''))) = $1)
          AND items @> $2::jsonb
        ORDER BY created_at DESC LIMIT 1`,
      [e, JSON.stringify([{ id: productId }])]
    );
    order = r.rows[0] || null;
  }
  if (!order || order.shipping_status !== "delivered") return null;
  const items = Array.isArray(order.items) ? order.items : [];
  if (!items.some((it) => it.id === productId)) return null;
  return { orderId: order.id, orderItemId: order.id + ":" + productId };
}

/** Paginated, filterable approved reviews for one product — the storefront
   product page. Includes the store's reply (if any) per review. */
async function productReviews(productId, opts) {
  opts = opts || {};
  const query = opts.read ? qRead : q;
  const page = Math.max(1, parseInt(opts.page, 10) || 1);
  const limit = Math.max(1, Math.min(200, parseInt(opts.limit, 10) || 5));
  const offset = (page - 1) * limit;
  const verifiedOnly = !!opts.verifiedOnly;
  const sort =
    opts.sort === "rating_high" ? "r.rating DESC, r.created_at DESC" :
    opts.sort === "rating_low" ? "r.rating ASC, r.created_at DESC" :
    opts.sort === "helpful" ? "r.helpful_count DESC, r.created_at DESC" :
    "r.created_at DESC";

  const where = "WHERE r.product_id = $1 AND r.status = 'approved'" + (verifiedOnly ? " AND r.is_verified_purchase" : "");
  const total = await query(`SELECT COUNT(*)::int AS n FROM reviews r ${where}`, [productId]);
  const r = await query(
    `${REVIEW_WITH_REPLY_SELECT} ${where} ORDER BY ${sort} LIMIT $2 OFFSET $3`,
    [productId, limit, offset]
  );
  return {
    reviews: r.rows.map(rowToReview),
    pagination: pagination(total.rows[0].n, page, limit),
  };
}

/** Rating summary + distribution for one product (approved reviews only). */
async function productReviewStats(productId, opts) {
  const query = opts && opts.read ? qRead : q;
  const summary = await query(
    `SELECT COUNT(*)::int AS total, COALESCE(AVG(rating), 0)::float AS average
       FROM reviews WHERE product_id = $1 AND status = 'approved'`,
    [productId]
  );
  const dist = await query(
    `SELECT rating, COUNT(*)::int AS count FROM reviews
      WHERE product_id = $1 AND status = 'approved' GROUP BY rating`,
    [productId]
  );
  const distribution = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
  dist.rows.forEach((row) => { distribution[row.rating] = row.count; });
  return {
    total: summary.rows[0].total,
    average: Math.round(summary.rows[0].average * 100) / 100,
    distribution,
  };
}

/** Approved reviews for one product (shown on the storefront). */
async function approvedReviews(productId, opts) {
  const query = opts && opts.read ? qRead : q;
  const r = await query(
    `SELECT * FROM reviews WHERE product_id = $1 AND status = 'approved'
     ORDER BY created_at DESC`,
    [productId]
  );
  return r.rows.map(rowToReview);
}

/** Approved reviews site-wide (homepage / reviews page). */
async function approvedReviewsAll(opts) {
  opts = opts || {};
  const query = opts.read ? qRead : q;
  const limit = Math.max(1, Math.min(100, parseInt(opts.limit, 10) || 12));
  const sort = opts.sort === "rating" ? "rating DESC, created_at DESC" : "created_at DESC";
  const r = await query(
    `SELECT * FROM reviews WHERE status = 'approved' ORDER BY ${sort} LIMIT $1`,
    [limit]
  );
  return r.rows.map(rowToReview);
}

/** Single approved review by id. */
async function approvedReviewById(id, opts) {
  const query = opts && opts.read ? qRead : q;
  const r = await query(
    `SELECT * FROM reviews WHERE id = $1 AND status = 'approved' LIMIT 1`,
    [id]
  );
  return r.rows[0] ? rowToReview(r.rows[0]) : null;
}

/** Aggregate stats for approved reviews. */
async function reviewStats(opts) {
  const query = opts && opts.read ? qRead : q;
  const summary = await query(
    `SELECT COUNT(*)::int AS total, COALESCE(AVG(rating), 0)::float AS average
     FROM reviews WHERE status = 'approved'`
  );
  const dist = await query(
    `SELECT rating, COUNT(*)::int AS count
     FROM reviews WHERE status = 'approved'
     GROUP BY rating ORDER BY rating DESC`
  );
  const byRating = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
  dist.rows.forEach(function (row) {
    byRating[row.rating] = row.count;
  });
  return {
    total: summary.rows[0].total,
    average: Math.round(summary.rows[0].average * 100) / 100,
    byRating: byRating,
  };
}

/** All reviews (admin moderation), newest first, pending first. */
/** Admin moderation queue — paginated, optionally filtered to one status
   (the tabs: pending/approved/rejected/flagged/removed). Joins in the
   product title so the list is self-contained. */
async function listReviewsPage(opts) {
  opts = opts || {};
  const p = pageOpts(opts, 20);
  const status = opts.status && opts.status !== "all" ? String(opts.status) : null;
  const where = status ? "WHERE status = $1" : "";
  const totalParams = status ? [status] : [];
  const total = await q(`SELECT COUNT(*)::int AS n FROM reviews ${where}`, totalParams);
  const params = status ? [status, p.limit, p.offset] : [p.limit, p.offset];
  const r = await q(
    `SELECT * FROM reviews ${where}
     ORDER BY (status = 'pending') DESC, (status = 'flagged') DESC, created_at DESC
     LIMIT $${status ? 2 : 1} OFFSET $${status ? 3 : 2}`,
    params
  );
  return {
    reviews: r.rows.map(rowToReview),
    pagination: pagination(total.rows[0].n, p.page, p.limit),
  };
}

/* `reason` is required by the caller (server.js) whenever status isn't
   'approved' — content-based moderation reason, never "didn't like it". */
async function setReviewStatus(id, { status, reason, moderatedBy }) {
  const r = await q(
    `UPDATE reviews
        SET status = $2, moderation_reason = $3, moderated_by = $4,
            moderated_at = now(), updated_at = now()
      WHERE id = $1`,
    [id, status, reason || null, moderatedBy || null]
  );
  return r.rowCount > 0;
}

async function deleteReview(id) {
  const r = await q("DELETE FROM reviews WHERE id = $1", [id]);
  return r.rowCount > 0;
}

/* Counts anything needing admin attention (pending + flagged), used for the
   admin sidebar/dashboard badge. */
async function pendingReviewCount() {
  const r = await q("SELECT COUNT(*)::int AS n FROM reviews WHERE status IN ('pending', 'flagged')");
  return r.rows[0].n;
}

/* ---------- review replies (one public store reply per review) ---------- */

async function upsertReviewReply(reviewId, adminId, body) {
  await q(
    `INSERT INTO review_replies (review_id, admin_id, body)
     VALUES ($1,$2,$3)
     ON CONFLICT (review_id) DO UPDATE SET body = EXCLUDED.body, admin_id = EXCLUDED.admin_id, updated_at = now()`,
    [reviewId, adminId || null, body]
  );
}

async function deleteReviewReply(reviewId) {
  const r = await q("DELETE FROM review_replies WHERE review_id = $1", [reviewId]);
  return r.rowCount > 0;
}

/* ---------- "was this helpful" votes ---------- */

/* Idempotent per (review, voter) — a repeat vote from the same anonymous
   voter key is a silent no-op, not a double count. */
async function voteReviewHelpful(reviewId, voterKey) {
  const ins = await q(
    "INSERT INTO review_helpful_votes (review_id, voter_key) VALUES ($1,$2) ON CONFLICT DO NOTHING",
    [reviewId, voterKey]
  );
  if (ins.rowCount > 0) {
    await q("UPDATE reviews SET helpful_count = helpful_count + 1 WHERE id = $1", [reviewId]);
  }
  const r = await q("SELECT helpful_count FROM reviews WHERE id = $1", [reviewId]);
  return r.rows[0] ? r.rows[0].helpful_count : 0;
}

/* ---------- orders ---------- */

function rowToOrder(r) {
  return {
    id: r.id,
    number: r.number,
    status: r.status,
    payment: r.payment,
    paymentStatus: r.payment_status,
    stripeSessionId: r.stripe_session_id,
    coupon: r.coupon,
    discount: parseFloat(r.discount),
    /* Recorded at charge time — never recomputed, so an old receipt keeps
       adding up even after the fee rules change. Null on rows created before
       migration 034; callers fall back to recomputing for those. */
    shippingFee: r.shipping_fee == null ? null : parseFloat(r.shipping_fee),
    codFee: r.cod_fee == null ? null : parseFloat(r.cod_fee),
    couponFreeShipping: !!r.coupon_free_shipping,
    total: parseFloat(r.total),
    lang: r.lang,
    userEmail: r.user_email,
    customer: r.customer,
    gift: r.gift,
    items: r.items,
    promotionSnapshots: Array.isArray(r.promotion_snapshots) ? r.promotion_snapshots : [],
    tracking: r.tracking || "",
    courier: r.courier || "",
    assignee: r.assignee || "",
    notes: r.notes || "",
    events: Array.isArray(r.events) ? r.events : [],
    shippingStatus: r.shipping_status || "not_ready",
    accessToken: r.access_token || "",
    createdAt: r.created_at,
    updatedAt: r.updated_at,
  };
}

/* A "needs attention" order (used by the review tab + active view). */
const ORDER_ATTENTION_SQL =
  "(status = 'review' OR payment_status IN ('failed','cod_not_delivered') OR shipping_status IN ('failed','returning','returned'))";

/* Admin order tabs → SQL condition. Values are literals (no user input),
   so they are safe to inline. Order status ≠ payment status ≠ shipping status. */
const ORDER_TAB_SQL = {
  active: "(status IN ('new','processing','ready','review') OR " + ORDER_ATTENTION_SQL + ")",
  new: "status = 'new'",
  card_paid: "(payment <> 'cod' AND payment_status = 'paid')",
  cod: "payment = 'cod'",
  processing: "status = 'processing'",
  ready: "status = 'ready'",
  transit: "shipping_status = 'transit'",
  delivered: "shipping_status = 'delivered'",
  review: ORDER_ATTENTION_SQL,
  cancelled: "status = 'cancelled'",
};

async function nextOrderNumber() {
  const r = await q("SELECT nextval('order_number_seq') AS n");
  return "NC-" + String(r.rows[0].n).padStart(4, "0");
}

async function createOrder(o) {
  await q(
    `INSERT INTO orders (id, number, status, payment, payment_status, coupon, discount, total, lang, user_email, customer, gift, items, access_token, promotion_snapshots, shipping_fee, cod_fee, coupon_free_shipping, terms_version, terms_accepted_at)
     VALUES ($1,$2,'new',$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19)`,
    [
      o.id,
      o.number,
      o.payment,
      o.paymentStatus,
      o.coupon,
      o.discount,
      o.total,
      o.lang,
      o.userEmail,
      JSON.stringify(o.customer),
      JSON.stringify(o.gift),
      JSON.stringify(o.items),
      o.accessToken || null,
      JSON.stringify(o.promotionSnapshots || []),
      o.shippingFee == null ? null : o.shippingFee,
      o.codFee == null ? null : o.codFee,
      !!o.couponFreeShipping,
      o.termsVersion || null,
      o.termsAcceptedAt || null,
    ]
  );
}

async function getOrderByAccessToken(token) {
  if (!token) return null;
  const r = await q("SELECT * FROM orders WHERE access_token = $1", [token]);
  return r.rowCount ? rowToOrder(r.rows[0]) : null;
}

async function listOrders() {
  const r = await q("SELECT * FROM orders ORDER BY created_at DESC");
  return r.rows.map(rowToOrder);
}

/**
 * Product ids sold the most in the current calendar month (excluding cancelled
 * orders), most-sold first. Returns [{ id, qty }]. Empty until real orders
 * exist — the storefront then falls back to a curated/auto selection.
 */
async function monthlyBestSellerIds(limit, opts) {
  const query = opts && opts.read ? qRead : q;
  const n = Math.max(1, Math.min(20, parseInt(limit, 10) || 5));
  const r = await query(
    `SELECT elem->>'id' AS id, SUM(COALESCE((elem->>'qty')::int, 1)) AS qty
       FROM orders o, jsonb_array_elements(o.items) elem
      WHERE o.created_at >= date_trunc('month', now())
        AND o.status <> 'cancelled'
        AND COALESCE(elem->>'id', '') <> ''
      GROUP BY elem->>'id'
      ORDER BY qty DESC, id ASC
      LIMIT $1`,
    [n]
  );
  return r.rows.map((row) => ({ id: row.id, qty: parseInt(row.qty, 10) || 0 }));
}

async function listOrdersPage(opts) {
  opts = opts || {};
  const p = pageOpts(opts, 50);
  const conds = [];
  const params = [];
  let i = 1;

  /* tab (cross-axis) or an explicit single order status (back-compat) */
  if (opts.status) {
    conds.push(`status = $${i++}`);
    params.push(opts.status);
  } else if (opts.tab && opts.tab !== "all" && ORDER_TAB_SQL[opts.tab]) {
    conds.push(ORDER_TAB_SQL[opts.tab]);
  }

  /* payment filter: method ("card"/"cod") or a specific payment_status value */
  if (opts.payment) {
    if (opts.payment === "cod") {
      conds.push(`payment = 'cod'`);
    } else if (opts.payment === "card") {
      conds.push(`payment <> 'cod'`);
    } else {
      conds.push(`payment_status = $${i++}`);
      params.push(opts.payment);
    }
  }

  /* shipping status filter */
  if (opts.shipping) {
    conds.push(`shipping_status = $${i++}`);
    params.push(opts.shipping);
  }

  /* courier filter — effective courier is the admin column, else customer JSON */
  if (opts.courier) {
    conds.push(`LOWER(COALESCE(NULLIF(courier, ''), customer->>'courier', '')) = $${i++}`);
    params.push(String(opts.courier).toLowerCase());
  }

  if (opts.from) { conds.push(`created_at >= $${i++}`); params.push(opts.from); }
  if (opts.to) { conds.push(`created_at < $${i++}`); params.push(opts.to); }

  /* search: order number, tracking, customer name / email / phone */
  if (opts.q && String(opts.q).trim()) {
    const like = `%${String(opts.q).trim().toLowerCase()}%`;
    conds.push(
      `(LOWER(number) LIKE $${i} OR LOWER(tracking) LIKE $${i}` +
      ` OR LOWER(COALESCE(customer->>'firstname','') || ' ' || COALESCE(customer->>'lastname','')) LIKE $${i}` +
      ` OR LOWER(COALESCE(customer->>'email','')) LIKE $${i}` +
      ` OR LOWER(COALESCE(customer->>'mobile','')) LIKE $${i}` +
      ` OR LOWER(COALESCE(customer->>'phone','')) LIKE $${i})`
    );
    params.push(like);
    i++;
  }

  const where = conds.length ? "WHERE " + conds.join(" AND ") : "";

  let order;
  switch (opts.sort) {
    case "oldest": order = "created_at ASC"; break;
    case "amount-desc": order = "total DESC, created_at DESC"; break;
    case "amount-asc": order = "total ASC, created_at DESC"; break;
    case "recent": order = "created_at DESC"; break;
    case "priority":
    default:
      /* problems first, then new, then oldest-waiting first */
      order = ORDER_ATTENTION_SQL + " DESC, (status = 'new') DESC, created_at ASC";
  }
  /* on a specific tab (not the action-oriented default views) show newest first */
  if (!opts.sort && opts.tab && opts.tab !== "active" && opts.tab !== "all") {
    order = "created_at DESC";
  }

  const total = await q(`SELECT COUNT(*)::int AS total FROM orders ${where}`, params);
  const listParams = params.slice();
  listParams.push(p.limit);
  listParams.push(p.offset);
  const r = await q(
    `SELECT * FROM orders ${where} ORDER BY ${order} LIMIT $${i++} OFFSET $${i++}`,
    listParams
  );
  return {
    orders: r.rows.map(rowToOrder),
    pagination: pagination(total.rows[0].total, p.page, p.limit),
  };
}

/* Order counts per admin tab (cross-axis), computed in one pass. */
async function orderTabCounts() {
  const selects = ["COUNT(*)::int AS all"];
  Object.keys(ORDER_TAB_SQL).forEach((tab) => {
    selects.push(`COUNT(*) FILTER (WHERE ${ORDER_TAB_SQL[tab]})::int AS "${tab}"`);
  });
  const r = await q(`SELECT ${selects.join(", ")} FROM orders`);
  return r.rows[0] || { all: 0 };
}

/* Append one entry to an order's event history (audit log). */
async function appendOrderEvent(id, event) {
  const r = await q(
    "UPDATE orders SET events = events || $2::jsonb, updated_at = now() WHERE id = $1",
    [id, JSON.stringify([event])]
  );
  return r.rowCount > 0;
}

async function listRecentOrders(limit) {
  const n = Math.max(1, Math.min(100, parseInt(limit, 10) || 8));
  const r = await q("SELECT * FROM orders ORDER BY created_at DESC LIMIT $1", [n]);
  return r.rows.map(rowToOrder);
}

async function ordersByEmail(email) {
  const r = await q(
    `SELECT * FROM orders WHERE user_email = $1 OR customer->>'email' = $1
     ORDER BY created_at DESC`,
    [email]
  );
  return r.rows.map(rowToOrder);
}

async function getOrder(id) {
  const r = await q("SELECT * FROM orders WHERE id = $1", [id]);
  return r.rowCount ? rowToOrder(r.rows[0]) : null;
}

async function updateOrder(id, fields) {
  const ALLOWED = new Set([
    "status", "payment_status", "shipping_status", "stripe_session_id", "payment",
    "tracking", "courier", "assignee", "notes",
  ]);
  const sets = [];
  const vals = [id];
  let i = 2;
  for (const [col, val] of Object.entries(fields)) {
    if (!ALLOWED.has(col)) continue;
    sets.push(col + " = $" + i++);
    vals.push(val);
  }
  if (!sets.length) return false;
  sets.push("updated_at = now()");
  const r = await q("UPDATE orders SET " + sets.join(", ") + " WHERE id = $1", vals);
  return r.rowCount > 0;
}

/* Orders with a real ACS voucher that haven't reached a final state yet —
   what the ACS tracking-sync cron job needs to check. `limit` bounds how many
   ACS calls one run makes (ACS caps requests at 10/sec by default). */
async function listActiveAcsShipments(limit) {
  const r = await q(
    `SELECT * FROM orders
      WHERE courier = 'acs' AND tracking <> ''
        AND shipping_status NOT IN ('delivered', 'returned')
      ORDER BY updated_at ASC
      LIMIT $1`,
    [Math.max(1, Math.min(200, limit || 50))]
  );
  return r.rows.map(rowToOrder);
}

async function getOrderByStripeSession(sessionId) {
  const r = await q("SELECT * FROM orders WHERE stripe_session_id = $1", [sessionId]);
  return r.rowCount ? rowToOrder(r.rows[0]) : null;
}

async function overviewCounts() {
  const r = await q(`SELECT
    (SELECT COUNT(*) FROM orders)::int AS orders,
    (SELECT COUNT(*) FROM orders WHERE status = 'new')::int AS new_orders,
    (SELECT COUNT(*) FROM users)::int AS users,
    (SELECT COUNT(*) FROM newsletter)::int AS newsletter,
    (SELECT COUNT(*) FROM messages)::int AS messages,
    (SELECT COUNT(*) FROM messages WHERE is_read = FALSE)::int AS unread_messages,
    (SELECT COUNT(*) FROM reviews WHERE status = 'pending')::int AS pending_reviews`);
  const x = r.rows[0];
  return {
    orders: x.orders,
    newOrders: x.new_orders,
    users: x.users,
    newsletter: x.newsletter,
    messages: x.messages,
    unreadMessages: x.unread_messages,
    pendingReviews: x.pending_reviews,
  };
}

/**
 * Atomically check & decrement stock for the given items.
 * Returns null on success or the id of the first out-of-stock product.
 */
async function reserveStock(items) {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    for (const it of items) {
      /* Variant ids (pv-*) track stock on their own row; everything else uses
         the catalog_overrides stock for the base/static product. */
      if (typeof it.id === "string" && it.id.indexOf("pv-") === 0) {
        const rv = await client.query(
          "SELECT stock FROM product_variants WHERE id = $1 FOR UPDATE",
          [it.id]
        );
        if (!rv.rowCount || rv.rows[0].stock == null) continue; // unlimited
        if (rv.rows[0].stock < it.qty) {
          await client.query("ROLLBACK");
          return it.id;
        }
        await client.query(
          "UPDATE product_variants SET stock = stock - $2 WHERE id = $1",
          [it.id, it.qty]
        );
        continue;
      }
      const r = await client.query(
        "SELECT stock FROM catalog_overrides WHERE id = $1 FOR UPDATE",
        [it.id]
      );
      if (!r.rowCount || r.rows[0].stock == null) continue; // unlimited
      if (r.rows[0].stock < it.qty) {
        await client.query("ROLLBACK");
        return it.id;
      }
      await client.query(
        "UPDATE catalog_overrides SET stock = stock - $2 WHERE id = $1",
        [it.id, it.qty]
      );
    }
    await client.query("COMMIT");
    return null;
  } catch (e) {
    await client.query("ROLLBACK");
    throw e;
  } finally {
    client.release();
  }
}

/* Give stock back (order cancelled). Only touches limited-stock rows. */
/* Puts stock back for one order's items using an existing client, so the caller
   can keep it inside a wider transaction. */
async function releaseStockWith(client, items) {
  for (const it of items || []) {
    const qty = Math.max(0, parseInt(it.qty, 10) || 0);
    if (!qty || !it.id) continue;
    if (typeof it.id === "string" && it.id.indexOf("pv-") === 0) {
      await client.query(
        "UPDATE product_variants SET stock = stock + $2 WHERE id = $1 AND stock IS NOT NULL",
        [it.id, qty]
      );
    } else {
      await client.query(
        "UPDATE catalog_overrides SET stock = stock + $2 WHERE id = $1 AND stock IS NOT NULL",
        [it.id, qty]
      );
    }
  }
}

async function releaseStock(items) {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    await releaseStockWith(client, items);
    await client.query("COMMIT");
  } catch (e) {
    await client.query("ROLLBACK");
    throw e;
  } finally {
    client.release();
  }
}

/**
 * Cancels card orders abandoned at the payment step and puts their stock back.
 *
 * Stock is decremented the moment an order is created (see reserveStock), i.e.
 * BEFORE the customer reaches the payment page. If they never pay — closed tab,
 * failed card, expired session — the order stays `pending` forever and the
 * stock stays locked, so a product reads "sold out" although nobody bought it.
 *
 * Only `payment_status = 'pending'` is swept: that value is used exclusively by
 * the card flow. COD ('cod_pending') and bank transfer ('offline') are
 * legitimately unpaid for a long time and must never be touched. `status =
 * 'new'` additionally protects anything an admin has already moved forward.
 *
 * `order_status_v2 IS NULL` restricts this to LEGACY orders. When
 * CHECKOUT_V2_ENABLED=true the v2 checkout creates orders with the same
 * status/payment_status pair, but its stock lives in inventory_reservations —
 * catalog_overrides was never decremented for it. Adding stock back here would
 * invent inventory that does not exist. V2 orders are freed instead by
 * expireInventoryReservations() in the same maintenance run.
 *
 * Claiming and stock release share one transaction, and rows are taken with
 * FOR UPDATE SKIP LOCKED, so concurrent cron runs can never double-release.
 * Provider-agnostic on purpose — it keeps working when Stripe is replaced.
 */
async function expireStalePendingOrders(opts) {
  const minutes = Math.max(1, parseInt((opts && opts.olderThanMinutes) || 120, 10));
  const limit = Math.max(1, parseInt((opts && opts.limit) || 100, 10));
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const claimed = await client.query(
      `SELECT id, number, items, created_at
         FROM orders
        WHERE payment_status = 'pending'
          AND status = 'new'
          AND order_status_v2 IS NULL
          AND created_at < now() - ($1 || ' minutes')::interval
        ORDER BY created_at
        LIMIT $2
        FOR UPDATE SKIP LOCKED`,
      [String(minutes), limit]
    );
    const expired = [];
    for (const row of claimed.rows) {
      await releaseStockWith(client, row.items);
      await client.query(
        "UPDATE orders SET status = 'cancelled', payment_status = 'failed' WHERE id = $1",
        [row.id]
      );
      expired.push({ id: row.id, number: row.number });
    }
    await client.query("COMMIT");
    return { expired: expired.length, orders: expired };
  } catch (e) {
    await client.query("ROLLBACK");
    throw e;
  } finally {
    client.release();
  }
}

/* ---------- audit log ---------- */

/* Fire-and-forget: an audit write must never break the request it records. */
async function logEvent(type, actor, ip, meta) {
  try {
    await q(
      "INSERT INTO audit_log (type, actor, ip, meta) VALUES ($1,$2,$3,$4)",
      [String(type).slice(0, 80), actor ? String(actor).slice(0, 200) : null, ip ? String(ip).slice(0, 60) : null, meta ? JSON.stringify(meta) : null]
    );
  } catch (e) {
    console.error("[audit] write failed:", e.message);
  }
}

async function listAuditLog(opts) {
  const p = pageOpts(opts, 50);
  const type = opts && opts.type ? String(opts.type) : null;
  const where = type ? "WHERE type = $3" : "";
  const totalSql = "SELECT COUNT(*)::int AS total FROM audit_log " + (type ? "WHERE type = $1" : "");
  const total = await q(totalSql, type ? [type] : []);
  const params = type ? [p.limit, p.offset, type] : [p.limit, p.offset];
  const r = await q(
    "SELECT id, type, actor, ip, meta, created_at FROM audit_log " +
      where +
      " ORDER BY created_at DESC LIMIT $1 OFFSET $2",
    params
  );
  return {
    events: r.rows,
    pagination: pagination(total.rows[0].total, p.page, p.limit),
  };
}

/* ---------- GDPR: data portability + right to erasure ---------- */

/* Everything we hold that is tied to this email — for the "export my data"
   right (GDPR art. 15/20). */
async function exportUserData(email) {
  const [user, orders, subs, msgs, revs, campaigns, welcomeCoupons, auditEvents,
    domainAuditEvents, riskAssessments, notifications] = await Promise.all([
    getUser(email),
    ordersByEmail(email),
    q(`SELECT email, firstname, lastname, source, status, consented_at,
              confirmed_at, unsubscribed_at, consent_policy_version, created_at
         FROM newsletter WHERE email = $1`, [email]),
    q("SELECT id, subject, message, lang, created_at FROM messages WHERE email = $1 ORDER BY created_at DESC", [email]),
    q("SELECT id, product_id, name, rating, title, text, status, created_at FROM reviews WHERE user_email = $1 ORDER BY created_at DESC", [email]),
    q(`SELECT campaign_id, status, attempts, sent_at, created_at
         FROM marketing_campaign_recipients WHERE lower(email) = lower($1)
        ORDER BY created_at DESC`, [email]).catch(() => ({ rows: [] })),
    q(`SELECT kind, redeemed_at, created_at FROM welcome_coupon_redemptions
        WHERE lower(email) = lower($1) ORDER BY created_at DESC`, [email]).catch(() => ({ rows: [] })),
    q(`SELECT type, created_at FROM audit_log
        WHERE lower(coalesce(actor, '')) = lower($1) ORDER BY created_at DESC`, [email]).catch(() => ({ rows: [] })),
    q(`SELECT action, entity_type, entity_id, source, created_at FROM audit_logs
        WHERE lower(coalesce(actor_id, '')) = lower($1) ORDER BY created_at DESC`, [email]).catch(() => ({ rows: [] })),
    q(`SELECT r.order_id, r.risk_score, r.risk_level, r.reasons,
              r.rules_triggered, r.decision, r.reviewed_at, r.created_at
         FROM risk_assessments r
         JOIN orders o ON o.id = r.order_id
        WHERE lower(coalesce(o.user_email, o.customer->>'email', '')) = lower($1)
        ORDER BY r.created_at DESC`, [email]).catch(() => ({ rows: [] })),
    q(`SELECT n.event_type, n.aggregate_type, n.aggregate_id, n.status,
              n.attempts, n.sent_at, n.created_at
         FROM notification_outbox n
        WHERE n.aggregate_id IN (
                SELECT id FROM orders
                 WHERE lower(coalesce(user_email, customer->>'email', '')) = lower($1)
              )
           OR n.payload->>'orderId' IN (
                SELECT id FROM orders
                 WHERE lower(coalesce(user_email, customer->>'email', '')) = lower($1)
              )
        ORDER BY n.created_at DESC`, [email]).catch(() => ({ rows: [] })),
  ]);
  return {
    exportedAt: new Date().toISOString(),
    account: user ? { ...user, passHash: undefined } : null,
    orders,
    newsletter: subs.rows,
    messages: msgs.rows,
    reviews: revs.rows,
    marketingCampaignHistory: campaigns.rows,
    welcomeCouponHistory: welcomeCoupons.rows,
    accountAuditHistory: auditEvents.rows,
    domainAuditHistory: domainAuditEvents.rows,
    riskAssessmentHistory: riskAssessments.rows,
    notificationHistory: notifications.rows,
  };
}

async function requestSubscriberConfirmation(s) {
  const r = await q(
    `INSERT INTO newsletter
       (email, firstname, lastname, source, status, consented_at,
        unsubscribed_at, consent_policy_version, confirmation_token_hash,
        confirmation_expires_at, confirmed_at, consent_notice)
     VALUES ($1,$2,$3,$4,'pending',now(),NULL,$5,$6,$7,NULL,$8)
     ON CONFLICT (email) DO UPDATE SET
       firstname = CASE WHEN EXCLUDED.firstname <> '' THEN EXCLUDED.firstname ELSE newsletter.firstname END,
       lastname  = CASE WHEN EXCLUDED.lastname  <> '' THEN EXCLUDED.lastname  ELSE newsletter.lastname  END,
       source = EXCLUDED.source,
       status = CASE WHEN newsletter.status = 'subscribed' THEN 'subscribed' ELSE 'pending' END,
       consented_at = CASE WHEN newsletter.status = 'subscribed' THEN newsletter.consented_at ELSE now() END,
       unsubscribed_at = NULL,
       consent_policy_version = EXCLUDED.consent_policy_version,
       confirmation_token_hash = CASE WHEN newsletter.status = 'subscribed' THEN NULL ELSE EXCLUDED.confirmation_token_hash END,
       confirmation_expires_at = CASE WHEN newsletter.status = 'subscribed' THEN NULL ELSE EXCLUDED.confirmation_expires_at END,
       confirmed_at = CASE WHEN newsletter.status = 'subscribed' THEN newsletter.confirmed_at ELSE NULL END,
       consent_notice = EXCLUDED.consent_notice
     RETURNING status`,
    [s.email, s.firstname || "", s.lastname || "", s.source || "site",
      s.policyVersion, s.tokenHash, s.expiresAt, s.consentNotice || ""]
  );
  return r.rows[0];
}

async function confirmSubscriber(tokenHash) {
  const r = await q(
    `UPDATE newsletter SET status='subscribed', confirmed_at=now(),
       consented_at=now(), confirmation_token_hash=NULL,
       confirmation_expires_at=NULL, unsubscribed_at=NULL
     WHERE confirmation_token_hash=$1
       AND confirmation_expires_at > now()
     RETURNING email, firstname, lastname`,
    [tokenHash]
  );
  if (!r.rowCount) return null;
  await q("UPDATE users SET newsletter_optin=TRUE WHERE lower(email)=lower($1)", [r.rows[0].email]);
  return r.rows[0];
}

function customerAfterErasure(customer) {
  const c = customer && typeof customer === "object" ? customer : {};
  const invoice = c.docType === "invoice";
  return {
    firstname: "—",
    lastname: "",
    email: "",
    phone: "",
    mobile: "",
    street: "",
    streetNumber: "",
    city: "",
    postal: "",
    prefecture: "",
    floor: "",
    locationType: "",
    notes: "",
    countryCode: c.countryCode || "",
    country: c.country || "",
    docType: invoice ? "invoice" : "receipt",
    /* Invoice identity is retained only as part of the statutory accounting
       record. Shipping/contact identity is not needed for that purpose. */
    company: invoice ? String(c.company || "") : "",
    afm: invoice ? String(c.afm || "") : "",
    doy: invoice ? String(c.doy || "") : "",
    activity: invoice ? String(c.activity || "") : "",
    companyAddress: invoice ? String(c.companyAddress || "") : "",
    anonymisedAt: new Date().toISOString(),
  };
}

function erasedSubjectKey(email) {
  const secret = process.env.CONSENT_HASH_SECRET || process.env.SESSION_SECRET || "nostalgia-erasure";
  return crypto.createHmac("sha256", secret).update(String(email).trim().toLowerCase()).digest("hex");
}

/* Erase the account and personal data. Order rows are RETAINED for legal /
   tax obligations (GDPR art. 17(3)(b)) but DETACHED from the account by
   nulling user_email — the accounting record survives without the login. */
async function deleteUserAccount(email) {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const ownedOrders = await client.query(
      `SELECT id, customer FROM orders
        WHERE lower(coalesce(user_email, '')) = lower($1)
           OR lower(coalesce(customer->>'email', '')) = lower($1)
        FOR UPDATE`,
      [email]
    );
    for (const order of ownedOrders.rows) {
      await client.query(
        `UPDATE orders
            SET user_email = NULL, customer = $2::jsonb, gift = $3::jsonb
          WHERE id = $1`,
        [order.id, JSON.stringify(customerAfterErasure(order.customer)), JSON.stringify({ isGift: false })]
      );
    }
    await client.query("DELETE FROM reviews WHERE user_email = $1", [email]);
    await client.query("DELETE FROM messages WHERE email = $1", [email]);
    await client.query("DELETE FROM newsletter WHERE email = $1", [email]);
    await client.query("DELETE FROM marketing_campaign_recipients WHERE lower(email) = lower($1)", [email]);
    const erasedKey = erasedSubjectKey(email);
    await client.query(
      `UPDATE welcome_coupon_redemptions
          SET email = $2
        WHERE lower(email) = lower($1)`,
      [email, "erased-" + erasedKey + "@invalid.local"]
    );
    await client.query(
      `UPDATE audit_log SET actor=$2
        WHERE lower(coalesce(actor,''))=lower($1)`,
      [email, "erased:" + erasedKey]
    );
    await client.query(
      `UPDATE audit_logs SET actor_id=$2
        WHERE lower(coalesce(actor_id,''))=lower($1)`,
      [email, "erased:" + erasedKey]
    );
    await client.query("DELETE FROM auth_codes WHERE email = $1", [email]);
    const del = await client.query("DELETE FROM users WHERE email = $1", [email]);
    await client.query("COMMIT");
    return del.rowCount > 0;
  } catch (e) {
    await client.query("ROLLBACK");
    throw e;
  } finally {
    client.release();
  }
}

/* Closes both pools, waiting for in-flight queries to finish. Called by the
   server's graceful-shutdown handler so a deploy/restart never kills a query
   (or a half-finished checkout transaction) mid-flight. */
async function close() {
  const pools = [pool, readPool].filter(Boolean);
  pool = null;
  readPool = null;
  await Promise.all(pools.map((p) => p.end().catch(() => {})));
}

module.exports = {
  init,
  close,
  getPool,
  DATA_DIR,
  logEvent,
  listAuditLog,
  exportUserData,
  deleteUserAccount,
  getSetting,
  setSetting,
  setSettingIfMissing,
  getUser,
  createUser,
  getUserByGoogleSub,
  linkGoogleAccount,
  setUserBirthDate,
  listUsers,
  listUsersPage,
  updateUser,
  setUserActive,
  setUserPassword,
  setAuthCode,
  getAuthCode,
  bumpAuthCodeAttempts,
  deleteAuthCode,
  requestSubscriberConfirmation,
  confirmSubscriber,
  listSubscribers,
  recordCookieConsent,
  listCookieConsents,
  cookieConsentHistory,
  listMarketingRecipients,
  listCampaignRecipients,
  createMarketingCampaign,
  claimMarketingRecipient,
  requeueMarketingRecipients,
  finishMarketingRecipient,
  finishMarketingCampaign,
  listQueuedMarketingCampaigns,
  listServiceRecipients,
  createAnnouncement,
  finishAnnouncement,
  listAnnouncements,
  listSubscribersPage,
  unsubscribeSubscriber,
  deleteSubscriber,
  addMessage,
  listMessages,
  getMessage,
  listMessagesPage,
  setMessageRead,
  deleteMessage,
  listCustomProducts,
  getCustomProduct,
  nextProductId,
  createCustomProduct,
  updateCustomProduct,
  deleteCustomProduct,
  getOverrides,
  setOverride,
  reconcilePriceHistory,
  listProductPriceHistory,
  getAllProductDetails,
  getProductDetails,
  setProductDetails,
  nextVariantId,
  getVariant,
  listVariants,
  getAllVariants,
  variantColorExists,
  variantSkuExists,
  createVariant,
  updateVariant,
  deleteVariant,
  deleteVariantsForProduct,
  listCoupons,
  getCoupon,
  createCoupon,
  updateCoupon,
  deleteCoupon,
  incrementCouponUse,
  hasPreviousOrder,
  hasRedeemedCoupon,
  recordCouponRedemption,
  listPromotions,
  listCandidatePromotions,
  getPromotion,
  createPromotion,
  updatePromotion,
  replacePromotionTargeting,
  deletePromotion,
  listPromotionAuditLog,
  createReview,
  DuplicateReviewError,
  hasReviewedOrderItem,
  findReviewableOrderItem,
  productReviews,
  productReviewStats,
  approvedReviews,
  approvedReviewsAll,
  approvedReviewById,
  reviewStats,
  listReviewsPage,
  setReviewStatus,
  deleteReview,
  pendingReviewCount,
  upsertReviewReply,
  deleteReviewReply,
  voteReviewHelpful,
  nextOrderNumber,
  createOrder,
  listOrders,
  listOrdersPage,
  orderTabCounts,
  appendOrderEvent,
  monthlyBestSellerIds,
  listRecentOrders,
  ordersByEmail,
  getOrder,
  updateOrder,
  listActiveAcsShipments,
  getOrderByStripeSession,
  getOrderByAccessToken,
  overviewCounts,
  reserveStock,
  releaseStock,
  expireStalePendingOrders,
  /* Pure helper exposed for regression tests; it performs no I/O. */
  _test: { customerAfterErasure },
};
