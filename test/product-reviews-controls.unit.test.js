"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const root = path.join(__dirname, "..");

test("hidden product-review controls stay out of layout", () => {
  const css = fs.readFileSync(path.join(root, "css", "shop.css"), "utf8");
  const source = fs.readFileSync(path.join(root, "js", "product.js"), "utf8");

  assert.match(css, /\.product-reviews\s+\[hidden\]\s*\{[^}]*display:\s*none\s*!important/s);
  assert.match(source, /id="product-review-form" hidden/);
  assert.match(source, /id="review-show-more" hidden/);
  assert.match(source, /form\.hidden\s*=\s*true/);
  assert.match(source, /showMore\.hidden\s*=\s*reviews\.length\s*>=\s*summary\.total/);
});
