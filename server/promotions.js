"use strict";

/**
 * Promotions engine — pure computation, no DB access (mirrors fees.js).
 * Coexists with the legacy per-product manual sale_price/sale_until: at read
 * time the caller picks whichever discount source gives the lower price
 * ("best discount wins"). See server/server.js for the DB-backed wiring
 * (active-promotions cache, HTTP routes) and server/db.js for the SQL.
 *
 * A "resolved" promotion (as loaded from the DB for pricing) looks like:
 *   {
 *     id, name, discountType, discountValue, maxDiscountPerProduct,
 *     status, startsAt, endsAt, priority,
 *     targets: [{ type: 'product'|'category'|'all_products', id: string|null }],
 *     exclusions: [{ type: 'product'|'new_products', id: string|null }],
 *   }
 */

const NEW_PRODUCT_WINDOW_MS = 30 * 24 * 60 * 60 * 1000; // 30 days — matches js/products.js NEW_WINDOW_DAYS

/** A promotion's admin-chosen `status` is authoritative for draft / paused /
 *  cancelled (manual states); scheduled / active / expired are DERIVED from
 *  the current time against starts_at/ends_at whenever status itself is
 *  'scheduled' or 'active' (i.e. "the admin has turned this on"). */
function effectiveStatus(promo, now) {
  now = now || new Date();
  if (!promo) return "draft";
  if (promo.status === "draft" || promo.status === "paused" || promo.status === "cancelled") {
    return promo.status;
  }
  if (promo.startsAt && now < new Date(promo.startsAt)) return "scheduled";
  if (promo.endsAt && now > new Date(promo.endsAt)) return "expired";
  return "active";
}

function isLive(promo, now) {
  return effectiveStatus(promo, now) === "active";
}

/** Custom (admin-created) products carry a real createdAt; the static
 *  catalog never does, so static products can never be "new" — matching the
 *  existing storefront convention in js/products.js. */
function productIsNew(product, now) {
  if (!product || !product.createdAt) return false;
  const created = new Date(product.createdAt).getTime();
  if (Number.isNaN(created)) return false;
  return (now || Date.now()) - created <= NEW_PRODUCT_WINDOW_MS;
}

function targetsMatch(promo, product) {
  return (promo.targets || []).some((t) => {
    if (t.type === "all_products") return true;
    if (t.type === "category") return t.id === product.catId;
    if (t.type === "product") return t.id === product.id;
    return false;
  });
}

function isExcluded(promo, product, now) {
  return (promo.exclusions || []).some((e) => {
    if (e.type === "product") return e.id === product.id;
    if (e.type === "new_products") return productIsNew(product, now);
    return false;
  });
}

/** Computes the price a promotion would produce for a product, or `null` if
 *  the promotion doesn't actually reduce the price (e.g. a fixed_sale_price
 *  at/above the regular price — never allowed to raise it). */
function discountedPrice(promo, regularPrice) {
  const regular = Number(regularPrice);
  if (!(regular > 0)) return null;
  const value = Number(promo.discountValue);
  if (!(value > 0)) return null;

  let price;
  if (promo.discountType === "percentage") {
    const cap = promo.maxDiscountPerProduct != null ? Number(promo.maxDiscountPerProduct) : null;
    let amount = round2((regular * value) / 100);
    if (cap != null && amount > cap) amount = cap;
    price = round2(regular - amount);
  } else if (promo.discountType === "fixed_amount") {
    price = round2(regular - value);
  } else if (promo.discountType === "fixed_sale_price") {
    price = round2(value);
  } else {
    return null;
  }

  if (!(price < regular) || price < 0) return null;
  return price;
}

function round2(n) {
  return Math.round((Number(n) + Number.EPSILON) * 100) / 100;
}

/** Finds the single best (lowest-price) LIVE promotion applicable to a
 *  product, honouring targets/exclusions. Ties broken by higher `priority`,
 *  then by lower `id` (stable/deterministic). Only one promotion ever wins —
 *  promotions never stack with each other. Returns null if none apply. */
function bestPromotionForProduct(promotions, product, regularPrice, now) {
  now = now || new Date();
  let best = null; // { promotion, price }
  for (const promo of promotions || []) {
    if (!isLive(promo, now)) continue;
    if (!targetsMatch(promo, product)) continue;
    if (isExcluded(promo, product, now)) continue;
    const price = discountedPrice(promo, regularPrice);
    if (price == null) continue;
    if (
      !best ||
      price < best.price ||
      (price === best.price && promo.priority > best.promotion.priority) ||
      (price === best.price && promo.priority === best.promotion.priority && promo.id < best.promotion.id)
    ) {
      best = { promotion: promo, price };
    }
  }
  return best;
}

/** Combines the legacy manual sale (already computed elsewhere) with the
 *  promotions engine and returns whichever gives the lower price, plus
 *  attribution for order-line snapshots. `manualPrice` should already be the
 *  regular price when no manual sale is active (i.e. the existing
 *  effectivePrice() result). */
function resolveFinalPrice(promotions, product, regularPrice, manualPrice, now) {
  now = now || new Date();
  const best = bestPromotionForProduct(promotions, product, regularPrice, now);
  const manualIsCheaper = manualPrice < regularPrice;

  if (best && best.price < manualPrice) {
    return {
      price: best.price,
      source: "promotion",
      promotion: {
        id: best.promotion.id,
        name: best.promotion.name,
        discountType: best.promotion.discountType,
        discountValue: best.promotion.discountValue,
        discountAmount: round2(regularPrice - best.price),
        startsAt: best.promotion.startsAt || null,
        endsAt: best.promotion.endsAt || null,
      },
    };
  }
  if (manualIsCheaper) {
    return { price: manualPrice, source: "manual", promotion: null };
  }
  return { price: regularPrice, source: null, promotion: null };
}

/** Confirmation gate for turning a promotion on (draft/paused → active or
 *  scheduled): large blast radius or a steep percentage both require the
 *  admin to explicitly confirm. */
const LARGE_PROMOTION_PRODUCT_THRESHOLD = 20;
const HIGH_DISCOUNT_PERCENT_THRESHOLD = 50;

function requiresConfirmation(promo, matchedProductCount) {
  if (matchedProductCount > LARGE_PROMOTION_PRODUCT_THRESHOLD) return true;
  if (promo.discountType === "percentage" && Number(promo.discountValue) >= HIGH_DISCOUNT_PERCENT_THRESHOLD) {
    return true;
  }
  return false;
}

/** Computes the full admin preview for a (possibly not-yet-saved) promotion
 *  definition against the current catalog: matched product count, exclusion
 *  breakdown, resulting price range, and how many matched products would
 *  actually keep being served by a DIFFERENT, better-or-equal promotion
 *  (`otherLivePromotions` should already exclude the promotion being edited).
 *  `allProducts`: [{ id, catId, createdAt, title, regularPrice }]. */
function computePromotionPreview(draftPromo, allProducts, otherLivePromotions, now) {
  now = now || new Date();
  const newProductsExcluded = (draftPromo.exclusions || []).some((e) => e.type === "new_products");
  const productExcludedIds = new Set(
    (draftPromo.exclusions || []).filter((e) => e.type === "product").map((e) => e.id)
  );
  let excludedNewCount = 0;
  let excludedProductCount = 0;
  let minPrice = null;
  let maxPrice = null;
  const rows = [];

  for (const product of allProducts || []) {
    if (!targetsMatch(draftPromo, product)) continue;
    if (newProductsExcluded && productIsNew(product, now)) { excludedNewCount++; continue; }
    if (productExcludedIds.has(product.id)) { excludedProductCount++; continue; }
    const newPrice = discountedPrice(draftPromo, product.regularPrice);
    if (newPrice == null) continue;
    if (minPrice == null || newPrice < minPrice) minPrice = newPrice;
    if (maxPrice == null || newPrice > maxPrice) maxPrice = newPrice;
    const currentBest = bestPromotionForProduct(otherLivePromotions, product, product.regularPrice, now);
    const conflict = !!(currentBest && currentBest.price <= newPrice);
    rows.push({
      id: product.id,
      title: product.title,
      regularPrice: product.regularPrice,
      newPrice,
      currentPromotionName: currentBest ? currentBest.promotion.name : null,
      conflict,
    });
  }

  return {
    matchedCount: rows.length,
    excludedNewCount,
    excludedProductCount,
    priceRange: rows.length ? { min: minPrice, max: maxPrice } : null,
    conflictCount: rows.filter((r) => r.conflict).length,
    rows,
  };
}

/** Human-readable summary of what a promotion targets, for the admin list. */
function describeTargets(targets) {
  const list = targets || [];
  if (list.some((t) => t.type === "all_products")) return "Όλα τα προϊόντα";
  const cats = list.filter((t) => t.type === "category").length;
  const prods = list.filter((t) => t.type === "product").length;
  const parts = [];
  if (cats) parts.push(cats === 1 ? "1 κατηγορία" : cats + " κατηγορίες");
  if (prods) parts.push(prods === 1 ? "1 προϊόν" : prods + " προϊόντα");
  return parts.join(" · ") || "—";
}

module.exports = {
  NEW_PRODUCT_WINDOW_MS,
  effectiveStatus,
  isLive,
  productIsNew,
  targetsMatch,
  isExcluded,
  discountedPrice,
  bestPromotionForProduct,
  resolveFinalPrice,
  requiresConfirmation,
  computePromotionPreview,
  describeTargets,
  LARGE_PROMOTION_PRODUCT_THRESHOLD,
  HIGH_DISCOUNT_PERCENT_THRESHOLD,
};
