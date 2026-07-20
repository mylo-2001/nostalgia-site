"use strict";

const assert = require("node:assert/strict");
const test = require("node:test");

const {
  InventoryServiceError,
  reserveInventory,
  sha256,
} = require("../server/services/inventory-service");

test("inventory keys are deterministic SHA-256 values", () => {
  assert.equal(sha256("same"), sha256("same"));
  assert.match(sha256("inventory"), /^[0-9a-f]{64}$/);
  assert.notEqual(sha256("first"), sha256("second"));
});

test("inventory validation rejects duplicate and unsafe quantities before database access", async () => {
  await assert.rejects(
    reserveInventory({
      lines: [
        { productId: "p-1", quantity: 1 },
        { productId: "p-1", quantity: 1 },
      ],
      orderId: "order-1",
      reservationKey: "reservation-key-long-enough",
    }),
    (error) => error instanceof InventoryServiceError && error.code === "DUPLICATE_INVENTORY_LINE"
  );
  await assert.rejects(
    reserveInventory({
      lines: [{ productId: "p-1", quantity: Number.MAX_SAFE_INTEGER + 1 }],
      orderId: "order-1",
      reservationKey: "reservation-key-long-enough",
    }),
    (error) => error.code === "INVALID_INVENTORY_QUANTITY"
  );
});

