"use strict";

const assert = require("node:assert/strict");
const test = require("node:test");

const originalMfaRequirement = process.env.ADMIN_2FA_REQUIRED;
process.env.ADMIN_2FA_REQUIRED = "false";

const auth = require("../server/auth");
const db = require("../server/db");
const { app } = require("../server/server");

function adminCookie() {
  const cookies = [];
  auth.startAdminSession({
    append(name, value) { cookies.push([name, value]); },
  }, "admin", { mfaVerified: false });
  return cookies[0][1].split(";")[0];
}

async function jsonRequest(url, method, cookie, body) {
  const response = await fetch(url, {
    method,
    headers: { "Content-Type": "application/json", Cookie: cookie },
    body: JSON.stringify(body),
  });
  return { response, body: await response.json() };
}

test("variant admin API validates identity fields and stores independent commercial data", async () => {
  auth.setSecret("product-variant-unit-secret-that-is-long-enough");
  const originals = {
    variantColorExists: db.variantColorExists,
    variantSkuExists: db.variantSkuExists,
    nextVariantId: db.nextVariantId,
    createVariant: db.createVariant,
    getVariant: db.getVariant,
    updateVariant: db.updateVariant,
    logEvent: db.logEvent,
  };
  const server = app.listen(0, "127.0.0.1");
  await new Promise((resolve) => server.once("listening", resolve));
  const { port } = server.address();
  const endpoint = `http://127.0.0.1:${port}`;
  const cookie = adminCookie();

  try {
    db.variantColorExists = async () => false;
    db.variantSkuExists = async () => false;
    db.logEvent = async () => {};

    let result = await jsonRequest(
      `${endpoint}/api/admin/products/cat1-1/variants`,
      "POST",
      cookie,
      { color: "Κόκκινο", price: "42.50", stock: "4" }
    );
    assert.equal(result.response.status, 400);
    assert.equal(result.body.error, "missing_sku");

    db.variantSkuExists = async () => true;
    result = await jsonRequest(
      `${endpoint}/api/admin/products/cat1-1/variants`,
      "POST",
      cookie,
      { color: "Κόκκινο", sku: "CANDLE-RED", price: "42.50", stock: "4" }
    );
    assert.equal(result.response.status, 409);
    assert.equal(result.body.error, "variant_sku_exists");

    let created = null;
    db.variantSkuExists = async () => false;
    db.nextVariantId = async () => "pv-test";
    db.createVariant = async (variant) => {
      created = variant;
      return variant;
    };
    result = await jsonRequest(
      `${endpoint}/api/admin/products/cat1-1/variants`,
      "POST",
      cookie,
      {
        color: "Κόκκινο",
        colorEn: "Red",
        colorHex: "#b0342c",
        sku: "CANDLE-RED",
        price: "42.50",
        stock: "4",
        available: true,
      }
    );
    assert.equal(result.response.status, 200);
    assert.equal(result.body.ok, true);
    assert.equal(created.id, "pv-test");
    assert.equal(created.productId, "cat1-1");
    assert.equal(created.sku, "CANDLE-RED");
    assert.equal(created.price, 42.5);
    assert.equal(created.stock, 4);

    db.getVariant = async () => ({
      id: "pv-test",
      productId: "cat1-1",
      color: "Κόκκινο",
      sku: "CANDLE-RED",
      price: 42.5,
      salePrice: null,
      stock: 4,
      images: [],
      available: true,
    });
    db.variantSkuExists = async () => true;
    result = await jsonRequest(
      `${endpoint}/api/admin/variants/pv-test`,
      "PATCH",
      cookie,
      { sku: "CANDLE-GREEN" }
    );
    assert.equal(result.response.status, 409);
    assert.equal(result.body.error, "variant_sku_exists");

    let updatedFields = null;
    db.variantSkuExists = async () => false;
    db.updateVariant = async (_id, fields) => {
      updatedFields = fields;
      return { id: "pv-test", ...fields };
    };
    result = await jsonRequest(
      `${endpoint}/api/admin/variants/pv-test`,
      "PATCH",
      cookie,
      {
        color: "Πράσινο",
        colorEn: "Green",
        colorHex: "#4a7a4e",
        sku: "CANDLE-GREEN",
        price: "47.00",
        stock: "2",
        available: false,
        replaceImages: true,
        imagesData: [],
      }
    );
    assert.equal(result.response.status, 200);
    assert.equal(updatedFields.sku, "CANDLE-GREEN");
    assert.equal(updatedFields.price, 47);
    assert.equal(updatedFields.stock, 2);
    assert.equal(updatedFields.available, false);
    assert.equal(updatedFields.images, null);
  } finally {
    Object.assign(db, originals);
    if (originalMfaRequirement === undefined) delete process.env.ADMIN_2FA_REQUIRED;
    else process.env.ADMIN_2FA_REQUIRED = originalMfaRequirement;
    await new Promise((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
  }
});
