"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const source = fs.readFileSync(path.join(__dirname, "..", "js", "product.js"), "utf8");

test("desktop related carousel contains more products than its four-card viewport", () => {
  const limit = Number(source.match(/RELATED_PRODUCT_LIMIT\s*=\s*(\d+)/)?.[1]);

  assert.ok(limit > 4, "Related product limit must exceed the four-card desktop viewport");
  assert.match(source, /\.slice\(0,\s*RELATED_PRODUCT_LIMIT\)/);
  assert.match(source, /return\s+4;/);
});
