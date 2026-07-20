"use strict";

const assert = require("node:assert/strict");
const path = require("node:path");
const test = require("node:test");

const {
  ADMIN_ROLES,
  DomainTransitionError,
  STATUS_VALUES,
  assertTransition,
  canTransition,
  isStatus,
  mapLegacyStatuses,
} = require("../server/domain/order-statuses");
const {
  checksum,
  loadMigrations,
  splitSqlStatements,
} = require("../server/migrate");

test("domain exposes the required independent status axes", () => {
  assert.deepEqual(STATUS_VALUES.order, [
    "draft", "pending", "confirmed", "processing", "ready_to_ship",
    "completed", "cancelled", "requires_review",
  ]);
  assert.deepEqual(STATUS_VALUES.payment, [
    "pending", "authorized", "paid", "failed", "cancelled",
    "partially_refunded", "refunded", "cod_pending", "cod_collected",
  ]);
  assert.deepEqual(STATUS_VALUES.shipping, [
    "not_ready", "ready", "label_created", "handed_to_courier",
    "in_transit", "delivered", "delivery_failed", "returning", "returned",
  ]);
});

test("all planned administrator roles are declared", () => {
  assert.deepEqual(ADMIN_ROLES, [
    "administrator", "order_manager", "warehouse",
    "customer_support", "accounting", "read_only",
  ]);
});

test("valid transitions and idempotent no-op transitions are accepted", () => {
  assert.equal(canTransition("order", "pending", "confirmed"), true);
  assert.equal(canTransition("payment", "paid", "partially_refunded"), true);
  assert.equal(canTransition("shipping", "in_transit", "delivery_failed"), true);
  assert.equal(canTransition("order", "confirmed", "confirmed"), true);
});

test("terminal and cross-axis transitions are rejected", () => {
  assert.equal(canTransition("order", "completed", "processing"), false);
  assert.equal(canTransition("payment", "refunded", "paid"), false);
  assert.equal(canTransition("shipping", "returned", "ready"), false);
  assert.equal(canTransition("payment", "pending", "delivered"), false);
  assert.equal(isStatus("unknown", "pending"), false);
});

test("assertTransition returns a typed domain error", () => {
  assert.throws(
    () => assertTransition("order", "cancelled", "confirmed"),
    (error) => error instanceof DomainTransitionError &&
      error.code === "INVALID_STATUS_TRANSITION" &&
      error.axis === "order"
  );
});

test("legacy paid and COD orders map without inventing a combined status", () => {
  assert.deepEqual(mapLegacyStatuses({
    status: "new",
    payment: "stripe",
    paymentStatus: "paid",
    shippingStatus: "not_ready",
  }), {
    orderStatus: "confirmed",
    paymentStatus: "paid",
    shippingStatus: "not_ready",
    requiresManualReview: false,
    warnings: [],
  });

  assert.deepEqual(mapLegacyStatuses({
    status: "new",
    payment: "cod",
    paymentStatus: "cod_pending",
    shippingStatus: "ready_courier",
  }), {
    orderStatus: "confirmed",
    paymentStatus: "cod_pending",
    shippingStatus: "ready",
    requiresManualReview: false,
    warnings: [],
  });
});

test("ambiguous legacy values are flagged for manual review", () => {
  const mapped = mapLegacyStatuses({
    status: "shipped",
    payment: "stripe",
    paymentStatus: "offline",
    shippingStatus: "shipped",
  });
  assert.equal(mapped.orderStatus, "processing");
  assert.equal(mapped.paymentStatus, "pending");
  assert.equal(mapped.shippingStatus, "in_transit");
  assert.equal(mapped.requiresManualReview, true);
  assert.equal(mapped.warnings.length, 3);
});

test("migration pairs are complete, ordered and checksummed", () => {
  const migrations = loadMigrations(path.join(__dirname, "..", "server", "migrations"));
  assert.deepEqual(migrations.slice(0, 2).map((migration) => migration.version), [1, 2]);
  assert.equal(migrations.length >= 3, true);
  assert.equal(migrations[0].up.transactional, true);
  assert.equal(migrations[1].up.transactional, false);
  assert.match(migrations[0].checksum, /^[0-9a-f]{64}$/);
  assert.equal(migrations[0].checksum, checksum(migrations[0].up.sql));
});

test("non-transactional SQL is split without breaking quoted semicolons", () => {
  const sql = "-- migration: no-transaction\nSELECT ';' AS value; SELECT $$a;b$$;";
  const statements = splitSqlStatements(sql);
  assert.equal(statements.length, 2);
  assert.match(statements[0], /SELECT ';'/);
  assert.match(statements[1], /\$\$a;b\$\$/);
});
