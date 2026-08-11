"use strict";

const { test } = require("node:test");
const assert = require("node:assert");
const { loadBrowserScript } = require("./helpers/browser-env");

/* i18n stub: category names for collection_catN, key passthrough otherwise. */
function makeI18n() {
  return {
    t(key) {
      const m = /^collection_(cat\d+)$/.exec(key);
      if (m) return "Category " + m[1].slice(3);
      return key;
    },
  };
}

function loadProducts() {
  const win = loadBrowserScript("js/products.js", { NostalgiaI18n: makeI18n() });
  return win.NostalgiaProducts;
}

test("exposes the NostalgiaProducts API", () => {
  const P = loadProducts();
  assert.equal(typeof P.getAll, "function");
  assert.equal(typeof P.getById, "function");
  assert.equal(typeof P.isOnSale, "function");
});

test("cat9 built-in colour variants link into 6 + 2 groups", () => {
  const P = loadProducts();
  const c9 = P.getAll().filter((p) => p.catId === "cat9");
  assert.equal(c9.length, 8);
  // first 6 = the "mirror" group (6 swatches each)
  for (let i = 0; i < 6; i++) {
    assert.equal((c9[i].variantGroup || []).length, 6, c9[i].id);
    assert.ok(c9[i].variantLabel, `${c9[i].id} has a colour label`);
  }
  // last 2 = the "mirror-large" group (2 swatches each)
  for (let i = 6; i < 8; i++) {
    assert.equal((c9[i].variantGroup || []).length, 2, c9[i].id);
  }
});

test("swatch entries carry id, label and hex", () => {
  const P = loadProducts();
  const p = P.getById("cat9-1");
  assert.ok(Array.isArray(p.variantGroup) && p.variantGroup.length === 6);
  p.variantGroup.forEach((v) => {
    assert.ok(v.id && /^cat9-\d+$/.test(v.id));
    assert.ok(v.label);
    assert.match(v.hex, /^#[0-9a-fA-F]{3,8}$/);
  });
});

test("admin-declared variantGroup links otherwise-unrelated products", () => {
  const P = loadProducts();
  const a = P.getById("cat3-1");
  const b = P.getById("cat3-2");
  const c = P.getById("cat3-3");
  a.details = { variantGroup: "eternal-x", variantColor: "Κόκκινο", variantColorHex: "#b0342c" };
  b.details = { variantGroup: "eternal-x", variantColor: "Μπλε", variantColorHex: "#2b4a7a" };
  P.refresh();
  assert.equal((P.getById("cat3-1").variantGroup || []).length, 2);
  assert.equal((P.getById("cat3-2").variantGroup || []).length, 2);
  assert.equal(P.getById("cat3-1").variantLabel, "Κόκκινο");
  // an unrelated product stays ungrouped
  assert.equal(P.getById("cat3-3").variantGroup, null);
});

test("a lone variantGroup member is NOT treated as a group", () => {
  const P = loadProducts();
  const a = P.getById("cat3-1");
  a.details = { variantGroup: "solo", variantColor: "Μόνο", variantColorHex: "#123456" };
  P.refresh();
  assert.equal(P.getById("cat3-1").variantGroup, null);
});

test("sale helpers: isOnSale / discountPercent / getEffectivePrice", () => {
  const P = loadProducts();
  const onSale = { price: 100, salePrice: 75 };
  const notSale = { price: 100, salePrice: null };
  const badSale = { price: 100, salePrice: 150 };
  assert.equal(P.isOnSale(onSale), true);
  assert.equal(P.isOnSale(notSale), false);
  assert.equal(P.isOnSale(badSale), false);
  assert.equal(P.discountPercent(onSale), 25);
  assert.equal(P.discountPercent({ price: 100, salePrice: 75, priorPrice: 80 }), 6);
  assert.equal(P.discountPercent({ price: 100, salePrice: 75, priorPrice: 70 }), 0);
  assert.equal(P.getEffectivePrice(onSale), 75);
  assert.equal(P.getEffectivePrice(notSale), 100);
});

test("applyServerProducts merges a custom product with a multi-image gallery", () => {
  const P = loadProducts();
  P.applyServerProducts([
    {
      id: "cu-1",
      catId: "cat1",
      title: "Custom",
      price: 40,
      image: "images/product%20photo/uploads/cu-1.png",
      images: [
        "images/product%20photo/uploads/cu-1.png",
        "images/product%20photo/uploads/cu-1-2.png",
        "images/product%20photo/uploads/cu-1-3.png",
      ],
    },
  ]);
  const cu = P.getById("cu-1");
  assert.ok(cu);
  assert.equal(cu.images.length, 3);
  assert.equal(cu.image, "images/product%20photo/uploads/cu-1.png");
});
