"use strict";

/**
 * Server-side mirror of the product catalog (js/products.js).
 * Per-product titles are empty in the site's i18n, so products are
 * identified as "<category name> · <index>" — same as the storefront.
 */

const CATEGORIES = {
  cat1: { name: "Art Class Murano Candle", count: 12 },
  cat2: { name: "Driftwood Beeswax Flame", count: 13 },
  cat3: { name: "Liquid Eternal", count: 7 },
  cat4: { name: "Vintage Unique Objects", count: 8 },
  cat5: { name: "NI Terra", count: 4 },
  cat6: { name: "Perfume", count: 0 },
  cat7: { name: "Diffusers", count: 0 },
  cat8: { name: "Gift Sets", count: 3 },
  cat9: { name: "Nostalgia Exclusive Mirror Candles", count: 8 },
};

/* Crawlable, human-readable URL per category — /collection/:slug — instead
   of the old #cat1 hash (which Google never indexes as a separate page). */
const CATEGORY_SLUGS = {
  cat1: "art-class-murano-candle",
  cat2: "driftwood-beeswax-flame",
  cat3: "liquid-eternal",
  cat4: "vintage-unique-objects",
  cat5: "ni-terra",
  cat6: "perfume",
  cat7: "diffusers",
  cat8: "gift-sets",
  cat9: "mirror-candles",
};
const CAT_ID_BY_SLUG = {};
Object.keys(CATEGORY_SLUGS).forEach((catId) => {
  CAT_ID_BY_SLUG[CATEGORY_SLUGS[catId]] = catId;
});

/* Default limited stock — matches LIMITED_STOCK in js/products.js */
const DEFAULT_STOCK = {
  "cat1-1": 4,
  "cat1-3": 4,
  "cat4-2": 4,
  "cat5-1": 4,
};

const MURANO_DIR = "images/product%20photo/art%20class%20murano%20candle/";
const GIFT_DIR = "images/product%20photo/Gift%20Sets/";
const MIRROR_DIR = "images/product%20photo/Nostalgia%20Exclusive%20Mirror%20Candles/";
/* Mirror candles: each colour is its own product (own price/stock). */
const MIRROR_VARIANTS = [
  { folder: "Mirror%20Candles-asimi", label: "Ασημί" },
  { folder: "Mirror%20Candles-aspro", label: "Λευκό" },
  { folder: "Mirror%20Candles-galazio", label: "Γαλάζιο" },
  { folder: "Mirror%20Candles-kokkino", label: "Κόκκινο" },
  { folder: "Mirror%20Candles-mauro", label: "Μαύρο" },
  { folder: "Mirror%20Candles-prasino", label: "Πράσινο" },
  { folder: "Mirror%20Candles-asimi-Large", label: "Large Ασημί" },
  { folder: "Mirror%20Candles-xriso-Large", label: "Large Χρυσό" },
];
/* Main (thumbnail) image of a product folder — mirrors js/products.js. */
function folderMain(folder) {
  return folder + "/photo1.png";
}
function driftwoodImg(name) {
  return "images/product%20photo/driftwood%20beeswax%20flame/" + name;
}
function liquidImg(n) {
  return "images/product%20photo/liquid%20eternal/product%20" + n + ".png";
}
function vesselImg(n) {
  return "images/product%20photo/unique%20art%20vessel/product%20" + n + ".png";
}
function terraImg(n) {
  return "images/product%20photo/Ni%20Terra/product%20" + n + ".png";
}

const CAT_IMAGES = {
  cat1: [
    "murano-aspro",
    "murano-aspro-mob",
    "murano-mauro",
    "murano%20kokkino",
    "murano-kokkino-anoixto",
    "murano-mple",
    "murano-flut-mple",
    "murano-flut-kitrino",
    "murano-galazio",
    "murano-pardalo",
    "murano-pardalo-anoixto",
    "murano-pardalo-skouro",
  ].map((f) => folderMain(MURANO_DIR + f)),
  cat2: [
    "product%201.png",
    "product%202.png",
    "product%203.png",
    "product%204%20.png",
    "product%205.png",
    "product%206%20.png",
    "product%207.png",
    "product%208.png",
    "product%209.png",
    "product%2010.png",
    "product%2011.png",
    "product%2012.png",
    "product%2013.png",
  ].map(driftwoodImg),
  cat3: Array.from({ length: 7 }, (_, i) =>
    folderMain("images/product%20photo/liquid%20eternal/liquid-" + (i + 1))
  ),
  cat4: Array.from({ length: 8 }, (_, i) => vesselImg(i + 1)),
  cat5: Array.from({ length: 4 }, (_, i) => terraImg(i + 1)),
  cat6: [],
  cat7: [],
  cat8: ["gift-set1", "gift-set2", "gift-set3"].map((f) => folderMain(GIFT_DIR + f)),
  cat9: MIRROR_VARIANTS.map((v) => folderMain(MIRROR_DIR + v.folder)),
};

/* Per-colour title suffix for the mirror candles (cat9). */
const CAT9_LABELS = MIRROR_VARIANTS.map((v) => v.label);

function buildCatalog() {
  const list = [];
  Object.keys(CATEGORIES).forEach((catId) => {
    const cat = CATEGORIES[catId];
    for (let i = 1; i <= cat.count; i++) {
      const suffix = catId === "cat9" && CAT9_LABELS[i - 1] ? CAT9_LABELS[i - 1] : i;
      list.push({
        id: catId + "-" + i,
        catId,
        index: i,
        category: cat.name,
        title: cat.name + " · " + suffix,
        image: (CAT_IMAGES[catId] || [])[i - 1] || null,
      });
    }
  });
  return list;
}

const PRODUCTS = buildCatalog();
const PRODUCT_IDS = new Set(PRODUCTS.map((p) => p.id));

module.exports = { CATEGORIES, DEFAULT_STOCK, PRODUCTS, PRODUCT_IDS, CATEGORY_SLUGS, CAT_ID_BY_SLUG };
