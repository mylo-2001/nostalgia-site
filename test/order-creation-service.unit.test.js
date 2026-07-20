"use strict";

const assert = require("node:assert/strict");
const test = require("node:test");

const {
  OrderCreationError,
  guestToken,
  normalizeCheckout,
} = require("../server/services/order-creation-service");

function request() {
  return {
    items: [{ productId: "p-1", quantity: 1 }],
    shippingMethodId: "home",
    paymentMethod: "card",
    destinationCountry: "GR",
    customer: {
      firstName: "Ada",
      lastName: "Lovelace",
      email: "ADA@example.com",
      phone: "+30 6900000000",
    },
    shippingAddress: {
      firstName: "Ada",
      lastName: "Lovelace",
      line1: "Example 1",
      city: "Athens",
      postalCode: "10558",
      countryCode: "GR",
      phone: "+30 6900000000",
    },
  };
}

test("checkout normalization keeps identifiers and validated address snapshots", () => {
  const normalized = normalizeCheckout(request(), { type: "guest" });
  assert.equal(normalized.customer.email, "ada@example.com");
  assert.equal(normalized.shippingAddress.countryCode, "GR");
  assert.deepEqual(normalized.billingAddress, normalized.shippingAddress);
});

test("checkout rejects browser totals and mismatched destination", () => {
  assert.throws(
    () => normalizeCheckout({ ...request(), grandTotal: "0.01" }),
    (error) => error instanceof OrderCreationError
      && error.code === "CLIENT_PRICING_FIELD_FORBIDDEN"
  );
  const mismatch = request();
  mismatch.shippingAddress.countryCode = "CY";
  assert.throws(
    () => normalizeCheckout(mismatch),
    (error) => error.code === "DESTINATION_ADDRESS_MISMATCH"
  );
});

test("guest tokens are deterministic, secret-bound capability values", () => {
  const secret = "s".repeat(32);
  const token = guestToken(secret, "a".repeat(64), "order-1");
  assert.equal(token, guestToken(secret, "a".repeat(64), "order-1"));
  assert.notEqual(token, guestToken("z".repeat(32), "a".repeat(64), "order-1"));
  assert.ok(!token.includes("order-1"));
});

