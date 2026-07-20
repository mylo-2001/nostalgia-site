"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const root = path.join(__dirname, "..");

test("checkout required controls have labels and an announced submission state", () => {
  const html = fs.readFileSync(path.join(root, "html", "checkout.html"), "utf8");
  const requiredTags = html.match(/<(?:input|select|textarea)\b[^>]*\brequired\b[^>]*>/gi) || [];
  for (const tag of requiredTags) {
    const id = tag.match(/\bid="([^"]+)"/i)?.[1];
    if (!id) continue; // Radio controls are wrapped by their visible label.
    assert.match(html, new RegExp(`<label\\b[^>]*for="${id}"`, "i"),
      `Missing label for required checkout control: ${id}`);
  }
  assert.match(html, /id="checkout-submit-status"[^>]*role="status"[^>]*aria-live="polite"/i);
  assert.match(html, /id="checkout-cta"/i);
  assert.ok(html.indexOf("js/checkout-v2.js") < html.indexOf("js/checkout.js"),
    "Checkout V2 must initialize before the checkout controller");
});

test("checkout has visible keyboard focus and payment-obligation copy", () => {
  const css = fs.readFileSync(path.join(root, "css", "shop.css"), "utf8");
  const translations = fs.readFileSync(path.join(root, "js", "i18n-bundles", "shop.js"), "utf8");
  assert.match(css, /\.btn-shop:focus-visible\s*\{[^}]*outline:/s);
  assert.match(css, /\.checkout-option input:focus-visible/);
  assert.match(translations, /checkout_submit:\s*"Παραγγελία με υποχρέωση πληρωμής"/);
  assert.match(translations, /checkout_submit:\s*"Place order with obligation to pay"/);
});

test("V2 checkout payload contains identifiers and choices, never browser totals", () => {
  const source = fs.readFileSync(path.join(root, "js", "checkout-v2.js"), "utf8");
  const start = source.indexOf("function productLines");
  const end = source.indexOf("function storageGet", start);
  const payload = source.slice(start, end);
  assert.ok(start >= 0 && end > start);
  for (const forbidden of ["grandTotal", "subtotal", "discountTotal", "shippingTotal",
    "codFee", "vatTotal", "unitPrice"]) {
    assert.equal(payload.includes(forbidden), false, `Browser payload includes ${forbidden}`);
  }
  assert.match(payload, /productId/);
  assert.match(payload, /variantId/);
  assert.match(payload, /shippingMethodId/);
  assert.match(payload, /paymentMethod/);
});
