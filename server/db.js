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
const { Pool, Client } = require("pg");
const catalog = require("./catalog");

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

async function ensureDatabase() {
  if (process.env.DATABASE_URL) return; // assume it exists
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
  const poolOpts = process.env.DATABASE_URL
    ? { connectionString: process.env.DATABASE_URL }
    : CFG;
  if (
    process.env.DATABASE_URL &&
    !/localhost|127\.0\.0\.1/i.test(process.env.DATABASE_URL)
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
    const readPoolOpts = { connectionString: process.env.READ_DATABASE_URL };
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
  await q(SCHEMA);
  await seedDefaultStock();
  await importLegacyJson();
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
    birthDate: r.birth_date,
    newsletterOptin: r.newsletter_optin,
    address: r.address || null,
    passHash: r.pass_hash,
    createdAt: r.created_at,
  };
}

async function getUser(email) {
  const r = await q("SELECT * FROM users WHERE email = $1", [email]);
  return r.rowCount ? rowToUser(r.rows[0]) : null;
}

async function createUser(u) {
  await q(
    `INSERT INTO users (email, firstname, lastname, birth_date, newsletter_optin, pass_hash)
     VALUES ($1,$2,$3,$4,$5,$6)`,
    [u.email, u.firstname, u.lastname, u.birthDate, u.newsletterOptin, u.passHash]
  );
}

async function listUsers() {
  const r = await q("SELECT * FROM users ORDER BY created_at DESC");
  return r.rows.map(rowToUser);
}

async function listUsersPage(opts) {
  const p = pageOpts(opts, 50);
  const total = await q("SELECT COUNT(*)::int AS total FROM users");
  const r = await q("SELECT * FROM users ORDER BY created_at DESC LIMIT $1 OFFSET $2", [
    p.limit,
    p.offset,
  ]);
  return {
    users: r.rows.map(rowToUser),
    pagination: pagination(total.rows[0].total, p.page, p.limit),
  };
}

/* Partial update of an account's own profile. Only whitelisted fields. */
async function updateUser(email, fields) {
  const cols = {
    firstname: "firstname",
    lastname: "lastname",
    birthDate: "birth_date",
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

async function addSubscriber(s) {
  await q(
    `INSERT INTO newsletter (email, firstname, lastname, source)
     VALUES ($1,$2,$3,$4) ON CONFLICT (email) DO NOTHING`,
    [s.email, s.firstname, s.lastname, s.source]
  );
}

async function listSubscribers() {
  const r = await q("SELECT * FROM newsletter ORDER BY created_at DESC");
  return r.rows.map((x) => ({
    email: x.email,
    firstname: x.firstname,
    lastname: x.lastname,
    source: x.source,
    at: x.created_at,
  }));
}

async function listSubscribersPage(opts) {
  const p = pageOpts(opts, 50);
  const total = await q("SELECT COUNT(*)::int AS total FROM newsletter");
  const r = await q("SELECT * FROM newsletter ORDER BY created_at DESC LIMIT $1 OFFSET $2", [
    p.limit,
    p.offset,
  ]);
  return {
    subscribers: r.rows.map((x) => ({
      email: x.email,
      firstname: x.firstname,
      lastname: x.lastname,
      source: x.source,
      at: x.created_at,
    })),
    pagination: pagination(total.rows[0].total, p.page, p.limit),
  };
}

async function deleteSubscriber(email) {
  const r = await q("DELETE FROM newsletter WHERE email = $1", [email]);
  return r.rowCount > 0;
}

/* ---------- messages ---------- */

async function addMessage(m) {
  await q(
    `INSERT INTO messages (id, last_name, first_name, email, phone, country, subject, message, lang)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
    [m.id, m.lastName, m.firstName, m.email, m.phone, m.country, m.subject, m.message, m.lang]
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
    read: x.is_read,
    at: x.created_at,
  }));
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
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,TRUE)`,
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
    "INSERT INTO coupons (code, type, value, expires_at, name, max_uses, free_shipping) VALUES ($1,$2,$3,$4,$5,$6,$7)",
    [c.code, c.type, c.value, c.expiresAt, c.name || "", c.maxUses ?? null, !!c.freeShipping]
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
    status: r.status,
    createdAt: r.created_at,
  };
}

async function createReview(rev) {
  await q(
    `INSERT INTO reviews (id, product_id, name, rating, title, text, user_email, status)
     VALUES ($1,$2,$3,$4,$5,$6,$7,'pending')`,
    [rev.id, rev.productId, rev.name, rev.rating, rev.title || "", rev.text, rev.userEmail]
  );
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
async function listReviews() {
  const r = await q(
    `SELECT * FROM reviews
     ORDER BY (status = 'pending') DESC, created_at DESC`
  );
  return r.rows.map(rowToReview);
}

async function setReviewStatus(id, status) {
  const r = await q("UPDATE reviews SET status = $2 WHERE id = $1", [id, status]);
  return r.rowCount > 0;
}

async function deleteReview(id) {
  const r = await q("DELETE FROM reviews WHERE id = $1", [id]);
  return r.rowCount > 0;
}

async function pendingReviewCount() {
  const r = await q("SELECT COUNT(*)::int AS n FROM reviews WHERE status = 'pending'");
  return r.rows[0].n;
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
    total: parseFloat(r.total),
    lang: r.lang,
    userEmail: r.user_email,
    customer: r.customer,
    gift: r.gift,
    items: r.items,
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
    `INSERT INTO orders (id, number, status, payment, payment_status, coupon, discount, total, lang, user_email, customer, gift, items, access_token)
     VALUES ($1,$2,'new',$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)`,
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
async function releaseStock(items) {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
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
    await client.query("COMMIT");
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
  const [user, orders, subs, msgs, revs] = await Promise.all([
    getUser(email),
    ordersByEmail(email),
    q("SELECT email, firstname, lastname, source, created_at FROM newsletter WHERE email = $1", [email]),
    q("SELECT id, subject, message, lang, created_at FROM messages WHERE email = $1 ORDER BY created_at DESC", [email]),
    q("SELECT id, product_id, name, rating, title, text, status, created_at FROM reviews WHERE user_email = $1 ORDER BY created_at DESC", [email]),
  ]);
  return {
    exportedAt: new Date().toISOString(),
    account: user ? { ...user, passHash: undefined } : null,
    orders,
    newsletter: subs.rows,
    messages: msgs.rows,
    reviews: revs.rows,
  };
}

/* Erase the account and personal data. Order rows are RETAINED for legal /
   tax obligations (GDPR art. 17(3)(b)) but DETACHED from the account by
   nulling user_email — the accounting record survives without the login. */
async function deleteUserAccount(email) {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    await client.query("UPDATE orders SET user_email = NULL WHERE user_email = $1", [email]);
    await client.query("DELETE FROM reviews WHERE user_email = $1", [email]);
    await client.query("DELETE FROM messages WHERE email = $1", [email]);
    await client.query("DELETE FROM newsletter WHERE email = $1", [email]);
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

module.exports = {
  init,
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
  listUsers,
  listUsersPage,
  updateUser,
  setUserPassword,
  setAuthCode,
  getAuthCode,
  bumpAuthCodeAttempts,
  deleteAuthCode,
  addSubscriber,
  listSubscribers,
  listSubscribersPage,
  deleteSubscriber,
  addMessage,
  listMessages,
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
  createReview,
  approvedReviews,
  approvedReviewsAll,
  approvedReviewById,
  reviewStats,
  listReviews,
  setReviewStatus,
  deleteReview,
  pendingReviewCount,
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
  getOrderByStripeSession,
  getOrderByAccessToken,
  overviewCounts,
  reserveStock,
  releaseStock,
};
