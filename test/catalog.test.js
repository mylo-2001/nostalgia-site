"use strict";

const { test } = require("node:test");
const assert = require("node:assert");
const fs = require("fs");
const path = require("path");

const catalog = require("../server/catalog.js");
const ROOT = path.join(__dirname, "..");

test("catalog exports the expected shape", () => {
  assert.ok(catalog.CATEGORIES && typeof catalog.CATEGORIES === "object");
  assert.ok(Array.isArray(catalog.PRODUCTS));
  assert.ok(catalog.PRODUCT_IDS instanceof Set);
  assert.ok(catalog.PRODUCTS.length > 0);
});

test("each category's product count matches its declared count", () => {
  const counts = {};
  catalog.PRODUCTS.forEach((p) => {
    counts[p.catId] = (counts[p.catId] || 0) + 1;
  });
  Object.keys(catalog.CATEGORIES).forEach((cid) => {
    assert.equal(
      counts[cid] || 0,
      catalog.CATEGORIES[cid].count,
      `${cid} should have ${catalog.CATEGORIES[cid].count} products`
    );
  });
});

test("cat9 (Mirror Candles) has 8 colour products", () => {
  const c9 = catalog.PRODUCTS.filter((p) => p.catId === "cat9");
  assert.equal(c9.length, 8);
});

test("product ids are unique and present in PRODUCT_IDS", () => {
  const seen = new Set();
  catalog.PRODUCTS.forEach((p) => {
    assert.ok(!seen.has(p.id), `duplicate id ${p.id}`);
    seen.add(p.id);
    assert.ok(catalog.PRODUCT_IDS.has(p.id), `${p.id} missing from PRODUCT_IDS`);
  });
});

test("every product has a non-empty title and category", () => {
  catalog.PRODUCTS.forEach((p) => {
    assert.ok(p.title && p.title.trim(), `${p.id} has empty title`);
    assert.ok(p.category && p.category.trim(), `${p.id} has empty category`);
  });
});

test("every product image file exists on disk", () => {
  const missing = [];
  catalog.PRODUCTS.forEach((p) => {
    if (!p.image) return;
    const rel = decodeURIComponent(p.image);
    if (!fs.existsSync(path.join(ROOT, rel))) missing.push(`${p.id} -> ${rel}`);
  });
  assert.deepEqual(missing, [], `missing image files:\n${missing.join("\n")}`);
});

test("cat9 titles carry a colour label (·  suffix)", () => {
  const c9 = catalog.PRODUCTS.filter((p) => p.catId === "cat9");
  c9.forEach((p) => assert.match(p.title, /·\s*\S+/, `${p.id} title has no colour`));
});
