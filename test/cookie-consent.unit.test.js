"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const vm = require("node:vm");

function loadCookies(stored) {
  const storage = new Map();
  if (stored) storage.set("nostalgia-cookie-consent", JSON.stringify(stored));
  const window = { setTimeout() {}, location: { reload() {} } };
  const context = {
    window,
    localStorage: {
      getItem(key) { return storage.get(key) || null; },
      setItem(key, value) { storage.set(key, value); },
    },
    document: { readyState: "loading", addEventListener() {}, dispatchEvent() {} },
    CustomEvent: function CustomEvent() {},
    Date,
    JSON,
  };
  vm.runInNewContext(fs.readFileSync(path.join(__dirname, "..", "js", "cookies.js"), "utf8"),
    context);
  return window.NostalgiaCookies;
}

test("expired consent is treated as no consent", () => {
  const expired = loadCookies({ analytics: true, marketing: true,
    timestamp: Date.now() - 366 * 24 * 60 * 60 * 1000 });
  assert.equal(expired.readConsent(), null);
});

test("valid consent preserves independent analytics and marketing choices", () => {
  const current = loadCookies({ essential: true, analytics: true, marketing: false,
    timestamp: Date.now() });
  assert.equal(current.readConsent().analytics, true);
  assert.equal(current.readConsent().marketing, false);
});
