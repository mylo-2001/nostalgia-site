"use strict";

const crypto = require("node:crypto");

const { moneyToMinor } = require("../domain/money");
const { restockInventory, sha256 } = require("./inventory-service");
const { transitionOrderStateInTransaction } = require("./order-state-service");
const { enqueueNotification } = require("./notification-outbox-service");

class ReturnRefundError extends Error {
  constructor(code, message, details = {}) {
    super(message);
    this.name = "ReturnRefundError";
    this.code = code;
    this.details = details;
  }
}

function fail(code, message, details) { throw new ReturnRefundError(code, message, details); }

const RETURN_STATUSES = ["requested", "approved", "in_transit", "received", "inspected",
  "completed", "rejected", "cancelled"];

async function tx(pool, work) {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const result = await work(client);
    await client.query("COMMIT");
    return result;
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally { client.release(); }
}

function normalizeReturnItems(items) {
  if (!Array.isArray(items) || !items.length) fail("RETURN_ITEMS_REQUIRED", "Return needs items");
  const seen = new Set();
  return items.map((item) => {
    const orderItemId = String(item.orderItemId || "");
    const quantity = Number(item.quantity);
    if (!orderItemId || !Number.isSafeInteger(quantity) || quantity < 1) {
      fail("INVALID_RETURN_ITEM", "Return item is invalid");
    }
    if (seen.has(orderItemId)) fail("DUPLICATE_RETURN_ITEM", "Return item is duplicated");
    seen.add(orderItemId);
    return { orderItemId, quantity, reason: String(item.reason || "").trim().slice(0, 500) };
  });
}

async function createReturn(options) {
  const items = normalizeReturnItems(options.items);
  const idempotencyKey = String(options.idempotencyKey || "");
  if (idempotencyKey.length < 16) fail("IDEMPOTENCY_KEY_REQUIRED", "Return requires idempotency key");
  const keyHash = sha256(`return:${idempotencyKey}`);
  const requestHash = sha256(JSON.stringify({ orderId: options.orderId, items }));
  return tx(options.pool, async (client) => {
    const existing = await client.query(`
      SELECT id, request_hash, status FROM returns WHERE idempotency_key_hash=$1 FOR UPDATE
    `, [keyHash]);
    if (existing.rowCount) {
      if (existing.rows[0].request_hash.trim() !== requestHash) {
        fail("IDEMPOTENCY_KEY_REUSED", "Return key was reused for another request");
      }
      return { returnId: existing.rows[0].id, status: existing.rows[0].status, idempotent: true };
    }
    const order = await client.query(`
      SELECT shipping_status_v2 FROM orders WHERE id=$1 FOR UPDATE
    `, [options.orderId]);
    if (!order.rowCount) fail("ORDER_NOT_FOUND", "Order was not found");
    if (!["delivered", "returning", "returned"].includes(order.rows[0].shipping_status_v2)) {
      fail("ORDER_NOT_RETURNABLE", "Order has not been delivered");
    }
    for (const item of items) {
      const line = await client.query(`
        SELECT oi.quantity,
          COALESCE((SELECT SUM(ri.quantity) FROM return_items ri
            JOIN returns r ON r.id=ri.return_id
            WHERE ri.order_item_id=oi.id AND r.status NOT IN ('rejected','cancelled')),0)::int claimed
          FROM order_items oi WHERE oi.id=$1 AND oi.order_id=$2 FOR SHARE
      `, [item.orderItemId, options.orderId]);
      if (!line.rowCount || line.rows[0].claimed + item.quantity > line.rows[0].quantity) {
        fail("RETURN_QUANTITY_EXCEEDED", "Return quantity exceeds purchased quantity");
      }
    }
    const created = await client.query(`
      INSERT INTO returns (order_id, reason, requested_by_type, requested_by_id,
        idempotency_key_hash, request_hash, request_id)
      VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING id,status
    `, [options.orderId, options.reason || null, options.actor?.type || "customer",
      options.actor?.id || null, keyHash, requestHash, options.requestId || null]);
    for (const item of items) {
      await client.query(`
        INSERT INTO return_items (return_id, order_item_id, quantity, reason)
        VALUES ($1,$2,$3,$4)
      `, [created.rows[0].id, item.orderItemId, item.quantity,
        item.reason || options.reason || "unspecified"]);
    }
    await client.query(`
      INSERT INTO audit_logs (actor_type, actor_id, action, entity_type, entity_id,
        new_values, source, request_id)
      VALUES ($1,$2,'return.requested','return',$3,$4,'returns.request',$5)
    `, [options.actor?.type || "customer", options.actor?.id || null,
      created.rows[0].id, { orderId: options.orderId, items }, options.requestId || null]);
    return { returnId: created.rows[0].id, status: created.rows[0].status, idempotent: false };
  });
}

async function getReturnOptions(options) {
  const client = await options.pool.connect();
  try {
    const result = await client.query(`
      SELECT o.id AS "orderId", o.number AS "orderNumber",
        o.shipping_status_v2 AS "shippingStatus",
        COALESCE(jsonb_agg(jsonb_build_object(
          'orderItemId', oi.id, 'productName', oi.product_name,
          'variantName', oi.variant_name, 'sku', oi.sku,
          'purchasedQuantity', oi.quantity,
          'claimedQuantity', COALESCE(claimed.quantity, 0),
          'returnableQuantity', oi.quantity - COALESCE(claimed.quantity, 0)
        ) ORDER BY oi.line_number) FILTER (WHERE oi.id IS NOT NULL), '[]'::jsonb) AS items
      FROM orders o
      LEFT JOIN order_items oi ON oi.order_id=o.id
      LEFT JOIN LATERAL (
        SELECT COALESCE(SUM(ri.quantity),0)::int AS quantity
        FROM return_items ri JOIN returns r ON r.id=ri.return_id
        WHERE ri.order_item_id=oi.id AND r.status NOT IN ('rejected','cancelled')
      ) claimed ON TRUE
      WHERE o.id=$1 OR ($2::boolean AND o.number=$1)
      GROUP BY o.id
    `, [options.orderId, options.allowOrderNumber === true]);
    if (!result.rowCount) fail("ORDER_NOT_FOUND", "Order was not found");
    const row = result.rows[0];
    const returnable = ["delivered", "returning", "returned"].includes(row.shippingStatus);
    return { ...row, returnable,
      items: row.items.filter((item) => Number(item.returnableQuantity) > 0) };
  } finally { client.release(); }
}

async function handReturnToCourier(options) {
  const carrier = String(options.carrier || "").trim().toLowerCase();
  const trackingNumber = String(options.trackingNumber || "").trim();
  if (!/^[a-z0-9_-]{2,40}$/.test(carrier)) fail("INVALID_RETURN_CARRIER", "Return carrier is invalid");
  if (!/^[A-Za-z0-9-]{5,80}$/.test(trackingNumber)) {
    fail("INVALID_RETURN_TRACKING", "Return tracking number is invalid");
  }
  return tx(options.pool, async (client) => {
    const selected = await client.query("SELECT * FROM returns WHERE id=$1 FOR UPDATE", [options.returnId]);
    if (!selected.rowCount) fail("RETURN_NOT_FOUND", "Return was not found");
    const row = selected.rows[0];
    if (row.status === "in_transit" && row.return_carrier === carrier &&
        row.return_tracking_number === trackingNumber) {
      return { returnId: row.id, status: row.status, carrier, trackingNumber, idempotent: true };
    }
    if (row.status !== "approved") fail("INVALID_RETURN_TRANSITION", "Return must be approved first");
    await client.query(`UPDATE returns SET status='in_transit', return_carrier=$2,
      return_tracking_number=$3, handed_to_return_courier_at=now(),
      version=version+1, updated_at=now() WHERE id=$1`,
    [options.returnId, carrier, trackingNumber]);
    await client.query(`INSERT INTO audit_logs (actor_type,actor_id,action,entity_type,
      entity_id,old_values,new_values,source,request_id) VALUES
      ('admin',$1,'return.handed_to_courier','return',$2,$3,$4,'returns.shipping',$5)`,
    [options.adminUserId, options.returnId, { status: row.status },
      { status: "in_transit", carrier, trackingNumber }, options.requestId || null]);
    return { returnId: options.returnId, status: "in_transit", carrier, trackingNumber,
      idempotent: false };
  });
}

async function getReturnShipment(options) {
  const client = await options.pool.connect();
  try {
    const result = await client.query(`SELECT id, status, return_carrier AS carrier,
      return_tracking_number AS "trackingNumber",
      handed_to_return_courier_at AS "handedAt" FROM returns WHERE id=$1`,
    [options.returnId]);
    if (!result.rowCount) fail("RETURN_NOT_FOUND", "Return was not found");
    if (!result.rows[0].trackingNumber) fail("RETURN_TRACKING_NOT_SET", "Return tracking is not set");
    return result.rows[0];
  } finally { client.release(); }
}

async function setReturnStatus(options, fromStatuses, target, action) {
  return tx(options.pool, async (client) => {
    const row = await client.query("SELECT * FROM returns WHERE id=$1 FOR UPDATE", [options.returnId]);
    if (!row.rowCount) fail("RETURN_NOT_FOUND", "Return was not found");
    if (row.rows[0].status === target) return { returnId: options.returnId, status: target, idempotent: true };
    if (!fromStatuses.includes(row.rows[0].status)) fail("INVALID_RETURN_TRANSITION", "Return status transition is invalid");
    await client.query(`UPDATE returns SET status=$2, version=version+1, updated_at=now(),
      approved_at=CASE WHEN $2='approved' THEN now() ELSE approved_at END,
      received_at=CASE WHEN $2='received' THEN now() ELSE received_at END WHERE id=$1`,
    [options.returnId, target]);
    await client.query(`INSERT INTO audit_logs (actor_type,actor_id,action,entity_type,
      entity_id,old_values,new_values,source,request_id)
      VALUES ('admin',$1,$2,'return',$3,$4,$5,'returns.lifecycle',$6)`,
    [options.adminUserId, action, options.returnId, { status: row.rows[0].status },
      { status: target, reason: options.lifecycleReason || null }, options.requestId || null]);
    if (target === "approved") {
      await enqueueNotification({ client, eventKey: `return_approved:${options.returnId}`,
        eventType: "return_approved", aggregateType: "return",
        aggregateId: options.returnId, correlationId: options.requestId,
        payload: { returnId: options.returnId, orderId: row.rows[0].order_id } });
    }
    return { returnId: options.returnId, status: target, idempotent: false };
  });
}

function approveReturn(options) {
  return setReturnStatus(options, ["requested"], "approved", "return.approved");
}
function receiveReturn(options) {
  return setReturnStatus(options, ["approved", "in_transit"], "received", "return.received");
}

function requireLifecycleReason(options) {
  const reason = String(options.reason || "").trim();
  if (reason.length < 3) fail("RETURN_REASON_REQUIRED", "A reason is required");
  return { ...options, lifecycleReason: reason.slice(0, 500) };
}

function rejectReturn(options) {
  return setReturnStatus(requireLifecycleReason(options), ["requested"], "rejected", "return.rejected");
}

function cancelReturn(options) {
  return setReturnStatus(requireLifecycleReason(options), ["requested", "approved", "in_transit"],
    "cancelled", "return.cancelled");
}

async function listAdminReturns(options) {
  const status = String(options.status || "").trim();
  if (status && !RETURN_STATUSES.includes(status)) fail("INVALID_RETURN_STATUS", "Return status is invalid");
  const limit = Math.min(Math.max(Number(options.limit) || 100, 1), 200);
  const client = await options.pool.connect();
  try {
    const result = await client.query(`
      SELECT r.id, r.order_id AS "orderId", r.status, r.reason,
        r.requested_by_type AS "requestedByType", r.approved_at AS "approvedAt",
        r.received_at AS "receivedAt", r.completed_at AS "completedAt",
        r.return_carrier AS "returnCarrier",
        r.return_tracking_number AS "returnTrackingNumber",
        r.handed_to_return_courier_at AS "handedToReturnCourierAt",
        r.created_at AS "createdAt", r.updated_at AS "updatedAt",
        o.number AS "orderNumber", o.customer_email_normalized AS "customerEmail",
        o.grand_total AS "orderTotal", o.currency,
        o.payment_status_v2 AS "paymentStatus", o.shipping_status_v2 AS "shippingStatus",
        COALESCE(item_data.items, '[]'::jsonb) AS items,
        payment.id AS "paymentId", payment.status AS "providerPaymentStatus",
        payment.amount AS "paymentAmount", payment.refunded_amount AS "refundedAmount",
        COALESCE(refund_data.refunds, '[]'::jsonb) AS refunds
      FROM returns r
      JOIN orders o ON o.id=r.order_id
      LEFT JOIN LATERAL (
        SELECT jsonb_agg(jsonb_build_object(
          'id', ri.id, 'orderItemId', ri.order_item_id, 'quantity', ri.quantity,
          'reason', ri.reason, 'condition', ri.condition,
          'restockDecision', ri.restock_decision, 'inspectionNotes', ri.inspection_notes,
          'productName', oi.product_name, 'variantName', oi.variant_name,
          'sku', oi.sku, 'unitPrice', oi.unit_price, 'currency', oi.currency
        ) ORDER BY oi.line_number) AS items
        FROM return_items ri JOIN order_items oi ON oi.id=ri.order_item_id
        WHERE ri.return_id=r.id
      ) item_data ON TRUE
      LEFT JOIN LATERAL (
        SELECT p.id, p.status, p.amount, p.refunded_amount
        FROM payments p WHERE p.order_id=o.id ORDER BY p.attempt DESC LIMIT 1
      ) payment ON TRUE
      LEFT JOIN LATERAL (
        SELECT jsonb_agg(jsonb_build_object(
          'id', rf.id, 'status', rf.status, 'amount', rf.amount,
          'currency', rf.currency, 'provider', rf.provider, 'reason', rf.reason,
          'requestedAt', rf.requested_at, 'confirmedAt', rf.confirmed_at
        ) ORDER BY rf.requested_at DESC) AS refunds
        FROM refunds rf WHERE rf.return_id=r.id
      ) refund_data ON TRUE
      WHERE ($1='' OR r.status=$1)
      ORDER BY r.created_at DESC LIMIT $2
    `, [status, limit]);
    return { returns: result.rows };
  } finally { client.release(); }
}

async function inspectReturn(options) {
  if (!Array.isArray(options.decisions) || !options.decisions.length) {
    fail("INSPECTION_REQUIRED", "Inspection decisions are required");
  }
  return tx(options.pool, async (client) => {
    const result = await client.query("SELECT * FROM returns WHERE id=$1 FOR UPDATE", [options.returnId]);
    if (!result.rowCount) fail("RETURN_NOT_FOUND", "Return was not found");
    if (result.rows[0].status === "completed") {
      return { returnId: options.returnId, status: "completed", idempotent: true };
    }
    if (result.rows[0].status !== "received") fail("RETURN_NOT_RECEIVED", "Return must be received before inspection");
    const movements = [];
    for (const decision of options.decisions) {
      const item = await client.query(`
        SELECT ri.*, oi.product_id, oi.variant_id
          FROM return_items ri JOIN order_items oi ON oi.id=ri.order_item_id
         WHERE ri.id=$1 AND ri.return_id=$2 FOR UPDATE OF ri
      `, [decision.returnItemId, options.returnId]);
      if (!item.rowCount) fail("RETURN_ITEM_NOT_FOUND", "Return item was not found");
      const condition = String(decision.condition || "");
      const restock = decision.restockDecision === "restock";
      if (!["unopened", "sellable", "damaged", "defective"].includes(condition)) {
        fail("INVALID_RETURN_CONDITION", "Return condition is invalid");
      }
      if (restock && !["unopened", "sellable"].includes(condition)) {
        fail("UNSELLABLE_RESTOCK", "Only sellable items can be restocked");
      }
      let movementId = null;
      if (restock) {
        const inventory = await client.query(`
          SELECT id FROM inventory WHERE product_id=$1
            AND COALESCE(variant_id,'')=COALESCE($2,'') FOR UPDATE
        `, [item.rows[0].product_id, item.rows[0].variant_id]);
        if (!inventory.rowCount) fail("INVENTORY_NOT_FOUND", "Return inventory is missing");
        const movement = await restockInventory({ client, inventoryId: inventory.rows[0].id,
          orderId: result.rows[0].order_id, quantity: item.rows[0].quantity,
          movementType: "return_restock", operationKey: `return-item:${item.rows[0].id}`,
          reason: "inspected_sellable_return", actor: { type: "admin", id: options.adminUserId },
          source: "returns.inspection", requestId: options.requestId });
        movementId = movement.movementId || item.rows[0].inventory_movement_id;
        movements.push(movement);
      }
      await client.query(`
        UPDATE return_items SET condition=$2, restock_decision=$3, inspection_notes=$4,
          inspected_by=$5, inspected_at=now(), restocked_at=CASE WHEN $3='restock' THEN now() END,
          inventory_movement_id=COALESCE($6,inventory_movement_id) WHERE id=$1
      `, [item.rows[0].id, condition, restock ? "restock" : "do_not_restock",
        String(decision.notes || "").slice(0, 1000), options.adminUserId, movementId]);
    }
    const pending = await client.query(`SELECT COUNT(*)::int count FROM return_items
      WHERE return_id=$1 AND inspected_at IS NULL`, [options.returnId]);
    const status = pending.rows[0].count ? "inspected" : "completed";
    await client.query(`UPDATE returns SET status=$2, version=version+1, updated_at=now(),
      completed_at=CASE WHEN $2='completed' THEN now() END,
      restock_completed_at=CASE WHEN $2='completed' THEN now() END WHERE id=$1`,
    [options.returnId, status]);
    await client.query(`INSERT INTO audit_logs (actor_type,actor_id,action,entity_type,
      entity_id,new_values,source,request_id) VALUES
      ('admin',$1,'return.inspected','return',$2,$3,'returns.inspection',$4)`,
    [options.adminUserId, options.returnId, { status, restocked: movements.length },
      options.requestId || null]);
    return { returnId: options.returnId, status, movements, idempotent: false };
  });
}

async function requestRefund(options) {
  if (!options.provider?.createRefund) throw new TypeError("Refund provider adapter is required");
  const idempotencyKey = String(options.idempotencyKey || "");
  if (idempotencyKey.length < 16) fail("IDEMPOTENCY_KEY_REQUIRED", "Refund requires idempotency key");
  const amountMinor = moneyToMinor(options.amount, "refund.amount");
  if (amountMinor <= 0n) fail("INVALID_REFUND_AMOUNT", "Refund amount must be positive");
  const keyHash = sha256(`refund:${idempotencyKey}`);
  const requestHash = sha256(JSON.stringify({ paymentId: options.paymentId,
    returnId: options.returnId || null, amount: options.amount }));
  const prepared = await tx(options.pool, async (client) => {
    const existing = await client.query("SELECT * FROM refunds WHERE idempotency_key_hash=$1 FOR UPDATE", [keyHash]);
    if (existing.rowCount) {
      if (existing.rows[0].request_hash.trim() !== requestHash) fail("IDEMPOTENCY_KEY_REUSED", "Refund key was reused");
      return { existing: true, row: existing.rows[0] };
    }
    const payment = await client.query(`SELECT p.*,o.id order_id FROM payments p
      JOIN orders o ON o.id=p.order_id WHERE p.id=$1 FOR UPDATE OF p,o`, [options.paymentId]);
    if (!payment.rowCount || !["paid","cod_collected","partially_refunded"].includes(payment.rows[0].status)) {
      fail("PAYMENT_NOT_REFUNDABLE", "Payment is not refundable");
    }
    if (options.returnId) {
      const linkedReturn = await client.query(
        "SELECT order_id, status FROM returns WHERE id=$1 FOR SHARE", [options.returnId]);
      if (!linkedReturn.rowCount) fail("RETURN_NOT_FOUND", "Return was not found");
      if (linkedReturn.rows[0].order_id !== payment.rows[0].order_id) {
        fail("RETURN_ORDER_MISMATCH", "Return does not belong to the payment order");
      }
      if (linkedReturn.rows[0].status !== "completed") {
        fail("RETURN_NOT_COMPLETED", "Return must be inspected before refund");
      }
    }
    const pending = await client.query(`SELECT COALESCE(SUM(amount),0) total FROM refunds
      WHERE payment_id=$1 AND status IN ('pending','processing','confirmed')`, [options.paymentId]);
    const available = moneyToMinor(payment.rows[0].amount, "payment.amount") -
      moneyToMinor(pending.rows[0].total, "refund.total");
    if (amountMinor > available) fail("REFUND_AMOUNT_EXCEEDED", "Refund exceeds remaining payment amount");
    const row = await client.query(`INSERT INTO refunds (order_id,payment_id,return_id,
      amount,currency,provider,reason,idempotency_key_hash,request_hash,requested_by_type,
      requested_by_id,request_id) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12) RETURNING *`,
    [payment.rows[0].order_id, options.paymentId, options.returnId || null, options.amount,
      payment.rows[0].currency, options.provider.name, options.reason || null, keyHash, requestHash,
      options.actor?.type || "admin", options.actor?.id || null, options.requestId || null]);
    return { existing: false, row: { ...row.rows[0], provider_transaction_id: payment.rows[0].provider_transaction_id } };
  });
  if (prepared.existing) return { refundId: prepared.row.id, status: prepared.row.status, idempotent: true };
  let providerRefund;
  try {
    providerRefund = await options.provider.createRefund({ refundId: prepared.row.id,
      orderId: prepared.row.order_id, providerTransactionId: prepared.row.provider_transaction_id,
      amountMinor: Number(amountMinor), currency: prepared.row.currency,
      providerIdempotencyKey: `nostalgia-refund-${prepared.row.id}` });
  } catch (_) {
    await options.pool.connect().then(async (client) => { try {
      await client.query("UPDATE refunds SET status='failed',failed_at=now(),updated_at=now() WHERE id=$1", [prepared.row.id]);
    } finally { client.release(); } });
    fail("REFUND_PROVIDER_UNAVAILABLE", "Refund provider request failed");
  }
  await options.pool.connect().then(async (client) => { try {
    await client.query(`UPDATE refunds SET status='processing',provider_refund_id=$2,
      updated_at=now() WHERE id=$1`, [prepared.row.id, providerRefund.id]);
  } finally { client.release(); } });
  return { refundId: prepared.row.id, status: "processing", providerRefundId: providerRefund.id,
    idempotent: false };
}

async function processRefundWebhook(options) {
  let verified;
  try { verified = options.provider.verifyWebhook(options.rawBody, options.signature, options.webhookSecret); }
  catch (_) { fail("INVALID_WEBHOOK_SIGNATURE", "Refund webhook signature is invalid"); }
  const event = options.provider.normalizeRefundEvent(verified);
  const rawHash = crypto.createHash("sha256").update(options.rawBody).digest("hex");
  return tx(options.pool, async (client) => {
    const inserted = await client.query(`INSERT INTO refund_events (provider,provider_event_id,
      provider_refund_id,event_type,outcome,signature_verified,sanitized_event,raw_event_sha256,
      request_id) VALUES ($1,$2,$3,$4,$5,TRUE,$6,$7,$8)
      ON CONFLICT(provider,provider_event_id) DO NOTHING RETURNING id`,
    [options.provider.name, event.id, event.providerRefundId, event.type, event.outcome,
      event, rawHash, options.requestId || null]);
    if (!inserted.rowCount) return { received: true, duplicate: true };
    if (event.outcome === "ignored") return { received: true, ignored: true };
    const refund = await client.query(`SELECT r.*,p.amount payment_amount,p.refunded_amount,
      p.status payment_status FROM refunds r JOIN payments p ON p.id=r.payment_id
      WHERE r.provider=$1 AND (r.id=$2::uuid OR r.provider_refund_id=$3) FOR UPDATE OF r,p`,
    [options.provider.name, event.refundId, event.providerRefundId]);
    if (!refund.rowCount) fail("REFUND_NOT_FOUND", "Refund event cannot be matched");
    const row = refund.rows[0];
    if (moneyToMinor(row.amount, "refund.amount") !== BigInt(event.amountMinor) ||
        row.currency !== event.currency) fail("REFUND_AMOUNT_MISMATCH", "Refund amount or currency differs");
    if (event.outcome === "failed") {
      await client.query("UPDATE refunds SET status='failed',failed_at=now(),updated_at=now() WHERE id=$1", [row.id]);
    } else {
      const totalMinor = moneyToMinor(row.refunded_amount, "refunded") + moneyToMinor(row.amount, "amount");
      const paymentMinor = moneyToMinor(row.payment_amount, "payment");
      const paymentStatus = totalMinor === paymentMinor ? "refunded" : "partially_refunded";
      await client.query(`UPDATE refunds SET status='confirmed',confirmed_at=now(),updated_at=now() WHERE id=$1`, [row.id]);
      await client.query(`UPDATE payments SET status=$2,refunded_amount=refunded_amount+$3,
        version=version+1,updated_at=now() WHERE id=$1`, [row.payment_id, paymentStatus, row.amount]);
      await client.query(`UPDATE orders SET refunded_total=refunded_total+$2 WHERE id=$1`, [row.order_id, row.amount]);
      await transitionOrderStateInTransaction({ client, orderId: row.order_id,
        changes: { paymentStatus }, actor: { type: "provider", id: options.provider.name },
        source: "refund.webhook", requestId: options.requestId,
        metadata: { providerEventId: event.id, refundId: row.id } });
      await client.query(`INSERT INTO audit_logs (actor_type,actor_id,action,entity_type,
        entity_id,new_values,source,request_id) VALUES
        ('provider',$1,'refund.confirmed','refund',$2,$3,'refund.webhook',$4)`,
      [options.provider.name, row.id, { amount: row.amount, currency: row.currency },
        options.requestId || null]);
      await enqueueNotification({ client, eventKey: `refund_confirmed:${row.id}`,
        eventType: "refund_confirmed", aggregateType: "refund", aggregateId: row.id,
        correlationId: options.requestId,
        payload: { refundId: row.id, orderId: row.order_id, amount: row.amount,
          currency: row.currency } });
    }
    await client.query("UPDATE refund_events SET refund_id=$2,processed_at=now() WHERE id=$1",
      [inserted.rows[0].id, row.id]);
    return { received: true, processed: true, refundId: row.id, outcome: event.outcome };
  });
}

module.exports = { ReturnRefundError, approveReturn, cancelReturn, createReturn, getReturnOptions,
  getReturnShipment, handReturnToCourier, inspectReturn, listAdminReturns,
  processRefundWebhook, receiveReturn, rejectReturn, requestRefund };
