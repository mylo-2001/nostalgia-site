"use strict";

const STATUS_VALUES = Object.freeze({
  order: Object.freeze([
    "draft",
    "pending",
    "confirmed",
    "processing",
    "ready_to_ship",
    "completed",
    "cancelled",
    "requires_review",
  ]),
  payment: Object.freeze([
    "pending",
    "authorized",
    "paid",
    "failed",
    "cancelled",
    "partially_refunded",
    "refunded",
    "cod_pending",
    "cod_collected",
  ]),
  shipping: Object.freeze([
    "not_ready",
    "ready",
    "label_created",
    "handed_to_courier",
    "in_transit",
    "delivered",
    "delivery_failed",
    "returning",
    "returned",
  ]),
});

const ADMIN_ROLES = Object.freeze([
  "administrator",
  "order_manager",
  "warehouse",
  "customer_support",
  "accounting",
  "read_only",
]);

const TRANSITIONS = Object.freeze({
  order: Object.freeze({
    draft: Object.freeze(["pending", "cancelled"]),
    pending: Object.freeze(["confirmed", "requires_review", "cancelled"]),
    confirmed: Object.freeze(["processing", "requires_review", "cancelled"]),
    processing: Object.freeze(["ready_to_ship", "requires_review", "cancelled"]),
    ready_to_ship: Object.freeze(["processing", "completed", "cancelled"]),
    requires_review: Object.freeze(["confirmed", "cancelled"]),
    completed: Object.freeze([]),
    cancelled: Object.freeze([]),
  }),
  payment: Object.freeze({
    pending: Object.freeze(["authorized", "paid", "failed", "cancelled", "cod_pending"]),
    authorized: Object.freeze(["paid", "failed", "cancelled"]),
    paid: Object.freeze(["partially_refunded", "refunded"]),
    partially_refunded: Object.freeze(["refunded"]),
    cod_pending: Object.freeze(["cod_collected", "cancelled"]),
    cod_collected: Object.freeze(["partially_refunded", "refunded"]),
    failed: Object.freeze(["pending"]),
    cancelled: Object.freeze([]),
    refunded: Object.freeze([]),
  }),
  shipping: Object.freeze({
    not_ready: Object.freeze(["ready"]),
    ready: Object.freeze(["not_ready", "label_created"]),
    label_created: Object.freeze(["ready", "handed_to_courier"]),
    handed_to_courier: Object.freeze(["in_transit", "returning"]),
    in_transit: Object.freeze(["delivered", "delivery_failed", "returning"]),
    delivery_failed: Object.freeze(["in_transit", "returning", "returned"]),
    delivered: Object.freeze(["returning"]),
    returning: Object.freeze(["returned"]),
    returned: Object.freeze([]),
  }),
});

class DomainTransitionError extends Error {
  constructor(axis, from, to) {
    super(`Invalid ${axis} status transition: ${from} -> ${to}`);
    this.name = "DomainTransitionError";
    this.code = "INVALID_STATUS_TRANSITION";
    this.axis = axis;
    this.from = from;
    this.to = to;
  }
}

function isStatus(axis, value) {
  return !!STATUS_VALUES[axis]?.includes(value);
}

function canTransition(axis, from, to) {
  if (!isStatus(axis, from) || !isStatus(axis, to)) return false;
  if (from === to) return true;
  return TRANSITIONS[axis][from].includes(to);
}

function assertTransition(axis, from, to) {
  if (!canTransition(axis, from, to)) {
    throw new DomainTransitionError(axis, from, to);
  }
}

function mapLegacyPaymentStatus(value, paymentMethod, warnings) {
  const status = String(value || "pending").toLowerCase();
  const direct = {
    pending: "pending",
    paid: "paid",
    failed: "failed",
    cancelled: "cancelled",
    refunded: "refunded",
    partial_refund: "partially_refunded",
    cod_pending: "cod_pending",
    cod_collected: "cod_collected",
    cod: "cod_pending",
  };
  if (direct[status]) return direct[status];
  if (["cod_not_delivered", "cod_awaiting_remittance"].includes(status)) {
    warnings.push(`ambiguous legacy payment status: ${status}`);
    return "cod_pending";
  }
  if (status === "offline") {
    warnings.push("legacy offline payment requires manual review");
    return paymentMethod === "cod" ? "cod_pending" : "pending";
  }
  warnings.push(`unknown legacy payment status: ${status}`);
  return paymentMethod === "cod" ? "cod_pending" : "pending";
}

function mapLegacyShippingStatus(value, warnings) {
  const status = String(value || "not_ready").toLowerCase();
  const direct = {
    not_ready: "not_ready",
    ready: "ready",
    ready_courier: "ready",
    label_created: "label_created",
    handed: "handed_to_courier",
    handed_to_courier: "handed_to_courier",
    transit: "in_transit",
    in_transit: "in_transit",
    delivered: "delivered",
    failed: "delivery_failed",
    delivery_failed: "delivery_failed",
    returning: "returning",
    returned: "returned",
  };
  if (direct[status]) return direct[status];
  if (status === "shipped") {
    warnings.push("legacy shipped status mapped to in_transit");
    return "in_transit";
  }
  warnings.push(`unknown legacy shipping status: ${status}`);
  return "not_ready";
}

function mapLegacyOrderStatus(value, targetPayment, targetShipping, warnings) {
  const status = String(value || "new").toLowerCase();
  const direct = {
    processing: "processing",
    ready: "ready_to_ship",
    completed: "completed",
    cancelled: "cancelled",
    review: "requires_review",
    issue: "requires_review",
    delivered: "completed",
  };
  if (direct[status]) return direct[status];
  if (status === "new") {
    return ["paid", "authorized", "cod_pending", "cod_collected"].includes(targetPayment)
      ? "confirmed"
      : "pending";
  }
  if (status === "shipped") {
    warnings.push("legacy shipped order requires lifecycle review");
    return targetShipping === "delivered" ? "completed" : "processing";
  }
  warnings.push(`unknown legacy order status: ${status}`);
  return "requires_review";
}

function mapLegacyStatuses(order) {
  const warnings = [];
  const paymentMethod = String(order.payment || "").toLowerCase();
  const paymentStatus = mapLegacyPaymentStatus(order.paymentStatus, paymentMethod, warnings);
  const shippingStatus = mapLegacyShippingStatus(order.shippingStatus, warnings);
  const orderStatus = mapLegacyOrderStatus(
    order.status,
    paymentStatus,
    shippingStatus,
    warnings
  );
  return {
    orderStatus,
    paymentStatus,
    shippingStatus,
    requiresManualReview: warnings.length > 0 || orderStatus === "requires_review",
    warnings,
  };
}

module.exports = {
  ADMIN_ROLES,
  DomainTransitionError,
  STATUS_VALUES,
  TRANSITIONS,
  assertTransition,
  canTransition,
  isStatus,
  mapLegacyStatuses,
};
