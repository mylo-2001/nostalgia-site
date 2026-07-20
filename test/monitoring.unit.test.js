"use strict";

const assert = require("node:assert/strict");
const test = require("node:test");

const { sanitizeMetadata } = require("../server/services/monitoring-service");

test("monitoring metadata removes credentials and limits strings", () => {
  const clean = sanitizeMetadata({ orderId: "1", password: "no", nested: {
    paymentToken: "no", message: "x".repeat(2000) } });
  assert.deepEqual(clean, { orderId: "1", nested: { message: "x".repeat(1000) } });
});
