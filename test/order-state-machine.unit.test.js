"use strict";

const assert = require("node:assert/strict");
const test = require("node:test");

const {
  InvalidOrderStateError,
  planStateTransition,
  validateStateCombination,
} = require("../server/domain/order-state-machine");

const PENDING_CARD = Object.freeze({
  orderStatus: "pending",
  paymentStatus: "pending",
  shippingStatus: "not_ready",
});

test("payment and order can advance in separate valid transitions", () => {
  const paid = planStateTransition(PENDING_CARD, { paymentStatus: "paid" }, {
    paymentMethod: "card",
  });
  assert.equal(paid.next.paymentStatus, "paid");
  assert.deepEqual(paid.transitions.map((item) => item.axis), ["payment"]);

  const confirmed = planStateTransition(paid.next, { orderStatus: "confirmed" }, {
    paymentMethod: "card",
  });
  assert.equal(confirmed.next.orderStatus, "confirmed");
});

test("multiple axes are validated against the final atomic state", () => {
  const current = {
    orderStatus: "ready_to_ship",
    paymentStatus: "paid",
    shippingStatus: "in_transit",
  };
  const plan = planStateTransition(current, {
    orderStatus: "completed",
    shippingStatus: "delivered",
  }, { paymentMethod: "card" });
  assert.deepEqual(plan.next, {
    orderStatus: "completed",
    paymentStatus: "paid",
    shippingStatus: "delivered",
  });
  assert.deepEqual(plan.transitions.map((item) => item.axis), ["order", "shipping"]);
});

test("fulfilment cannot start before payment is ready", () => {
  assert.throws(
    () => planStateTransition(PENDING_CARD, { orderStatus: "confirmed" }, {
      paymentMethod: "card",
    }),
    (error) => error instanceof InvalidOrderStateError &&
      error.code === "PAYMENT_NOT_READY_FOR_FULFILMENT"
  );
});

test("shipping cannot advance while the order is pending", () => {
  assert.throws(
    () => planStateTransition(PENDING_CARD, { shippingStatus: "ready" }),
    (error) => error instanceof InvalidOrderStateError &&
      error.code === "ORDER_NOT_READY_FOR_SHIPPING"
  );
});

test("COD collection requires delivery and matching payment method", () => {
  assert.throws(
    () => validateStateCombination({
      orderStatus: "processing",
      paymentStatus: "cod_collected",
      shippingStatus: "in_transit",
    }, { paymentMethod: "cod" }),
    (error) => error.code === "COD_NOT_DELIVERED"
  );
  assert.throws(
    () => validateStateCombination({
      orderStatus: "confirmed",
      paymentStatus: "cod_pending",
      shippingStatus: "not_ready",
    }, { paymentMethod: "card" }),
    (error) => error.code === "PAYMENT_METHOD_STATUS_MISMATCH"
  );
});

test("terminal status transitions and unknown fields are rejected", () => {
  assert.throws(() => planStateTransition({
    orderStatus: "completed",
    paymentStatus: "paid",
    shippingStatus: "delivered",
  }, { orderStatus: "processing" }), /Invalid order status transition/);

  assert.throws(
    () => planStateTransition(PENDING_CARD, { status: "confirmed" }),
    (error) => error instanceof InvalidOrderStateError &&
      error.code === "UNKNOWN_STATE_FIELD"
  );
});

test("same-state requests are safe no-ops", () => {
  const plan = planStateTransition(PENDING_CARD, { orderStatus: "pending" });
  assert.deepEqual(plan.transitions, []);
  assert.deepEqual(plan.next, PENDING_CARD);
});

test("a shipped cancellation can enter the return flow atomically", () => {
  const plan = planStateTransition({
    orderStatus: "ready_to_ship",
    paymentStatus: "paid",
    shippingStatus: "in_transit",
  }, {
    orderStatus: "cancelled",
    shippingStatus: "returning",
  }, { paymentMethod: "card" });
  assert.equal(plan.next.orderStatus, "cancelled");
  assert.equal(plan.next.shippingStatus, "returning");
});
