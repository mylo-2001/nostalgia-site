"use strict";

const assert = require("node:assert/strict");
const test = require("node:test");

const {
  PricingServiceError,
  normalizeRequest,
} = require("../server/services/pricing-service");

test("pricing request accepts identifiers and merges duplicate lines", () => {
  const normalized = normalizeRequest({
    items: [
      { productId: "p-1", variantId: "v-1", quantity: 1 },
      { productId: "p-1", variantId: "v-1", quantity: 2 },
    ],
    shippingMethodId: "home",
    paymentMethod: "card",
    destinationCountry: "gr",
    couponCode: " save10 ",
  });
  assert.deepEqual(normalized.items, [{ productId: "p-1", variantId: "v-1", quantity: 3 }]);
  assert.equal(normalized.paymentMethod, "card");
  assert.equal(normalized.destinationCountry, "GR");
  assert.equal(normalized.couponCode, "SAVE10");
});

test("pricing request rejects browser-supplied monetary fields", () => {
  assert.throws(
    () => normalizeRequest({
      items: [{ productId: "p-1", quantity: 1, unitPrice: "0.01" }],
      shippingMethodId: "home",
      paymentMethod: "card",
      destinationCountry: "GR",
      grandTotal: "0.01",
    }),
    (error) => error instanceof PricingServiceError
      && error.code === "CLIENT_PRICING_FIELD_FORBIDDEN"
  );
});
