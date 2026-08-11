"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

function read(relativePath) {
  return fs.readFileSync(path.join(__dirname, "..", relativePath), "utf8");
}

test("price history is persisted and reconciled across catalog and checkout resolution", () => {
  const migration = read("server/migrations/043_price_history.up.sql");
  const db = read("server/db.js");
  const server = read("server/server.js");
  assert.match(migration, /CREATE TABLE IF NOT EXISTS product_price_history/);
  assert.match(migration, /WHERE valid_to IS NULL/);
  assert.match(db, /pg_advisory_xact_lock/);
  assert.match(db, /MIN\(price\)::numeric AS prior_price/);
  assert.match(server, /await db\.reconcilePriceHistory\(priceObservations, ctx\.now\)/);
  assert.match(server, /await observeResolvedProductPrice\(product, ctx\.now\)/);
  assert.match(server, /price-history\?days=90|\/price-history/);
});

test("storefront uses priorPrice for discount claims and hides invalid comparisons", () => {
  const products = read("js/products.js");
  const product = read("js/product.js");
  const collection = read("js/collection.js");
  assert.match(products, /p\.priorPrice != null \? Number\(p\.priorPrice\)/);
  assert.match(products, /reference > Number\(p\.salePrice\)/);
  assert.match(product, /Χαμηλότερη τιμή προηγούμενων 30 ημερών/);
  assert.match(product, /if \(!\(reference > current\)\)/);
  assert.match(collection, /if \(discount > 0\)/);
});

test("admin exposes auditable price periods for products and variants", () => {
  const panel = read("admin/src/components/PriceHistory.tsx");
  const products = read("admin/src/pages/Products.tsx");
  const variants = read("admin/src/components/ProductVariants.tsx");
  assert.match(panel, /Ιστορικό τιμών/);
  assert.match(panel, /price-history\?days=90/);
  assert.match(products, /<PriceHistory itemId=\{p\.id\}/);
  assert.match(variants, /<PriceHistory itemId=\{variant\.id\}/);
});

