"use strict";

const {
  consumeInventoryReservationGroup,
  releaseInventoryReservationGroup,
  restockInventory,
} = require("./inventory-service");
const { transitionOrderStateInTransaction } = require("./order-state-service");

class CodServiceError extends Error {
  constructor(code, message, details = {}) {
    super(message);
    this.name = "CodServiceError";
    this.code = code;
    this.details = details;
  }
}

async function inTransaction(options, work) {
  if (options.client) return work(options.client);
  if (!options.pool || typeof options.pool.connect !== "function") {
    throw new TypeError("COD operation requires a PostgreSQL pool or transaction client");
  }
  const client = await options.pool.connect();
  try {
    await client.query("BEGIN");
    const result = await work(client);
    await client.query("COMMIT");
    return result;
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

async function lockCodOrder(client, orderId) {
  const result = await client.query(`
    SELECT id, order_status_v2, payment_status_v2, shipping_status_v2,
           payment_method_v2, reservation_group_key, version
      FROM orders
     WHERE id = $1
     FOR UPDATE
  `, [orderId]);
  if (!result.rowCount) throw new CodServiceError("ORDER_NOT_FOUND", "Order was not found");
  if (result.rows[0].payment_method_v2 !== "cod") {
    throw new CodServiceError("NOT_COD_ORDER", "Operation is only valid for COD orders");
  }
  return result.rows[0];
}

async function reviewCodOrder(options) {
  const decision = String(options.decision || "");
  if (!["approved", "rejected"].includes(decision)) {
    throw new CodServiceError("INVALID_RISK_DECISION", "COD review must approve or reject");
  }
  if (!options.reviewerId) {
    throw new CodServiceError("REVIEWER_REQUIRED", "COD review requires an administrator ID");
  }
  return inTransaction(options, async (client) => {
    const order = await lockCodOrder(client, options.orderId);
    const assessment = await client.query(`
      SELECT id, decision FROM risk_assessments
       WHERE order_id = $1
       FOR UPDATE
    `, [options.orderId]);
    if (!assessment.rowCount) {
      throw new CodServiceError("RISK_ASSESSMENT_NOT_FOUND", "COD risk assessment is missing");
    }
    if (assessment.rows[0].decision === decision) {
      return { orderId: options.orderId, decision, idempotent: true };
    }
    if (assessment.rows[0].decision !== "pending" || order.order_status_v2 !== "requires_review") {
      throw new CodServiceError("RISK_REVIEW_CLOSED", "COD risk review is already closed");
    }

    if (decision === "approved") {
      await consumeInventoryReservationGroup({
        client,
        groupKey: order.reservation_group_key.trim(),
        operationKey: `cod-review-approved:${options.orderId}`,
        actor: { type: "admin", id: options.reviewerId },
        source: "admin.cod_risk_review",
        requestId: options.requestId,
      });
      await transitionOrderStateInTransaction({
        client,
        orderId: options.orderId,
        changes: { orderStatus: "confirmed" },
        actor: { type: "admin", id: options.reviewerId },
        source: "admin.cod_risk_review",
        requestId: options.requestId,
        metadata: { reason: options.reason || "risk_review_approved" },
      });
    } else {
      await releaseInventoryReservationGroup({
        client,
        groupKey: order.reservation_group_key.trim(),
        operationKey: `cod-review-rejected:${options.orderId}`,
        reason: "risk_review_rejected",
        actor: { type: "admin", id: options.reviewerId },
        source: "admin.cod_risk_review",
        requestId: options.requestId,
      });
      await transitionOrderStateInTransaction({
        client,
        orderId: options.orderId,
        changes: { orderStatus: "cancelled", paymentStatus: "cancelled" },
        actor: { type: "admin", id: options.reviewerId },
        source: "admin.cod_risk_review",
        requestId: options.requestId,
        metadata: { reason: options.reason || "risk_review_rejected" },
      });
      await client.query(`
        UPDATE payments
           SET status = 'cancelled', cancelled_at = now(), version = version + 1,
               updated_at = now()
         WHERE order_id = $1 AND provider = 'cod' AND status = 'cod_pending'
      `, [options.orderId]);
    }

    await client.query(`
      UPDATE risk_assessments
         SET decision = $2, reviewed_by = $3, reviewed_at = now(), updated_at = now()
       WHERE id = $1
    `, [assessment.rows[0].id, decision, options.reviewerId]);
    await client.query(`
      UPDATE orders SET risk_decision = $2 WHERE id = $1
    `, [options.orderId, decision]);
    return { orderId: options.orderId, decision, idempotent: false };
  });
}

async function markCodCollected(options) {
  return inTransaction(options, async (client) => {
    const order = await lockCodOrder(client, options.orderId);
    if (order.payment_status_v2 === "cod_collected") {
      return { orderId: options.orderId, paymentStatus: "cod_collected", idempotent: true };
    }
    if (order.shipping_status_v2 !== "delivered") {
      throw new CodServiceError("COD_NOT_DELIVERED", "COD collection requires delivered shipping status");
    }
    await transitionOrderStateInTransaction({
      client,
      orderId: options.orderId,
      changes: {
        paymentStatus: "cod_collected",
        ...(order.order_status_v2 === "ready_to_ship" ? { orderStatus: "completed" } : {}),
      },
      actor: options.actor || { type: "system", id: "courier-reconciliation" },
      source: options.source || "cod.collection",
      requestId: options.requestId,
      metadata: { reason: "courier_collection_confirmed" },
    });
    const payment = await client.query(`
      UPDATE payments
         SET status = 'cod_collected', paid_at = now(), version = version + 1,
             updated_at = now()
       WHERE order_id = $1 AND provider = 'cod' AND status = 'cod_pending'
       RETURNING id
    `, [options.orderId]);
    if (!payment.rowCount) {
      throw new CodServiceError("COD_PAYMENT_MISSING", "Pending COD payment was not found");
    }
    return { orderId: options.orderId, paymentId: payment.rows[0].id,
      paymentStatus: "cod_collected", idempotent: false };
  });
}

async function restockReturnedCodOrder(options) {
  return inTransaction(options, async (client) => {
    const order = await lockCodOrder(client, options.orderId);
    if (order.shipping_status_v2 !== "returned") {
      throw new CodServiceError("COD_NOT_RETURNED", "Stock is restored only after the parcel is returned");
    }
    const lines = await client.query(`
      SELECT DISTINCT r.inventory_id, r.quantity
        FROM inventory_reservations r
       WHERE r.order_id = $1 AND r.status = 'consumed'
       ORDER BY r.inventory_id
    `, [options.orderId]);
    const movements = [];
    for (const line of lines.rows) {
      movements.push(await restockInventory({
        client,
        inventoryId: line.inventory_id,
        orderId: options.orderId,
        quantity: line.quantity,
        operationKey: `cod-returned:${options.orderId}:${line.inventory_id}`,
        reason: "cod_delivery_returned",
        actor: options.actor || { type: "system", id: "courier-reconciliation" },
        source: options.source || "cod.returned",
        requestId: options.requestId,
      }));
    }
    if (order.payment_status_v2 === "cod_pending") {
      await transitionOrderStateInTransaction({
        client,
        orderId: options.orderId,
        changes: { orderStatus: "cancelled", paymentStatus: "cancelled" },
        actor: options.actor || { type: "system", id: "courier-reconciliation" },
        source: options.source || "cod.returned",
        requestId: options.requestId,
        metadata: { reason: "cod_delivery_returned" },
      });
      await client.query(`
        UPDATE payments SET status = 'cancelled', cancelled_at = now(),
               version = version + 1, updated_at = now()
         WHERE order_id = $1 AND provider = 'cod' AND status = 'cod_pending'
      `, [options.orderId]);
    }
    return { orderId: options.orderId, movements,
      idempotent: movements.length > 0 && movements.every((item) => item.idempotent) };
  });
}

module.exports = {
  CodServiceError,
  markCodCollected,
  restockReturnedCodOrder,
  reviewCodOrder,
};
