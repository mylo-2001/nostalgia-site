"use strict";

const { test } = require("node:test");
const assert = require("node:assert");
const { loadBrowserScript } = require("./helpers/browser-env");

function loadImages() {
  return loadBrowserScript("js/images.js").NostalgiaImages;
}

test("exposes the NostalgiaImages API", () => {
  const I = loadImages();
  assert.equal(typeof I.webp, "function");
  assert.equal(typeof I.hasDerivatives, "function");
});

test("webp() builds a responsive -Nw.webp path for catalog PNGs", () => {
  const I = loadImages();
  const out = I.webp("images/product%20photo/art/photo1.png", 960);
  assert.match(out, /photo1-960w\.webp$/);
  // spaces stay percent-encoded
  assert.ok(out.indexOf(" ") === -1);
});

test("hasDerivatives() is TRUE for built-in catalog images", () => {
  const I = loadImages();
  assert.equal(I.hasDerivatives("images/product%20photo/art%20class/photo1.png"), true);
});

test("hasDerivatives() is FALSE for admin uploads (no pre-built webp)", () => {
  const I = loadImages();
  assert.equal(I.hasDerivatives("images/product%20photo/uploads/cu-5.png"), false);
});

test("hasDerivatives() is FALSE for absolute / CDN URLs", () => {
  const I = loadImages();
  assert.equal(I.hasDerivatives("https://res.cloudinary.com/x/cu-5.png"), false);
  assert.equal(I.hasDerivatives("http://example.com/a.png"), false);
});
