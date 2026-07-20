"use strict";

/**
 * Secret URL path for the React admin UI (not the /api/admin JSON API).
 * Set ADMIN_UI_PATH in .env, e.g. /ni-ops-k7m2xq9p
 */

const FALLBACK = "/admin-react";
const RESERVED = new Set([
  "/api",
  "/admin",
  "/assets",
  "/collection",
  "/cart",
  "/checkout",
  "/account",
  "/contact",
  "/about",
  "/product",
  "/wishlist",
  "/reviews",
]);

function normalizeAdminUiPath(raw) {
  let p = String(raw == null || raw === "" ? FALLBACK : raw).trim();
  if (!p.startsWith("/")) p = "/" + p;
  p = p.replace(/\/+$/, "");
  if (!/^\/[a-zA-Z0-9][a-zA-Z0-9_-]{2,63}$/.test(p)) {
    console.warn("[admin] ADMIN_UI_PATH invalid (" + raw + "), using " + FALLBACK);
    return FALLBACK;
  }
  if (RESERVED.has(p)) {
    console.warn("[admin] ADMIN_UI_PATH reserved (" + p + "), using " + FALLBACK);
    return FALLBACK;
  }
  return p;
}

const ADMIN_UI_PATH = normalizeAdminUiPath(process.env.ADMIN_UI_PATH);

function escapeRegex(s) {
  return String(s).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/** Match /secret, /secret/, /secret/anything */
function adminUiPathRegex() {
  return new RegExp("^" + escapeRegex(ADMIN_UI_PATH) + "(?:/.*)?$");
}

function isAdminUiAssetPath(pathname) {
  return String(pathname || "").startsWith(ADMIN_UI_PATH + "/assets/");
}

module.exports = {
  ADMIN_UI_PATH,
  FALLBACK,
  normalizeAdminUiPath,
  adminUiPathRegex,
  isAdminUiAssetPath,
};
