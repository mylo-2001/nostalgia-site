"use strict";

/**
 * Nostalgia backend — PostgreSQL edition.
 * Serves the static storefront, the JSON API and the hidden admin panel
 * (path from ADMIN_UI_PATH in .env — not linked anywhere on the site).
 *
 *   npm start            → http://localhost:8000
 *   PORT=3000 npm start  → custom port
 *
 * All secrets (DB password, session secret, admin credentials, Stripe key)
 * are read from the root .env file — see .env.example. Nothing sensitive is
 * hardcoded in source or committed to git.
 */

const path = require("path");
const fs = require("fs");
const crypto = require("crypto");

/* Load secrets from .env (root) before anything reads process.env. */
(function loadEnv() {
  const envPath = path.join(__dirname, "..", ".env");
  try {
    if (fs.existsSync(envPath) && typeof process.loadEnvFile === "function") {
      process.loadEnvFile(envPath);
    }
  } catch (e) {
    console.warn("[env] could not load .env:", e.message);
  }
})();

const express = require("express");
const Stripe = require("stripe");

const db = require("./db");
const auth = require("./auth");
const catalog = require("./catalog");
const mailer = require("./email");
const notify = require("./notify");
const { mergeBase64Pdfs } = require("./pdf-merge");
const security = require("./security");
const fees = require("./fees");
const promotions = require("./promotions");
const reviewsPolicy = require("./reviews-policy");
const acs = require("./acs");
const cdn = require("./cloudinary");
const { createAdminDatabaseSession, recordAdminLoginEvent, revokeAdminSession } =
  require("./services/admin-session-service");
const { createV2Router } = require("./routes/v2-router");
const { StripePaymentProvider } = require("./payments/stripe-provider");
const { processPaymentWebhook } = require("./services/payment-service");
const { processRefundWebhook } = require("./services/return-refund-service");
const { expireInventoryReservations } = require("./services/inventory-service");
const { processNotificationBatch } = require("./services/notification-outbox-service");
const { enqueueCampaign, processQueuedCampaigns } = require("./services/marketing-campaign-service");
const { runRetention } = require("./services/retention-service");
const { EmailNotificationSender } = require("./notifications/email-notification-sender");
const { collectOperationalMetrics, evaluateOperationalAlerts, runTrackedJob } =
  require("./services/monitoring-service");

const PORT = parseInt(process.env.PORT, 10) || 8000;
const ROOT = path.join(__dirname, "..");
/* All storefront *.html live under html/ (assets like css/js/images stay at ROOT).
   URLs are unchanged — only the files moved — so nothing in the pages breaks. */
const HTML_DIR = path.join(ROOT, "html");
/* Must stay under images/ — that is where the rest of the product photos moved,
   and the URL returned by saveProductImage() is images/product%20photo/uploads/…
   which express.static(ROOT) resolves from disk. Pointing this anywhere else
   writes the file outside the served tree and every upload 404s. */
const UPLOADS_DIR = path.join(ROOT, "images", "product photo", "uploads");
const CONTACT_ATTACHMENTS_DIR = path.join(ROOT, ".private", "contact-attachments");

const app = express();
app.disable("x-powered-by");

app.use((req, res, next) => {
  const supplied = String(req.headers["x-request-id"] || "");
  req.requestId = /^[A-Za-z0-9._:-]{8,100}$/.test(supplied)
    ? supplied
    : crypto.randomUUID();
  res.setHeader("X-Request-Id", req.requestId);
  req.log = {
    info(fields) { console.info(JSON.stringify({ level: "info", ...fields })); },
    error(fields) { console.error(JSON.stringify({ level: "error", ...fields })); },
  };
  next();
});

if (security.trustProxyEnabled()) {
  app.set("trust proxy", 1);
}

/* async route wrapper — must exist before route registration */
const ah = (fn) => (req, res, next) => fn(req, res, next).catch(next);

function bad(res, status, error) {
  return res.status(status).json({ ok: false, error });
}

/* ACS explains failures in plain Greek ("Δεν επιτρέπεται εκτύπωση voucher μετά
   την έκδοση λίστας παραλαβής"). Sending only e.code would leave the shop owner
   staring at "acs_execution_error", so pass the message through as `detail`. */
function badAcs(res, e) {
  return res.status(502).json({ ok: false, error: e.code, detail: e.message || "" });
}

const READ_CACHE_TTL_MS = Math.max(
  0,
  parseInt(process.env.READ_CACHE_TTL_MS || "20000", 10) || 0
);
const readCache = new Map();

async function cachedJson(req, res, key, producer, ttlMs) {
  const ttl = ttlMs == null ? READ_CACHE_TTL_MS : ttlMs;
  const noCache = /\bno-cache\b/i.test(String(req.headers["cache-control"] || ""));
  if (ttl > 0 && !noCache) {
    const hit = readCache.get(key);
    if (hit && hit.expires > Date.now()) {
      res.set("X-Cache", "HIT");
      res.set("Cache-Control", "public, max-age=15, stale-while-revalidate=30");
      return res.json(hit.value);
    }
  }

  const value = await producer();
  if (ttl > 0) {
    readCache.set(key, { value, expires: Date.now() + ttl });
  }
  res.set("X-Cache", "MISS");
  res.set("Cache-Control", "public, max-age=15, stale-while-revalidate=30");
  return res.json(value);
}

function clearReadCache() {
  readCache.clear();
}

app.use(security.enforceHttps);
app.use(security.securityHeaders);
app.use(security.rateLimit);

function gaMeasurementId() {
  return (
    process.env.GA_MEASUREMENT_ID ||
    process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID ||
    ""
  ).trim();
}

/* Marketing-category tracker ids. Same single-source-of-truth rule as GA: the
   id lives in .env, never in the client bundle, so a tracker can be switched
   off by clearing one variable instead of editing and redeploying JS. An empty
   value keeps the tool off entirely — see js/tracking.js. */
function klaviyoCompanyId() {
  return (process.env.KLAVIYO_COMPANY_ID || "").trim();
}

function metaPixelId() {
  return (process.env.META_PIXEL_ID || "").trim();
}

function publicSiteUrl(req) {
  return (process.env.SITE_URL || siteOrigin(req)).replace(/\/$/, "");
}

function requireCron(req, res, next) {
  const expected = (process.env.CRON_TOKEN || process.env.CRON_SECRET || "").trim();
  if (!expected) return bad(res, 503, "cron_not_configured");
  const authHeader = String(req.headers.authorization || "");
  // Bearer header only — never accept the secret via URL query (avoids leaking
  // it into access logs, proxies, and browser history).
  const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : "";
  if (token !== expected) return bad(res, 401, "unauthorized");
  next();
}

/* Stripe webhook needs the raw body for signature verification. */
app.post(
  "/api/stripe/webhook",
  express.raw({ type: "application/json" }),
  ah(async (req, res) => {
    const secret = (process.env.STRIPE_WEBHOOK_SECRET || "").trim();
    if (!secret) return bad(res, 503, "webhook_not_configured");
    const stripe = await getStripe();
    if (!stripe) return bad(res, 503, "stripe_not_configured");

    const sig = req.headers["stripe-signature"];
    let event;
    try {
      event = stripe.webhooks.constructEvent(req.body, sig, secret);
    } catch (e) {
      console.error("[stripe] webhook signature failed:", e.message);
      return bad(res, 400, "invalid_signature");
    }

    if (event.type === "checkout.session.completed") {
      const session = event.data.object;
      const order = await db.getOrderByStripeSession(session.id);
      if (order && order.paymentStatus !== "paid") {
        await db.updateOrder(order.id, { payment_status: "paid" });
        order.paymentStatus = "paid";
        mailer.sendOrderConfirmation(order);
        notify.notifyNewOrder(order);
        audit(req, "order.paid", order.number, { total: order.total, via: "webhook" });
      }
    }

    res.json({ ok: true, received: true });
  })
);

/* V2 Stripe endpoint dispatches only after the selected service verifies the signature. */
app.post(
  "/api/v2/stripe/webhook",
  express.raw({ type: "application/json", limit: "1mb" }),
  ah(async (req, res) => {
    const secret = (process.env.STRIPE_WEBHOOK_SECRET || "").trim();
    const stripe = await getStripe();
    if (!secret || !stripe) return bad(res, 503, "webhook_not_configured");
    const provider = new StripePaymentProvider(stripe);
    let type = "";
    try { type = JSON.parse(req.body.toString("utf8")).type || ""; } catch (_) {}
    const operation = String(type).startsWith("refund.")
      ? processRefundWebhook
      : processPaymentWebhook;
    const result = await operation({ pool: db.getPool(), provider, rawBody: req.body,
      signature: req.headers["stripe-signature"], webhookSecret: secret,
      requestId: req.requestId });
    res.json({ ok: true, ...result });
  })
);

/*
 * Body size limits — tight by default to shrink the DoS amplification surface on
 * public endpoints. Only the admin product create/update routes carry base64
 * product photos, so the generous 15mb limit is scoped to those alone.
 */
const jsonSmall = express.json({ limit: "1mb" });
const jsonLarge = express.json({ limit: "15mb" });
app.use((req, res, next) => {
  if (
    req.method !== "GET" &&
    /^\/api\/admin\/(?:products|variants)(\/|$)/.test(req.path)
  ) {
    return jsonLarge(req, res, next);
  }
  return jsonSmall(req, res, next);
});
app.use(security.checkApiOrigin);
app.use("/api/v2", createV2Router({ getPool: () => db.getPool(), getStripe }));

/* ---------- helpers ---------- */

function normEmail(v) {
  return String(v || "").toLowerCase().trim();
}

function str(v, max) {
  return String(v == null ? "" : v).trim().slice(0, max || 300);
}

function isEmail(v) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v);
}

function round2(n) {
  return Math.round(n * 100) / 100;
}

function parsePrice(raw) {
  if (raw === null || raw === "" || raw === undefined) return null;
  const n = round2(parseFloat(String(raw).replace(",", ".")));
  if (isNaN(n) || n < 0 || n > 100000) return undefined; // undefined = invalid
  return n;
}

function pageQuery(req) {
  return {
    page: Math.max(1, parseInt(req.query.page, 10) || 1),
    limit: Math.max(1, Math.min(100, parseInt(req.query.limit, 10) || 50)),
  };
}

/* A sale/coupon duration in days → an absolute expiry ISO string.
   null = no expiry (runs until removed). undefined = invalid input. */
function daysToExpiry(raw) {
  if (raw === null || raw === "" || raw === undefined) return null;
  const n = parseInt(String(raw).trim(), 10);
  if (isNaN(n) || n <= 0 || n > 3650) return undefined;
  return new Date(Date.now() + n * 24 * 60 * 60 * 1000).toISOString();
}

function publicUser(u) {
  return {
    email: u.email,
    firstname: u.firstname,
    lastname: u.lastname,
    newsletterOptin: !!u.newsletterOptin,
    address: u.address || null,
    active: u.active !== false,
    createdAt: u.createdAt,
  };
}

function requireAdmin(req, res, next) {
  const session = auth.getAdminSession(req);
  if (!session) return bad(res, 401, "unauthorized");
  req.admin = session;
  const enrollmentRoute = /^\/api\/admin\/(?:mfa\/(?:status|setup|enable)|logout)$/.test(req.path);
  if (security.admin2faRequired() && !session.mfa && !enrollmentRoute) {
    return bad(res, 403, "admin_2fa_required");
  }
  next();
}

function clientIp(req) {
  return req.ip || (req.socket && req.socket.remoteAddress) || "";
}

/* Append a row to the security audit trail. Fire-and-forget so it never
   blocks or breaks the request. NEVER pass passwords / card data in `meta`. */
function audit(req, type, actor, meta) {
  db.logEvent(type, actor || null, clientIp(req), meta || null).catch((e) =>
    console.error("[audit]", e.message)
  );
}

function siteOrigin(req) {
  const forwarded = String(req.headers["x-forwarded-proto"] || "").split(",")[0].trim();
  const proto = req.secure || forwarded === "https" ? "https" : req.protocol;
  return proto + "://" + req.get("host");
}

/* Landing pages worth crawling. Deliberately excluded: cart, checkout, account,
   wishlist and track (per-visitor state, nothing stable to index), plus 404,
   diag and dev-problems. Category pages are NOT listed here — they are appended
   from the catalog at request time so a new category cannot be forgotten. */
const SITEMAP_PAGES = [
  { slug: "", priority: "1.0" },
  { slug: "collection", priority: "0.9" },
  { slug: "new-arrivals", priority: "0.8" },
  { slug: "sale", priority: "0.8" },
  { slug: "seasonal", priority: "0.8" },
  { slug: "reviews", priority: "0.7" },
  { slug: "scent-finder", priority: "0.7" },
  { slug: "gift-experience", priority: "0.7" },
  { slug: "about", priority: "0.7" },
  { slug: "contact", priority: "0.7" },
  { slug: "faq", priority: "0.7" },
  { slug: "journal", priority: "0.7" },
  { slug: "shipping-returns", priority: "0.7" },
  { slug: "payments", priority: "0.7" },
  { slug: "privacy", priority: "0.7" },
  { slug: "terms", priority: "0.7" },
  { slug: "review-policy", priority: "0.4" },
];

/* ---------- stripe ---------- */

let stripeClient = null;
let stripeKeyCached = undefined;

async function getStripe() {
  /* Legacy adapter only. It must never become active merely because an old
     key still exists while the storefront is being migrated to Worldline. */
  if (String(process.env.PAYMENT_PROVIDER || "").toLowerCase() !== "stripe") return null;
  const setting = (await db.getSetting("stripe")) || {};
  const key = process.env.STRIPE_SECRET_KEY || setting.secretKey || "";
  if (key !== stripeKeyCached) {
    stripeKeyCached = key;
    stripeClient = key ? new Stripe(key) : null;
  }
  return stripeClient;
}

/* ---------- product helpers ---------- */

function staticProduct(id) {
  return catalog.PRODUCT_IDS.has(id)
    ? catalog.PRODUCTS.find((p) => p.id === id) || null
    : null;
}

/* A sale is active only while it has a price below regular AND, when an
   expiry is set, that expiry is still in the future. */
function saleActive(regular, sale, saleUntil) {
  if (sale == null || regular == null || !(sale > 0) || !(sale < regular)) return false;
  if (saleUntil && new Date(saleUntil).getTime() <= Date.now()) return false;
  return true;
}

/* When the sale is active it becomes the effective (charged) price —
   orders and Stripe always use this. */
function effectivePrice(regular, sale, saleUntil) {
  return saleActive(regular, sale, saleUntil) ? sale : regular;
}

/* ---------- promotions engine: pricing integration ----------
   Coexists with the manual sale_price/sale_until above — whichever gives the
   lower price wins ("best discount wins"), never the other way around. */

/* Candidate (possibly-live) promotions, loaded fresh per request/handler.
   Cheap: a handful of small queries regardless of how many products are
   being priced, so bulk callers (catalog listing) should load this ONCE and
   thread it through rather than re-fetching per product. */
async function loadPromotionContext() {
  const candidates = await db.listCandidatePromotions();
  return { candidates, now: new Date() };
}

/* Resolves the final price for one product/variant given its identity (for
   promotion targeting) and its two independent discount sources: the manual
   per-product sale, and the promotions engine. Returns the shape every price
   call site already expects (price/salePrice/saleUntil) plus optional
   promotion attribution for order-line snapshots. */
function applyPromotionPricing(matchProduct, regularPrice, manualSalePrice, manualSaleUntil, ctx) {
  if (regularPrice == null) {
    return { price: null, salePrice: null, saleUntil: null, promotion: null };
  }
  const manualActive = saleActive(regularPrice, manualSalePrice, manualSaleUntil);
  const manualPrice = manualActive ? manualSalePrice : regularPrice;
  const resolved = promotions.resolveFinalPrice(
    (ctx && ctx.candidates) || [], matchProduct, regularPrice, manualPrice, (ctx && ctx.now) || new Date()
  );
  if (resolved.source === "promotion") {
    return {
      price: resolved.price,
      salePrice: resolved.price,
      saleUntil: resolved.promotion.endsAt || null,
      promotion: resolved.promotion,
    };
  }
  if (resolved.source === "manual") {
    return { price: manualPrice, salePrice: manualSalePrice, saleUntil: manualSaleUntil || null, promotion: null };
  }
  return { price: regularPrice, salePrice: null, saleUntil: null, promotion: null };
}

/* Compose a purchasable product object from a base product + one colour
   variant. The variant supplies its own images / stock / sku / price; the
   name, description, category and content stay on the base. Promotions are
   not targetable at variant granularity (MVP) — a variant with its own price
   is matched against its BASE product's id/category. A variant with no own
   price simply inherits the base's already-promotion-resolved price. */
function composeVariant(base, v, ctx) {
  if (!base || !v) return null;
  let price;
  let salePrice = null;
  let saleUntil = null;
  let regularPrice;
  let promotion = null;
  if (v.price != null) {
    const resolved = applyPromotionPricing(
      { id: base.id, catId: base.catId, createdAt: base.createdAt },
      v.price, v.salePrice, v.saleUntil, ctx
    );
    price = resolved.price;
    salePrice = resolved.salePrice;
    saleUntil = resolved.saleUntil;
    regularPrice = v.price;
    promotion = resolved.promotion;
  } else {
    price = base.price != null ? base.price : null;
    salePrice = base.salePrice != null ? base.salePrice : null;
    saleUntil = base.saleUntil || null;
    regularPrice = base.regularPrice != null ? base.regularPrice : base.price;
    promotion = base.promotion || null;
  }
  const images = Array.isArray(v.images) && v.images.length
    ? v.images
    : (Array.isArray(base.images) && base.images.length ? base.images : (base.image ? [base.image] : []));
  const colorLabel = v.color || "";
  const colorLabelEn = v.colorEn || v.color || "";
  return Object.assign({}, base, {
    id: v.id,
    variantOf: v.productId,
    variantColor: colorLabel,
    variantColorEn: colorLabelEn,
    variantColorHex: v.colorHex || "",
    sku: v.sku || "",
    title: (base.title || "") + (colorLabel ? " — " + colorLabel : ""),
    titleEn: base.titleEn ? base.titleEn + (colorLabelEn ? " — " + colorLabelEn : "") : "",
    price: price,
    regularPrice: regularPrice,
    salePrice: salePrice,
    saleUntil: saleUntil,
    promotion: promotion,
    stock: v.stock != null ? v.stock : null,
    image: images[0] || base.image || null,
    images: images,
    available: v.available !== false,
  });
}

async function resolveVariant(id, overrides, ctx) {
  const v = await db.getVariant(id);
  if (!v || v.available === false) return null;
  ctx = ctx || (await loadPromotionContext());
  const base = await resolveProduct(v.productId, overrides, ctx);
  if (!base) return null;
  return composeVariant(base, v, ctx);
}

/* The single canonical per-product/variant price resolver — checkout, order
   review lookups, product-detail and the sitemap all funnel through this, so
   making it promotion-aware here covers every one of those call sites. */
async function resolveProduct(id, overrides, ctx) {
  if (typeof id === "string" && id.indexOf("pv-") === 0) {
    return resolveVariant(id, overrides, ctx);
  }
  ctx = ctx || (await loadPromotionContext());
  const st = staticProduct(id);
  if (st) {
    const ov = overrides[id] || {};
    const regular = ov.price != null ? ov.price : null;
    const resolved = applyPromotionPricing(
      { id: st.id, catId: st.catId, createdAt: null }, regular, ov.salePrice, ov.saleUntil, ctx
    );
    return Object.assign({}, st, {
      custom: false,
      price: resolved.price,
      regularPrice: regular,
      salePrice: resolved.salePrice,
      saleUntil: resolved.saleUntil,
      promotion: resolved.promotion,
    });
  }
  const cu = await db.getCustomProduct(id);
  if (cu && cu.active !== false) {
    const resolved = applyPromotionPricing(
      { id: cu.id, catId: cu.catId, createdAt: cu.createdAt }, cu.price, cu.salePrice, cu.saleUntil, ctx
    );
    return Object.assign({}, cu, {
      custom: true,
      price: resolved.price,
      regularPrice: cu.price,
      salePrice: resolved.salePrice,
      saleUntil: resolved.saleUntil,
      promotion: resolved.promotion,
    });
  }
  return null;
}

/* `ctx` (from loadPromotionContext()) is optional so any legacy call site
   still works without promotions; bulk listing handlers load it once and
   pass it through to avoid a DB round trip per product. */
function publicProduct(p, details, ctx) {
  const resolved = applyPromotionPricing(
    { id: p.id, catId: p.catId, createdAt: p.createdAt }, p.price, p.salePrice, p.saleUntil, ctx
  );
  const base = {
    id: p.id,
    catId: p.catId,
    title: p.title,
    titleEn: p.titleEn || "",
    description: p.description || "",
    descriptionEn: p.descriptionEn || "",
    price: p.price != null ? p.price : null,
    salePrice: resolved.salePrice,
    saleUntil: resolved.saleUntil,
    image: p.image || null,
    images: Array.isArray(p.images) && p.images.length
      ? p.images
      : (p.image ? [p.image] : []),
    createdAt: p.createdAt,
  };
  if (details && typeof details === "object" && Object.keys(details).length) {
    base.details = details;
  }
  return base;
}

/* Storefront shape for one colour variant. price is null when it inherits the
   base price; salePrice is only present while a discount (manual sale OR a
   live promotion) is active. `matchProduct` is the variant's BASE product
   identity (promotions aren't targetable per-variant in this MVP). */
function publicVariant(v, matchProduct, ctx) {
  const resolved = v.price != null
    ? applyPromotionPricing(matchProduct || { id: v.productId, catId: null, createdAt: null }, v.price, v.salePrice, v.saleUntil, ctx)
    : { salePrice: null, saleUntil: null };
  return {
    id: v.id,
    productId: v.productId,
    color: v.color || "",
    colorEn: v.colorEn || "",
    colorHex: v.colorHex || "",
    sku: v.sku || "",
    price: v.price != null ? v.price : null,
    salePrice: resolved.salePrice,
    saleUntil: resolved.saleUntil,
    stock: v.stock != null ? v.stock : null,
    images: Array.isArray(v.images) ? v.images : [],
    available: v.available !== false,
  };
}

function normalizeProductDetails(raw) {
  if (!raw || typeof raw !== "object") return {};
  const d = Object.assign({}, raw);
  function lines(val) {
    if (Array.isArray(val)) return val.map(String).map((s) => s.trim()).filter(Boolean);
    if (typeof val === "string") {
      return val.split(/\r?\n/).map((s) => s.trim()).filter(Boolean);
    }
    return undefined;
  }
  if (d.features !== undefined) d.features = lines(d.features) || [];
  if (d.badges !== undefined) {
    d.badges = Array.isArray(d.badges)
      ? d.badges.map(String).map((s) => s.trim()).filter(Boolean)
      : String(d.badges || "")
          .split(/[,|]/)
          .map((s) => s.trim())
          .filter(Boolean);
  }
  if (d.includes !== undefined) d.includes = lines(d.includes) || [];
  if (d.care !== undefined) {
    const careLines = lines(d.care);
    d.care = careLines && careLines.length ? careLines : String(d.care || "").trim();
  }
  if (d.shipping !== undefined) d.shipping = lines(d.shipping) || [];
  /* Shipping weight per unit, in kg, INCLUDING packaging. Feeds the ACS
     voucher so the declared weight matches what the courier actually weighs —
     ACS re-weighs every parcel and bills the real figure, so a wrong
     declaration only produces a surprise invoice. Empty/0 means "unknown". */
  if (d.weightKg !== undefined) {
    const w = parseFloat(String(d.weightKg).replace(",", "."));
    d.weightKg = Number.isFinite(w) && w > 0 ? Math.min(999, Math.round(w * 1000) / 1000) : null;
  }
  if (d.specs !== undefined && Array.isArray(d.specs)) {
    d.specs = d.specs
      .map(function (s) {
        if (!s) return null;
        if (typeof s === "object" && s.label && s.value) {
          return { label: String(s.label).trim(), value: String(s.value).trim() };
        }
        if (typeof s === "string" && s.indexOf(":") !== -1) {
          const idx = s.indexOf(":");
          return { label: s.slice(0, idx).trim(), value: s.slice(idx + 1).trim() };
        }
        return null;
      })
      .filter(Boolean);
  } else if (typeof d.specs === "string") {
    d.specs = lines(d.specs)
      .map(function (line) {
        const idx = line.indexOf(":");
        if (idx === -1) return null;
        return { label: line.slice(0, idx).trim(), value: line.slice(idx + 1).trim() };
      })
      .filter(Boolean);
  }
  if (d.longDescription !== undefined) d.longDescription = String(d.longDescription || "").trim();
  /* Colour-variant linking: products sharing a variantGroup key are shown as
     colour siblings on the storefront (each keeps its own price/stock). */
  if (d.variantGroup !== undefined) d.variantGroup = String(d.variantGroup || "").trim();
  if (d.variantColor !== undefined) d.variantColor = String(d.variantColor || "").trim();
  if (d.variantColorHex !== undefined) d.variantColorHex = String(d.variantColorHex || "").trim();
  if (d.colorFamily !== undefined) d.colorFamily = String(d.colorFamily || "").trim();
  if (d.scentNotes && typeof d.scentNotes === "object") {
    d.scentNotes = {
      top: String(d.scentNotes.top || "").trim(),
      heart: String(d.scentNotes.heart || "").trim(),
      base: String(d.scentNotes.base || "").trim(),
    };
  }
  if (d.diffuser && typeof d.diffuser === "object") {
    d.diffuser = {
      notes: String(d.diffuser.notes || "").trim(),
      duration: String(d.diffuser.duration || "").trim(),
      capacity: String(d.diffuser.capacity || "").trim(),
    };
  }

  /* English (bilingual) counterparts — same shapes as the Greek fields, kept
     alongside them in the JSONB blob. Empty ones fall back to Greek on the
     storefront. */
  if (d.featuresEn !== undefined) d.featuresEn = lines(d.featuresEn) || [];
  if (d.includesEn !== undefined) d.includesEn = lines(d.includesEn) || [];
  if (d.shippingEn !== undefined) d.shippingEn = lines(d.shippingEn) || [];
  if (d.badgesEn !== undefined) {
    d.badgesEn = Array.isArray(d.badgesEn)
      ? d.badgesEn.map(String).map((s) => s.trim()).filter(Boolean)
      : String(d.badgesEn || "").split(/[,|]/).map((s) => s.trim()).filter(Boolean);
  }
  if (d.careEn !== undefined) {
    const careLinesEn = lines(d.careEn);
    d.careEn = careLinesEn && careLinesEn.length ? careLinesEn : String(d.careEn || "").trim();
  }
  if (d.specsEn !== undefined) {
    if (Array.isArray(d.specsEn)) {
      d.specsEn = d.specsEn
        .map(function (s) {
          if (!s) return null;
          if (typeof s === "object" && s.label && s.value) {
            return { label: String(s.label).trim(), value: String(s.value).trim() };
          }
          if (typeof s === "string" && s.indexOf(":") !== -1) {
            const idx = s.indexOf(":");
            return { label: s.slice(0, idx).trim(), value: s.slice(idx + 1).trim() };
          }
          return null;
        })
        .filter(Boolean);
    } else if (typeof d.specsEn === "string") {
      d.specsEn = (lines(d.specsEn) || [])
        .map(function (line) {
          const idx = line.indexOf(":");
          if (idx === -1) return null;
          return { label: line.slice(0, idx).trim(), value: line.slice(idx + 1).trim() };
        })
        .filter(Boolean);
    }
  }
  if (d.longDescriptionEn !== undefined) d.longDescriptionEn = String(d.longDescriptionEn || "").trim();
  if (d.descriptionEn !== undefined) d.descriptionEn = String(d.descriptionEn || "").trim();
  if (d.variantColorEn !== undefined) d.variantColorEn = String(d.variantColorEn || "").trim();
  if (d.scentNotesEn && typeof d.scentNotesEn === "object") {
    d.scentNotesEn = {
      top: String(d.scentNotesEn.top || "").trim(),
      heart: String(d.scentNotesEn.heart || "").trim(),
      base: String(d.scentNotesEn.base || "").trim(),
    };
  }
  if (d.diffuserEn && typeof d.diffuserEn === "object") {
    d.diffuserEn = {
      notes: String(d.diffuserEn.notes || "").trim(),
      duration: String(d.diffuserEn.duration || "").trim(),
      capacity: String(d.diffuserEn.capacity || "").trim(),
    };
  }
  return d;
}

/* ---------- SEO helpers (sitemap, llms.txt, per-product meta) ---------- */

function escapeHtml(s) {
  return String(s == null ? "" : s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function absImage(base, image) {
  if (!image) return base + "/images/logo/logo.png";
  if (/^https?:\/\//i.test(image)) return image;
  return base + "/" + String(image).replace(/^\//, "");
}

function availabilityOf(stock) {
  if (stock == null) return "https://schema.org/InStock";
  return stock > 0 ? "https://schema.org/InStock" : "https://schema.org/OutOfStock";
}

/* A short, crawler-friendly description. Uses the product's own description
   when set (admin/custom), otherwise a sensible bilingual fallback so the
   page is never empty for Google / AI. */
function seoDescription(p) {
  if (p.longDescription && p.longDescription.trim()) return p.longDescription.trim();
  if (p.description && p.description.trim()) return p.description.trim();
  const cat = p.category ? p.category + " — " : "";
  return (
    cat +
    "Χειροποίητο αρωματικό κερί από τη συλλογή της Nostalgia Collection, Ελλάδα. " +
    "Handmade scented candle / home fragrance, made in Greece."
  );
}

/* Every purchasable product (static catalog + admin/custom) resolved with
   the fields the SEO routes need. Single source for sitemap, llms.txt and
   per-product meta. */
async function seoProducts() {
  const overrides = await db.getOverrides({ read: true });
  const ctx = await loadPromotionContext();
  const list = [];
  catalog.PRODUCTS.forEach((p) => {
    const ov = overrides[p.id] || {};
    const resolved = applyPromotionPricing(
      { id: p.id, catId: p.catId, createdAt: null }, ov.price != null ? ov.price : null, ov.salePrice, ov.saleUntil, ctx
    );
    list.push({
      id: p.id,
      title: p.title,
      category: p.category,
      description: "",
      image: p.image,
      price: resolved.price,
      stock: ov.stock != null ? ov.stock : null,
      catId: p.catId || null,
    });
  });
  const customs = await db.listCustomProducts(true);
  customs.forEach((c) => {
    const ov = overrides[c.id] || {};
    const resolved = applyPromotionPricing(
      { id: c.id, catId: c.catId, createdAt: c.createdAt }, c.price, c.salePrice, c.saleUntil, ctx
    );
    list.push({
      id: c.id,
      title: c.title,
      category: (catalog.CATEGORIES[c.catId] || {}).name || "",
      description: c.description || "",
      image: c.image,
      price: resolved.price,
      stock: ov.stock != null ? ov.stock : null,
      catId: c.catId || null,
    });
  });
  return list;
}

/* ---------- account-holder notifications (fire-and-forget) ---------- */

/* New-product / sale / coupon mails are MARKETING, so they may only go to
   addresses with a recorded newsletter consent. This used to be
   db.listUsers() — every account holder, including people who had explicitly
   unsubscribed, which is exactly what the consent trail added in
   migration 031 exists to prevent. */
async function accountRecipients() {
  return db.listMarketingRecipients();
}

function notifyNewProduct(product, opts) {
  const o = opts || {};
  enqueueCampaign({
    kind: "new_product",
    sourceId: product.id,
    eventId: o.eventId || "product-published:" + product.id,
    subject: "Νέο προϊόν — Nostalgia Candle",
    snapshot: product,
    audience: o.audience || { type: "newsletter" },
    createdBy: o.createdBy,
  }).catch((e) => console.error("[notify] new product:", e.message));
}

function notifySale(product, opts) {
  const o = opts || {};
  enqueueCampaign({
    kind: "sale",
    sourceId: product.id,
    eventId: o.eventId || "sale-activated:" + product.id + ":" + String(product.saleUntil || ""),
    subject: "Νέα προσφορά — Nostalgia Candle",
    snapshot: product,
    audience: o.audience || { type: "newsletter" },
    createdBy: o.createdBy,
  }).catch((e) => console.error("[notify] sale:", e.message));
}

async function promotionEmailSnapshot(promotion) {
  const ids = (promotion.targets || []).filter((t) => t.type === "product" && t.id).map((t) => t.id);
  const candidates = ids.length ? ids : (await allSellableProductsForPromotions()).map((p) => p.id).slice(0, 3);
  const products = [];
  for (const id of candidates.slice(0, 3)) {
    const p = (await db.getCustomProduct(id)) || staticProduct(id);
    if (!p || p.price == null) continue;
    const salePrice = promotion.discountType === "percentage"
      ? Math.max(0.01, Number(p.price) * (1 - Number(promotion.discountValue) / 100))
      : promotion.discountType === "fixed_amount"
        ? Math.max(0.01, Number(p.price) - Number(promotion.discountValue))
        : Number(promotion.discountValue);
    products.push({ ...p, salePrice, saleUntil: promotion.endsAt || null });
  }
  const first = products[0];
  return first ? { ...first, relatedProducts: products.slice(1) } : null;
}

function notifyCoupon(coupon, opts) {
  const o = opts || {};
  enqueueCampaign({
    kind: "coupon",
    sourceId: coupon.code,
    eventId: o.eventId || "coupon-sent:" + coupon.code,
    subject: "Νέο κουπόνι — Nostalgia Candle",
    snapshot: coupon,
    audience: o.audience || { type: "newsletter" },
    createdBy: o.createdBy,
  }).catch((e) => console.error("[notify] coupon:", e.message));
}

/* Welcome offer: 10% on newsletter signup, extra 5% on account creation.
   Fire-and-forget so a mail outage never breaks signup/registration. */
function sendWelcomeCoupon(email, kind, opts) {
  if (!email) return;
  Promise.resolve()
    .then(() => mailer.sendWelcomeCoupon(email, kind, opts || {}))
    .catch((e) => console.error("[welcome-coupon] " + kind + ":", e.message));
}

const NEWSLETTER_POLICY_VERSION = "2026-08-06";
const NEWSLETTER_CONSENT_NOTICE =
  "Newsletter with product news and offers; consent may be withdrawn at any time.";

async function requestNewsletterOptIn(input) {
  const token = crypto.randomBytes(32).toString("base64url");
  const tokenHash = crypto.createHash("sha256").update(token).digest("hex");
  const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);
  const result = await db.requestSubscriberConfirmation({
    email: input.email,
    firstname: input.firstname || "",
    lastname: input.lastname || "",
    source: input.source || "site",
    policyVersion: NEWSLETTER_POLICY_VERSION,
    consentNotice: NEWSLETTER_CONSENT_NOTICE,
    tokenHash,
    expiresAt,
  });
  let confirmationDeliveryFailed = false;
  if (result.status !== "subscribed") {
    try {
      await mailer.sendNewsletterConfirmation(input.email, token, {
        firstname: input.firstname,
        lang: input.lang,
      });
    } catch (error) {
      confirmationDeliveryFailed = true;
      console.error("[newsletter-confirmation]", error.message);
    }
  }
  return { ...result, confirmationDeliveryFailed };
}

/* ---------- order lifecycle notifications (fire-and-forget) ----------
 * One email per real transition — never on a PATCH that leaves the field
 * unchanged, and never twice for the same transition (e.g. handed→transit
 * doesn't re-send "shipped", since the customer already got that at handed). */
function notifyOrderStatusChange(order, from, to) {
  if (to === "processing" && from !== "processing") {
    mailer.sendOrderPreparing(order).catch((e) => console.error("[notify] preparing:", e.message));
  }
}

function notifyOrderShippingChange(order, from, to, extra) {
  const wasWithCourier = from === "handed" || from === "transit";
  const nowWithCourier = to === "handed" || to === "transit";
  if (nowWithCourier && !wasWithCourier) {
    mailer.sendOrderShipped(order, extra || {}).catch((e) => console.error("[notify] shipped:", e.message));
  } else if (to === "delivered") {
    mailer.sendOrderDelivered(order).catch((e) => console.error("[notify] delivered:", e.message));
  } else if (to === "failed" && from !== "failed") {
    mailer.sendOrderIssue(order, { reason: "delivery_failed" }).catch((e) => console.error("[notify] issue:", e.message));
  }
}

function notifyOrderPaymentChange(order, from, to) {
  if (to === "cod_not_delivered" && from !== "cod_not_delivered") {
    mailer.sendOrderIssue(order, { reason: "cod_not_delivered" }).catch((e) => console.error("[notify] issue:", e.message));
  }
}

/** Accepts a data URL — Cloudinary when configured, else local uploads folder.
 *  `slot` distinguishes gallery photos of the same product (1st photo = no slot
 *  so it keeps the plain "<id>" key used as the thumbnail). */
async function saveProductImage(id, dataUrl, slot) {
  const m = /^data:image\/(png|jpe?g|webp|gif);base64,(.+)$/.exec(
    String(dataUrl || "")
  );
  if (!m) return null;
  const ext = m[1] === "jpeg" ? "jpg" : m[1];
  const buf = Buffer.from(m[2], "base64");
  if (!buf.length || buf.length > 10 * 1024 * 1024) return null;

  const key = slot != null ? id + "-" + slot : id;

  /* Cloudinary is best-effort. A revoked/rotated API key, a quota limit or a
     network blip must never cost the shop the photo the admin just uploaded, so
     any failure falls through to the same local folder used when CLOUDINARY_*
     is unset. Returning null here (the old behaviour) silently discarded it. */
  if (cdn.configured()) {
    try {
      const uploaded = await cdn.uploadProductImage(key, dataUrl);
      if (uploaded) return uploaded;
      console.error("[cloudinary] no URL returned for " + key + " — storing locally");
    } catch (e) {
      console.error("[cloudinary] upload failed for " + key + " — storing locally:", e.message);
    }
  }

  fs.mkdirSync(UPLOADS_DIR, { recursive: true });
  const filename = key + "." + ext;
  fs.writeFileSync(path.join(UPLOADS_DIR, filename), buf);
  return "images/product%20photo/uploads/" + encodeURIComponent(filename);
}

/* Contact uploads are deliberately kept outside the public static tree. The
   browser sends a small data URL; we validate both its declared MIME and its
   magic bytes before writing a UUID-only filename. Admin downloads are served
   through the authenticated route below, never as public static files. */
function saveContactAttachment(attachment) {
  if (!attachment || typeof attachment !== "object") return null;
  const originalName = str(attachment.name, 160).replace(/[\\/\0]/g, "_").trim();
  const declaredMime = String(attachment.mime || "").toLowerCase().trim();
  const match = /^data:([^;,]+);base64,([a-z0-9+/=\r\n]+)$/i.exec(String(attachment.data || ""));
  if (!match || !originalName) return null;
  const buf = Buffer.from(match[2].replace(/\s/g, ""), "base64");
  if (!buf.length || buf.length > 750 * 1024) return null;

  let mime = "";
  let ext = "";
  if (buf.subarray(0, 4).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47])) && declaredMime === "image/png") { mime = "image/png"; ext = "png"; }
  else if (buf.subarray(0, 3).equals(Buffer.from([0xff, 0xd8, 0xff])) && declaredMime === "image/jpeg") { mime = "image/jpeg"; ext = "jpg"; }
  else if (buf.subarray(0, 4).toString("ascii") === "RIFF" && buf.subarray(8, 12).toString("ascii") === "WEBP" && declaredMime === "image/webp") { mime = "image/webp"; ext = "webp"; }
  else if (buf.subarray(0, 5).toString("ascii") === "%PDF-" && declaredMime === "application/pdf") { mime = "application/pdf"; ext = "pdf"; }
  else return null;

  fs.mkdirSync(CONTACT_ATTACHMENTS_DIR, { recursive: true, mode: 0o700 });
  const storageName = crypto.randomUUID() + "." + ext;
  fs.writeFileSync(path.join(CONTACT_ATTACHMENTS_DIR, storageName), buf, { mode: 0o600 });
  return { name: originalName, mime, size: buf.length, storageName };
}

function removeContactAttachment(attachment) {
  if (!attachment || !attachment.attachmentStorageName) return;
  if (!/^[a-f0-9-]+\.(png|jpg|webp|pdf)$/i.test(attachment.attachmentStorageName)) return;
  try { fs.unlinkSync(path.join(CONTACT_ATTACHMENTS_DIR, attachment.attachmentStorageName)); } catch (_) {}
}

/** Save up to `MAX_PRODUCT_IMAGES` gallery photos; returns the stored URLs.
 *  The first photo doubles as the thumbnail (image). */
const MAX_PRODUCT_IMAGES = 3;
function validProductImageBatch(dataUrls) {
  if (!Array.isArray(dataUrls) || dataUrls.length > MAX_PRODUCT_IMAGES) return false;
  return dataUrls.every((dataUrl) => {
    const match = /^data:image\/(png|jpe?g|webp|gif);base64,(.+)$/.exec(String(dataUrl || ""));
    if (!match) return false;
    const bytes = Buffer.from(match[2], "base64");
    return bytes.length > 0 && bytes.length <= 10 * 1024 * 1024;
  });
}

async function saveProductImages(id, dataUrls) {
  const list = (Array.isArray(dataUrls) ? dataUrls : [dataUrls])
    .filter(Boolean)
    .slice(0, MAX_PRODUCT_IMAGES);
  const out = [];
  for (let i = 0; i < list.length; i++) {
    const url = await saveProductImage(id, list[i], i === 0 ? null : i + 1);
    if (url) out.push(url);
  }
  return out;
}

async function removeProductImages(id, urls) {
  for (const url of Array.isArray(urls) ? urls : [urls]) {
    if (url) await removeProductImageFile(id, url);
  }
}

async function removeProductImageFile(id, imageUrl) {
  if (!imageUrl) return;
  if (cdn.isCloudinaryUrl(imageUrl)) {
    await cdn.deleteProductImage(id, imageUrl);
    return;
  }
  try {
    const filename = decodeURIComponent(String(imageUrl).split("/").pop());
    fs.unlinkSync(path.join(UPLOADS_DIR, filename));
  } catch (e) {}
}

/* ---------- coupons ---------- */

/* How many codes a single order may stack. */
const MAX_COUPONS_PER_ORDER = 5;

/* Validates ONE code. `email` unlocks the welcome-offer rules (first order
   only / once per customer), which are keyed on the customer's email so guest
   checkouts are covered too. Returns { ok, coupon } or { ok:false, reason }. */
async function checkCoupon(code, email) {
  const c = await db.getCoupon(String(code || "").toUpperCase().trim());
  if (!c || !c.active) return { ok: false, reason: "invalid" };
  if (c.expiresAt && new Date(c.expiresAt) < new Date(new Date().toDateString())) {
    return { ok: false, reason: "expired" };
  }
  if (c.maxUses != null && c.uses >= c.maxUses) return { ok: false, reason: "exhausted" };

  if (c.firstOrderOnly || c.oncePerCustomer) {
    const mail = String(email || "").trim().toLowerCase();
    /* Without an email we cannot prove eligibility, so the code stays pending
       until checkout supplies one (the cart asks for it before applying). */
    if (!mail) return { ok: false, reason: "email_required" };
    if (c.oncePerCustomer && (await db.hasRedeemedCoupon(c.code, mail))) {
      return { ok: false, reason: "already_used" };
    }
    if (c.firstOrderOnly && (await db.hasPreviousOrder(mail))) {
      return { ok: false, reason: "not_first_order" };
    }
  }
  return { ok: true, coupon: c };
}

function couponDiscount(coupon, subtotal) {
  if (!coupon || subtotal <= 0) return 0;
  if (coupon.type === "percent") {
    return round2((subtotal * coupon.value) / 100);
  }
  return round2(Math.min(coupon.value, subtotal));
}

/* Resolves a list of codes into the coupons that actually apply plus the total
   discount. Percentages are ADDITIVE on the original subtotal (10% + 5% = 15%),
   the sum is capped at the subtotal, and free shipping applies if any coupon
   grants it. Duplicates are ignored; rejects are reported with a reason. */
async function resolveCoupons(codes, subtotal, email) {
  const list = Array.isArray(codes) ? codes : codes ? [codes] : [];
  const seen = new Set();
  const applied = [];
  const rejected = [];

  for (const raw of list) {
    const code = String(raw || "").toUpperCase().trim();
    if (!code || seen.has(code)) continue;
    seen.add(code);
    if (applied.length >= MAX_COUPONS_PER_ORDER) {
      rejected.push({ code, reason: "too_many" });
      continue;
    }
    const res = await checkCoupon(code, email);
    if (!res.ok) {
      rejected.push({ code, reason: res.reason });
      continue;
    }
    applied.push(res.coupon);
  }

  let discount = 0;
  for (const c of applied) discount = round2(discount + couponDiscount(c, subtotal));
  discount = round2(Math.min(discount, subtotal));

  return { applied, rejected, discount, freeShipping: applied.some((c) => c.freeShipping) };
}

/* ================= PUBLIC API ================= */

app.get("/api/health", ah(async (req, res) => {
  await db.getPool().query("SELECT 1");
  res.set("Cache-Control", "no-store");
  res.json({ ok: true, database: "ready", requestId: req.requestId });
}));

app.get("/api/public-config", (req, res) => {
  const pk = (process.env.STRIPE_PUBLISHABLE_KEY || "").trim();
  res.json({
    ok: true,
    gaMeasurementId: gaMeasurementId(),
    klaviyoCompanyId: klaviyoCompanyId(),
    metaPixelId: metaPixelId(),
    /* Public by nature — it ships to every visitor's browser. Served from the
       environment rather than a committed js/site-config.js so the repo never
       carries it, and protected by referrer + API restrictions on Google's
       side, which is the only protection a browser key can have. */
    googleMapsApiKey: (process.env.GOOGLE_MAPS_API_KEY || "").trim(),
    stripePublishableKey: pk,
    checkoutV2Enabled: process.env.CHECKOUT_V2_ENABLED === "true",
    turnstileSiteKey: security.turnstileSiteKey(),
    siteUrl: publicSiteUrl(req),
    email: {
      resend: mailer.resendConfigured(),
      smtp: mailer.smtpConfigured(),
    },
    cloudinary: { configured: cdn.configured() },
  });
});

app.get("/api/cron/ping", requireCron, (req, res) => {
  res.json({ ok: true, ts: new Date().toISOString() });
});

app.get("/api/cron/maintenance", requireCron, ah(async (req, res) => {
  const pool = db.getPool();
  const workerId = `maintenance:${process.env.VERCEL_REGION || "local"}`;
  const result = await runTrackedJob({ pool, jobName: "commerce_maintenance", workerId,
    correlationId: req.requestId, work: async () => {
      const inventory = await expireInventoryReservations({ pool, workerId,
        requestId: req.requestId, batchSize: 100 });
      /* Frees stock still held by card orders the customer never paid for. */
      const stalePending = await db.expireStalePendingOrders({
        olderThanMinutes: parseInt(process.env.PENDING_ORDER_TIMEOUT_MIN, 10) || 120,
        limit: 100,
      });
      if (stalePending.expired) {
        clearReadCache();
        console.log("[maintenance] released stock for " + stalePending.expired +
          " abandoned order(s):", stalePending.orders.map((o) => o.number).join(", "));
      }
      const notifications = mailer.emailConfigured()
        ? await processNotificationBatch({ pool, workerId,
          sender: new EmailNotificationSender(pool), batchSize: 25 })
        : { claimed: 0, skipped: "email_not_configured" };
      const promotionsActivated = [];
      if (mailer.emailConfigured()) {
        const promotionsNow = await db.listPromotions();
        for (const promotion of promotionsNow) {
          if (!promotion.sendMarketingEmail || promotions.effectiveStatus(promotion, new Date()) !== "active") continue;
          const snapshot = await promotionEmailSnapshot(promotion);
          if (snapshot) {
            notifySale(snapshot, { eventId: "promotion-activated:" + promotion.id, audience: { type: "newsletter" }, createdBy: promotion.createdBy });
            promotionsActivated.push(promotion.id);
          }
        }
      }
      const monitoring = await evaluateOperationalAlerts({ pool });
      /* Only ping on a newly-opened alert. An alert that is still open just
         keeps counting up — re-sending it every 5 minutes would be spam. */
      (monitoring.alerts || [])
        .filter((a) => Number(a.occurrences) === 1)
        .forEach((a) => notify.notifyAlert(a));
      return { inventory, stalePending, notifications, promotionsActivated, monitoring };
    } });
  res.json({ ok: true, result, requestId: req.requestId });
}));

/* Applies the retention rules (GDPR art. 5(1)(e)) — see
   services/retention-service.js. Its own endpoint rather than part of
   /api/cron/maintenance because that one runs every five minutes, and
   deleting personal data is a once-a-day concern.

   Still a no-op until RETENTION_ENABLED=true: run it as a dry run first, read
   what it reports, and only then let it delete anything. */
app.get("/api/cron/retention", requireCron, ah(async (req, res) => {
  const result = await runRetention({ pool: db.getPool(), apply: true });
  if (result.applied && result.totalMatched > 0) {
    console.log("[retention] applied — " + result.totalMatched + " record(s) affected");
    db.logEvent("retention.applied", "cron", null, {
      totalMatched: result.totalMatched,
      steps: result.steps,
    }).catch(() => {});
  }
  res.json({ ok: true, ...result, requestId: req.requestId });
}));

/* Pulls current status for every active ACS shipment and updates our own
   shipping_status — the automatic counterpart to the admin's manual
   "Ανανέωση tracking ACS" button. Meant to be hit every few minutes by the
   same cron mechanism as /api/cron/maintenance (see deploy/nostalgia.crontab).
   One order's ACS error never aborts the rest of the batch. */
app.get("/api/cron/acs-tracking-sync", requireCron, ah(async (req, res) => {
  if (!acs.configured()) return res.json({ ok: true, skipped: "acs_not_configured" });

  const orders = await db.listActiveAcsShipments(50);
  const results = { checked: orders.length, updated: 0, errors: [] };

  for (const order of orders) {
    try {
      const summary = await acs.trackingSummary(order.tracking);
      const mapped = acs.mapShipmentStatus(summary);
      if (mapped && mapped !== order.shippingStatus) {
        await db.updateOrder(order.id, { shipping_status: mapped });
        await db.appendOrderEvent(order.id, {
          at: new Date().toISOString(), actor: "acs-cron", type: "shipping",
          from: order.shippingStatus, to: mapped,
        });
        results.updated += 1;
        notifyOrderShippingChange(
          Object.assign({}, order, { shippingStatus: mapped }),
          order.shippingStatus,
          mapped,
          { eta: summary && summary.delivery_date_expected }
        );
      }
    } catch (e) {
      results.errors.push({ orderId: order.id, number: order.number, error: e.message });
    }
    // Stay well under ACS's default 10 requests/sec cap.
    await new Promise((resolve) => setTimeout(resolve, 120));
  }

  if (results.updated) clearReadCache();
  res.json({ ok: true, ...results, requestId: req.requestId });
}));

app.get("/api/admin/operations/metrics", requireAdmin, ah(async (req, res) => {
  res.json({ ok: true, metrics: await collectOperationalMetrics({ pool: db.getPool() }) });
}));

/* ---------- auth ---------- */

app.post("/api/auth/register", ah(async (req, res) => {
  const b = req.body || {};
  const email = normEmail(b.email);
  const password = String(b.password || "");
  if (auth.rateLimited("register:" + (req.ip || ""))) {
    return bad(res, 429, "too_many_attempts");
  }
  if (!(await security.verifyTurnstile(b.captchaToken, req.ip))) {
    return bad(res, 400, "captcha_failed");
  }
  if (!isEmail(email)) return bad(res, 400, "invalid_email");
  const pwErr = security.passwordStrengthError(password);
  if (pwErr) return bad(res, 400, pwErr);
  if (!str(b.firstname, 80) || !str(b.lastname, 80)) {
    return bad(res, 400, "missing_fields");
  }
  if (await db.getUser(email)) return bad(res, 409, "exists");
  const user = {
    email,
    firstname: str(b.firstname, 80),
    lastname: str(b.lastname, 80),
    birthDate: "",
    /* Becomes true only after the email owner completes double opt-in. */
    newsletterOptin: false,
    passHash: await auth.hashPassword(password),
  };
  await db.createUser(user);
  let newsletterConfirmationFailed = false;
  if (b.newsletterOptin) {
    const optInResult = await requestNewsletterOptIn({
      email,
      firstname: user.firstname,
      lastname: user.lastname,
      source: "register",
      lang: b.lang,
    });
    newsletterConfirmationFailed = optInResult.confirmationDeliveryFailed;
  }
  /* Account bonus: the extra 5% that stacks with the newsletter 10%. */
  sendWelcomeCoupon(email, "account", { firstname: user.firstname, lang: b.lang });
  auth.startUserSession(res, email);
  audit(req, "user.register", email);
  res.json({ ok: true, user: publicUser(user), newsletterConfirmationFailed });
}));

app.post("/api/auth/login", ah(async (req, res) => {
  const email = normEmail(req.body && req.body.email);
  const password = String((req.body && req.body.password) || "");
  if (auth.rateLimited("user:" + (req.ip || "") + ":" + email)) {
    audit(req, "user.login.blocked", email);
    return bad(res, 429, "too_many_attempts");
  }
  if (!(await security.verifyTurnstile(req.body && req.body.captchaToken, req.ip))) {
    return bad(res, 400, "captcha_failed");
  }
  if (!security.validatePassword(password) && password.length > 0) {
    return bad(res, 400, "invalid_credentials");
  }
  const user = await db.getUser(email);
  if (!user || !await auth.verifyPassword(password, user.passHash)) {
    audit(req, "user.login.failed", email);
    return bad(res, 401, "invalid_credentials");
  }
  if (user.active === false) {
    audit(req, "user.login.disabled", email);
    return bad(res, 403, "account_disabled");
  }
  auth.clearRateLimit("user:" + (req.ip || "") + ":" + email);
  /* Transparently upgrade an old scrypt hash to Argon2id on the way in. */
  if (auth.needsRehash(user.passHash)) {
    try {
      await db.setUserPassword(email, await auth.hashPassword(password));
    } catch (e) {
      console.error("[rehash] user", e.message);
    }
  }
  auth.startUserSession(res, email, !!(req.body && req.body.remember));
  audit(req, "user.login.success", email);
  res.json({ ok: true, user: publicUser(user) });
}));

app.post("/api/auth/logout", (req, res) => {
  const session = auth.getUserSession(req);
  auth.endUserSession(res);
  if (session) audit(req, "user.logout", session.sub);
  res.json({ ok: true });
});

/* ---------- Sign in with Google (OAuth 2.0 authorization code) ----------
 *
 * The authorization-code flow rather than the browser-side credential: the
 * code is exchanged server to server, so the client secret and the resulting
 * identity never pass through the page, and the visitor ends up holding the
 * same session cookie a password login issues. Nothing downstream needs to
 * know which way they signed in.
 */

const GOOGLE_AUTH_URL = "https://accounts.google.com/o/oauth2/v2/auth";
const GOOGLE_TOKEN_URL = "https://oauth2.googleapis.com/token";
const GOOGLE_STATE_COOKIE = "nostalgia_oauth_state";
const GOOGLE_STATE_MS = 10 * 60 * 1000;

function googleConfigured() {
  return !!(
    (process.env.GOOGLE_CLIENT_ID || "").trim() &&
    (process.env.GOOGLE_CLIENT_SECRET || "").trim()
  );
}

function googleRedirectUri(req) {
  return publicSiteUrl(req) + "/api/auth/google/callback";
}

/* Sends the visitor back to the account page with a reason instead of a bare
   JSON error: they arrive here by browser navigation, not by fetch. */
function googleFail(res, reason) {
  return res.redirect("/account?google=" + encodeURIComponent(reason));
}

app.get("/api/auth/google", (req, res) => {
  if (!googleConfigured()) return googleFail(res, "not_configured");

  /* Single-use, tied to this browser through an httpOnly cookie. Without it a
     third party could hand the visitor a pre-made callback URL and have them
     sign in to an account they do not own. */
  const state = crypto.randomBytes(32).toString("base64url");
  auth.setCookie(res, GOOGLE_STATE_COOKIE, state, GOOGLE_STATE_MS);

  const params = new URLSearchParams({
    client_id: (process.env.GOOGLE_CLIENT_ID || "").trim(),
    redirect_uri: googleRedirectUri(req),
    response_type: "code",
    scope: "openid email profile",
    state: state,
    /* Always let people choose which Google account, instead of silently
       reusing whichever one the browser happens to be signed into. */
    prompt: "select_account",
  });
  res.redirect(GOOGLE_AUTH_URL + "?" + params.toString());
});

/* Google signs the id_token, and we receive it over TLS straight from the
   token endpoint rather than via the browser, so the signature adds nothing
   here — but the claims still have to be checked. An unchecked `aud` would
   accept a token minted for a different application entirely. */
function readGoogleIdToken(idToken) {
  const parts = String(idToken || "").split(".");
  if (parts.length !== 3) return null;
  let claims;
  try {
    claims = JSON.parse(Buffer.from(parts[1], "base64url").toString("utf8"));
  } catch (e) {
    return null;
  }
  const iss = String(claims.iss || "");
  if (iss !== "accounts.google.com" && iss !== "https://accounts.google.com") return null;
  if (String(claims.aud || "") !== (process.env.GOOGLE_CLIENT_ID || "").trim()) return null;
  if (!claims.exp || Number(claims.exp) * 1000 <= Date.now()) return null;
  if (!claims.sub || !claims.email) return null;
  /* An unverified address could belong to somebody else, and this flow trusts
     the email enough to merge into an existing account. */
  if (claims.email_verified === false || claims.email_verified === "false") return null;
  return claims;
}

app.get("/api/auth/google/callback", ah(async (req, res) => {
  if (!googleConfigured()) return googleFail(res, "not_configured");

  const cookieState = auth.parseCookies(req)[GOOGLE_STATE_COOKIE] || "";
  auth.setCookie(res, GOOGLE_STATE_COOKIE, "", 0);

  if (req.query.error) {
    /* access_denied also covers "your consent screen is still in testing and
       this address is not a test user", which is the likeliest cause early on. */
    return googleFail(res, String(req.query.error).slice(0, 40));
  }

  const queryState = String(req.query.state || "");
  if (!cookieState || !queryState || !security.timingSafeEqualStr(cookieState, queryState)) {
    return googleFail(res, "state_mismatch");
  }

  const code = String(req.query.code || "");
  if (!code) return googleFail(res, "missing_code");

  let claims;
  try {
    const tokenRes = await fetch(GOOGLE_TOKEN_URL, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        code: code,
        client_id: (process.env.GOOGLE_CLIENT_ID || "").trim(),
        client_secret: (process.env.GOOGLE_CLIENT_SECRET || "").trim(),
        redirect_uri: googleRedirectUri(req),
        grant_type: "authorization_code",
      }).toString(),
    });
    const payload = await tokenRes.json();
    if (!tokenRes.ok) {
      console.error("[google oauth] token exchange failed:", payload && payload.error);
      return googleFail(res, "exchange_failed");
    }
    claims = readGoogleIdToken(payload.id_token);
  } catch (e) {
    console.error("[google oauth]", e.message);
    return googleFail(res, "exchange_failed");
  }

  if (!claims) return googleFail(res, "invalid_token");

  const email = normEmail(claims.email);
  if (!isEmail(email)) return googleFail(res, "invalid_email");

  /* Resolution order matters. The subject id first, because it survives the
     owner changing their Google email; the address only as the bridge that
     links a pre-existing password account the first time. */
  let user = await db.getUserByGoogleSub(claims.sub);
  let created = false;

  if (!user) {
    const existing = await db.getUser(email);
    if (existing) {
      user = await db.linkGoogleAccount(email, claims.sub);
      if (!user) return googleFail(res, "link_conflict");
      audit(req, "user.google.linked", email);
    } else {
      await db.createUser({
        email,
        firstname: str(claims.given_name, 80) || email.split("@")[0],
        lastname: str(claims.family_name, 80) || "",
        /* Google does not supply a birth date. It is offered afterwards and
           may stay empty; nothing in the shop requires it. */
        birthDate: "",
        newsletterOptin: false,
        /* Empty hash, never a placeholder that could be guessed:
           auth.verifyPassword returns false for an empty stored value, so this
           account simply cannot be entered with a password. */
        passHash: "",
        googleSub: claims.sub,
        authProvider: "google",
      });
      user = await db.getUser(email);
      created = true;
      audit(req, "user.google.register", email);
    }
  }

  if (!user) return googleFail(res, "user_unavailable");
  if (user.active === false) return googleFail(res, "account_disabled");

  auth.startUserSession(res, user.email);
  audit(req, "user.google.login", user.email);

  /* `welcome` lets the account page offer the optional birth date once, right
     after the account is first created. */
  res.redirect("/account?google=ok" + (created ? "&welcome=1" : ""));
}));

/* Offered once after a Google account is created, since Google supplies no
   birth date. Entirely optional — an empty value is a valid answer and clears
   whatever was there, so "not now" and "actually, remove it" are the same
   request. */
app.post("/api/auth/birth-date", ah(async (req, res) => {
  const session = auth.getUserSession(req);
  if (!session) return bad(res, 401, "unauthorized");

  const raw = String((req.body && req.body.birthDate) || "").trim();
  /* Either empty, or a plain ISO date. Anything else is a client bug rather
     than something to coerce. */
  if (raw && !/^\d{4}-\d{2}-\d{2}$/.test(raw)) return bad(res, 400, "invalid_date");
  if (raw) {
    const d = new Date(raw + "T00:00:00Z");
    if (isNaN(d.getTime()) || d.getTime() > Date.now()) return bad(res, 400, "invalid_date");
  }

  const user = await db.setUserBirthDate(session.sub, raw);
  if (!user) return bad(res, 404, "not_found");
  audit(req, "user.birthdate.set", session.sub);
  res.json({ ok: true, user: publicUser(user) });
}));

app.get("/api/auth/me", ah(async (req, res) => {
  const session = auth.getUserSession(req);
  if (!session) return res.json({ ok: true, user: null });
  const user = await db.getUser(session.sub);
  res.json({ ok: true, user: user ? publicUser(user) : null });
}));

/* Update the signed-in user's own profile (name only). Email is the
   account identity and is intentionally read-only here. */
app.patch("/api/auth/me", ah(async (req, res) => {
  const session = auth.getUserSession(req);
  if (!session) return bad(res, 401, "unauthorized");
  const user = await db.getUser(session.sub);
  if (!user) return bad(res, 401, "unauthorized");
  const b = req.body || {};
  const fields = {};
  if (b.firstname != null) {
    const fn = str(b.firstname, 80);
    if (!fn) return bad(res, 400, "missing_fields");
    fields.firstname = fn;
  }
  if (b.lastname != null) {
    const ln = str(b.lastname, 80);
    if (!ln) return bad(res, 400, "missing_fields");
    fields.lastname = ln;
  }
  if (Object.keys(fields).length) await db.updateUser(session.sub, fields);
  const updated = await db.getUser(session.sub);
  res.json({ ok: true, user: publicUser(updated) });
}));

/* Change password: verify current, then set the new one. */
app.post("/api/auth/change-password", ah(async (req, res) => {
  const session = auth.getUserSession(req);
  if (!session) return bad(res, 401, "unauthorized");
  if (auth.rateLimited("pw:" + (req.ip || "") + ":" + session.sub)) {
    return bad(res, 429, "too_many_attempts");
  }
  const b = req.body || {};
  const current = String(b.currentPassword || "");
  const next = String(b.newPassword || "");
  const pwErr = security.passwordStrengthError(next);
  if (pwErr) return bad(res, 400, pwErr);
  const user = await db.getUser(session.sub);
  if (!user || !await auth.verifyPassword(current, user.passHash)) {
    return bad(res, 401, "wrong_password");
  }
  await db.setUserPassword(session.sub, await auth.hashPassword(next));
  audit(req, "user.password.change", session.sub);
  res.json({ ok: true });
}));

/* Email a one-time code for password reset / change. Works both for a
   logged-in user (session email) and a logged-out "forgot password" (body
   email). Always returns ok so the email's existence is never revealed. */
const RESET_CODE_TTL_MS = 15 * 60 * 1000;

app.post("/api/auth/request-code", ah(async (req, res) => {
  const session = auth.getUserSession(req);
  const email = session ? session.sub : normEmail(req.body && req.body.email);
  if (!isEmail(email)) return bad(res, 400, "invalid_email");
  if (auth.rateLimited("code:" + (req.ip || "") + ":" + email)) {
    return bad(res, 429, "too_many_attempts");
  }
  const user = await db.getUser(email);
  if (user) {
    const code = auth.generateCode();
    const expiresAt = new Date(Date.now() + RESET_CODE_TTL_MS).toISOString();
    await db.setAuthCode(email, auth.codeHash(code), expiresAt);
    const lang = (req.body && req.body.lang) === "en" ? "en" : "el";
    mailer.sendPasswordCode(email, code, lang).catch((e) => console.error("[code]", e.message));
  }
  res.json({ ok: true });
}));

/* Verify an emailed code and set the new password. Logs the user in on
   success (handy for the forgot-password flow). */
app.post("/api/auth/reset-password", ah(async (req, res) => {
  const b = req.body || {};
  const session = auth.getUserSession(req);
  const email = session ? session.sub : normEmail(b.email);
  const code = String(b.code || "").trim();
  const next = String(b.newPassword || "");
  if (!isEmail(email)) return bad(res, 400, "invalid_email");
  const pwErr = security.passwordStrengthError(next);
  if (pwErr) return bad(res, 400, pwErr);
  const rec = await db.getAuthCode(email);
  if (!rec) return bad(res, 400, "invalid_code");
  if (new Date(rec.expiresAt).getTime() <= Date.now()) {
    await db.deleteAuthCode(email);
    return bad(res, 400, "code_expired");
  }
  if (rec.attempts >= 5) {
    await db.deleteAuthCode(email);
    return bad(res, 429, "too_many_attempts");
  }
  if (!auth.verifyCodeHash(code, rec.codeHash)) {
    await db.bumpAuthCodeAttempts(email);
    return bad(res, 400, "invalid_code");
  }
  const user = await db.getUser(email);
  if (!user) return bad(res, 400, "invalid_code");
  await db.setUserPassword(email, await auth.hashPassword(next));
  await db.deleteAuthCode(email);
  auth.startUserSession(res, email);
  audit(req, "user.password.reset", email);
  res.json({ ok: true });
}));

/* ---------- GDPR: export & delete account ---------- */

/* Right of access / data portability (GDPR art. 15 & 20): download every
   piece of personal data tied to the signed-in account as JSON. */
app.get("/api/auth/export", ah(async (req, res) => {
  const session = auth.getUserSession(req);
  if (!session) return bad(res, 401, "unauthorized");
  const data = await db.exportUserData(session.sub);
  audit(req, "user.data.export", session.sub);
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.setHeader(
    "Content-Disposition",
    'attachment; filename="nostalgia-my-data.json"'
  );
  res.send(JSON.stringify(data, null, 2));
}));

/* Right to erasure (GDPR art. 17): delete the account. Requires the current
   password as confirmation. Order records are retained (legal/tax duty) but
   detached from the account — see db.deleteUserAccount. */
app.post("/api/auth/delete-account", ah(async (req, res) => {
  const session = auth.getUserSession(req);
  if (!session) return bad(res, 401, "unauthorized");
  if (auth.rateLimited("del:" + (req.ip || "") + ":" + session.sub)) {
    return bad(res, 429, "too_many_attempts");
  }
  const password = String((req.body && req.body.password) || "");
  const user = await db.getUser(session.sub);
  if (!user || !await auth.verifyPassword(password, user.passHash)) {
    return bad(res, 401, "wrong_password");
  }
  await db.deleteUserAccount(session.sub);
  auth.endUserSession(res);
  audit(req, "user.account.delete", "erased-account");
  res.json({ ok: true });
}));

/* Save (or clear) the account's default shipping address. Mirrors the
   checkout shipping-address fields so it can pre-fill the checkout form. */
app.put("/api/auth/address", ah(async (req, res) => {
  const session = auth.getUserSession(req);
  if (!session) return bad(res, 401, "unauthorized");
  const b = req.body || {};
  const address = {
    firstname: str(b.firstname, 80),
    lastname: str(b.lastname, 80),
    phone: str(b.phone, 40),
    mobile: str(b.mobile, 40),
    postal: str(b.postal, 20),
    countryCode: str(b.countryCode, 4),
    country: str(b.country, 80),
    street: str(b.street, 160),
    streetNumber: str(b.streetNumber, 20),
    city: str(b.city, 80),
    prefecture: str(b.prefecture, 80),
    floor: str(b.floor, 20),
    locationType: str(b.locationType, 20),
  };
  const hasAny = Object.keys(address).some((k) => address[k]);
  await db.updateUser(session.sub, { address: hasAny ? address : null });
  const updated = await db.getUser(session.sub);
  res.json({ ok: true, address: updated.address || null });
}));

/* Toggle newsletter opt-in from the account, syncing the newsletter list. */
app.post("/api/auth/newsletter", ah(async (req, res) => {
  const session = auth.getUserSession(req);
  if (!session) return bad(res, 401, "unauthorized");
  const optin = !!(req.body && req.body.optin);
  const user = await db.getUser(session.sub);
  if (optin) {
    await db.updateUser(session.sub, { newsletterOptin: false });
    const result = await requestNewsletterOptIn({
      email: user.email,
      firstname: user.firstname,
      lastname: user.lastname,
      source: "account",
      lang: req.body && req.body.lang,
    });
    if (result.confirmationDeliveryFailed) {
      return bad(res, 503, "confirmation_email_failed");
    }
    return res.json({ ok: true, newsletterOptin: result.status === "subscribed", confirmationPending: result.status !== "subscribed" });
  } else {
    await db.unsubscribeSubscriber(user.email);
  }
  res.json({ ok: true, newsletterOptin: false, confirmationPending: false });
}));

/* ---------- newsletter ---------- */

app.post("/api/newsletter", ah(async (req, res) => {
  const b = req.body || {};
  const email = normEmail(b.email);
  if (!isEmail(email)) return bad(res, 400, "invalid_email");
  const firstname = str(b.firstname, 80);
  const result = await requestNewsletterOptIn({
    email,
    firstname,
    lastname: str(b.lastname, 80),
    source: str(b.source, 40) || "site",
    lang: b.lang,
  });
  if (result.confirmationDeliveryFailed) {
    return bad(res, 503, "confirmation_email_failed");
  }
  res.json({ ok: true, confirmationPending: result.status !== "subscribed" });
}));

app.get("/api/newsletter/confirm", ah(async (req, res) => {
  const token = String(req.query.token || "");
  const en = req.query.lang === "en";
  const tokenHash = /^[A-Za-z0-9_-]{40,100}$/.test(token)
    ? crypto.createHash("sha256").update(token).digest("hex")
    : "";
  const subscriber = tokenHash ? await db.confirmSubscriber(tokenHash) : null;
  if (subscriber) {
    sendWelcomeCoupon(subscriber.email, "newsletter", {
      firstname: subscriber.firstname,
      lang: en ? "en" : "el",
    });
  }
  const title = subscriber
    ? en ? "Subscription confirmed" : "Η εγγραφή επιβεβαιώθηκε"
    : en ? "Invalid or expired link" : "Μη έγκυρος ή ληγμένος σύνδεσμος";
  const body = subscriber
    ? en ? "Thank you. You can unsubscribe at any time from every newsletter."
      : "Ευχαριστούμε. Μπορείς να διαγραφείς ανά πάσα στιγμή από κάθε newsletter."
    : en ? "Submit the newsletter form again to receive a new confirmation link."
      : "Συμπλήρωσε ξανά τη φόρμα newsletter για νέο σύνδεσμο επιβεβαίωσης.";
  res.set("Content-Type", "text/html; charset=utf-8");
  res.send("<!doctype html><html lang=\"" + (en ? "en" : "el") + "\"><meta charset=\"utf-8\">" +
    "<meta name=\"viewport\" content=\"width=device-width,initial-scale=1\"><title>" + title +
    "</title><body style=\"font-family:Georgia,serif;max-width:620px;margin:12vh auto;padding:24px;text-align:center\">" +
    "<h1>" + title + "</h1><p>" + body + "</p><p><a href=\"/\">Nostalgia Collection</a></p></body></html>");
}));

/* One-click unsubscribe link from marketing emails — no login, verified via
   an HMAC token (security.newsletterUnsubscribeToken) instead of a session,
   since the recipient is reading this from their inbox, not the site. */
/* Records a cookie-banner choice. Public and unauthenticated by necessity —
   the visitor has no account and the whole point is to log the decision of
   someone who may never create one. Rate-limited like any other open endpoint;
   a flood here would only pollute our own evidence log. */
app.post("/api/cookie-consent", ah(async (req, res) => {
  const b = req.body || {};
  const visitorId = str(b.visitorId, 64);
  /* No id means no way to tie the record to a later dispute, which is the
     only reason the row exists. */
  if (!visitorId) return bad(res, 400, "missing_visitor_id");

  const saved = await db.recordCookieConsent({
    visitorId,
    analytics: !!b.analytics,
    marketing: !!b.marketing,
    policyVersion: str(b.policyVersion, 20) || "v1",
    source: str(b.source, 20),
    /* The random browser id, choice, time and policy version are sufficient
       evidence. Do not turn the consent log into an IP/UA tracking store. */
    ipHash: null,
    userAgent: null,
  });
  res.json({ ok: true, id: saved.id, at: saved.created_at });
}));

app.get("/api/newsletter/unsubscribe", ah(async (req, res) => {
  const email = normEmail(req.query.email);
  const token = String(req.query.token || "");
  const en = req.query.lang === "en";
  const ok = isEmail(email) && security.verifyNewsletterUnsubscribeToken(email, token);
  if (ok) await db.unsubscribeSubscriber(email);
  const title = ok
    ? en ? "You have been unsubscribed" : "Η διαγραφή ολοκληρώθηκε"
    : en ? "Invalid or expired link" : "Μη έγκυρος σύνδεσμος";
  const body = ok
    ? en
      ? "You will no longer receive marketing emails from Nostalgia Collection. Order confirmations are unaffected."
      : "Δεν θα λαμβάνετε πλέον marketing emails από τη Nostalgia Collection. Τα emails παραγγελιών δεν επηρεάζονται."
    : en
      ? "This unsubscribe link is invalid or has expired."
      : "Αυτός ο σύνδεσμος διαγραφής δεν είναι έγκυρος ή έχει λήξει.";
  res.set("Content-Type", "text/html; charset=utf-8");
  res.send(
    "<!doctype html><html lang=\"" + (en ? "en" : "el") + "\"><meta charset=\"utf-8\">" +
    "<meta name=\"viewport\" content=\"width=device-width, initial-scale=1\">" +
    "<title>" + title + " — Nostalgia Collection</title>" +
    "<body style=\"font-family:Georgia,'Times New Roman',serif;background:#faf6ef;color:#2b2b2b;margin:0;padding:48px 20px;text-align:center\">" +
    "<h1 style=\"font-size:20px;margin:0 0 12px\">" + title + "</h1>" +
    "<p style=\"font-size:15px;max-width:420px;margin:0 auto 24px;line-height:1.6\">" + body + "</p>" +
    "<a href=\"/\" style=\"color:#a87d34;text-decoration:none;font-size:14px\">nostalgiacandle.gr</a>" +
    "</body></html>"
  );
}));

/* ---------- contact ---------- */

app.post("/api/contact", ah(async (req, res) => {
  if (auth.rateLimited("contact:" + (req.ip || ""))) {
    return bad(res, 429, "too_many_attempts");
  }
  if (!(await security.verifyTurnstile(req.body && req.body.captchaToken, req.ip))) {
    return bad(res, 400, "captcha_failed");
  }
  const b = req.body || {};
  const email = normEmail(b.email);
  const message = str(b.message, 4000);
  if (!isEmail(email) || !message) return bad(res, 400, "missing_fields");
  const attachment = b.attachment ? saveContactAttachment(b.attachment) : null;
  if (b.attachment && !attachment) return bad(res, 400, "attachment_invalid");
  const msg = {
    id: crypto.randomUUID(),
    lastName: str(b.name, 80),
    firstName: str(b.firstName, 80),
    email,
    phone: str(b.phone, 40),
    country: str(b.country, 80),
    subject: str(b.subject, 160),
    message,
    lang: b.lang === "en" ? "en" : "el",
    attachmentName: attachment ? attachment.name : "",
    attachmentMime: attachment ? attachment.mime : "",
    attachmentSize: attachment ? attachment.size : 0,
    attachmentStorageName: attachment ? attachment.storageName : "",
  };
  try {
    await db.addMessage(msg);
  } catch (error) {
    removeContactAttachment(msg);
    throw error;
  }
  mailer.sendContactNotification(msg).catch((e) => console.error("[contact]", e.message));
  mailer.sendContactAutoReply(msg).catch((e) => console.error("[contact]", e.message));
  res.json({ ok: true });
}));

/* ---------- catalog (custom products + prices + stock) ---------- */

app.get("/api/catalog", ah(async (req, res) => {
  return cachedJson(req, res, "catalog", async () => {
    const overrides = await db.getOverrides({ read: true });
    const detailsMap = await db.getAllProductDetails({ read: true });
    const customs = await db.listCustomProducts(true, { read: true });
    const variantsByProduct = await db.getAllVariants({ read: true });
    const ctx = await loadPromotionContext();
    const customsById = {};
    customs.forEach((c) => { customsById[c.id] = c; });
    /* Static catalog products carry no createdAt (constants), so they can
       never match a "new products" exclusion — same as everywhere else. */
    function identityFor(id) {
      const st = catalog.PRODUCT_IDS.has(id) ? catalog.PRODUCTS.find((p) => p.id === id) : null;
      if (st) return { id, catId: st.catId, createdAt: null };
      const cu = customsById[id];
      return { id, catId: cu ? cu.catId : null, createdAt: cu ? cu.createdAt : null };
    }
    const prices = {};
    const salePrices = {};
    const stock = {};
    Object.keys(overrides).forEach((id) => {
      const ov = overrides[id];
      if (catalog.PRODUCT_IDS.has(id)) {
        if (ov.price != null) prices[id] = ov.price;
        const resolved = applyPromotionPricing(identityFor(id), ov.price != null ? ov.price : null, ov.salePrice, ov.saleUntil, ctx);
        if (resolved.salePrice != null) salePrices[id] = resolved.salePrice;
      }
      stock[id] = ov.stock;
    });
    const variants = {};
    Object.keys(variantsByProduct).forEach((pid) => {
      const matchProduct = identityFor(pid);
      variants[pid] = variantsByProduct[pid].map((v) => publicVariant(v, matchProduct, ctx));
    });
    return {
      ok: true,
      products: customs.map(function (p) {
        return publicProduct(p, detailsMap[p.id], ctx);
      }),
      prices,
      salePrices,
      stock,
      details: detailsMap,
      variants,
    };
  });
}));

/* kept for compatibility */
app.get("/api/stock", ah(async (req, res) => {
  return cachedJson(req, res, "stock", async () => {
    const overrides = await db.getOverrides({ read: true });
    const stock = {};
    Object.keys(overrides).forEach((id) => {
      stock[id] = overrides[id].stock;
    });
    return { ok: true, stock };
  });
}));

app.get("/api/products", ah(async (req, res) => {
  return cachedJson(req, res, "products", async () => {
    const detailsMap = await db.getAllProductDetails({ read: true });
    const customs = await db.listCustomProducts(true, { read: true });
    const ctx = await loadPromotionContext();
    return {
      ok: true,
      products: customs.map(function (p) {
        return publicProduct(p, detailsMap[p.id], ctx);
      }),
    };
  });
}));

/* Monthly best sellers (this calendar month). Empty until real orders exist —
   the storefront then falls back to a curated/auto selection client-side. */
app.get("/api/products/bestsellers", ah(async (req, res) => {
  return cachedJson(req, res, "bestsellers", async () => {
    const rows = await db.monthlyBestSellerIds(5, { read: true });
    return { ok: true, items: rows };
  });
}));

/* ---------- coupons (public validation) ---------- */

app.post("/api/coupons/validate", ah(async (req, res) => {
  const b = req.body || {};
  const code = String(b.code || "").toUpperCase().trim();
  if (!code) return bad(res, 400, "missing_code");

  /* The email lets us answer the welcome-offer rules up front instead of
     failing at checkout. Logged-in visitors get it from their session. */
  const session = auth.getUserSession(req);
  const email = String(b.email || (session && session.sub) || "").trim();

  const result = await checkCoupon(code, email);
  if (!result.ok) return res.json({ ok: true, valid: false, reason: result.reason });

  const c = result.coupon;
  res.json({
    ok: true,
    valid: true,
    coupon: {
      code: c.code,
      type: c.type,
      value: c.value,
      freeShipping: !!c.freeShipping,
      firstOrderOnly: !!c.firstOrderOnly,
    },
  });
}));

/* ---------- reviews ---------- */

function reviewDisplayTitle(rev) {
  const title = String(rev.title || "").trim();
  if (title) return title;
  const line = String(rev.text || "")
    .trim()
    .split("\n")[0];
  if (line.length <= 90) return line;
  return line.slice(0, 87) + "...";
}

function reviewExcerpt(text, max) {
  max = max || 160;
  const clean = String(text || "").trim().replace(/\s+/g, " ");
  if (clean.length <= max) return clean;
  return clean.slice(0, max - 1).trim() + "…";
}

async function enrichReview(rev, overrides) {
  const p = await resolveProduct(rev.productId, overrides);
  const title = reviewDisplayTitle(rev);
  return {
    id: rev.id,
    name: rev.name,
    rating: rev.rating,
    title: title,
    text: rev.text,
    excerpt: reviewExcerpt(rev.text, 180),
    isVerifiedPurchase: !!rev.isVerifiedPurchase,
    helpfulCount: rev.helpfulCount || 0,
    reply: rev.reply || null,
    createdAt: rev.createdAt,
    productId: rev.productId,
    productTitle: p ? p.title : "",
    productImage: p && p.image ? p.image : null,
    productUrl: p ? "/product/" + encodeURIComponent(p.id) : "/collection",
  };
}

async function enrichReviews(reviews, overrides) {
  return Promise.all(reviews.map(function (r) {
    return enrichReview(r, overrides);
  }));
}

/* Approved review stats (site-wide). */
app.get("/api/reviews/stats", ah(async (req, res) => {
  return cachedJson(req, res, "reviews:stats", async () => {
    const stats = await db.reviewStats({ read: true });
    return { ok: true, stats: stats };
  }, 30000);
}));

/* Single approved review. */
app.get("/api/reviews/:id", ah(async (req, res) => {
  const id = String(req.params.id || "");
  if (!id || id === "stats") return bad(res, 404, "not_found");
  const rev = await db.approvedReviewById(id, { read: true });
  if (!rev) return bad(res, 404, "not_found");
  const overrides = await db.getOverrides();
  res.json({ ok: true, review: await enrichReview(rev, overrides) });
}));

/* Approved reviews — per product or site-wide list. */
app.get("/api/reviews", ah(async (req, res) => {
  return cachedJson(req, res, "reviews:list:" + req.originalUrl, async () => {
    const productId = String(req.query.productId || "");
    const overrides = await db.getOverrides({ read: true });

    if (productId) {
      const reviews = await db.approvedReviews(productId, { read: true });
      const enriched = await enrichReviews(reviews, overrides);
      return { ok: true, reviews: enriched };
    }

    const limit = Math.max(1, Math.min(50, parseInt(req.query.limit, 10) || 12));
    const sort = req.query.sort === "rating" ? "rating" : "date";
    const reviews = await db.approvedReviewsAll({ limit: limit, sort: sort, read: true });
    const enriched = await enrichReviews(reviews, overrides);
    return { ok: true, reviews: enriched };
  }, 30000);
}));

/* Display name for a logged-in reviewer: "Firstname L." — never the client's
   own free-text `name` for an account holder, so no one can pose as someone
   else's name while their review carries their real, verified account. */
function reviewerDisplayName(user, fallback) {
  if (!user) return fallback;
  const first = String(user.firstname || "").trim();
  const lastInitial = String(user.lastname || "").trim().slice(0, 1);
  const name = [first, lastInitial ? lastInitial + "." : ""].filter(Boolean).join(" ");
  return name || fallback;
}

/* Submit a review — stored as pending until the admin approves it.
   Works for guests and logged-in users alike; a delivered order (found via
   the shopper's own account, or a guest order-tracking token) marks it as a
   verified purchase, but isn't required — unverified reviews are still
   accepted and clearly labelled as such. */
app.post("/api/reviews", ah(async (req, res) => {
  const b = req.body || {};
  if (auth.rateLimited("review:" + (req.ip || ""))) {
    return bad(res, 429, "too_many_attempts");
  }
  const overrides = await db.getOverrides();
  const product = await resolveProduct(String(b.productId || ""), overrides);
  if (!product) return bad(res, 404, "product_not_found");

  const rating = Math.max(1, Math.min(5, parseInt(b.rating, 10) || 0));
  if (!rating) return bad(res, 400, "invalid_rating");
  const title = str(b.title, 80);
  if (title.length < 5) return bad(res, 400, "title_too_short");
  const text = str(b.text, 2000);
  if (text.length < 20) return bad(res, 400, "text_too_short");

  /* Automatic, content-neutral pre-screen — never based on rating/sentiment. */
  const screen = reviewsPolicy.screenReviewContent({ title, text });
  if (!screen.ok) return bad(res, 400, screen.reason);

  const session = auth.getUserSession(req);
  let user = null;
  if (session) user = await db.getUser(session.sub);

  const name = user ? reviewerDisplayName(user, "Πελάτης") : (str(b.name, 80) || "Guest");

  /* Verified purchase: logged-in shoppers are checked against their own
     delivered orders; guests can prove a purchase with the same access token
     already used for order tracking (no new email flow needed). */
  let match = null;
  if (session) {
    match = await db.findReviewableOrderItem({ email: session.sub, productId: product.id });
  } else if (b.orderToken) {
    match = await db.findReviewableOrderItem({ accessToken: str(b.orderToken, 80), productId: product.id });
  }
  if (match && (await db.hasReviewedOrderItem(match.orderItemId))) {
    return bad(res, 409, "already_reviewed");
  }

  try {
    await db.createReview({
      id: crypto.randomUUID(),
      productId: product.id,
      name,
      rating,
      title,
      text,
      userEmail: session ? session.sub : null,
      orderId: match ? match.orderId : null,
      orderItemId: match ? match.orderItemId : null,
      isVerifiedPurchase: !!match,
    });
  } catch (e) {
    if (e instanceof db.DuplicateReviewError) return bad(res, 409, "already_reviewed");
    throw e;
  }
  clearReadCache();
  /* pending → not shown until approved; the client shows a thank-you message */
  res.json({ ok: true, pending: true, verified: !!match });
}));

/* Per-product reviews for the redesigned product-page section: paginated,
   sortable, optionally verified-only, with the store's reply attached. */
app.get("/api/products/:productId/reviews", ah(async (req, res) => {
  const productId = String(req.params.productId || "");
  return cachedJson(req, res, "reviews:product:" + productId + ":" + req.originalUrl, async () => {
    const page = Math.max(1, parseInt(req.query.page, 10) || 1);
    const limit = Math.max(1, Math.min(200, parseInt(req.query.limit, 10) || 5));
    const sort = str(req.query.sort, 20) || "newest";
    const verifiedOnly = req.query.verifiedOnly === "true";
    const sortKey = sort === "rating_high" ? "rating_high" : sort === "rating_low" ? "rating_low" : sort === "helpful" ? "helpful" : "newest";

    const [summary, page1] = await Promise.all([
      db.productReviewStats(productId, { read: true }),
      db.productReviews(productId, { page, limit, sort: sortKey, verifiedOnly, read: true }),
    ]);
    return {
      ok: true,
      summary,
      reviews: page1.reviews.map((r) => ({
        id: r.id, name: r.name, rating: r.rating, title: r.title, text: r.text,
        isVerifiedPurchase: r.isVerifiedPurchase, helpfulCount: r.helpfulCount,
        reply: r.reply, createdAt: r.createdAt,
      })),
      pagination: page1.pagination,
    };
  }, 20000);
}));

/* "Was this helpful?" — one vote per anonymous browser (voterKey is a
   client-generated id persisted in localStorage, not tied to any account). */
app.post("/api/reviews/:id/helpful", ah(async (req, res) => {
  const id = String(req.params.id || "");
  const voterKey = str((req.body && req.body.voterKey) || "", 80);
  if (!voterKey) return bad(res, 400, "missing_voter_key");
  const helpfulCount = await db.voteReviewHelpful(id, voterKey);
  clearReadCache();
  res.json({ ok: true, helpfulCount });
}));

/* ---------- orders ---------- */

/* Three independent axes. Legacy values (shipped/delivered/issue/offline/cod)
   are still accepted so orders created before the split keep working. */
const ORDER_STATUSES = ["new", "processing", "ready", "completed", "cancelled", "review", "shipped", "delivered", "issue"];
const PAYMENT_STATUSES = [
  "pending", "paid", "failed", "refunded", "partial_refund", "offline",
  "cod_pending", "cod_collected", "cod_not_delivered", "cod_awaiting_remittance", "cod",
];
const SHIPPING_STATUSES = ["not_ready", "ready_courier", "handed", "transit", "delivered", "failed", "returning", "returned"];
const ORDER_TABS = ["active", "new", "card_paid", "cod", "processing", "ready", "transit", "delivered", "review", "cancelled", "all"];

app.post("/api/orders", ah(async (req, res) => {
  const b = req.body || {};
  if (!(await security.verifyTurnstile(b.captchaToken, req.ip))) {
    return bad(res, 400, "captcha_failed");
  }
  const customer = b.customer || {};
  const email = normEmail(customer.email);
  if (!isEmail(email)) return bad(res, 400, "invalid_email");

  const overrides = await db.getOverrides();
  const rawItems = Array.isArray(b.items) ? b.items : [];
  const items = [];
  for (const it of rawItems) {
    const id = String((it && it.id) || "");
    const qty = Math.max(1, Math.min(99, parseInt(it && it.qty, 10) || 1));
    const product = await resolveProduct(id, overrides);
    if (!product) continue;
    const item = {
      id,
      qty,
      title: product.title,
      image: product.image,
      price: product.price != null ? product.price : null,
    };
    /* Size ("100ml") for the receipt line, snapshotted like title and price so
       the order keeps showing what was bought even if the product is edited
       later. Only diffusers carry a capacity today — candles have no size
       field, so the line simply doesn't appear for them. */
    try {
      const details = await db.getProductDetails(id);
      const capacity = details && details.diffuser && details.diffuser.capacity;
      if (capacity) item.size = String(capacity).trim();
    } catch (_) {
      /* never let a cosmetic lookup block an order */
    }
    /* Snapshot the discount attribution NOW — if a promotion later changes or
       expires, this order must keep showing what was actually charged. */
    if (product.regularPrice != null && product.price != null && product.regularPrice !== product.price) {
      item.basePrice = product.regularPrice;
    }
    if (product.promotion) {
      item.promotionId = product.promotion.id;
      item.promotionName = product.promotion.name;
      item.discountType = product.promotion.discountType;
      item.discountValue = product.promotion.discountValue;
      item.discountAmount = product.promotion.discountAmount;
    }
    items.push(item);
  }
  if (!items.length) return bad(res, 400, "empty_cart");

  const promotionSnapshots = items
    .filter((it) => it.promotionId != null)
    .map((it) => ({
      productId: it.id,
      qty: it.qty,
      promotionId: it.promotionId,
      promotionName: it.promotionName,
      discountType: it.discountType,
      discountValue: it.discountValue,
      discountAmount: it.discountAmount,
      baseUnitPrice: it.basePrice,
      finalUnitPrice: it.price,
    }));

  /* coupons + totals (prices only exist where the admin has set them).
     Several codes may be stacked; the welcome-offer rules are keyed on the
     customer's email so guests are covered as well as account holders. */
  const subtotal = round2(
    items.reduce((s, it) => s + (it.price != null ? it.price * it.qty : 0), 0)
  );
  const couponEmail = String(customer.email || "").trim().toLowerCase();
  const couponCodes = Array.isArray(b.coupons)
    ? b.coupons
    : b.coupon
      ? [b.coupon]
      : [];
  const {
    applied: appliedCoupons,
    discount,
    freeShipping: couponFreeShipping,
  } = await resolveCoupons(couponCodes, subtotal, couponEmail);
  if (b.payment === "cod") return bad(res, 400, "card_payment_only");
  const payment = "stripe";
  const courier = fees.normalizeCourier(customer.courier);
  if (!courier) return bad(res, 400, "invalid_courier");
  const { shipping: shippingFee, cod: codFee, feesTotal } = fees.orderExtraFees(payment, subtotal, {
    couponFreeShipping,
  });
  const total = round2(Math.max(0, subtotal - discount + feesTotal));
  const allPriced = items.every((it) => it.price != null);
  if (!allPriced) return bad(res, 503, "pricing_unavailable");
  const stripe = await getStripe();
  if (!stripe) return bad(res, 503, "card_provider_not_configured");

  /* atomic stock check & reserve */
  const outOfStock = await db.reserveStock(items);
  if (outOfStock) return bad(res, 409, "out_of_stock:" + outOfStock);

  const stripeFlow = !!(stripe && allPriced && total > 0);

  const session = auth.getUserSession(req);
  const order = {
    id: crypto.randomUUID(),
    number: await db.nextOrderNumber(),
    /* random capability token so guests can track their order via an emailed
       link, without login and without a guessable order id. */
    accessToken: crypto.randomBytes(24).toString("hex"),
    payment,
    /* COD is NEVER "paid" at creation — it is collected on delivery. */
    paymentStatus: stripeFlow ? "pending" : "offline",
    coupon: appliedCoupons.map((c) => c.code).join(", "),
    discount,
    shippingFee,
    codFee,
    /* Recorded so the receipt can say WHY shipping was free — a coupon perk
       reads very differently to the customer than hitting the order-value
       threshold, and a later recompute cannot tell the two apart. */
    couponFreeShipping,
    total,
    promotionSnapshots,
    lang: b.lang === "en" ? "en" : "el",
    userEmail: session ? session.sub : null,
    customer: {
      firstname: str(customer.firstname, 80),
      lastname: str(customer.lastname, 80),
      email,
      phone: str(customer.phone, 40),
      mobile: str(customer.mobile, 40),
      street: str(customer.street, 160),
      streetNumber: str(customer.streetNumber, 20),
      city: str(customer.city, 80),
      postal: str(customer.postal, 20),
      prefecture: str(customer.prefecture, 80),
      floor: str(customer.floor, 40),
      locationType: str(customer.locationType, 40),
      countryCode: str(customer.countryCode, 4) || "GR",
      country: str(customer.country, 80),
      notes: str(customer.notes, 1000),
      docType: customer.docType === "invoice" ? "invoice" : "receipt",
      company: str(customer.company, 160),
      afm: str(customer.afm, 20),
      doy: str(customer.doy, 80),
      activity: str(customer.activity, 160),
      courier,
    },
    gift:
      customer.gift && customer.gift.isGift
        ? {
            isGift: true,
            wrap: !!customer.gift.wrap,
            message: !!customer.gift.message,
            messageText: str(customer.gift.messageText, 500),
            box: !!customer.gift.box,
            boxType: str(customer.gift.boxType, 40),
            shipOther: !!customer.gift.shipOther,
            recipient: str(customer.gift.recipient, 160),
          }
        : { isGift: false },
    items,
  };

  await db.createOrder(order);
  /* Count the use and, for welcome-offer codes, burn the one-per-customer
     entitlement. The unique index on (code, email) makes this idempotent, so a
     retry or a double submit can never redeem the same code twice. */
  for (const c of appliedCoupons) {
    await db.incrementCouponUse(c.code);
    if (c.oncePerCustomer || c.firstOrderOnly) {
      try {
        await db.recordCouponRedemption({
          code: c.code,
          email: couponEmail,
          orderId: order.id,
          discount: couponDiscount(c, subtotal),
        });
      } catch (e) {
        console.error("[coupon] redemption not recorded:", c.code, e.message);
      }
    }
  }
  audit(req, "order.created", order.number, { total: order.total, payment: order.payment });
  clearReadCache();

  /* Stripe Checkout session */
  let checkoutUrl = null;
  if (stripeFlow) {
    try {
      const origin = siteOrigin(req);
      const feeLabels =
        order.lang === "en"
          ? { shipping: "Shipping" }
          : { shipping: "Μεταφορικά" };
      const lineItems = items.map((it) => ({
        quantity: it.qty,
        price_data: {
          currency: "eur",
          unit_amount: Math.round(it.price * 100),
          product_data: { name: it.title },
        },
      }));
      if (shippingFee > 0) {
        lineItems.push({
          quantity: 1,
          price_data: {
            currency: "eur",
            unit_amount: Math.round(shippingFee * 100),
            product_data: { name: feeLabels.shipping },
          },
        });
      }
      const params = {
        mode: "payment",
        line_items: lineItems,
        customer_email: email,
        metadata: { orderId: order.id, orderNumber: order.number },
        success_url:
          origin + "/checkout?stripe=success&session_id={CHECKOUT_SESSION_ID}",
        cancel_url: origin + "/checkout?stripe=cancel",
      };
      if (discount > 0) {
        const stripeCoupon = await stripe.coupons.create({
          amount_off: Math.round(discount * 100),
          currency: "eur",
          duration: "once",
          name: order.coupon || "Coupon",
        });
        params.discounts = [{ coupon: stripeCoupon.id }];
      }
      const checkout = await stripe.checkout.sessions.create(params);
      await db.updateOrder(order.id, { stripe_session_id: checkout.id });
      checkoutUrl = checkout.url;
    } catch (e) {
      console.error("[stripe] checkout session failed:", e.message);
      await db.updateOrder(order.id, { payment_status: "offline" });
    }
  }

  /* Send the confirmation now for every flow EXCEPT card payments that are
     still pending — those get their receipt once payment is confirmed. */
  if (!checkoutUrl) {
    mailer.sendOrderConfirmation(order);
    notify.notifyNewOrder(order);
  }

  res.json({
    ok: true,
    order: { id: order.id, number: order.number, total, discount },
    checkoutUrl,
  });
}));

/* Stripe success redirect lands here (via checkout.js) to confirm payment. */
app.get("/api/orders/confirm", ah(async (req, res) => {
  const sessionId = String(req.query.session_id || "");
  if (!sessionId) return bad(res, 400, "missing_session");
  const order = await db.getOrderByStripeSession(sessionId);
  if (!order) return bad(res, 404, "not_found");
  if (order.paymentStatus !== "paid") {
    const stripe = await getStripe();
    if (!stripe) return bad(res, 500, "stripe_not_configured");
    const session = await stripe.checkout.sessions.retrieve(sessionId);
    if (session.payment_status === "paid") {
      await db.updateOrder(order.id, { payment_status: "paid" });
      order.paymentStatus = "paid";
      /* payment just confirmed → send the receipt now */
      mailer.sendOrderConfirmation(order);
      notify.notifyNewOrder(order);
    }
  }
  res.json({
    ok: true,
    paid: order.paymentStatus === "paid",
    order: {
      id: order.id,
      number: order.number,
      payment: order.payment,
      items: order.items,
      total: order.total,
    },
  });
}));

/* Customer-initiated cancellation (from the order-success page or account).
   Card + paid → Stripe refund; card pending / COD → just cancel. Only allowed
   before the parcel has been handed to the courier. */
app.post("/api/orders/:id/cancel", ah(async (req, res) => {
  if (!security.isUuid(req.params.id)) return bad(res, 400, "invalid_id");
  const order = await db.getOrder(req.params.id);
  if (!order) return bad(res, 404, "not_found");

  /* Logged-in users must own the order; guests are authorized by possession of
     the unguessable order id (shown only to them on the success page). */
  const session = auth.getUserSession(req);
  if (session) {
    const owns =
      (order.userEmail && order.userEmail === session.sub) ||
      (order.customer && normEmail(order.customer.email) === normEmail(session.sub));
    if (!owns) return bad(res, 403, "forbidden");
  }

  if (order.status === "cancelled") return res.json({ ok: true, alreadyCancelled: true, refunded: order.paymentStatus === "refunded" });

  const shippedish = ["handed", "transit", "delivered"].includes(order.shippingStatus);
  const doneish = ["shipped", "delivered", "completed"].includes(order.status);
  if (shippedish || doneish) return bad(res, 409, "not_cancellable");

  const now = new Date().toISOString();
  let refunded = false;

  if (order.payment !== "cod" && order.paymentStatus === "paid" && order.stripeSessionId) {
    const stripe = await getStripe();
    if (stripe) {
      try {
        const s = await stripe.checkout.sessions.retrieve(order.stripeSessionId);
        if (s && s.payment_intent) {
          await stripe.refunds.create({ payment_intent: s.payment_intent });
          refunded = true;
        }
      } catch (e) {
        console.error("[stripe] refund failed:", e.message);
        return bad(res, 502, "refund_failed");
      }
    }
  }

  const fields = { status: "cancelled" };
  if (refunded) fields.payment_status = "refunded";
  await db.updateOrder(order.id, fields);
  await db.releaseStock(order.items);
  await db.appendOrderEvent(order.id, { at: now, actor: "customer", type: "status", from: order.status, to: "cancelled" });
  if (refunded) await db.appendOrderEvent(order.id, { at: now, actor: "customer", type: "payment", from: "paid", to: "refunded" });
  audit(req, "order.cancelled.customer", order.number, { refunded });
  clearReadCache();

  res.json({ ok: true, refunded });
}));

app.get("/api/orders/mine", ah(async (req, res) => {
  const session = auth.getUserSession(req);
  if (!session) return bad(res, 401, "unauthorized");
  const orders = await db.ordersByEmail(session.sub);
  res.json({ ok: true, orders });
}));

/* Public guest tracking by capability token (emailed link). No login, no
   guessable id. Returns a safe subset — the recipient's own order. */
app.get("/api/orders/track", ah(async (req, res) => {
  const token = String(req.query.token || "");
  if (token.length < 20) return bad(res, 400, "invalid_token");
  const o = await db.getOrderByAccessToken(token);
  if (!o) return bad(res, 404, "not_found");
  const c = o.customer || {};
  const courier = o.courier || c.courier || "";

  /* Best-effort: the shopper's own courier journey (origin → destination,
     each checkpoint) when this is a real ACS shipment. Never blocks the page
     if ACS is unreachable or not configured — the rest of the order info
     (from our own DB) always renders regardless. */
  let trackingDetails = null;
  if (courier === "acs" && o.tracking && acs.configured()) {
    try {
      const checkpoints = await acs.trackingDetails(o.tracking);
      trackingDetails = checkpoints.map((cp) => ({
        at: cp.checkpoint_date_time,
        action: cp.checkpoint_action,
        location: cp.checkpoint_location,
      }));
    } catch (e) {
      trackingDetails = null;
    }
  }

  res.json({
    ok: true,
    order: {
      number: o.number,
      createdAt: o.createdAt,
      status: o.status,
      paymentStatus: o.paymentStatus,
      shippingStatus: o.shippingStatus,
      payment: o.payment,
      tracking: o.tracking || "",
      courier: courier,
      trackingDetails,
      items: (o.items || []).map((it) => ({ title: it.title, qty: it.qty, image: it.image, price: it.price })),
      total: o.total,
      discount: o.discount,
      coupon: o.coupon,
      customer: { firstname: c.firstname || "", lastname: c.lastname || "", city: c.city || "", postal: c.postal || "" },
    },
  });
}));

/* ================= ADMIN API ================= */

app.post("/api/admin/login", ah(async (req, res) => {
  const username = str(req.body && req.body.username, 80);
  const password = String((req.body && req.body.password) || "");
  const code = String((req.body && req.body.code) || "");
  const rememberDevice = !!(req.body && req.body.rememberDevice);
  const mfaRequired = security.admin2faRequired();
  if (auth.rateLimited("admin:" + (req.ip || ""))) {
    audit(req, "admin.login.blocked", username);
    try { await recordAdminLoginEvent({ pool: db.getPool(), username, outcome: "blocked",
      ipAddress: clientIp(req), userAgent: req.get("user-agent") || null,
      requestId: req.requestId }); } catch (_) {}
    return bad(res, 429, "too_many_attempts");
  }
  if (!(await security.verifyTurnstile(req.body && req.body.captchaToken, req.ip))) {
    return bad(res, 400, "captcha_failed");
  }
  const admin = await db.getSetting("admin");
  if (
    !admin ||
    username !== admin.username ||
    !await auth.verifyPassword(password, admin.passHash)
  ) {
    audit(req, "admin.login.failed", username);
    try { await recordAdminLoginEvent({ pool: db.getPool(), username,
      outcome: "invalid_credentials", ipAddress: clientIp(req),
      userAgent: req.get("user-agent") || null, requestId: req.requestId }); } catch (_) {}
    return bad(res, 401, "invalid_credentials");
  }
  /* Second factor: when TOTP is enabled the code is mandatory — UNLESS this
     device is already trusted ("remember this device"), in which case the
     password alone completes the login. */
  if (mfaRequired && admin.totpEnabled && admin.totpSecret) {
    const trusted = auth.hasAdminTrust(req, username);
    if (!trusted) {
      if (!code) {
        try { await recordAdminLoginEvent({ pool: db.getPool(), username,
          outcome: "mfa_required", ipAddress: clientIp(req),
          userAgent: req.get("user-agent") || null, requestId: req.requestId }); } catch (_) {}
        return bad(res, 401, "mfa_required");
      }
      if (!auth.verifyTotp(admin.totpSecret, code)) {
        audit(req, "admin.login.mfa_failed", username);
        try { await recordAdminLoginEvent({ pool: db.getPool(), username,
          outcome: "invalid_mfa", ipAddress: clientIp(req),
          userAgent: req.get("user-agent") || null, requestId: req.requestId }); } catch (_) {}
        return bad(res, 401, "invalid_mfa");
      }
      /* Fresh 2FA pass — honour the "trust this device" choice. */
      if (rememberDevice) auth.startAdminTrust(res, username);
    }
  }
  auth.clearRateLimit("admin:" + (req.ip || ""));
  /* Upgrade a legacy scrypt admin hash to Argon2id. */
  if (auth.needsRehash(admin.passHash)) {
    try {
      admin.passHash = await auth.hashPassword(password);
      await db.setSetting("admin", admin);
    } catch (e) {
      console.error("[rehash] admin", e.message);
    }
  }
  const mfaVerified = mfaRequired && !!admin.totpEnabled && !!admin.totpSecret;
  const session = auth.startAdminSession(res, username, {
    mfaVerified,
  });
  try {
    await createAdminDatabaseSession({
      pool: db.getPool(),
      username,
      mfaVerified,
      sessionId: session.sessionId,
      sessionFamilyId: session.sessionFamilyId,
      csrfHash: session.csrfHash,
      expiresAt: session.expiresAt,
      ipAddress: clientIp(req),
      userAgent: req.get("user-agent") || null,
      requestId: req.requestId || null,
    });
  } catch (error) {
    // Legacy admin remains available until V2 migrations are deployed.
    console.warn("[admin-session] V2 session not persisted:", error.message);
  }
  audit(req, "admin.login.success", username, {
    mfa: mfaVerified,
    trustedDevice: admin.totpEnabled ? auth.hasAdminTrust(req, username) || rememberDevice : false,
  });
  res.json({ ok: true, username, csrfToken: session.csrfToken, mfaRequired });
}));

app.post("/api/admin/logout", requireAdmin, ah(async (req, res) => {
  if (req.admin?.sid) {
    try {
      await revokeAdminSession({ pool: db.getPool(), sessionId: req.admin.sid });
    } catch (error) {
      console.warn("[admin-session] logout revocation failed:", error.message);
    }
  }
  auth.endAdminSession(res);
  audit(req, "admin.logout", req.admin && req.admin.sub);
  res.json({ ok: true });
}));

app.get("/api/admin/me", ah(async (req, res) => {
  const session = auth.getAdminSession(req);
  res.set("Cache-Control", "no-store");
  if (!session) return res.json({ ok: true, admin: null });

  const admin = await db.getSetting("admin");
  const mfaRequired = security.admin2faRequired();
  const mfaEnabled = !!(admin && admin.totpEnabled && admin.totpSecret);
  const mfaVerified = !!session.mfa;
  res.json({
    ok: true,
    admin: {
      username: session.sub,
      mfaRequired,
      mfaEnabled,
      mfaVerified,
      accessGranted: !mfaRequired || mfaVerified,
      requiresMfaSetup: mfaRequired && !mfaEnabled,
      requiresMfaVerification: mfaRequired && mfaEnabled && !mfaVerified,
    },
  });
}));

app.post("/api/admin/password", requireAdmin, ah(async (req, res) => {
  const current = String((req.body && req.body.current) || "");
  const next = String((req.body && req.body.next) || "");
  const admin = await db.getSetting("admin");
  if (!admin || !await auth.verifyPassword(current, admin.passHash)) {
    return bad(res, 401, "invalid_credentials");
  }
  const pwErr = security.passwordStrengthError(next);
  if (pwErr) return bad(res, 400, pwErr);
  admin.passHash = await auth.hashPassword(next);
  await db.setSetting("admin", admin);
  try {
    fs.unlinkSync(path.join(db.DATA_DIR, "admin-credentials.txt"));
  } catch (e) {}
  audit(req, "admin.password.change", req.admin && req.admin.sub);
  res.json({ ok: true });
}));

/* ---------- admin MFA (TOTP) ---------- */

app.get("/api/admin/mfa/status", requireAdmin, ah(async (req, res) => {
  const admin = await db.getSetting("admin");
  res.json({ ok: true, required: security.admin2faRequired(),
    enabled: !!(admin && admin.totpEnabled) });
}));

/* Step 1: generate a fresh secret (kept "pending" until verified) and hand
   back the otpauth URI + base32 secret for the authenticator app. */
app.post("/api/admin/mfa/setup", requireAdmin, ah(async (req, res) => {
  const admin = await db.getSetting("admin");
  if (!admin) return bad(res, 400, "no_admin");
  if (admin.totpEnabled) return bad(res, 409, "already_enabled");
  const secret = auth.generateTotpSecret();
  admin.totpPending = secret;
  await db.setSetting("admin", admin);
  res.json({
    ok: true,
    secret,
    otpauth: auth.otpauthURL(secret, admin.username, "Nostalgia Admin"),
  });
}));

/* Step 2: confirm the app is set up by verifying one live code, then enable. */
app.post("/api/admin/mfa/enable", requireAdmin, ah(async (req, res) => {
  const code = String((req.body && req.body.code) || "");
  const admin = await db.getSetting("admin");
  if (!admin || !admin.totpPending) return bad(res, 400, "no_pending_setup");
  if (!auth.verifyTotp(admin.totpPending, code)) {
    return bad(res, 400, "invalid_mfa");
  }
  admin.totpSecret = admin.totpPending;
  admin.totpEnabled = true;
  delete admin.totpPending;
  await db.setSetting("admin", admin);
  if (req.admin?.sid) {
    try { await revokeAdminSession({ pool: db.getPool(), sessionId: req.admin.sid,
      reason: "mfa_enrolled" }); } catch (error) {
      console.warn("[admin-session] pre-MFA session revocation failed:", error.message);
    }
  }
  const session = auth.startAdminSession(res, admin.username, { mfaVerified: true });
  try {
    await createAdminDatabaseSession({ pool: db.getPool(), username: admin.username,
      mfaVerified: true, sessionId: session.sessionId,
      sessionFamilyId: session.sessionFamilyId, csrfHash: session.csrfHash,
      expiresAt: session.expiresAt, ipAddress: clientIp(req),
      userAgent: req.get("user-agent") || null, requestId: req.requestId || null });
  } catch (error) {
    console.warn("[admin-session] MFA session not persisted:", error.message);
  }
  audit(req, "admin.mfa.enabled", req.admin && req.admin.sub);
  res.json({ ok: true, csrfToken: session.csrfToken });
}));

/* Disable MFA — requires BOTH the current password and a live code. */
app.post("/api/admin/mfa/disable", requireAdmin, ah(async (req, res) => {
  if (process.env.ALLOW_ADMIN_2FA_DISABLE !== "true") {
    return bad(res, 403, "admin_2fa_required");
  }
  const password = String((req.body && req.body.password) || "");
  const code = String((req.body && req.body.code) || "");
  const admin = await db.getSetting("admin");
  if (!admin || !admin.totpEnabled) return bad(res, 400, "not_enabled");
  if (!await auth.verifyPassword(password, admin.passHash)) {
    return bad(res, 401, "invalid_credentials");
  }
  if (!auth.verifyTotp(admin.totpSecret, code)) {
    return bad(res, 400, "invalid_mfa");
  }
  delete admin.totpSecret;
  delete admin.totpPending;
  admin.totpEnabled = false;
  await db.setSetting("admin", admin);
  auth.clearAdminTrust(res);
  audit(req, "admin.mfa.disabled", req.admin && req.admin.sub);
  res.json({ ok: true });
}));

/* Read-only security audit trail for the admin panel. */
app.get("/api/admin/audit", requireAdmin, ah(async (req, res) => {
  const out = await db.listAuditLog({
    page: req.query.page,
    limit: req.query.limit,
    type: req.query.type,
  });
  res.json({ ok: true, ...out });
}));

/* ---------- settings (Stripe) ---------- */

app.get("/api/admin/settings", requireAdmin, ah(async (req, res) => {
  const stripe = (await db.getSetting("stripe")) || {};
  const key = process.env.STRIPE_SECRET_KEY || stripe.secretKey || "";
  res.json({
    ok: true,
    stripe: {
      configured: !!key,
      keyHint: key ? "••••" + key.slice(-4) : null,
      fromEnv: !!process.env.STRIPE_SECRET_KEY,
      publishableFromEnv: !!process.env.STRIPE_PUBLISHABLE_KEY,
      webhookFromEnv: !!process.env.STRIPE_WEBHOOK_SECRET,
    },
    analytics: { configured: !!gaMeasurementId(), id: gaMeasurementId() || null, fromEnv: !!(process.env.GA_MEASUREMENT_ID || process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID) },
    email: {
      resend: mailer.resendConfigured(),
      smtp: mailer.smtpConfigured(),
    },
    cron: { configured: !!(process.env.CRON_TOKEN || "").trim() },
    acs: { configured: acs.configured() },
  });
}));

app.post("/api/admin/settings/stripe", requireAdmin, ah(async (req, res) => {
  const key = String((req.body && req.body.secretKey) || "").trim();
  if (key && !/^(sk|rk)_(test|live)_/.test(key)) {
    return bad(res, 400, "invalid_key");
  }
  await db.setSetting("stripe", { secretKey: key });
  stripeKeyCached = undefined; // force re-init on next use
  res.json({ ok: true, configured: !!key });
}));

/* ---------- overview / orders ---------- */

app.get("/api/admin/overview", requireAdmin, ah(async (req, res) => {
  const counts = await db.overviewCounts();
  const recentOrders = await db.listRecentOrders(8);
  res.json({ ok: true, counts, recentOrders });
}));

app.get("/api/admin/orders", requireAdmin, ah(async (req, res) => {
  const pg = pageQuery(req);
  const status = String(req.query.status || "");
  const tab = String(req.query.tab || "");
  if (status && !ORDER_STATUSES.includes(status)) return bad(res, 400, "invalid_status");
  if (tab && !ORDER_TABS.includes(tab)) return bad(res, 400, "invalid_tab");
  const fromD = req.query.from ? new Date(String(req.query.from)) : null;
  let toD = req.query.to ? new Date(String(req.query.to)) : null;
  if (toD && !isNaN(toD.getTime())) toD = new Date(toD.getTime() + 24 * 60 * 60 * 1000); // inclusive day
  const opts = Object.assign({}, pg, {
    tab: tab || undefined,
    status: status || undefined,
    q: String(req.query.q || "").slice(0, 120),
    payment: String(req.query.payment || ""),
    shipping: String(req.query.shipping || ""),
    courier: String(req.query.courier || ""),
    sort: String(req.query.sort || ""),
    from: fromD && !isNaN(fromD.getTime()) ? fromD : undefined,
    to: toD && !isNaN(toD.getTime()) ? toD : undefined,
  });
  const [data, counts] = await Promise.all([db.listOrdersPage(opts), db.orderTabCounts()]);
  res.json({ ok: true, orders: data.orders, pagination: data.pagination, counts });
}));

app.patch("/api/admin/orders/:id", requireAdmin, ah(async (req, res) => {
  if (!security.isUuid(req.params.id)) return bad(res, 400, "invalid_id");
  const current = await db.getOrder(req.params.id);
  if (!current) return bad(res, 404, "not_found");
  const body = req.body || {};
  const actor = (req.admin && (req.admin.sub || req.admin.username)) || "admin";
  const now = new Date().toISOString();
  const fields = {};
  const events = [];

  if (body.status !== undefined) {
    const status = String(body.status);
    if (!ORDER_STATUSES.includes(status)) return bad(res, 400, "invalid_status");
    if (status !== current.status) {
      fields.status = status;
      events.push({ at: now, actor: actor, type: "status", from: current.status, to: status });
    }
  }
  if (body.paymentStatus !== undefined) {
    const ps = String(body.paymentStatus);
    if (!PAYMENT_STATUSES.includes(ps)) return bad(res, 400, "invalid_payment_status");
    if (ps !== current.paymentStatus) {
      fields.payment_status = ps;
      events.push({ at: now, actor: actor, type: "payment", from: current.paymentStatus, to: ps });
    }
  }
  if (body.shippingStatus !== undefined) {
    const ss = String(body.shippingStatus);
    if (!SHIPPING_STATUSES.includes(ss)) return bad(res, 400, "invalid_shipping_status");
    if (ss !== current.shippingStatus) {
      fields.shipping_status = ss;
      events.push({ at: now, actor: actor, type: "shipping", from: current.shippingStatus, to: ss });
    }
  }
  if (body.tracking !== undefined) {
    const v = String(body.tracking).trim().slice(0, 120);
    if (v !== current.tracking) { fields.tracking = v; events.push({ at: now, actor: actor, type: "tracking", to: v }); }
  }
  if (body.courier !== undefined) {
    const v = String(body.courier).trim().slice(0, 40);
    if (v !== current.courier) { fields.courier = v; events.push({ at: now, actor: actor, type: "courier", to: v }); }
  }
  if (body.assignee !== undefined) {
    const v = String(body.assignee).trim().slice(0, 80);
    if (v !== current.assignee) { fields.assignee = v; events.push({ at: now, actor: actor, type: "assignee", to: v }); }
  }
  if (body.notes !== undefined) {
    const v = String(body.notes).slice(0, 4000);
    if (v !== current.notes) { fields.notes = v; events.push({ at: now, actor: actor, type: "notes" }); }
  }

  if (Object.keys(fields).length) await db.updateOrder(req.params.id, fields);
  for (const ev of events) await db.appendOrderEvent(req.params.id, ev);
  audit(req, "admin.order.update", req.params.id);
  const updated = await db.getOrder(req.params.id);
  for (const ev of events) {
    if (ev.type === "status") notifyOrderStatusChange(updated, ev.from, ev.to);
    else if (ev.type === "shipping") notifyOrderShippingChange(updated, ev.from, ev.to);
    else if (ev.type === "payment") notifyOrderPaymentChange(updated, ev.from, ev.to);
  }
  res.json({ ok: true, order: updated });
}));

/* ---------- ACS Courier integration ---------- */

/* Today's date in the SERVER's local timezone as YYYY-MM-DD.
   Not toISOString() — that is UTC, so between midnight and 02:00/03:00 Greek
   time it returns *yesterday*, and ACS rejects the voucher outright with
   "Μη αποδεκτή ημερομηνία παραλαβής" (pickup dates cannot be in the past). */
function localToday() {
  const now = new Date();
  return new Date(now.getTime() - now.getTimezoneOffset() * 60000)
    .toISOString()
    .slice(0, 10);
}

/* ACS bills the HIGHER of declared and re-weighed mass, and refuses anything
   under 0.5kg, so this is both the floor and the fallback when no product has
   a weight recorded yet. */
const ACS_MIN_WEIGHT_KG = 0.5;

/**
 * Total shipping weight of an order, from the per-product `weightKg` stored in
 * product_details. Variant ids ("pv-…") inherit their parent product's weight
 * unless the variant itself has one.
 *
 * Returns null when NO item has a recorded weight — the caller then keeps the
 * old default rather than inventing a number. A partially-known order still
 * returns a sum, since an undercount is closer than 0.5kg flat.
 */
async function orderWeightKg(order) {
  const items = Array.isArray(order && order.items) ? order.items : [];
  if (!items.length) return null;
  let details;
  try {
    details = await db.getAllProductDetails({ read: true });
  } catch (e) {
    console.error("[acs] weight lookup failed:", e.message);
    return null;
  }
  let total = 0;
  let known = false;
  for (const it of items) {
    const qty = Math.max(0, parseInt(it && it.qty, 10) || 0);
    if (!qty || !it.id) continue;
    const own = details[it.id] && details[it.id].weightKg;
    const parent = it.variantOf && details[it.variantOf] && details[it.variantOf].weightKg;
    const w = parseFloat(own || parent || 0);
    if (Number.isFinite(w) && w > 0) {
      total += w * qty;
      known = true;
    }
  }
  if (!known) return null;
  return Math.max(ACS_MIN_WEIGHT_KG, Math.round(total * 1000) / 1000);
}

/* ACS_Get_Content_Types → 4 = ΕΙΔΗ ΔΙΑΚΟΣΜΗΣΗΣ. Mandatory for Cyprus customs. */
const ACS_CONTENT_TYPE_DECOR = 4;

/* ACS_Create_Voucher only covers Greece and Cyprus — every other destination is
   rejected with "Μη αποδεκτός ταχ.κωδικός ή χώρα προορισμού" (verified live). */
const ACS_COUNTRIES = new Set(["GR", "CY"]);

/* Greek phone numbers as ACS expects them: plain digits, no +30/leading 0. */
function acsPhoneNumber(raw) {
  if (!raw) return null;
  let digits = String(raw).replace(/\D/g, "");
  if (digits.length === 12 && digits.startsWith("30")) digits = digits.slice(2);
  if (digits.length === 11 && digits.startsWith("0")) digits = digits.slice(1);
  return digits ? parseInt(digits, 10) : null;
}

/* Builds ACS_Create_Voucher params from an order — see server/acs.js and the
   "ACS Rest API Web Services" PDF for the field meanings. `weight` (kg) and
   `notes` are supplied by the admin at creation time since neither is tracked
   per-product today. */
function acsVoucherParamsForOrder(order, { pickupDate, weight, notes, saturday }) {
  const c = order.customer || {};
  const isCod = order.payment === "cod";
  const products = [];
  if (isCod) products.push("COD");
  if (saturday) products.push("SAT");
  const zip = parseInt(String(c.postal || "").replace(/\D/g, ""), 10);
  const country = (c.countryCode || "GR").toUpperCase();

  return {
    Pickup_Date: pickupDate,
    Sender: "Nostalgia Collection",
    Recipient_Name: [c.firstname, c.lastname].filter(Boolean).join(" ") || order.number,
    Recipient_Address: c.street || "",
    Recipient_Address_Number: c.streetNumber || null,
    Recipient_Zipcode: Number.isFinite(zip) ? zip : null,
    Recipient_Region: c.city || "",
    Recipient_Phone: acsPhoneNumber(c.phone),
    Recipient_Cell_Phone: acsPhoneNumber(c.mobile),
    Recipient_Floor: c.floor || null,
    Recipient_Company_Name: c.company || null,
    Recipient_Country: c.countryCode || "GR",
    Acs_Station_Destination: null,
    Acs_Station_Branch_Destination: 1,
    Billing_Code: acs.billingCode(),
    Charge_Type: 2, // sender (the shop) pays the courier
    Cost_Center_Code: null,
    Item_Quantity: 1,
    Weight: weight > 0 ? weight : 0.5,
    Cod_Ammount: isCod ? order.total : null,
    Cod_Payment_Way: isCod ? 0 : null, // cash
    Acs_Delivery_Products: products.length ? products.join(",") : null,
    Insurance_Ammount: null,
    Delivery_Notes: notes ? str(notes, 500) : null,
    Recipient_Email: c.email || null,
    Reference_Key1: order.number,
    Reference_Key2: null,
    With_Return_Voucher: null,
    /* Cyprus customs require a declared content type. The API accepts null
       (tested 30/7/2026 — the voucher is still created), but ACS warn that an
       undeclared parcel risks delays and fines from Larnaca customs, so we
       always declare. 4 = ΕΙΔΗ ΔΙΑΚΟΣΜΗΣΗΣ, the right bucket for candles
       (full list via ACS_Get_Content_Types). Greece ignores the field. */
    Content_Type_ID: country === "CY" ? ACS_CONTENT_TYPE_DECOR : null,
    Language: null,
  };
}

app.get("/api/admin/acs/status", requireAdmin, ah(async (req, res) => {
  res.json({ ok: true, configured: acs.configured() });
}));

/* Suggested parcel weight for one order, so the admin can prefill the field
   instead of the operator guessing. `estimated` is false when no product in
   the order has a weight recorded yet. */
app.get("/api/admin/orders/:id/acs/weight", requireAdmin, ah(async (req, res) => {
  if (!security.isUuid(req.params.id)) return bad(res, 400, "invalid_id");
  const order = await db.getOrder(req.params.id);
  if (!order) return bad(res, 404, "not_found");
  const weight = await orderWeightKg(order);
  res.json({
    ok: true,
    weightKg: weight || ACS_MIN_WEIGHT_KG,
    estimated: weight != null,
  });
}));

/* Creates a real ACS shipment for this order and stores the voucher number as
   the order's tracking code. Does NOT finalize it — see /acs/pickup-list. */
app.post("/api/admin/orders/:id/acs/create-voucher", requireAdmin, ah(async (req, res) => {
  if (!security.isUuid(req.params.id)) return bad(res, 400, "invalid_id");
  if (!acs.configured()) return bad(res, 409, "acs_not_configured");
  const order = await db.getOrder(req.params.id);
  if (!order) return bad(res, 404, "not_found");
  if (order.tracking) return bad(res, 409, "voucher_already_exists");

  /* Fail early with a readable reason. The storefront offers 47 European
     countries but ACS only ships GR/CY, so without this the operator would get
     the opaque "Μη αποδεκτός ταχ.κωδικός ή χώρα προορισμού" from ACS. */
  const destination = ((order.customer && order.customer.countryCode) || "GR").toUpperCase();
  if (!ACS_COUNTRIES.has(destination)) {
    return res.status(409).json({
      ok: false,
      error: "acs_country_unsupported",
      detail: "Η ACS στέλνει μόνο σε Ελλάδα και Κύπρο. Προορισμός παραγγελίας: " +
        destination + ". Χρειάζεται άλλος courier για αυτή την αποστολή.",
    });
  }

  const b = req.body || {};
  const pickupDate = str(b.pickupDate, 10) || localToday();
  /* An explicit weight from the operator always wins; otherwise fall back to
     the catalogue weights rather than the old flat 0.5kg, which would under-
     declare a box of candles and produce a surprise ACS invoice. */
  const weight = parsePrice(b.weight) || (await orderWeightKg(order)) || ACS_MIN_WEIGHT_KG;
  const actor = (req.admin && (req.admin.sub || req.admin.username)) || "admin";

  let result;
  try {
    result = await acs.createVoucher(
      acsVoucherParamsForOrder(order, { pickupDate, weight, notes: b.notes, saturday: !!b.saturday })
    );
  } catch (e) {
    if (e instanceof acs.AcsError) return badAcs(res, e);
    throw e;
  }
  if (result.Error_Message) return bad(res, 400, "acs_error:" + result.Error_Message);

  const voucherNo = String(result.Voucher_No || "").trim();
  if (!voucherNo) return bad(res, 502, "acs_no_voucher_returned");

  const now = new Date().toISOString();
  await db.updateOrder(order.id, { tracking: voucherNo, courier: "acs" });
  await db.appendOrderEvent(order.id, { at: now, actor, type: "tracking", to: voucherNo });
  await db.appendOrderEvent(order.id, { at: now, actor, type: "courier", to: "acs" });
  audit(req, "admin.acs.voucher_created", order.id, { voucherNo });
  clearReadCache();
  res.json({ ok: true, voucherNo, order: await db.getOrder(order.id) });
}));

app.get("/api/admin/orders/:id/acs/print-voucher", requireAdmin, ah(async (req, res) => {
  if (!security.isUuid(req.params.id)) return bad(res, 400, "invalid_id");
  if (!acs.configured()) return bad(res, 409, "acs_not_configured");
  const order = await db.getOrder(req.params.id);
  if (!order) return bad(res, 404, "not_found");
  if (!order.tracking || order.courier !== "acs") return bad(res, 409, "no_acs_voucher");

  /* printType 2=laser A4, 1=thermal roll. startPosition picks which of the 3
     label slots on an A4 sheet to use, so a partly-used sheet isn't wasted. */
  const printType = Number(req.query.printType) === 1 ? 1 : 2;
  const startPosition = [1, 2, 3].includes(Number(req.query.startPosition))
    ? Number(req.query.startPosition) : 1;
  let pdf;
  try {
    pdf = await acs.printVoucher({ voucherNo: order.tracking, printType, startPosition, language: "GR" });
  } catch (e) {
    if (e instanceof acs.AcsError) return badAcs(res, e);
    throw e;
  }
  res.json({ ok: true, pdf });
}));

/* Prints up to MAX_PRINT_BATCH labels in ONE ACS call and returns them merged
   into a single PDF, so a day's shipping is one print job rather than one
   browser tab per parcel. */
app.post("/api/admin/acs/print-vouchers", requireAdmin, ah(async (req, res) => {
  if (!acs.configured()) return bad(res, 409, "acs_not_configured");
  const ids = Array.isArray(req.body && req.body.orderIds) ? req.body.orderIds : [];
  if (!ids.length) return bad(res, 400, "no_orders");
  if (ids.length > acs.MAX_PRINT_BATCH) return bad(res, 400, "too_many_orders");

  const printType = Number(req.body.printType) === 1 ? 1 : 2;
  const startPosition = [1, 2, 3].includes(Number(req.body.startPosition))
    ? Number(req.body.startPosition) : 1;

  const vouchers = [];
  for (const id of ids) {
    if (!security.isUuid(String(id))) return bad(res, 400, "invalid_id");
    const order = await db.getOrder(String(id));
    if (!order) return bad(res, 404, "not_found");
    if (!order.tracking || order.courier !== "acs") return bad(res, 409, "no_acs_voucher");
    vouchers.push(order.tracking);
  }

  let printed;
  try {
    printed = await acs.printVouchers({ voucherNos: vouchers, printType, startPosition, language: "GR" });
  } catch (e) {
    if (e instanceof acs.AcsError) return badAcs(res, e);
    throw e;
  }
  const pdf = await mergeBase64Pdfs(printed.map((p) => p.pdf));
  audit(req, "admin.acs.vouchers_printed", null, { count: printed.length });
  res.json({ ok: true, pdf, count: printed.length, vouchers: printed.map((p) => p.voucherNo) });
}));

app.delete("/api/admin/orders/:id/acs/voucher", requireAdmin, ah(async (req, res) => {
  if (!security.isUuid(req.params.id)) return bad(res, 400, "invalid_id");
  if (!acs.configured()) return bad(res, 409, "acs_not_configured");
  const order = await db.getOrder(req.params.id);
  if (!order) return bad(res, 404, "not_found");
  if (!order.tracking || order.courier !== "acs") return bad(res, 409, "no_acs_voucher");

  try {
    await acs.deleteVoucher(order.tracking);
  } catch (e) {
    if (e instanceof acs.AcsError) return badAcs(res, e);
    throw e;
  }
  const actor = (req.admin && (req.admin.sub || req.admin.username)) || "admin";
  await db.updateOrder(order.id, { tracking: "", courier: "" });
  await db.appendOrderEvent(order.id, { at: new Date().toISOString(), actor, type: "tracking", to: "" });
  audit(req, "admin.acs.voucher_deleted", order.id);
  clearReadCache();
  res.json({ ok: true, order: await db.getOrder(order.id) });
}));

/* Cancels up to MAX_DELETE_BATCH shipments in one ACS call. Only works while
   the vouchers are not yet in a pickup list — afterwards only an ACS branch
   can remove them, so ACS rejects the whole batch. */
app.post("/api/admin/acs/delete-vouchers", requireAdmin, ah(async (req, res) => {
  if (!acs.configured()) return bad(res, 409, "acs_not_configured");
  const ids = Array.isArray(req.body && req.body.orderIds) ? req.body.orderIds : [];
  if (!ids.length) return bad(res, 400, "no_orders");
  if (ids.length > acs.MAX_DELETE_BATCH) return bad(res, 400, "too_many_orders");

  const orders = [];
  for (const id of ids) {
    if (!security.isUuid(String(id))) return bad(res, 400, "invalid_id");
    const order = await db.getOrder(String(id));
    if (!order) return bad(res, 404, "not_found");
    if (!order.tracking || order.courier !== "acs") return bad(res, 409, "no_acs_voucher");
    orders.push(order);
  }

  try {
    await acs.deleteVouchers(orders.map((o) => o.tracking));
  } catch (e) {
    if (e instanceof acs.AcsError) return badAcs(res, e);
    throw e;
  }

  /* ACS deletes all-or-nothing, so only clear our side once it confirmed. */
  const actor = (req.admin && (req.admin.sub || req.admin.username)) || "admin";
  const at = new Date().toISOString();
  for (const order of orders) {
    await db.updateOrder(order.id, { tracking: "", courier: "" });
    await db.appendOrderEvent(order.id, { at, actor, type: "tracking", to: "" });
  }
  audit(req, "admin.acs.vouchers_deleted", null, { count: orders.length });
  clearReadCache();
  res.json({ ok: true, count: orders.length });
}));

/* Pulls the current ACS tracking status and maps it onto our own
   shipping_status — a manual "refresh" button; a cron job can call the same
   logic periodically once this is proven out. */
app.post("/api/admin/orders/:id/acs/refresh-tracking", requireAdmin, ah(async (req, res) => {
  if (!security.isUuid(req.params.id)) return bad(res, 400, "invalid_id");
  if (!acs.configured()) return bad(res, 409, "acs_not_configured");
  const order = await db.getOrder(req.params.id);
  if (!order) return bad(res, 404, "not_found");
  if (!order.tracking || order.courier !== "acs") return bad(res, 409, "no_acs_voucher");

  let summary;
  try {
    summary = await acs.trackingSummary(order.tracking);
  } catch (e) {
    if (e instanceof acs.AcsError) return badAcs(res, e);
    throw e;
  }
  const mapped = acs.mapShipmentStatus(summary);
  if (mapped && mapped !== order.shippingStatus) {
    const actor = "acs-sync";
    await db.updateOrder(order.id, { shipping_status: mapped });
    await db.appendOrderEvent(order.id, { at: new Date().toISOString(), actor, type: "shipping", from: order.shippingStatus, to: mapped });
    clearReadCache();
    notifyOrderShippingChange(
      Object.assign({}, order, { shippingStatus: mapped }),
      order.shippingStatus,
      mapped,
      { eta: summary && summary.delivery_date_expected }
    );
  }
  res.json({ ok: true, summary, shippingStatus: mapped || order.shippingStatus, order: await db.getOrder(order.id) });
}));

/* End-of-day finalization: MUST be called or the vouchers printed today stay
   unrecognized by ACS (their barcodes won't scan) — see server/acs.js. */
app.post("/api/admin/acs/pickup-list", requireAdmin, ah(async (req, res) => {
  if (!acs.configured()) return bad(res, 409, "acs_not_configured");
  const pickupDate = str((req.body && req.body.pickupDate) || "", 10) || localToday();
  let result;
  try {
    result = await acs.issuePickupList(pickupDate, null);
  } catch (e) {
    if (e instanceof acs.AcsError) return badAcs(res, e);
    throw e;
  }
  audit(req, "admin.acs.pickup_list_issued", pickupDate, { pickupListNo: result.PickupList_No });
  res.json({ ok: true, ...result });
}));

/* Lists the pickup lists already issued for a date, so the admin can reprint
   one after a page reload — the number is otherwise only held in React state
   and would be lost, leaving no way back to the PDF. */
app.get("/api/admin/acs/pickup-lists", requireAdmin, ah(async (req, res) => {
  if (!acs.configured()) return bad(res, 409, "acs_not_configured");
  const pickupDate = str(req.query.pickupDate || "", 10) || localToday();
  let lists;
  try {
    lists = await acs.getPickupLists(pickupDate);
  } catch (e) {
    if (e instanceof acs.AcsError) return badAcs(res, e);
    throw e;
  }
  res.json({ ok: true, pickupDate, lists });
}));

app.get("/api/admin/acs/pickup-list/:massNumber/print", requireAdmin, ah(async (req, res) => {
  if (!acs.configured()) return bad(res, 409, "acs_not_configured");
  const pickupDate = str(req.query.pickupDate || "", 10) || localToday();
  let pdf;
  try {
    pdf = await acs.printPickupList(req.params.massNumber, pickupDate);
  } catch (e) {
    if (e instanceof acs.AcsError) return badAcs(res, e);
    throw e;
  }
  res.json({ ok: true, pdf });
}));

/* ---------- users / newsletter / messages ---------- */

/* The list carries the real email (same trust boundary as every other admin
   list — Orders/Newsletter/Reviews already show customer emails plainly);
   the admin UI masks it on screen by default and reveals on click, purely to
   cut down on shoulder-surfing/screenshots, not as an access-control layer. */
function adminUserListRow(u) {
  return {
    email: u.email,
    firstname: u.firstname,
    lastname: u.lastname,
    newsletterOptin: !!u.newsletterOptin,
    active: u.active !== false,
    orderCount: u.orderCount || 0,
    lastOrderAt: u.lastOrderAt || null,
    createdAt: u.createdAt,
  };
}

app.get("/api/admin/users", requireAdmin, ah(async (req, res) => {
  const data = await db.listUsersPage(pageQuery(req));
  res.json({
    ok: true,
    users: data.users.map(adminUserListRow),
    pagination: data.pagination,
  });
}));

app.patch("/api/admin/users/:email", requireAdmin, ah(async (req, res) => {
  const email = normEmail(req.params.email);
  if (typeof (req.body && req.body.active) !== "boolean") return bad(res, 400, "invalid_body");
  const updated = await db.setUserActive(email, req.body.active);
  if (!updated) return bad(res, 404, "not_found");
  audit(req, req.body.active ? "admin.customer.enabled" : "admin.customer.disabled", req.admin && req.admin.sub, { email });
  res.json({ ok: true });
}));

app.get("/api/admin/newsletter", requireAdmin, ah(async (req, res) => {
  const data = await db.listSubscribersPage(pageQuery(req));
  res.json({ ok: true, subscribers: data.subscribers, pagination: data.pagination });
}));

/* Unsubscribes (soft) rather than deletes — the opt-in/opt-out trail has to
   survive so the same address can't silently re-appear without fresh
   consent. Hard deletion only ever happens via GDPR account erasure. */
app.patch("/api/admin/newsletter/:email", requireAdmin, ah(async (req, res) => {
  const email = normEmail(req.params.email);
  if (!req.body || req.body.status !== "unsubscribed") return bad(res, 400, "invalid_body");
  const updated = await db.unsubscribeSubscriber(email);
  if (!updated) return bad(res, 404, "not_found");
  audit(req, "admin.newsletter.unsubscribed", req.admin && req.admin.sub, { email });
  res.json({ ok: true });
}));

/* ---------- announcements (admin-composed mass email) ----------
   Two kinds on two legal bases — see migrations/033_announcements.up.sql.
   Audience selection lives in db.js and is NOT overridable from the request:
   the admin picks a kind, not a list of addresses, so there is no way to
   accidentally mail people who opted out. */

/* Marketing → consented newsletter addresses only.
   Service → account holders PLUS newsletter subscribers. A guest who bought
   once without registering but left us their address would otherwise never
   hear that someone is impersonating the shop, which defeats the point of the
   warning. broadcast() de-duplicates, so the overlap costs nothing. */
async function announcementAudience(kind) {
  if (kind !== "service") return db.listMarketingRecipients();
  const [accounts, subscribers] = await Promise.all([
    db.listServiceRecipients(),
    db.listMarketingRecipients(),
  ]);
  const seen = new Set();
  return accounts.concat(subscribers).filter((r) => {
    const key = String(r.email || "").trim().toLowerCase();
    if (!key || seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function readAnnouncement(body) {
  const b = body || {};
  const kind = b.kind === "service" ? "service" : "marketing";
  return {
    kind,
    subject: str(b.subject, 200),
    heading: str(b.heading, 160),
    subheading: str(b.subheading, 300),
    body: str(b.body, 20000),
    calloutTitle: str(b.calloutTitle, 120),
    /* One bullet per line in the admin textarea. */
    calloutItems: String(b.calloutItems || "")
      .split(/\r?\n/)
      .map((s) => str(s, 200))
      .filter(Boolean)
      .slice(0, 12),
    showContacts: !!b.showContacts,
    note: str(b.note, 300),
    ctaUrl: str(b.ctaUrl, 400),
    ctaText: str(b.ctaText, 80),
  };
}

/** How many people a given kind would actually reach, right now. */
app.get("/api/admin/announcements/audience", requireAdmin, ah(async (req, res) => {
  const kind = req.query.kind === "service" ? "service" : "marketing";
  const recipients = await announcementAudience(kind);
  res.json({
    ok: true,
    kind,
    count: recipients.length,
    /* A handful of addresses so the operator can sanity-check WHO this is
       before sending to all of them. */
    sample: recipients.slice(0, 5).map((r) => r.email),
  });
}));

/** Rendered HTML exactly as a recipient would see it. No sending. */
app.post("/api/admin/announcements/preview", requireAdmin, ah(async (req, res) => {
  const a = readAnnouncement(req.body);
  if (!a.subject || !a.body) return bad(res, 400, "subject_and_body_required");
  res.json({ ok: true, subject: a.subject, html: mailer.announcementPreviewHtml(a) });
}));

/** Sends ONE copy to a chosen address, so the real thing can be proof-read
    in a real inbox before it reaches hundreds of people. */
app.post("/api/admin/announcements/test", requireAdmin, ah(async (req, res) => {
  const a = readAnnouncement(req.body);
  if (!a.subject || !a.body) return bad(res, 400, "subject_and_body_required");
  const to = normEmail((req.body && req.body.to) || "");
  if (!isEmail(to)) return bad(res, 400, "invalid_email");

  const result = await mailer.sendAnnouncement([{ email: to, firstname: "" }], a);
  audit(req, "admin.announcement.test", req.admin && req.admin.sub, { to, kind: a.kind });
  res.json({ ok: true, result });
}));

/* The real send. Deliberately NOT idempotent-by-accident: the client must
   echo back the audience size it showed the operator, and we refuse if the
   audience has changed underneath them (someone unsubscribed while they were
   typing). Better a retry than a surprise. */
app.post("/api/admin/announcements", requireAdmin, ah(async (req, res) => {
  const a = readAnnouncement(req.body);
  if (!a.subject || !a.body) return bad(res, 400, "subject_and_body_required");

  const recipients = await announcementAudience(a.kind);
  if (!recipients.length) return bad(res, 409, "no_recipients");

  const confirmed = parseInt((req.body && req.body.confirmCount), 10);
  if (!Number.isFinite(confirmed) || confirmed !== recipients.length) {
    return res.status(409).json({
      ok: false,
      error: "audience_changed",
      expected: confirmed,
      actual: recipients.length,
    });
  }

  const record = await db.createAnnouncement({
    id: crypto.randomUUID(),
    kind: a.kind,
    subject: a.subject,
    body: a.body,
    segments: [a.kind],
    recipientCount: recipients.length,
    createdBy: (req.admin && req.admin.sub) || null,
  });
  audit(req, "admin.announcement.send", req.admin && req.admin.sub, {
    id: record.id, kind: a.kind, subject: a.subject, recipients: recipients.length,
  });

  let result;
  try {
    result = await mailer.sendAnnouncement(recipients, a);
  } catch (e) {
    await db.finishAnnouncement(record.id, { status: "failed", sent: 0, failed: recipients.length, failures: [{ email: "", error: e.message }] });
    throw e;
  }

  const saved = await db.finishAnnouncement(record.id, {
    status: result.sent > 0 ? "sent" : "failed",
    sent: result.sent,
    failed: result.failed,
    failures: result.failures,
  });
  res.json({ ok: true, announcement: saved, result });
}));

/* ---------- GDPR evidence + retention ---------- */

/** The consent log, newest first — what you show if the DPA asks. */
app.get("/api/admin/cookie-consents", requireAdmin, ah(async (req, res) => {
  res.json({ ok: true, consents: await db.listCookieConsents(req.query.limit) });
}));

/** Every choice one browser ever made, for a specific dispute. */
app.get("/api/admin/cookie-consents/:visitorId", requireAdmin, ah(async (req, res) => {
  res.json({ ok: true, history: await db.cookieConsentHistory(req.params.visitorId) });
}));

/* Dry run by default: shows exactly how many rows each rule would touch
   without touching any of them. Pass ?apply=true (and set RETENTION_ENABLED)
   to actually run it — deleting customer data should take two deliberate
   decisions, not one. */
app.post("/api/admin/retention/run", requireAdmin, ah(async (req, res) => {
  const apply = String((req.body && req.body.apply) || req.query.apply) === "true";
  const result = await runRetention({ pool: db.getPool(), apply });
  if (result.applied) {
    audit(req, "admin.retention.applied", req.admin && req.admin.sub, {
      totalMatched: result.totalMatched,
    });
  }
  res.json({ ok: true, ...result });
}));

app.get("/api/admin/announcements", requireAdmin, ah(async (req, res) => {
  res.json({ ok: true, announcements: await db.listAnnouncements(req.query.limit) });
}));

app.get("/api/admin/messages", requireAdmin, ah(async (req, res) => {
  const data = await db.listMessagesPage(pageQuery(req));
  res.json({ ok: true, messages: data.messages, pagination: data.pagination });
}));

app.get("/api/admin/messages/:id/attachment", requireAdmin, ah(async (req, res) => {
  const message = await db.getMessage(req.params.id);
  if (!message || !message.attachmentStorageName) return bad(res, 404, "not_found");
  if (!/^[a-f0-9-]+\.(png|jpg|webp|pdf)$/i.test(message.attachmentStorageName)) return bad(res, 404, "not_found");
  const filePath = path.join(CONTACT_ATTACHMENTS_DIR, message.attachmentStorageName);
  if (!fs.existsSync(filePath)) return bad(res, 404, "not_found");
  res.set({
    "Content-Type": "application/octet-stream",
    "Content-Disposition": "attachment; filename*=UTF-8''" + encodeURIComponent(message.attachmentName || "attachment"),
    "X-Content-Type-Options": "nosniff",
    "Cache-Control": "private, no-store",
  });
  fs.createReadStream(filePath).pipe(res);
}));

app.patch("/api/admin/messages/:id", requireAdmin, ah(async (req, res) => {
  if (typeof (req.body && req.body.read) !== "boolean") {
    return bad(res, 400, "invalid_body");
  }
  const updated = await db.setMessageRead(req.params.id, req.body.read);
  if (!updated) return bad(res, 404, "not_found");
  res.json({ ok: true });
}));

app.post("/api/admin/messages/:id/reply", requireAdmin, ah(async (req, res) => {
  const message = await db.getMessage(req.params.id);
  if (!message) return bad(res, 404, "not_found");
  const body = String((req.body && req.body.body) || "").trim();
  if (!body || body.length > 20000) return bad(res, 400, "invalid_body");
  await mailer.sendContactReply(message, body);
  audit(req, "admin.message.replied", req.admin && req.admin.sub, { messageId: message.id, to: message.email });
  res.json({ ok: true });
}));

app.delete("/api/admin/messages/:id", requireAdmin, ah(async (req, res) => {
  const message = await db.getMessage(req.params.id);
  const deleted = await db.deleteMessage(req.params.id);
  if (!deleted) return bad(res, 404, "not_found");
  removeContactAttachment(message);
  res.json({ ok: true });
}));

/* ---------- products ---------- */

app.get("/api/admin/products", requireAdmin, ah(async (req, res) => {
  const overrides = await db.getOverrides();
  const detailsMap = await db.getAllProductDetails();
  const variantsByProduct = await db.getAllVariants();
  const statics = catalog.PRODUCTS.map((p) => {
    const ov = overrides[p.id] || {};
    return Object.assign({}, p, {
      custom: false,
      stock: ov.stock != null ? ov.stock : null,
      price: ov.price != null ? ov.price : null,
      salePrice: ov.salePrice != null ? ov.salePrice : null,
      saleUntil: ov.saleUntil || null,
      details: detailsMap[p.id] || null,
      variants: variantsByProduct[p.id] || [],
    });
  });
  const customs = (await db.listCustomProducts(false)).map((p) => {
    const ov = overrides[p.id] || {};
    return Object.assign({}, p, {
      custom: true,
      category:
        (catalog.CATEGORIES[p.catId] && catalog.CATEGORIES[p.catId].name) ||
        p.catId,
      stock: ov.stock != null ? ov.stock : null,
      details: detailsMap[p.id] || null,
      variants: variantsByProduct[p.id] || [],
    });
  });
  res.json({ ok: true, products: statics.concat(customs) });
}));

app.post("/api/admin/products", requireAdmin, ah(async (req, res) => {
  const b = req.body || {};
  const catId = String(b.catId || "");
  if (!catalog.CATEGORIES[catId]) return bad(res, 400, "invalid_category");
  const title = str(b.title, 160);
  if (!title) return bad(res, 400, "missing_title");
  const price = parsePrice(b.price);
  if (price === undefined) return bad(res, 400, "invalid_price");
  const salePrice = parsePrice(b.salePrice);
  if (salePrice === undefined) return bad(res, 400, "invalid_sale_price");
  if (salePrice != null && (price == null || salePrice >= price)) {
    return bad(res, 400, "invalid_sale_price");
  }
  const saleUntil = daysToExpiry(b.saleDays);
  if (saleUntil === undefined) return bad(res, 400, "invalid_sale_days");

  const id = await db.nextProductId();
  let image = null;
  let images = [];
  const incoming = Array.isArray(b.imagesData)
    ? b.imagesData
    : (b.imageData ? [b.imageData] : []);
  if (!validProductImageBatch(incoming)) return bad(res, 400, "invalid_image");
  if (incoming.length) {
    images = await saveProductImages(id, incoming);
    if (images.length !== incoming.length) return bad(res, 400, "invalid_image");
    image = images[0];
  }
  const product = {
    id,
    catId,
    title,
    titleEn: str(b.titleEn, 160),
    description: str(b.description, 4000),
    descriptionEn: str(b.descriptionEn, 4000),
    price,
    salePrice,
    saleUntil: salePrice != null ? saleUntil : null,
    image,
    images,
    active: b.publish !== false,
  };
  await db.createCustomProduct(product);

  if (b.details && typeof b.details === "object") {
    await db.setProductDetails(id, normalizeProductDetails(b.details));
  }

  if (b.stock !== null && b.stock !== "" && b.stock !== undefined) {
    const n = parseInt(b.stock, 10);
    if (!isNaN(n) && n >= 0 && n <= 9999) {
      await db.setOverride(id, { stock: n });
    }
  }

  if (product.active && b.sendMarketingEmail === true) {
    notifyNewProduct(product, {
      eventId: "product-published:" + id,
      audience: { type: b.audienceType || "newsletter" },
      createdBy: req.admin && req.admin.sub,
    });
  }

  clearReadCache();
  audit(req, "admin.product.created", req.admin && req.admin.sub,
    { productId: id, category: catId, hasImages: images.length > 0 });
  res.json({ ok: true, product });
}));

app.patch("/api/admin/products/:id", requireAdmin, ah(async (req, res) => {
  const id = req.params.id;
  const b = req.body || {};
  const custom = await db.getCustomProduct(id);
  const isStatic = catalog.PRODUCT_IDS.has(id);
  if (!custom && !isStatic) return bad(res, 404, "not_found");

  if (custom) {
    const wasActive = custom.active !== false;
    const wasOnSale = saleActive(custom.price, custom.salePrice, custom.saleUntil);
    const fields = {};
    if (b.title !== undefined) {
      const title = str(b.title, 160);
      if (!title) return bad(res, 400, "missing_title");
      fields.title = title;
    }
    if (b.titleEn !== undefined) fields.title_en = str(b.titleEn, 160);
    if (b.description !== undefined) fields.description = str(b.description, 4000);
    if (b.descriptionEn !== undefined) fields.description_en = str(b.descriptionEn, 4000);
    if (b.price !== undefined) {
      const price = parsePrice(b.price);
      if (price === undefined) return bad(res, 400, "invalid_price");
      fields.price = price;
    }
    if (b.salePrice !== undefined || b.saleDays !== undefined) {
      const sp = b.salePrice !== undefined ? parsePrice(b.salePrice) : custom.salePrice;
      if (sp === undefined) return bad(res, 400, "invalid_sale_price");
      const effPrice = fields.price !== undefined ? fields.price : custom.price;
      if (sp != null && (effPrice == null || sp >= effPrice)) {
        return bad(res, 400, "invalid_sale_price");
      }
      fields.sale_price = sp;
      if (sp == null) {
        fields.sale_until = null;
      } else if (b.saleDays !== undefined) {
        const until = daysToExpiry(b.saleDays);
        if (until === undefined) return bad(res, 400, "invalid_sale_days");
        fields.sale_until = until;
      }
    }
    if (b.active !== undefined) fields.active = !!b.active;
    if (b.catId !== undefined) {
      if (!catalog.CATEGORIES[b.catId]) return bad(res, 400, "invalid_category");
      fields.cat_id = String(b.catId);
    }
    const incomingImgs = Array.isArray(b.imagesData)
      ? b.imagesData
      : (b.imageData ? [b.imageData] : []);
    const replaceImages = b.replaceImages === true && Array.isArray(b.imagesData);
    if (replaceImages || incomingImgs.length) {
      if (!validProductImageBatch(incomingImgs)) return bad(res, 400, "invalid_image");
      const prev = Array.isArray(custom.images) && custom.images.length
        ? custom.images
        : (custom.image ? [custom.image] : []);
      const saved = incomingImgs.length ? await saveProductImages(id, incomingImgs) : [];
      if (saved.length !== incomingImgs.length) return bad(res, 400, "invalid_image");
      fields.image = saved[0] || null;
      fields.images = JSON.stringify(saved);
      /* clean up any previous files that are no longer referenced */
      const stale = prev.filter((u) => saved.indexOf(u) === -1);
      if (stale.length) await removeProductImages(id, stale);
    }
    if (Object.keys(fields).length) await db.updateCustomProduct(id, fields);

    /* fire a sale email only when the discount newly becomes active */
    const updated = await db.getCustomProduct(id);
    if (updated && updated.active !== false && !wasActive && b.sendMarketingEmail === true) {
      notifyNewProduct(updated, {
        eventId: "product-published:" + id,
        audience: { type: b.audienceType || "newsletter" },
        createdBy: req.admin && req.admin.sub,
      });
    }
    if (updated && updated.active !== false &&
        saleActive(updated.price, updated.salePrice, updated.saleUntil) && !wasOnSale) {
      notifySale(updated);
    }
  } else {
    /* price + sale-price overrides for a static catalog product */
    const cur = (await db.getOverrides())[id] || {};
    const wasOnSale = saleActive(cur.price, cur.salePrice, cur.saleUntil);
    let effPrice = cur.price;
    if (b.price !== undefined) {
      const price = parsePrice(b.price);
      if (price === undefined) return bad(res, 400, "invalid_price");
      await db.setOverride(id, { price });
      effPrice = price;
    }
    if (b.salePrice !== undefined || b.saleDays !== undefined) {
      const sp = b.salePrice !== undefined ? parsePrice(b.salePrice) : cur.salePrice;
      if (sp === undefined) return bad(res, 400, "invalid_sale_price");
      if (sp != null && (effPrice == null || sp >= effPrice)) {
        return bad(res, 400, "invalid_sale_price");
      }
      const ovFields = { salePrice: sp };
      if (sp == null) {
        ovFields.saleUntil = null;
      } else if (b.saleDays !== undefined) {
        const until = daysToExpiry(b.saleDays);
        if (until === undefined) return bad(res, 400, "invalid_sale_days");
        ovFields.saleUntil = until;
      }
      await db.setOverride(id, ovFields);

      const after = (await db.getOverrides())[id] || {};
      if (saleActive(after.price, after.salePrice, after.saleUntil) && !wasOnSale) {
        const st = staticProduct(id);
        notifySale(Object.assign({}, st, {
          price: after.price,
          salePrice: after.salePrice,
          saleUntil: after.saleUntil,
        }));
      }
    }
  }

  if (b.stock !== undefined) {
    if (b.stock === null || b.stock === "") {
      await db.setOverride(id, { stock: null });
    } else {
      const n = parseInt(b.stock, 10);
      if (isNaN(n) || n < 0 || n > 9999) return bad(res, 400, "invalid_stock");
      await db.setOverride(id, { stock: n });
    }
  }

  if (b.details !== undefined) {
    await db.setProductDetails(id, normalizeProductDetails(b.details));
  }

  const overrides = await db.getOverrides();
  const ov = overrides[id] || {};
  clearReadCache();
  audit(req, "admin.product.updated", req.admin && req.admin.sub, {
    productId: id,
    fields: Object.keys(b).map((key) => key === "imagesData" || key === "imageData" ? "images" : key)
      .filter((key, index, all) => all.indexOf(key) === index),
  });
  res.json({
    ok: true,
    id,
    stock: ov.stock != null ? ov.stock : null,
    product: custom ? await db.getCustomProduct(id) : null,
    details: (await db.getProductDetails(id))?.details || null,
  });
}));

app.delete("/api/admin/products/:id", requireAdmin, ah(async (req, res) => {
  const id = req.params.id;
  const removed = await db.deleteCustomProduct(id);
  if (!removed) return bad(res, 404, "not_found");
  await db.setOverride(id, { stock: null, price: null });
  const toRemove = removed.imageList && removed.imageList.length
    ? removed.imageList
    : (removed.image ? [removed.image] : []);
  await removeProductImages(id, toRemove);
  /* also drop every colour variant of this product + their photos */
  const variants = await db.listVariants(id);
  for (const v of variants) {
    await db.deleteVariant(v.id);
    if (v.images && v.images.length) await removeProductImages(v.id, v.images);
  }
  clearReadCache();
  audit(req, "admin.product.deleted", req.admin && req.admin.sub,
    { productId: id, variantsDeleted: variants.length });
  res.json({ ok: true });
}));

/* ---------- product variants (colours) ---------- */

function parseStockValue(raw) {
  if (raw === null || raw === "" || raw === undefined) return null;
  const n = parseInt(raw, 10);
  if (isNaN(n) || n < 0 || n > 9999) return undefined; // undefined = invalid
  return n;
}

function validVariantHex(value) {
  return value === "" || /^#[0-9a-f]{6}$/i.test(value);
}

function sendVariantConstraintConflict(res, error) {
  if (!error || error.code !== "23505") return false;
  const constraint = String(error.constraint || "");
  if (constraint === "product_variants_product_color_unique_idx") {
    bad(res, 409, "variant_color_exists");
    return true;
  }
  if (constraint === "product_variants_sku_unique_idx") {
    bad(res, 409, "variant_sku_exists");
    return true;
  }
  return false;
}

async function baseProductExists(id) {
  if (catalog.PRODUCT_IDS.has(id)) return true;
  const cu = await db.getCustomProduct(id);
  return !!cu;
}

/* Add a colour variant to an existing base product (static or custom). */
app.post("/api/admin/products/:id/variants", requireAdmin, ah(async (req, res) => {
  const baseId = req.params.id;
  if (!(await baseProductExists(baseId))) return bad(res, 404, "not_found");
  const b = req.body || {};

  const color = str(b.color, 80);
  if (!color) return bad(res, 400, "missing_color");
  if (await db.variantColorExists(baseId, color)) {
    return bad(res, 409, "variant_color_exists");
  }

  const sku = str(b.sku, 80);
  if (!sku) return bad(res, 400, "missing_sku");
  if (await db.variantSkuExists(sku)) {
    return bad(res, 409, "variant_sku_exists");
  }

  const colorHex = str(b.colorHex, 20);
  if (!validVariantHex(colorHex)) return bad(res, 400, "invalid_color_hex");

  const price = parsePrice(b.price);
  if (price === undefined) return bad(res, 400, "invalid_price");
  if (price === null) return bad(res, 400, "missing_price");
  const salePrice = parsePrice(b.salePrice);
  if (salePrice === undefined) return bad(res, 400, "invalid_sale_price");
  if (salePrice != null && (price == null || salePrice >= price)) {
    return bad(res, 400, "invalid_sale_price");
  }
  const saleUntil = daysToExpiry(b.saleDays);
  if (saleUntil === undefined) return bad(res, 400, "invalid_sale_days");
  const stock = parseStockValue(b.stock);
  if (stock === undefined) return bad(res, 400, "invalid_stock");
  if (stock === null) return bad(res, 400, "missing_stock");

  const id = await db.nextVariantId();
  let images = [];
  const incoming = Array.isArray(b.imagesData) ? b.imagesData : (b.imageData ? [b.imageData] : []);
  if (!validProductImageBatch(incoming)) return bad(res, 400, "invalid_image");
  if (incoming.length) {
    images = await saveProductImages(id, incoming);
    if (images.length !== incoming.length) return bad(res, 400, "invalid_image");
  }

  let variant;
  try {
    variant = await db.createVariant({
      id,
      productId: baseId,
      color,
      colorEn: str(b.colorEn, 80),
      colorHex,
      sku,
      price,
      salePrice: salePrice != null ? salePrice : null,
      saleUntil: salePrice != null ? saleUntil : null,
      stock,
      images,
      available: b.available !== false && b.available !== "0",
    });
  } catch (error) {
    if (images.length) await removeProductImages(id, images);
    if (sendVariantConstraintConflict(res, error)) return;
    throw error;
  }

  clearReadCache();
  audit(req, "admin.product_variant.created", req.admin && req.admin.sub,
    { variantId: variant.id, productId: baseId, sku: variant.sku });
  res.json({ ok: true, variant });
}));

app.patch("/api/admin/variants/:vid", requireAdmin, ah(async (req, res) => {
  const vid = req.params.vid;
  const current = await db.getVariant(vid);
  if (!current) return bad(res, 404, "not_found");
  const b = req.body || {};
  const fields = {};

  if (b.color !== undefined) {
    const color = str(b.color, 80);
    if (!color) return bad(res, 400, "missing_color");
    if (await db.variantColorExists(current.productId, color, vid)) {
      return bad(res, 409, "variant_color_exists");
    }
    fields.color = color;
  }
  if (b.colorEn !== undefined) fields.color_en = str(b.colorEn, 80);
  if (b.colorHex !== undefined) {
    const colorHex = str(b.colorHex, 20);
    if (!validVariantHex(colorHex)) return bad(res, 400, "invalid_color_hex");
    fields.color_hex = colorHex;
  }
  if (b.sku !== undefined) {
    const sku = str(b.sku, 80);
    if (!sku) return bad(res, 400, "missing_sku");
    if (await db.variantSkuExists(sku, vid)) {
      return bad(res, 409, "variant_sku_exists");
    }
    fields.sku = sku;
  }
  if (b.available !== undefined) fields.available = b.available !== false && b.available !== "0";

  const effPriceGiven = b.price !== undefined;
  let effPrice = current.price;
  if (effPriceGiven) {
    const price = parsePrice(b.price);
    if (price === undefined) return bad(res, 400, "invalid_price");
    if (price === null) return bad(res, 400, "missing_price");
    fields.price = price;
    effPrice = price;
  }
  if (b.salePrice !== undefined || b.saleDays !== undefined) {
    const sp = b.salePrice !== undefined ? parsePrice(b.salePrice) : current.salePrice;
    if (sp === undefined) return bad(res, 400, "invalid_sale_price");
    if (sp != null && (effPrice == null || sp >= effPrice)) {
      return bad(res, 400, "invalid_sale_price");
    }
    fields.sale_price = sp;
    if (sp == null) {
      fields.sale_until = null;
    } else if (b.saleDays !== undefined) {
      const until = daysToExpiry(b.saleDays);
      if (until === undefined) return bad(res, 400, "invalid_sale_days");
      fields.sale_until = until;
    }
  }
  if (b.stock !== undefined) {
    const stock = parseStockValue(b.stock);
    if (stock === undefined) return bad(res, 400, "invalid_stock");
    if (stock === null) return bad(res, 400, "missing_stock");
    fields.stock = stock;
  }

  const incoming = Array.isArray(b.imagesData) ? b.imagesData : (b.imageData ? [b.imageData] : []);
  const replaceImages = b.replaceImages === true;
  if (replaceImages || incoming.length) {
    if (!validProductImageBatch(incoming)) return bad(res, 400, "invalid_image");
    const saved = incoming.length ? await saveProductImages(vid, incoming) : [];
    if (incoming.length && saved.length !== incoming.length) return bad(res, 400, "invalid_image");
    const stale = (current.images || []).filter((u) => saved.indexOf(u) === -1);
    if (stale.length) await removeProductImages(vid, stale);
    fields.images = saved.length ? JSON.stringify(saved) : null;
  }

  let variant;
  try {
    variant = await db.updateVariant(vid, fields);
  } catch (error) {
    if (sendVariantConstraintConflict(res, error)) return;
    throw error;
  }
  clearReadCache();
  audit(req, "admin.product_variant.updated", req.admin && req.admin.sub, {
    variantId: vid,
    productId: current.productId,
    fields: Object.keys(b).map((key) => key === "imagesData" || key === "imageData" ? "images" : key)
      .filter((key, index, all) => all.indexOf(key) === index),
  });
  res.json({ ok: true, variant });
}));

app.delete("/api/admin/variants/:vid", requireAdmin, ah(async (req, res) => {
  const removed = await db.deleteVariant(req.params.vid);
  if (!removed) return bad(res, 404, "not_found");
  if (removed.imageList && removed.imageList.length) {
    await removeProductImages(req.params.vid, removed.imageList);
  }
  clearReadCache();
  audit(req, "admin.product_variant.deleted", req.admin && req.admin.sub, {
    variantId: req.params.vid, productId: removed.productId || null,
  });
  res.json({ ok: true });
}));

/* ---------- coupons (admin) ---------- */

app.get("/api/admin/coupons", requireAdmin, ah(async (req, res) => {
  res.json({ ok: true, coupons: await db.listCoupons() });
}));

app.post("/api/admin/coupons", requireAdmin, ah(async (req, res) => {
  const b = req.body || {};
  const code = String(b.code || "").toUpperCase().trim().slice(0, 40);
  if (!/^[A-Z0-9_-]{2,40}$/.test(code)) return bad(res, 400, "invalid_code");
  const type = b.type === "fixed" ? "fixed" : "percent";
  const freeShipping = !!b.freeShipping;
  const rawValue = b.value === undefined || b.value === null || b.value === "" ? 0 : parsePrice(b.value);
  const value = rawValue === undefined || rawValue === null ? 0 : rawValue;
  if (!freeShipping && value <= 0) {
    return bad(res, 400, "invalid_value");
  }
  if (value > 0 && type === "percent" && value > 100) return bad(res, 400, "invalid_value");
  if (await db.getCoupon(code)) return bad(res, 409, "exists");

  const name = str(b.name, 80) || "";
  let maxUses = null;
  if (b.maxUses !== undefined && b.maxUses !== null && b.maxUses !== "") {
    maxUses = parseInt(b.maxUses, 10);
    if (!Number.isFinite(maxUses) || maxUses < 1 || maxUses > 1000000) {
      return bad(res, 400, "invalid_max_uses");
    }
  }

  /* Duration in days takes priority; otherwise an explicit expiry date. */
  let expiresAt = null;
  if (b.durationDays !== undefined && b.durationDays !== null && b.durationDays !== "") {
    const iso = daysToExpiry(b.durationDays);
    if (iso === undefined) return bad(res, 400, "invalid_duration");
    expiresAt = iso.slice(0, 10); // coupons store a DATE
  } else if (b.expiresAt) {
    expiresAt = str(b.expiresAt, 10);
  }

  await db.createCoupon({
    code, type, value, expiresAt, name, maxUses, freeShipping,
    /* One redemption per customer (keyed on their order email), and/or
       restricted to a customer's very first order. */
    oncePerCustomer: !!b.oncePerCustomer,
    firstOrderOnly: !!b.firstOrderOnly,
  });
  const coupon = await db.getCoupon(code);

  if (b.sendMarketingEmail === true) {
    notifyCoupon(coupon, {
      eventId: "coupon-sent:" + coupon.code,
      audience: {
        type: b.audienceType || "newsletter",
        email: b.audienceEmail || "",
      },
      createdBy: req.admin && req.admin.sub,
    });
  }

  res.json({ ok: true, coupon });
}));

app.patch("/api/admin/coupons/:code", requireAdmin, ah(async (req, res) => {
  const code = String(req.params.code || "").toUpperCase();
  if (typeof (req.body && req.body.active) !== "boolean") {
    return bad(res, 400, "invalid_body");
  }
  const updated = await db.updateCoupon(code, { active: req.body.active });
  if (!updated) return bad(res, 404, "not_found");
  res.json({ ok: true });
}));

app.delete("/api/admin/coupons/:code", requireAdmin, ah(async (req, res) => {
  const deleted = await db.deleteCoupon(String(req.params.code || "").toUpperCase());
  if (!deleted) return bad(res, 404, "not_found");
  res.json({ ok: true });
}));

/* ---------- promotions engine (admin) ---------- */

/* Every currently-sellable product (has a regular price set), in the shape
   the promotions engine matches/prices against. Static catalog items with no
   admin-set price are skipped — there is nothing to discount. */
async function allSellableProductsForPromotions() {
  const overrides = await db.getOverrides();
  const customs = await db.listCustomProducts(true);
  const list = [];
  catalog.PRODUCTS.forEach((p) => {
    const ov = overrides[p.id] || {};
    if (ov.price == null) return;
    list.push({ id: p.id, catId: p.catId, title: p.title, regularPrice: ov.price, createdAt: null });
  });
  customs.forEach((c) => {
    if (c.price == null) return;
    list.push({ id: c.id, catId: c.catId, title: c.title, regularPrice: c.price, createdAt: c.createdAt });
  });
  return list;
}

const PROMOTION_DISCOUNT_TYPES = new Set(["percentage", "fixed_amount", "fixed_sale_price"]);
const PROMOTION_TARGET_TYPES = new Set(["product", "category", "all_products"]);
const PROMOTION_EXCLUSION_TYPES = new Set(["product", "new_products"]);
const PROMOTION_STATUSES = new Set(["draft", "scheduled", "active", "paused", "cancelled"]);

/* Parses + validates the scalar/targets/exclusions fields of a promotion
   request body. `sellableIds` is used to reject targets/exclusions that
   don't refer to a real, priced product. Returns { error } or { value }. */
function parsePromotionInput(b, sellableIds) {
  const name = str(b.name, 160);
  if (!name) return { error: "missing_name" };

  const code = str(b.code, 40).toUpperCase();
  if (code && !/^[A-Z0-9_-]{2,40}$/.test(code)) return { error: "invalid_code" };

  const discountType = String(b.discountType || "");
  if (!PROMOTION_DISCOUNT_TYPES.has(discountType)) return { error: "invalid_discount_type" };

  const discountValue = parsePrice(b.discountValue);
  if (discountValue === undefined || discountValue == null || discountValue <= 0) {
    return { error: "invalid_discount_value" };
  }
  if (discountType === "percentage" && discountValue > 100) return { error: "invalid_discount_value" };

  let maxDiscountPerProduct = null;
  if (b.maxDiscountPerProduct !== undefined && b.maxDiscountPerProduct !== null && b.maxDiscountPerProduct !== "") {
    maxDiscountPerProduct = parsePrice(b.maxDiscountPerProduct);
    if (maxDiscountPerProduct === undefined || maxDiscountPerProduct <= 0) return { error: "invalid_max_discount" };
  }

  const status = b.status !== undefined ? String(b.status) : "draft";
  if (!PROMOTION_STATUSES.has(status)) return { error: "invalid_status" };

  let startsAt = null;
  let endsAt = null;
  if (b.startsAt) {
    startsAt = new Date(b.startsAt);
    if (isNaN(startsAt.getTime())) return { error: "invalid_starts_at" };
  }
  if (b.endsAt) {
    endsAt = new Date(b.endsAt);
    if (isNaN(endsAt.getTime())) return { error: "invalid_ends_at" };
  }
  if (startsAt && endsAt && endsAt <= startsAt) return { error: "invalid_window" };

  const timezone = str(b.timezone, 60) || "Europe/Athens";
  const priority = Number.isFinite(Number(b.priority)) ? Math.round(Number(b.priority)) : 100;

  const targets = Array.isArray(b.targets) ? b.targets : [];
  if (!targets.length) return { error: "missing_targets" };
  const normTargets = [];
  for (const t of targets) {
    const type = String((t && t.type) || "");
    if (!PROMOTION_TARGET_TYPES.has(type)) return { error: "invalid_target" };
    if (type === "all_products") { normTargets.push({ type, id: null }); continue; }
    const id = str(t && t.id, 60);
    if (!id) return { error: "invalid_target" };
    if (type === "category" && !catalog.CATEGORIES[id]) return { error: "invalid_target_category" };
    if (type === "product" && sellableIds && !sellableIds.has(id)) return { error: "invalid_target_product" };
    normTargets.push({ type, id });
  }

  const exclusions = Array.isArray(b.exclusions) ? b.exclusions : [];
  const normExclusions = [];
  for (const e of exclusions) {
    const type = String((e && e.type) || "");
    if (!PROMOTION_EXCLUSION_TYPES.has(type)) return { error: "invalid_exclusion" };
    if (type === "new_products") { normExclusions.push({ type, id: null }); continue; }
    const id = str(e && e.id, 60);
    if (!id) return { error: "invalid_exclusion" };
    if (sellableIds && !sellableIds.has(id)) return { error: "invalid_exclusion_product" };
    normExclusions.push({ type, id });
  }

  return {
    value: {
      name, code, discountType, discountValue, maxDiscountPerProduct, status,
      startsAt: startsAt ? startsAt.toISOString() : null,
      endsAt: endsAt ? endsAt.toISOString() : null,
      timezone, priority, sendMarketingEmail: b.sendMarketingEmail === true, targets: normTargets, exclusions: normExclusions,
    },
  };
}

app.get("/api/admin/promotions", requireAdmin, ah(async (req, res) => {
  const [list, allProducts] = await Promise.all([db.listPromotions(), allSellableProductsForPromotions()]);
  const now = new Date();
  const rows = list.map((p) => {
    const others = list.filter((o) => o.id !== p.id);
    const preview = promotions.computePromotionPreview(p, allProducts, others, now);
    return {
      ...p,
      effectiveStatus: promotions.effectiveStatus(p, now),
      targetSummary: promotions.describeTargets(p.targets),
      matchedCount: preview.matchedCount,
    };
  });
  res.json({ ok: true, promotions: rows });
}));

app.get("/api/admin/promotions/:id", requireAdmin, ah(async (req, res) => {
  const id = parseInt(req.params.id, 10);
  const promo = await db.getPromotion(id);
  if (!promo) return bad(res, 404, "not_found");
  res.json({ ok: true, promotion: { ...promo, effectiveStatus: promotions.effectiveStatus(promo, new Date()) } });
}));

app.get("/api/admin/promotions/:id/audit", requireAdmin, ah(async (req, res) => {
  const id = parseInt(req.params.id, 10);
  const events = await db.listPromotionAuditLog(id);
  res.json({ ok: true, events });
}));

/* Accepts either a saved promotion id (?id=) to preview edits against, or a
   fully inline draft body — used by the admin wizard's "Preview" step before
   anything is persisted. */
app.post("/api/admin/promotions/preview", requireAdmin, ah(async (req, res) => {
  const b = req.body || {};
  const allProducts = await allSellableProductsForPromotions();
  const sellableIds = new Set(allProducts.map((p) => p.id));
  const parsed = parsePromotionInput(b, sellableIds);
  if (parsed.error) return bad(res, 400, parsed.error);

  const excludeId = b.excludeId != null ? parseInt(b.excludeId, 10) : null;
  const candidates = await db.listCandidatePromotions();
  const others = excludeId ? candidates.filter((p) => p.id !== excludeId) : candidates;
  const preview = promotions.computePromotionPreview(parsed.value, allProducts, others, new Date());
  const effectiveStatus = promotions.effectiveStatus(parsed.value, new Date());
  res.json({
    ok: true,
    preview,
    effectiveStatus,
    requiresConfirmation:
      (effectiveStatus === "active" || effectiveStatus === "scheduled") &&
      promotions.requiresConfirmation(parsed.value, preview.matchedCount),
  });
}));

app.post("/api/admin/promotions", requireAdmin, ah(async (req, res) => {
  const b = req.body || {};
  const allProducts = await allSellableProductsForPromotions();
  const sellableIds = new Set(allProducts.map((p) => p.id));
  const parsed = parsePromotionInput(b, sellableIds);
  if (parsed.error) return bad(res, 400, parsed.error);
  const draft = parsed.value;

  const effectiveStatus = promotions.effectiveStatus(draft, new Date());
  if (effectiveStatus === "active" || effectiveStatus === "scheduled") {
    const candidates = await db.listCandidatePromotions();
    const preview = promotions.computePromotionPreview(draft, allProducts, candidates, new Date());
    if (promotions.requiresConfirmation(draft, preview.matchedCount) && !b.confirm) {
      return res.status(409).json({ ok: false, error: "confirmation_required", preview, effectiveStatus });
    }
  }

  let id;
  try {
    id = await db.createPromotion({ ...draft, createdBy: req.admin && req.admin.sub });
  } catch (e) {
    if (String(e.message || "").includes("promotions_code_uniq")) return bad(res, 409, "code_exists");
    throw e;
  }
  audit(req, "promotion.created", req.admin && req.admin.sub, { promotionId: String(id), name: draft.name, status: draft.status });
  clearReadCache();
  const promo = await db.getPromotion(id);
  if (b.sendMarketingEmail === true && effectiveStatus === "active") {
    promotionEmailSnapshot(promo).then((snapshot) => {
      if (snapshot) notifySale(snapshot, { eventId: "promotion-activated:" + id, audience: { type: "newsletter" }, createdBy: req.admin && req.admin.sub });
    }).catch((e) => console.error("[notify] promotion:", e.message));
  }
  res.json({ ok: true, promotion: promo });
}));

app.patch("/api/admin/promotions/:id", requireAdmin, ah(async (req, res) => {
  const id = parseInt(req.params.id, 10);
  const existing = await db.getPromotion(id);
  if (!existing) return bad(res, 404, "not_found");
  const wasEffectiveStatus = promotions.effectiveStatus(existing, new Date());
  const b = req.body || {};

  const allProducts = await allSellableProductsForPromotions();
  const sellableIds = new Set(allProducts.map((p) => p.id));

  /* Merge onto the existing promotion so a partial PATCH (e.g. just {status:
     "paused"}) still validates as a complete, consistent definition. */
  const merged = {
    name: b.name !== undefined ? b.name : existing.name,
    code: b.code !== undefined ? b.code : existing.code,
    discountType: b.discountType !== undefined ? b.discountType : existing.discountType,
    discountValue: b.discountValue !== undefined ? b.discountValue : existing.discountValue,
    maxDiscountPerProduct: b.maxDiscountPerProduct !== undefined ? b.maxDiscountPerProduct : existing.maxDiscountPerProduct,
    status: b.status !== undefined ? b.status : existing.status,
    startsAt: b.startsAt !== undefined ? b.startsAt : existing.startsAt,
    endsAt: b.endsAt !== undefined ? b.endsAt : existing.endsAt,
    timezone: b.timezone !== undefined ? b.timezone : existing.timezone,
    priority: b.priority !== undefined ? b.priority : existing.priority,
    sendMarketingEmail: b.sendMarketingEmail !== undefined ? !!b.sendMarketingEmail : existing.sendMarketingEmail,
    targets: b.targets !== undefined ? b.targets : existing.targets,
    exclusions: b.exclusions !== undefined ? b.exclusions : existing.exclusions,
  };
  const parsed = parsePromotionInput(merged, sellableIds);
  if (parsed.error) return bad(res, 400, parsed.error);
  const next = parsed.value;

  /* Any edit that could matter for pricing (not just renaming/priority/tz)
     re-runs the same big-change confirmation gate as first activation. */
  const RISKY_FIELDS = ["status", "discountType", "discountValue", "maxDiscountPerProduct", "startsAt", "endsAt", "targets", "exclusions"];
  const touchesRisky = RISKY_FIELDS.some((k) => Object.prototype.hasOwnProperty.call(b, k));
  const effectiveStatus = promotions.effectiveStatus(next, new Date());
  if (touchesRisky && (effectiveStatus === "active" || effectiveStatus === "scheduled")) {
    const candidates = (await db.listCandidatePromotions()).filter((p) => p.id !== id);
    const preview = promotions.computePromotionPreview(next, allProducts, candidates, new Date());
    if (promotions.requiresConfirmation(next, preview.matchedCount) && !b.confirm) {
      return res.status(409).json({ ok: false, error: "confirmation_required", preview, effectiveStatus });
    }
  }

  try {
    await db.updatePromotion(id, next);
  } catch (e) {
    if (String(e.message || "").includes("promotions_code_uniq")) return bad(res, 409, "code_exists");
    throw e;
  }
  if (b.targets !== undefined || b.exclusions !== undefined) {
    await db.replacePromotionTargeting(id, b.targets !== undefined ? next.targets : null, b.exclusions !== undefined ? next.exclusions : null);
  }

  const changedKeys = Object.keys(b).filter((k) => k !== "confirm");
  audit(req, "promotion.updated", req.admin && req.admin.sub, {
    promotionId: String(id), name: next.name, changed: changedKeys,
    from: Object.fromEntries(changedKeys.map((k) => [k, existing[k]])),
    to: Object.fromEntries(changedKeys.map((k) => [k, next[k]])),
  });
  clearReadCache();
  const promo = await db.getPromotion(id);
  if (promo.sendMarketingEmail && wasEffectiveStatus !== "active" && effectiveStatus === "active") {
    promotionEmailSnapshot(promo).then((snapshot) => {
      if (snapshot) notifySale(snapshot, { eventId: "promotion-activated:" + id, audience: { type: "newsletter" }, createdBy: req.admin && req.admin.sub });
    }).catch((e) => console.error("[notify] promotion:", e.message));
  }
  res.json({ ok: true, promotion: promo });
}));

app.delete("/api/admin/promotions/:id", requireAdmin, ah(async (req, res) => {
  const id = parseInt(req.params.id, 10);
  const existing = await db.getPromotion(id);
  if (!existing) return bad(res, 404, "not_found");
  /* Anything that ever went live is cancelled, never deleted — history must
     survive so past orders stay explainable. Only a still-draft promotion,
     which never affected a live price, can be removed outright. */
  if (existing.status !== "draft") return bad(res, 400, "only_draft_deletable");
  await db.deletePromotion(id);
  audit(req, "promotion.deleted", req.admin && req.admin.sub, { promotionId: String(id), name: existing.name });
  res.json({ ok: true });
}));

/* ---------- reviews (admin moderation) ---------- */

app.get("/api/admin/reviews", requireAdmin, ah(async (req, res) => {
  const status = str(req.query.status, 20) || "pending";
  const page = Math.max(1, parseInt(req.query.page, 10) || 1);
  const limit = Math.max(1, Math.min(100, parseInt(req.query.limit, 10) || 20));
  const data = await db.listReviewsPage({ status, page, limit });
  /* attach a human-readable product title for the admin table */
  const overrides = await db.getOverrides();
  const withTitles = await Promise.all(
    data.reviews.map(async (r) => {
      const p = await resolveProduct(r.productId, overrides);
      return Object.assign({}, r, { productTitle: p ? p.title : r.productId });
    })
  );
  res.json({ ok: true, reviews: withTitles, pagination: data.pagination, reasons: reviewsPolicy.REJECTION_REASONS });
}));

/* Moving a review to anything but 'approved' requires one of the enumerated,
   content-based reasons — never a free-form "didn't like it". Every change
   is audit-logged (who, when, old→new status, reason). */
app.patch("/api/admin/reviews/:id", requireAdmin, ah(async (req, res) => {
  const status = req.body && req.body.status;
  if (!["pending", "approved", "rejected", "flagged", "removed"].includes(status)) {
    return bad(res, 400, "invalid_status");
  }
  const reason = str((req.body && req.body.reason) || "", 40);
  if (status !== "approved" && status !== "pending" && !reviewsPolicy.REJECTION_REASON_CODES.has(reason)) {
    return bad(res, 400, "reason_required");
  }
  const actor = (req.admin && (req.admin.sub || req.admin.username)) || "admin";
  const updated = await db.setReviewStatus(req.params.id, {
    status,
    reason: status === "approved" || status === "pending" ? null : reason,
    moderatedBy: actor,
  });
  if (!updated) return bad(res, 404, "not_found");
  clearReadCache();
  audit(req, "review.moderated", actor, { reviewId: req.params.id, status, reason: reason || null });
  res.json({ ok: true });
}));

/* Public store reply — one per review, editable in place. */
app.post("/api/admin/reviews/:id/reply", requireAdmin, ah(async (req, res) => {
  const body = str((req.body && req.body.body) || "", 1000);
  if (!body) return bad(res, 400, "empty_reply");
  const actor = (req.admin && (req.admin.sub || req.admin.username)) || "admin";
  await db.upsertReviewReply(req.params.id, actor, body);
  clearReadCache();
  audit(req, "review.replied", actor, { reviewId: req.params.id });
  res.json({ ok: true });
}));

app.delete("/api/admin/reviews/:id/reply", requireAdmin, ah(async (req, res) => {
  await db.deleteReviewReply(req.params.id);
  clearReadCache();
  audit(req, "review.reply_deleted", (req.admin && (req.admin.sub || req.admin.username)) || "admin", { reviewId: req.params.id });
  res.json({ ok: true });
}));

/* ================= ADMIN PANEL (secret path via ADMIN_UI_PATH) ================= */

const {
  ADMIN_UI_PATH,
  adminUiPathRegex,
} = require("./admin-ui-path");

/* Guessable legacy URLs must not reveal the panel — same branded 404 as the rest of the site. */
app.get(/^\/admin(\/.*)?$/, (req, res) => {
  res.status(404).sendFile(path.join(HTML_DIR, "404.html"));
});
if (ADMIN_UI_PATH !== "/admin-react") {
  app.get(/^\/admin-react(\/.*)?$/, (req, res) => {
    res.status(404).sendFile(path.join(HTML_DIR, "404.html"));
  });
}

const ADMIN_REACT_DIR = path.join(ROOT, "admin", "dist");
app.use(
  ADMIN_UI_PATH + "/assets",
  (req, res, next) => {
    res.set("X-Robots-Tag", "noindex, nofollow");
    res.set("Cache-Control", "no-store");
    next();
  },
  express.static(path.join(ADMIN_REACT_DIR, "assets"))
);
app.get(adminUiPathRegex(), (req, res, next) => {
  const index = path.join(ADMIN_REACT_DIR, "index.html");
  if (!fs.existsSync(index)) return next();
  let html;
  try {
    html = fs.readFileSync(index, "utf8");
  } catch {
    return next();
  }
  /* Vite builds with base "./". Without a trailing slash in the URL, the browser
     resolves ./assets to /assets. Rewrite to absolute ADMIN_UI_PATH URLs. */
  html = html.replace(
    /(src|href)="\.\/assets\//g,
    "$1=\"" + ADMIN_UI_PATH + "/assets/"
  );
  res.set("X-Robots-Tag", "noindex, nofollow");
  res.set("Cache-Control", "no-store");
  res.type("html").send(html);
});

/* ================= SEO (dynamic) ================= */


app.get("/sitemap.xml", ah(async (req, res) => {
  const base = publicSiteUrl(req);
  const today = localToday();
  const pageUrls = SITEMAP_PAGES.map(function (entry) {
    const loc = entry.slug ? base + "/" + entry.slug : base + "/";
    return (
      "  <url>\n" +
      "    <loc>" + loc + "</loc>\n" +
      "    <lastmod>" + today + "</lastmod>\n" +
      "    <changefreq>weekly</changefreq>\n" +
      "    <priority>" + entry.priority + "</priority>\n" +
      "  </url>"
    );
  });
  /* Category landing pages. renderCollectionSeo() gives each one its own
     title/description/canonical, so leaving them out of the sitemap wasted
     work already being done. Empty categories are skipped for the same reason
     that route marks them "noindex" — listing a page we ask Google not to
     index is a contradictory signal. */
  const categoryUrls = Object.keys(catalog.CATEGORIES)
    .filter((catId) => {
      const cat = catalog.CATEGORIES[catId];
      return cat && cat.count > 0 && catalog.CATEGORY_SLUGS[catId];
    })
    .map((catId) => {
      const loc = base + "/collection/" + catalog.CATEGORY_SLUGS[catId];
      return (
        "  <url>\n" +
        "    <loc>" + escapeHtml(loc) + "</loc>\n" +
        "    <lastmod>" + today + "</lastmod>\n" +
        "    <changefreq>weekly</changefreq>\n" +
        "    <priority>0.85</priority>\n" +
        "  </url>"
      );
    });

  /* one entry per product so Google indexes every candle individually.
     Out-of-stock products stay listed on purpose: Google's guidance is to keep
     them indexed carrying schema.org/OutOfStock (see availabilityOf) rather
     than to remove or redirect them. */
  const products = await seoProducts();
  const productUrls = products.map(function (p) {
    const loc = base + "/product/" + encodeURIComponent(p.id);
    const img = escapeHtml(absImage(base, p.image));
    return (
      "  <url>\n" +
      "    <loc>" + escapeHtml(loc) + "</loc>\n" +
      "    <lastmod>" + today + "</lastmod>\n" +
      "    <changefreq>weekly</changefreq>\n" +
      "    <priority>0.8</priority>\n" +
      "    <image:image><image:loc>" + img + "</image:loc></image:image>\n" +
      "  </url>"
    );
  });
  res.type("application/xml");
  res.send(
    '<?xml version="1.0" encoding="UTF-8"?>\n' +
      '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" ' +
      'xmlns:image="http://www.google.com/schemas/sitemap-image/1.1">\n' +
      pageUrls.concat(categoryUrls, productUrls).join("\n") +
      "\n</urlset>"
  );
}));

/* ---------- product feeds (Google Merchant Center, Skroutz, BestPrice) ----------
 *
 * One resolver, two serialisations. The comparison engines that matter in Greece
 * want different XML shapes, but the same underlying rows, so the pricing,
 * stock and description logic lives here once.
 *
 * A product with no resolvable price is skipped rather than exported at 0 —
 * every one of these platforms treats a zero price as an error, and a rejected
 * item is easier to miss than an absent one.
 */
function feedItems(base, products) {
  return products
    .filter((p) => p.price != null && Number(p.price) > 0)
    .map((p) => ({
      id: p.id,
      title: p.title || "Nostalgia Collection",
      /* Falls back to the generic per-category sentence until real per-product
         copy is entered in admin. Feeds tolerate that far better than search
         does — but the moment descriptions land, this improves with no code
         change. */
      description: seoDescription(p),
      link: base + "/product/" + encodeURIComponent(p.id),
      image: absImage(base, p.image),
      price: Number(p.price).toFixed(2),
      category: p.category || "Αρωματικά κεριά",
      categoryPath:
        p.catId && catalog.CATEGORY_SLUGS[p.catId]
          ? base + "/collection/" + catalog.CATEGORY_SLUGS[p.catId]
          : base + "/collection",
      /* null stock means made-to-order rather than depleted — same reading as
         availabilityOf() uses for schema.org. */
      inStock: p.stock == null || Number(p.stock) > 0,
      /* Skroutz requires an integer quantity on every product. A null stock is
         "not tracked", not "unlimited", so it is declared as a single
         made-to-order piece: understating can never oversell, and these are
         one-off handmade items anyway. */
      quantity: p.stock == null ? 1 : Math.max(0, Math.min(10000000, Math.floor(Number(p.stock)))),
      madeToOrder: p.stock == null,
    }));
}

/* VAT declared in the feed. Greek standard rate; candles carry no reduced rate.
   The V2 pricing engine holds per-line rates in the database, but that table is
   not wired into the catalog path yet, so the feed states the rate explicitly
   rather than inventing one per product. It must match what the invoice
   actually charges — revisit together, not separately. */
const FEED_VAT_RATE = Number(process.env.FEED_VAT_RATE || 24).toFixed(2);

/* Skroutz validates availability against a fixed vocabulary and rejects the
   feed on anything else. Their published English docs are not self-consistent
   about the exact wording ("In Stock" vs "Delivery 1 to 3 days"), so the
   strings live here: if the merchant panel reports an invalid value, this is
   the only place to change. */
const SKROUTZ_AVAILABILITY = {
  inStock: "In Stock",
  madeToOrder: "Available up to 12 days",
  outOfStock: "Available up to 12 days",
};

/* Feeds are meant to be downloaded by Skroutz/BestPrice/Merchant Center, never
   to appear as a search result. X-Robots-Tag is the right instrument for that:
   a robots.txt Disallow would also stop those platforms fetching the file,
   which is the one thing it must never do. noindex governs indexing only,
   so the fetchers are unaffected. */
function feedHeaders(res) {
  res.type("application/xml");
  res.setHeader("X-Robots-Tag", "noindex");
}

/* Skroutz's examples wrap free text in CDATA, which keeps Greek copy, ampersands
   and stray markup intact. The split guards the one sequence CDATA cannot hold. */
function cdata(s) {
  return "<![CDATA[" + String(s == null ? "" : s).split("]]>").join("]]]]><![CDATA[>") + "]]>";
}

app.get("/feed/google.xml", ah(async (req, res) => {
  const base = publicSiteUrl(req);
  const items = feedItems(base, await seoProducts());
  const body = items
    .map(
      (i) =>
        "  <item>\n" +
        "    <g:id>" + escapeHtml(i.id) + "</g:id>\n" +
        "    <g:title>" + escapeHtml(i.title) + "</g:title>\n" +
        "    <g:description>" + escapeHtml(i.description) + "</g:description>\n" +
        "    <g:link>" + escapeHtml(i.link) + "</g:link>\n" +
        "    <g:image_link>" + escapeHtml(i.image) + "</g:image_link>\n" +
        "    <g:availability>" + (i.inStock ? "in_stock" : "out_of_stock") + "</g:availability>\n" +
        "    <g:price>" + i.price + " EUR</g:price>\n" +
        "    <g:brand>Nostalgia Collection</g:brand>\n" +
        "    <g:condition>new</g:condition>\n" +
        /* Handmade one-offs have no barcode. Declaring that explicitly is what
           stops Merchant Center rejecting the item for a missing GTIN/MPN. */
        "    <g:identifier_exists>no</g:identifier_exists>\n" +
        /* g:product_type is our own taxonomy and always safe. google_product_category
           is deliberately omitted: the catalog mixes candles, diffusers and
           perfume, and a single wrong taxonomy id causes disapprovals, whereas
           leaving it out lets Google classify each item itself. */
        "    <g:product_type>" + escapeHtml(i.category) + "</g:product_type>\n" +
        "  </item>"
    )
    .join("\n");
  feedHeaders(res);
  res.send(
    '<?xml version="1.0" encoding="UTF-8"?>\n' +
      '<rss version="2.0" xmlns:g="http://base.google.com/ns/1.0">\n' +
      "<channel>\n" +
      "  <title>Nostalgia Collection</title>\n" +
      "  <link>" + escapeHtml(base) + "</link>\n" +
      "  <description>Χειροποίητα αρωματικά κεριά — Nostalgia Collection</description>\n" +
      (body ? body + "\n" : "") +
      "</channel>\n</rss>"
  );
}));

/* Skroutz's shape, which BestPrice also accepts. Every field Skroutz marks
   mandatory is emitted — id, name, link, image, category, price_with_vat, vat,
   availability, manufacturer, mpn, ean, description, quantity — because a feed
   missing any one of them is rejected outright rather than partially imported.
   The deprecated <instock> flag is deliberately not sent; <quantity> replaced it.

   Out-of-stock items stay in the feed with quantity 0 instead of being dropped,
   so a product that comes back does not lose its accumulated listing history. */
app.get("/feed/skroutz.xml", ah(async (req, res) => {
  const base = publicSiteUrl(req);
  const items = feedItems(base, await seoProducts());
  const body = items
    .map((i) => {
      const availability = !i.inStock
        ? SKROUTZ_AVAILABILITY.outOfStock
        : i.madeToOrder
        ? SKROUTZ_AVAILABILITY.madeToOrder
        : SKROUTZ_AVAILABILITY.inStock;
      return (
        "    <product>\n" +
        "      <id>" + escapeHtml(i.id) + "</id>\n" +
        "      <name>" + cdata(i.title) + "</name>\n" +
        "      <link>" + cdata(i.link) + "</link>\n" +
        "      <image>" + cdata(i.image) + "</image>\n" +
        "      <category>" + cdata(i.category) + "</category>\n" +
        "      <price_with_vat>" + i.price + "</price_with_vat>\n" +
        "      <vat>" + FEED_VAT_RATE + "</vat>\n" +
        "      <manufacturer>" + cdata("Nostalgia Collection") + "</manufacturer>\n" +
        /* Handmade one-offs carry no barcode. Skroutz still wants both fields
           present, so the internal SKU stands in for the manufacturer part
           number and the barcode is sent empty rather than invented. */
        "      <mpn>" + escapeHtml(i.id) + "</mpn>\n" +
        "      <ean></ean>\n" +
        "      <availability>" + escapeHtml(availability) + "</availability>\n" +
        "      <quantity>" + i.quantity + "</quantity>\n" +
        "      <description>" + cdata(i.description) + "</description>\n" +
        "    </product>"
      );
    })
    .join("\n");
  feedHeaders(res);
  res.send(
    '<?xml version="1.0" encoding="UTF-8"?>\n' +
      "<mywebstore>\n" +
      "  <created_at>" + new Date().toISOString() + "</created_at>\n" +
      "  <products>\n" +
      (body ? body + "\n" : "") +
      "  </products>\n</mywebstore>"
  );
}));

/* Greek convention: comma for decimals, and no ",00" tail on whole amounts —
   "δωρεάν άνω των 120€" reads naturally, "120,00€" does not. */
function fmtMoney(n) {
  const v = Number(n || 0);
  return (Number.isInteger(v) ? String(v) : v.toFixed(2).replace(".", ",")) + "€";
}

/**
 * llms.txt — a curated markdown map of the shop for language models
 * (https://llmstxt.org/). Where sitemap.xml lists which URLs exist, this tells
 * an assistant what the shop sells and where the answers live, without it
 * parsing HTML full of nav and scripts.
 *
 * Built from the live catalogue AND the live fee config, for the same reason
 * as the sitemap: a hand-written file goes stale the first time Maria adds a
 * product or the free-shipping threshold moves.
 *
 * Bilingual on purpose — the question may arrive in either language.
 * Deliberately modest: the spec is a proposal, Google states it does not use
 * it, and no assistant publicly commits to reading it.
 */
/* Served dynamically so the Sitemap line can carry an ABSOLUTE url — Google
   ignores a relative one, which is what the static robots.txt had. Same
   directives as that file, plus a pointer to llms.txt. */
app.get("/robots.txt", (req, res) => {
  const base = publicSiteUrl(req);
  const aiBots = ["GPTBot", "ChatGPT-User", "Claude-Web", "anthropic-ai",
    "PerplexityBot", "Google-Extended"];
  res.type("text/plain; charset=utf-8");
  res.send(
    "User-agent: *\n" +
    "Allow: /\n\n" +
    "# Admin and API are not for indexing\n" +
    "Disallow: /admin\n" +
    "Disallow: /api/\n\n" +
    "# Internal search results: thin, unbounded and duplicated from /collection.\n" +
    "# Categories live on real paths (/collection/<slug>) and stay crawlable.\n" +
    "Disallow: /*?search=\n" +
    "Disallow: /*&search=\n\n" +
    "# AI crawlers — a curated summary lives at /llms.txt\n" +
    aiBots.map((b) => "User-agent: " + b + "\nAllow: /\n").join("\n") +
    "\nSitemap: " + base + "/sitemap.xml\n"
  );
});

app.get("/llms.txt", ah(async (req, res) => {
  const base = publicSiteUrl(req);
  const out = [
    "# Nostalgia Collection",
    "",
    "> Χειροποίητα αρωματικά κεριά και αρώματα σπιτιού, φτιαγμένα σε μικρές " +
      "παρτίδες στη Θεσσαλονίκη. Handmade scented candles and home fragrance " +
      "from Greece, made in small batches. Αποστολές σε Ελλάδα και Κύπρο με ACS " +
      "Courier · πληρωμή με κάρτα · δίγλωσσος ιστότοπος " +
      "(ελληνικά / English).",
    "",
    "## Τι πουλάμε / What we sell",
    "",
    "- Χειροποίητα αρωματικά κεριά — handmade scented candles",
    "- Αρωματικά χώρου με sticks — reed diffusers",
    "- Σετ δώρου με συσκευασία και προσωπική κάρτα — gift sets",
    "",
  ];

  /* Collections before products: "what kinds do you have?" is answered by the
     nine collections, not by a flat list of every candle. */
  const cats = Object.entries(catalog.CATEGORIES)
    .filter(([id, c]) => c && c.count && catalog.CATEGORY_SLUGS[id]);
  if (cats.length) {
    out.push("## Συλλογές / Collections", "");
    cats.forEach(([id, c]) => {
      out.push("- [" + c.name + "](" + base + "/collection/" +
        catalog.CATEGORY_SLUGS[id] + "): " + c.count + " προϊόντα.");
    });
    out.push("");
  }

  /* A catalogue hiccup should still leave a usable file, never a 500. */
  try {
    const products = await seoProducts();
    const inStock = products.filter((p) => p.stock == null || p.stock > 0);
    if (inStock.length) {
      out.push("## Προϊόντα / Products (" + inStock.length + ")", "");
      inStock.forEach((p) => {
        const price = p.price != null ? " — " + fmtMoney(p.price) : "";
        const desc = String(p.description || "").replace(/\s+/g, " ").trim().slice(0, 140);
        out.push("- [" + p.title + "](" + base + "/product/" +
          encodeURIComponent(p.id) + ")" + price +
          (desc ? ": " + desc : (p.category ? ": " + p.category + "." : "")));
      });
      out.push("");
    }
  } catch (e) {
    console.error("[llms.txt] products:", e.message);
  }

  out.push(
    "## Αγορά και αποστολή / Buying and shipping",
    "",
    "- [Αποστολές και επιστροφές](" + base + "/shipping-returns): ACS Courier σε " +
      "Ελλάδα και Κύπρο. Μεταφορικά " + fmtMoney(fees.SHIPPING_FEE) + ", δωρεάν " +
      "άνω των " + fmtMoney(fees.FREE_SHIPPING_MIN) + ". Επιστροφές εντός 14 ημερών.",
    "- [Τρόποι πληρωμής](" + base + "/payments): Κάρτα.",
    "- [Συχνές ερωτήσεις](" + base + "/faq): Χρόνοι παράδοσης, διάρκεια καύσης, " +
      "υλικά, φροντίδα κεριού.",
    "",
    "## Βοήθεια επιλογής / Choosing",
    "",
    "- [Βρες το άρωμά σου](" + base + "/scent-finder): Προτείνει άρωμα ανά χώρο, " +
      "διάθεση και περίσταση.",
    "- [Ιδέες δώρου](" + base + "/gift-experience): Συσκευασία δώρου και προτάσεις.",
    "- [Η ιστορία μας](" + base + "/about): Ποιοι είμαστε, πώς φτιάχνονται τα κεριά.",
    "- [Journal](" + base + "/journal): Άρθρα για αρώματα, εποχές και φροντίδα.",
    "",
    "## Επικοινωνία / Contact",
    "",
    "- [Φόρμα επικοινωνίας](" + base + "/contact)",
    "- Email: info@nostalgiacandle.gr",
    "- Έδρα: Θεσσαλονίκη, Ελλάδα",
    "",
    "## Optional",
    "",
    "- [Όροι χρήσης](" + base + "/terms)",
    "- [Πολιτική απορρήτου](" + base + "/privacy)",
    "",
  );

  res.type("text/plain; charset=utf-8");
  res.set("Cache-Control", "public, max-age=3600");
  res.send(out.join("\n"));
}));


/* ================= STATIC STOREFRONT ================= */

function redirectQueryWithout(keys) {
  return function (req) {
    const params = new URLSearchParams(req.url.includes("?") ? req.url.slice(req.url.indexOf("?") + 1) : "");
    keys.forEach(function (k) {
      params.delete(k);
    });
    const q = params.toString();
    return q ? "?" + q : "";
  };
}

/* Legacy *.html bookmarks → clean paths (301). */
app.use(function (req, res, next) {
  if (req.method !== "GET" && req.method !== "HEAD") return next();
  /* /html/* is an internal folder, not a public path → let it fall through to the 404 guard. */
  if (req.path.startsWith("/html/")) return next();

  /* Site-ownership files must answer 200 at the exact URL the verifier issued.
     Stripping .html and redirecting is right for a bookmarked page and wrong
     here — Google and Pinterest ask for that filename, not a tidier one. */
  if (/^\/(google[0-9a-f]{8,}|pinterest-[0-9a-z]+)\.html$/i.test(req.path)) return next();

  const match = req.path.match(/^\/(.+)\.html$/);
  if (!match) return next();

  const base = match[1];
  if (base === "index") {
    return res.redirect(301, "/" + redirectQueryWithout([])(req));
  }
  if (base === "product") {
    const id = req.query.id;
    if (id) {
      const tail = redirectQueryWithout(["id"])(req);
      return res.redirect(301, "/product/" + encodeURIComponent(String(id)) + tail);
    }
  }
  if (base === "review") {
    const id = req.query.id;
    if (id) {
      const tail = redirectQueryWithout(["id"])(req);
      return res.redirect(301, "/review/" + encodeURIComponent(String(id)) + tail);
    }
  }
  if (base === "account") {
    if (req.query.mode === "register") {
      return res.redirect(301, "/account/register" + redirectQueryWithout(["mode"])(req));
    }
    return res.redirect(301, "/account" + redirectQueryWithout(["mode"])(req));
  }
  return res.redirect(301, "/" + base + redirectQueryWithout([])(req));
});

app.get("/account/register", function (req, res) {
  res.sendFile(path.join(HTML_DIR, "account.html"));
});

/* Public guest order tracking page (opened from the emailed link). */
app.get("/track", function (req, res) {
  res.sendFile(path.join(HTML_DIR, "track.html"));
});

/* product.html template, cached until the file changes (dev-friendly). */
let PRODUCT_TEMPLATE = null;
let PRODUCT_TEMPLATE_MTIME = 0;
function productTemplate() {
  const file = path.join(HTML_DIR, "product.html");
  const mtime = fs.statSync(file).mtimeMs;
  if (PRODUCT_TEMPLATE == null || mtime !== PRODUCT_TEMPLATE_MTIME) {
    PRODUCT_TEMPLATE = fs.readFileSync(file, "utf8");
    PRODUCT_TEMPLATE_MTIME = mtime;
  }
  return PRODUCT_TEMPLATE;
}

/* Server-render per-product <title>, meta and Schema.org Product JSON-LD
   into the head, so Google rich results and AI crawlers (which do not run
   JavaScript) can read the specific product. */
function renderProductSeo(base, p) {
  const title = (p.title || "Προϊόν") + " · Nostalgia Collection";
  const desc = seoDescription(p);
  const url = base + "/product/" + encodeURIComponent(p.id);
  const img = absImage(base, p.image);

  const offers = {
    "@type": "Offer",
    url: url,
    priceCurrency: "EUR",
    availability: availabilityOf(p.stock),
    itemCondition: "https://schema.org/NewCondition",
    hasMerchantReturnPolicy: {
      "@type": "MerchantReturnPolicy",
      applicableCountry: "GR",
      returnPolicyCategory: "https://schema.org/MerchantReturnFiniteReturnWindow",
      merchantReturnDays: 14,
      returnMethod: "https://schema.org/ReturnByMail",
      returnFees: "https://schema.org/ReturnShippingFees",
    },
    shippingDetails: {
      "@type": "OfferShippingDetails",
      shippingRate: { "@type": "MonetaryAmount", value: fees.SHIPPING_FEE.toFixed(2), currency: "EUR" },
      shippingDestination: { "@type": "DefinedRegion", addressCountry: "GR" },
      deliveryTime: {
        "@type": "ShippingDeliveryTime",
        handlingTime: { "@type": "QuantitativeValue", minValue: 0, maxValue: 1, unitCode: "DAY" },
        transitTime: { "@type": "QuantitativeValue", minValue: 1, maxValue: 5, unitCode: "DAY" },
      },
    },
  };
  if (p.price != null) offers.price = Number(p.price).toFixed(2);
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "Product",
    name: p.title || "Nostalgia Collection",
    description: desc,
    image: img,
    sku: p.id,
    brand: { "@type": "Brand", name: "Nostalgia Collection" },
    category: p.category || "Scented candles",
    offers: offers,
  };
  /* GTIN/MPN don't exist for these handmade, made-to-order pieces — Google's
     own guidance accepts sku (already set above) as a valid identifier when
     no barcode exists, so this isn't left incomplete. */
  if (p.variantColor) jsonLd.color = p.variantColor;
  /* Never fabricate a rating — only attach one backed by real approved
     reviews (server/db.js productReviewStats, status = 'approved' only). */
  if (p.reviewStats && p.reviewStats.total > 0) {
    jsonLd.aggregateRating = {
      "@type": "AggregateRating",
      ratingValue: p.reviewStats.average,
      reviewCount: p.reviewStats.total,
      bestRating: 5,
      worstRating: 1,
    };
  }
  /* Individual reviews alongside aggregateRating. Google reads both, and the
     rich result is stronger when the text is there — but only approved reviews
     reach this point (db.approvedReviews filters on status), so nothing
     unmoderated is ever published as markup. Capped because the whole JSON-LD
     block ships in the document head. */
  if (Array.isArray(p.reviews) && p.reviews.length) {
    jsonLd.review = p.reviews.slice(0, 20).map((r) => {
      const item = {
        "@type": "Review",
        reviewRating: {
          "@type": "Rating",
          ratingValue: r.rating,
          bestRating: 5,
          worstRating: 1,
        },
        author: { "@type": "Person", name: r.name || "Πελάτης" },
      };
      if (r.title) item.name = r.title;
      if (r.text) item.reviewBody = r.text;
      if (r.createdAt) {
        const d = new Date(r.createdAt);
        if (!isNaN(d)) item.datePublished = d.toISOString().slice(0, 10);
      }
      return item;
    });
  }

  /* Home → Συλλογή → <category> → product. The category step was missing, which
     both flattened the trail Google shows and dropped the one internal link
     from a product back up to its category page. */
  const crumbSlug = p.catId ? catalog.CATEGORY_SLUGS[p.catId] : null;
  const crumbs = [
    { "@type": "ListItem", position: 1, name: "Nostalgia Collection", item: base + "/" },
    { "@type": "ListItem", position: 2, name: "Συλλογή", item: base + "/collection" },
  ];
  if (crumbSlug && p.category) {
    crumbs.push({
      "@type": "ListItem",
      position: 3,
      name: p.category,
      item: base + "/collection/" + crumbSlug,
    });
  }
  crumbs.push({
    "@type": "ListItem",
    position: crumbs.length + 1,
    name: p.title || "Προϊόν",
    item: url,
  });
  const breadcrumbLd = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: crumbs,
  };

  let head =
    '<meta name="seo:product" content="' + escapeHtml(p.id) + '" />\n' +
    '  <meta name="description" content="' + escapeHtml(desc) + '" />\n' +
    '  <meta name="robots" content="index, follow, max-image-preview:large" />\n' +
    '  <link rel="canonical" href="' + escapeHtml(url) + '" />\n' +
    '  <meta property="og:type" content="product" />\n' +
    '  <meta property="og:site_name" content="Nostalgia Collection" />\n' +
    '  <meta property="og:title" content="' + escapeHtml(title) + '" />\n' +
    '  <meta property="og:description" content="' + escapeHtml(desc) + '" />\n' +
    '  <meta property="og:url" content="' + escapeHtml(url) + '" />\n' +
    '  <meta property="og:image" content="' + escapeHtml(img) + '" />\n' +
    '  <meta name="twitter:card" content="summary_large_image" />\n' +
    '  <meta name="twitter:title" content="' + escapeHtml(title) + '" />\n' +
    '  <meta name="twitter:description" content="' + escapeHtml(desc) + '" />\n';
  if (p.price != null) {
    head +=
      '  <meta property="product:price:amount" content="' + escapeHtml(Number(p.price).toFixed(2)) + '" />\n' +
      '  <meta property="product:price:currency" content="EUR" />\n';
  }
  head += '  <script type="application/ld+json">' + JSON.stringify(jsonLd) + "</script>\n";
  head += '  <script type="application/ld+json">' + JSON.stringify(breadcrumbLd) + "</script>\n";

  /* Real H1/description/price in the initial HTML — not just JSON-LD — for
     crawlers and readers that don't run JS. product.js replaces this whole
     section's innerHTML once it boots, so there is no duplicate content or
     layout conflict for JS-enabled visitors (it's gone before they notice). */
  const priceLine = p.price != null ? '<p class="product-fallback__price">€' + Number(p.price).toFixed(2) + "</p>" : "";
  const fallback =
    '<div class="product-fallback">' +
    '<h1 class="product-fallback__title">' + escapeHtml(p.title || "Προϊόν") + "</h1>" +
    (img ? '<img class="product-fallback__img" src="' + escapeHtml(img) + '" alt="' + escapeHtml(p.title || "") + '" width="600" height="750" />' : "") +
    priceLine +
    (desc ? '<p class="product-fallback__desc">' + escapeHtml(desc) + "</p>" : "") +
    "</div>";

  return { title: title, head: head, fallback: fallback };
}

app.get("/product/:id", ah(async (req, res) => {
  const id = String(req.params.id || "");
  let product = null;
  try {
    const [overrides, details, reviewStats, reviews] = await Promise.all([
      db.getOverrides(),
      db.getProductDetails(id),
      db.productReviewStats(id, { read: true }),
      db.approvedReviews(id, { read: true }),
    ]);
    const resolved = await resolveProduct(id, overrides);
    if (resolved) {
      const d = (details && details.details) || {};
      product = {
        id: resolved.id,
        title: resolved.title,
        description: resolved.description || "",
        longDescription: d.longDescription || "",
        variantColor: d.variantColor || "",
        image: resolved.image,
        price: resolved.price != null ? resolved.price : null,
        stock: overrides[id] && overrides[id].stock != null ? overrides[id].stock : null,
        catId: resolved.catId || null,
        category:
          (catalog.CATEGORIES[resolved.catId] || {}).name ||
          (staticProduct(id) ? staticProduct(id).category : "") ||
          "",
        reviewStats: reviewStats,
        reviews: reviews,
      };
    }
  } catch (e) {
    console.error("[product seo]", e.message);
  }

  /* Unknown product → real 404 status (client still shows its own 404 UI),
     so crawlers don't index this as a valid, empty product page. */
  if (!product) {
    return res.status(404).sendFile(path.join(HTML_DIR, "product.html"));
  }

  const base = publicSiteUrl(req);
  const seo = renderProductSeo(base, product);
  let html = productTemplate()
    .replace(/<title>[\s\S]*?<\/title>/i, "<title>" + escapeHtml(seo.title) + "</title>")
    .replace(/<\/head>/i, "  " + seo.head + "</head>")
    .replace(
      '<section class="product-page" id="product-page-root" aria-live="polite"></section>',
      '<section class="product-page" id="product-page-root" aria-live="polite">' + seo.fallback + "</section>"
    );
  res.type("html").send(html);
}));

/* collection.html template, cached until the file changes (dev-friendly). */
let COLLECTION_TEMPLATE = null;
let COLLECTION_TEMPLATE_MTIME = 0;
function collectionTemplate() {
  const file = path.join(HTML_DIR, "collection.html");
  const mtime = fs.statSync(file).mtimeMs;
  if (COLLECTION_TEMPLATE == null || mtime !== COLLECTION_TEMPLATE_MTIME) {
    COLLECTION_TEMPLATE = fs.readFileSync(file, "utf8");
    COLLECTION_TEMPLATE_MTIME = mtime;
  }
  return COLLECTION_TEMPLATE;
}

/* Server-render per-category <title>/meta/canonical so each category is a
   real, distinct, indexable page — not just a #cat1 fragment on /collection
   (Google never indexes URL fragments as separate pages). */
function renderCollectionSeo(base, catId) {
  const cat = catalog.CATEGORIES[catId];
  const slug = catalog.CATEGORY_SLUGS[catId];
  const url = base + "/collection/" + slug;
  const title = cat.name + " · Συλλογή · Nostalgia Collection";
  const desc = "Ανακαλύψτε τη συλλογή " + cat.name + " — χειροποίητα αρωματικά κεριά Nostalgia Collection, φτιαγμένα στην Ελλάδα.";
  /* Categories with zero live products yet ("coming soon") are thin content —
     don't invite Google to index an empty page. */
  const robots = cat.count > 0 ? "index, follow, max-image-preview:large" : "noindex, follow";

  const head =
    '<meta name="description" content="' + escapeHtml(desc) + '" />\n' +
    '  <meta name="robots" content="' + robots + '" />\n' +
    '  <link rel="canonical" href="' + escapeHtml(url) + '" />\n' +
    '  <meta property="og:type" content="website" />\n' +
    '  <meta property="og:site_name" content="Nostalgia Collection" />\n' +
    '  <meta property="og:title" content="' + escapeHtml(title) + '" />\n' +
    '  <meta property="og:description" content="' + escapeHtml(desc) + '" />\n' +
    '  <meta property="og:url" content="' + escapeHtml(url) + '" />\n' +
    '  <meta name="twitter:card" content="summary_large_image" />\n' +
    '  <meta name="twitter:title" content="' + escapeHtml(title) + '" />\n' +
    '  <meta name="twitter:description" content="' + escapeHtml(desc) + '" />\n' +
    '  <script type="application/ld+json">' + JSON.stringify({
      "@context": "https://schema.org",
      "@type": "CollectionPage",
      name: title,
      description: desc,
      url: url,
      isPartOf: { "@type": "WebSite", name: "Nostalgia Collection", url: base + "/" },
    }) + "</script>\n" +
    '  <script type="application/ld+json">' + JSON.stringify({
      "@context": "https://schema.org",
      "@type": "BreadcrumbList",
      itemListElement: [
        { "@type": "ListItem", position: 1, name: "Nostalgia Collection", item: base + "/" },
        { "@type": "ListItem", position: 2, name: "Συλλογή", item: base + "/collection" },
        { "@type": "ListItem", position: 3, name: cat.name, item: url },
      ],
    }) + "</script>\n";

  return { title, head };
}

app.get("/collection/:slug", ah(async (req, res) => {
  const catId = catalog.CAT_ID_BY_SLUG[String(req.params.slug || "")];
  if (!catId) return res.status(404).sendFile(path.join(HTML_DIR, "404.html"));

  const base = publicSiteUrl(req);
  const seo = renderCollectionSeo(base, catId);
  const html = collectionTemplate()
    .replace(/<title>[\s\S]*?<\/title>/i, "<title>" + escapeHtml(seo.title) + "</title>")
    .replace(/<\/head>/i, "  " + seo.head + "</head>")
    .replace('data-page="collection"', 'data-page="collection" data-active-cat="' + catId + '"');
  res.type("html").send(html);
}));

app.get("/review/:id", function (req, res) {
  res.sendFile(path.join(HTML_DIR, "review.html"));
});

/* Never expose server internals or repo plumbing through the static server. */
const BLOCKED = /^\/(server|node_modules|tools|html|admin|\.git|\.claude)(\/|$)|^\/package(-lock)?\.json$|^\/run-server\.cmd$/i;
app.use((req, res, next) => {
  if (BLOCKED.test(req.path)) return res.status(404).end();
  next();
});

/* Static assets (css, js, logo, images) live at ROOT; pages live under html/.
   Assets are matched first, then clean-URL pages (/checkout → html/checkout.html,
   / → html/index.html). */
app.use(express.static(ROOT, { index: false }));
app.use(
  express.static(HTML_DIR, {
    extensions: ["html"],
    index: "index.html",
  })
);

app.use((req, res) => {
  if (req.path.startsWith("/api/")) return bad(res, 404, "not_found");
  res.status(404).sendFile(path.join(HTML_DIR, "404.html"));
});

/* error handler — keep JSON shape for API consumers */
app.use((err, req, res, next) => {
  console.error("[server]", err);
  if (res.headersSent) return next(err);
  /* express.json marks an over-limit body as `entity.too.large`. Preserve
     the client error status instead of turning a safe validation rejection
     into a misleading 500. */
  if (err && (err.status === 413 || err.type === "entity.too.large")) {
    return bad(res, 413, "payload_too_large");
  }
  bad(res, 500, "server_error");
});

/* ================= STARTUP ================= */

async function ensureSecret() {
  /* .env wins; NEXTAUTH_SECRET accepted as alias (hosting convention). */
  let secret =
    process.env.SESSION_SECRET ||
    process.env.NEXTAUTH_SECRET ||
    (await db.getSetting("secret"));
  if (!secret) {
    secret = crypto.randomBytes(32).toString("hex");
    await db.setSetting("secret", secret);
  }
  security.assertStrongSessionSecret(secret);
  auth.setSecret(secret);
}

async function ensureAdmin() {
  const envUser = process.env.ADMIN_USERNAME;
  const envPass = process.env.ADMIN_PASSWORD;
  const existing = await db.getSetting("admin");

  /* When ADMIN_PASSWORD is set in .env it is the source of truth: apply it
     on every startup so credentials live only in .env, not in the panel. */
  if (envPass) {
    await db.setSetting("admin", {
      ...(existing || {}),
      username: envUser || (existing && existing.username) || "admin",
      passHash: await auth.hashPassword(envPass),
      fromEnv: true,
      createdAt: (existing && existing.createdAt) || new Date().toISOString(),
    });
    /* a plaintext credentials file is pointless when the password is in .env */
    try {
      fs.unlinkSync(path.join(db.DATA_DIR, "admin-credentials.txt"));
    } catch (e) {}
    return;
  }

  if (existing && existing.passHash) return;

  /* Production must set ADMIN_PASSWORD — never bootstrap a plaintext password
     into logs or a credentials file on a live host. */
  if (security.isProduction()) {
    throw new Error(
      "ADMIN_PASSWORD must be set in .env before the first production start"
    );
  }

  /* Local/dev only: generate once, write to a gitignored file, never echo
     the password to stdout (CodeQL clear-text logging / shared terminals). */
  const password = crypto.randomBytes(9).toString("base64url");
  const admin = {
    username: envUser || "admin",
    passHash: await auth.hashPassword(password),
    createdAt: new Date().toISOString(),
  };
  await db.setSetting("admin", admin);
  fs.mkdirSync(db.DATA_DIR, { recursive: true });
  const credPath = path.join(db.DATA_DIR, "admin-credentials.txt");
  fs.writeFileSync(
    credPath,
    "Nostalgia admin panel — http://localhost:" + PORT + ADMIN_UI_PATH + "\n" +
      "Username: " + admin.username + "\n" +
      "Password: " + password + "\n" +
      "(Change it from the admin panel → Ρυθμίσεις, or set ADMIN_PASSWORD in .env.\n" +
      " Delete this file afterwards.)\n",
    "utf8"
  );
  console.log("=".repeat(56));
  console.log("  Admin panel created: " + ADMIN_UI_PATH);
  console.log("  Username: " + admin.username);
  console.log("  Password written to server/data/admin-credentials.txt");
  console.log("  (gitignored — set ADMIN_PASSWORD in .env for production)");
  console.log("=".repeat(56));
}

let initializationPromise = null;

function initialize() {
  if (!initializationPromise) {
    initializationPromise = (async () => {
      await db.init();
      await ensureSecret();
      await ensureAdmin();
      if (mailer.emailConfigured()) {
        processQueuedCampaigns(10).catch((error) => console.error("[marketing-campaign] startup recovery failed:", error.message));
      }
    })();
  }
  return initializationPromise;
}

async function main() {
  await initialize();
  const server = app.listen(PORT, () => {
    console.log("Nostalgia site + API:  http://localhost:" + PORT);
    console.log("Admin panel (hidden):  http://localhost:" + PORT + ADMIN_UI_PATH + "/");
    console.log("Database:              PostgreSQL");
    console.log("");
    console.log("Server is running — keep this window open (Ctrl+C to stop).");
  });
  server.on("error", function (err) {
    if (err && err.code === "EADDRINUSE") {
      console.error("Port " + PORT + " is already in use. Close the other server first.");
    } else {
      console.error("Server error:", err.message || err);
    }
    process.exit(1);
  });
  installGracefulShutdown(server);
  /* Some Windows terminals close stdin and Node exits — keep the process alive. */
  if (process.stdin && typeof process.stdin.resume === "function") {
    process.stdin.resume();
  }
}

/**
 * Stop accepting new connections, let in-flight requests finish, then close the
 * database pools before exiting. Without this a deploy/restart kills requests
 * mid-flight — a checkout could take payment yet never persist its order.
 * Falls back to a hard exit if something hangs past the grace period.
 */
function installGracefulShutdown(server) {
  const GRACE_MS = parseInt(process.env.SHUTDOWN_GRACE_MS, 10) || 10000;
  let shuttingDown = false;

  async function shutdown(signal) {
    if (shuttingDown) return; // a second Ctrl+C shouldn't re-enter
    shuttingDown = true;
    console.log("\n" + signal + " received — finishing active requests…");

    /* Hard limit: if a request or the pool hangs, still exit rather than
       leaving the process (and its port) stuck forever. */
    const killer = setTimeout(() => {
      console.error("Grace period expired — forcing exit.");
      process.exit(1);
    }, GRACE_MS);
    killer.unref();

    try {
      await new Promise((resolve) => server.close(resolve));
      await db.close();
      console.log("Shutdown complete.");
      process.exit(0);
    } catch (err) {
      console.error("Shutdown error:", (err && err.message) || err);
      process.exit(1);
    }
  }

  process.on("SIGTERM", () => shutdown("SIGTERM")); // systemd / VPS restart
  process.on("SIGINT", () => shutdown("SIGINT")); // Ctrl+C
}

if (require.main === module) main().catch((err) => {
  console.error("Failed to start:", err.message);
  console.error(
    "Is PostgreSQL running? Connection: host=%s port=%s user=%s db=%s",
    process.env.PGHOST || "localhost",
    process.env.PGPORT || 5432,
    process.env.PGUSER || "postgres",
    process.env.PGDATABASE || "nostalgia"
  );
  process.exit(1);
});

module.exports = { app, initialize };
