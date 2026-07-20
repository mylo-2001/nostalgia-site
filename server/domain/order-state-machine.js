"use strict";

const {
  STATUS_VALUES,
  assertTransition,
  isStatus,
} = require("./order-statuses");

const STATE_FIELDS = Object.freeze({
  order: "orderStatus",
  payment: "paymentStatus",
  shipping: "shippingStatus",
});
const FIELD_AXES = Object.freeze(Object.fromEntries(
  Object.entries(STATE_FIELDS).map(([axis, field]) => [field, axis])
));

const ACTIVE_ORDER_STATUSES = new Set([
  "confirmed",
  "processing",
  "ready_to_ship",
]);
const FULFILMENT_PAYMENT_STATUSES = new Set([
  "authorized",
  "paid",
  "partially_refunded",
  "cod_pending",
  "cod_collected",
]);
const COMPLETED_PAYMENT_STATUSES = new Set([
  "paid",
  "partially_refunded",
  "refunded",
  "cod_collected",
]);
const SHIPPING_IN_PROGRESS = new Set([
  "ready",
  "label_created",
  "handed_to_courier",
  "in_transit",
  "delivered",
  "delivery_failed",
  "returning",
  "returned",
]);
const SHIPPING_ORDER_STATUSES = new Set([
  "confirmed",
  "processing",
  "ready_to_ship",
  "completed",
]);
const CANCELLATION_SHIPPING_STATUSES = new Set([
  "delivery_failed",
  "returning",
  "returned",
]);

class InvalidOrderStateError extends Error {
  constructor(code, message, details = {}) {
    super(message);
    this.name = "InvalidOrderStateError";
    this.code = code;
    this.details = details;
  }
}

function validateStateShape(state) {
  for (const [axis, field] of Object.entries(STATE_FIELDS)) {
    if (!isStatus(axis, state[field])) {
      throw new InvalidOrderStateError(
        "INVALID_ORDER_STATE",
        `Invalid ${field}: ${state[field]}`,
        { axis, field, value: state[field] }
      );
    }
  }
}

function validateStateCombination(state, context = {}) {
  validateStateShape(state);
  const { orderStatus, paymentStatus, shippingStatus } = state;
  const paymentMethod = context.paymentMethod || null;

  if (ACTIVE_ORDER_STATUSES.has(orderStatus) &&
      !FULFILMENT_PAYMENT_STATUSES.has(paymentStatus)) {
    throw new InvalidOrderStateError(
      "PAYMENT_NOT_READY_FOR_FULFILMENT",
      `${orderStatus} requires an authorized, paid, partially refunded, or COD payment`,
      { orderStatus, paymentStatus }
    );
  }

  if (orderStatus === "completed") {
    if (!["delivered", "returning", "returned"].includes(shippingStatus)) {
      throw new InvalidOrderStateError(
        "ORDER_NOT_DELIVERED",
        "A completed order must be delivered or in a post-delivery return flow",
        { orderStatus, shippingStatus }
      );
    }
    if (!COMPLETED_PAYMENT_STATUSES.has(paymentStatus)) {
      throw new InvalidOrderStateError(
        "PAYMENT_NOT_SETTLED",
        "A completed order must have a settled payment state",
        { orderStatus, paymentStatus }
      );
    }
  }

  const validCancellationShipping = orderStatus === "cancelled" &&
    CANCELLATION_SHIPPING_STATUSES.has(shippingStatus);
  if (SHIPPING_IN_PROGRESS.has(shippingStatus) &&
      !SHIPPING_ORDER_STATUSES.has(orderStatus) &&
      !validCancellationShipping) {
    throw new InvalidOrderStateError(
      "ORDER_NOT_READY_FOR_SHIPPING",
      `${shippingStatus} is not allowed while order status is ${orderStatus}`,
      { orderStatus, shippingStatus }
    );
  }

  if (paymentStatus === "cod_collected" &&
      !["delivered", "returning", "returned"].includes(shippingStatus)) {
    throw new InvalidOrderStateError(
      "COD_NOT_DELIVERED",
      "COD cannot be collected before delivery",
      { paymentStatus, shippingStatus }
    );
  }

  if (paymentMethod === "card" && paymentStatus.startsWith("cod_")) {
    throw new InvalidOrderStateError(
      "PAYMENT_METHOD_STATUS_MISMATCH",
      `Card payment cannot use ${paymentStatus}`,
      { paymentMethod, paymentStatus }
    );
  }
  if (paymentMethod === "cod" && ["authorized", "paid"].includes(paymentStatus)) {
    throw new InvalidOrderStateError(
      "PAYMENT_METHOD_STATUS_MISMATCH",
      `COD payment cannot use ${paymentStatus}`,
      { paymentMethod, paymentStatus }
    );
  }
}

function planStateTransition(current, changes, context = {}) {
  validateStateShape(current);
  const requested = changes || {};
  const unknownFields = Object.keys(requested).filter((field) => !FIELD_AXES[field]);
  if (unknownFields.length) {
    throw new InvalidOrderStateError(
      "UNKNOWN_STATE_FIELD",
      `Unknown state fields: ${unknownFields.join(", ")}`,
      { fields: unknownFields }
    );
  }

  const next = { ...current };
  const transitions = [];
  for (const [field, value] of Object.entries(requested)) {
    const axis = FIELD_AXES[field];
    if (!isStatus(axis, value)) {
      throw new InvalidOrderStateError(
        "INVALID_TARGET_STATUS",
        `Invalid ${field}: ${value}`,
        { axis, field, value }
      );
    }
    const from = current[field];
    assertTransition(axis, from, value);
    next[field] = value;
    if (from !== value) transitions.push({ axis, field, from, to: value });
  }

  validateStateCombination(next, context);
  return { current: { ...current }, next, transitions };
}

module.exports = {
  FIELD_AXES,
  InvalidOrderStateError,
  STATE_FIELDS,
  planStateTransition,
  validateStateCombination,
  validateStateShape,
};
