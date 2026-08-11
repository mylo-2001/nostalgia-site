"use strict";

const { assertPermission, AdminAuthorizationError } = require("../domain/admin-rbac");
const { transitionOrderStateInTransaction } = require("./order-state-service");
const { enqueueNotification } = require("./notification-outbox-service");

class AdminOrderServiceError extends Error {
  constructor(code, message, details = {}) {
    super(message);
    this.name = "AdminOrderServiceError";
    this.code = code;
    this.details = details;
  }
}

async function inTransaction(options, work) {
  const client = await options.pool.connect();
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

async function authorizeAdmin(client, adminUserId, permission) {
  const result = await client.query(`
    SELECT u.id, u.status, u.totp_enabled, rp.permission_code
      FROM admin_users u
      LEFT JOIN admin_user_roles ur ON ur.admin_user_id = u.id
      LEFT JOIN admin_role_permissions rp ON rp.role_code = ur.role_code
     WHERE u.id = $1
  `, [adminUserId]);
  if (!result.rowCount || result.rows[0].status !== "active") {
    throw new AdminAuthorizationError("ADMIN_ACCOUNT_INACTIVE", "Administrator is not active");
  }
  assertPermission(result.rows, permission);
  return { id: result.rows[0].id, totpEnabled: result.rows[0].totp_enabled };
}

function auditContext(options) {
  return {
    requestId: options.requestId || null,
    ipAddress: options.ipAddress || null,
    userAgent: options.userAgent || null,
  };
}

async function getAdminOrder(options) {
  return inTransaction(options, async (client) => {
    await authorizeAdmin(client, options.adminUserId, "order.read");
    const result = await client.query(`
      SELECT o.id, o.number, o.order_status_v2, o.payment_status_v2,
             o.shipping_status_v2, o.payment_method_v2, o.currency,
             o.subtotal, o.discount_total, o.shipping_total, o.cod_fee,
             o.vat_total, o.grand_total, o.shipping_address_snapshot,
             o.billing_address_snapshot, o.customer_email_normalized,
             o.version, o.created_at, o.updated_at,
             COALESCE(jsonb_agg(to_jsonb(oi) ORDER BY oi.line_number)
               FILTER (WHERE oi.id IS NOT NULL), '[]'::jsonb) AS items
        FROM orders o
        LEFT JOIN order_items oi ON oi.order_id = o.id
       WHERE o.id = $1
       GROUP BY o.id
    `, [options.orderId]);
    if (!result.rowCount) throw new AdminOrderServiceError("ORDER_NOT_FOUND", "Order was not found");
    await client.query(`
      INSERT INTO audit_logs (actor_type, actor_id, action, entity_type, entity_id,
        source, request_id, ip_address, user_agent)
      VALUES ('admin', $1, 'order.sensitive_data_viewed', 'order', $2,
        'admin.order_read', $3, $4, $5)
    `, [options.adminUserId, options.orderId, options.requestId || null,
      options.ipAddress || null, options.userAgent || null]);
    return result.rows[0];
  });
}

async function transitionAdminOrder(options) {
  return inTransaction(options, async (client) => {
    if (["refunded", "partially_refunded", "partial_refund"]
      .includes(options.changes?.paymentStatus)) {
      throw new AdminOrderServiceError("PROVIDER_REFUND_REQUIRED",
        "Refunded status can only be written by a verified provider callback");
    }
    const isCancellation = options.changes?.orderStatus === "cancelled";
    await authorizeAdmin(client, options.adminUserId,
      isCancellation ? "order.cancel" : "order.update_status");
    if (isCancellation) {
      const payment = await client.query(`
        SELECT o.payment_method_v2, o.payment_status_v2, o.grand_total,
          COALESCE((SELECT p.amount FROM payments p WHERE p.order_id=o.id
            ORDER BY p.attempt DESC LIMIT 1), o.grand_total) AS charged,
          COALESCE((SELECT SUM(r.amount) FROM refunds r
            WHERE r.order_id=o.id AND r.status='confirmed'),0) AS refunded
        FROM orders o WHERE o.id=$1 FOR SHARE
      `, [options.orderId]);
      if (payment.rowCount && payment.rows[0].payment_method_v2 !== "cod" &&
          ["paid", "refunded", "partially_refunded"].includes(payment.rows[0].payment_status_v2) &&
          (Number(payment.rows[0].refunded) < Number(payment.rows[0].charged) ||
           Number(payment.rows[0].charged) <= 0)) {
        throw new AdminOrderServiceError("PROVIDER_REFUND_REQUIRED",
          "Paid order cancellation requires a provider-confirmed full refund");
      }
    }
    const result = await transitionOrderStateInTransaction({
      client, orderId: options.orderId, changes: options.changes,
      expectedVersion: options.expectedVersion,
      actor: { type: "admin", id: options.adminUserId },
      source: "admin.order_update", metadata: { reason: options.reason || null },
      ...auditContext(options),
    });
    if (options.changes?.orderStatus === "cancelled") {
      await enqueueNotification({ client, eventKey: `order_cancelled:${options.orderId}`,
        eventType: "order_cancelled", aggregateType: "order",
        aggregateId: options.orderId, correlationId: options.requestId,
        payload: { orderId: options.orderId } });
    }
    return result;
  });
}

async function updateAdminAddress(options) {
  return inTransaction(options, async (client) => {
    await authorizeAdmin(client, options.adminUserId, "order.update_address");
    const selected = await client.query(`
      SELECT shipping_address_snapshot, billing_address_snapshot,
             shipping_status_v2, version
        FROM orders WHERE id = $1 FOR UPDATE
    `, [options.orderId]);
    if (!selected.rowCount) throw new AdminOrderServiceError("ORDER_NOT_FOUND", "Order was not found");
    const row = selected.rows[0];
    if (row.version !== options.expectedVersion) {
      throw new AdminOrderServiceError("ORDER_VERSION_CONFLICT",
        "Order changed after it was read", { actualVersion: row.version });
    }
    if (["handed_to_courier", "in_transit", "delivered", "returning", "returned"]
      .includes(row.shipping_status_v2)) {
      throw new AdminOrderServiceError("ADDRESS_CHANGE_TOO_LATE",
        "Address cannot change after courier handoff");
    }
    const shipping = options.shippingAddress || row.shipping_address_snapshot;
    const billing = options.billingAddress || row.billing_address_snapshot;
    const updated = await client.query(`
      UPDATE orders SET shipping_address_snapshot = $2, billing_address_snapshot = $3,
             version = version + 1, updated_at = now()
       WHERE id = $1 AND version = $4 RETURNING version
    `, [options.orderId, shipping, billing, options.expectedVersion]);
    if (!updated.rowCount) throw new AdminOrderServiceError("ORDER_VERSION_CONFLICT",
      "Order changed during address update");
    await client.query(`
      UPDATE shipments SET shipping_address_snapshot = $2, version = version + 1,
             updated_at = now()
       WHERE order_id = $1 AND status IN ('not_ready', 'ready', 'label_created')
    `, [options.orderId, shipping]);
    await client.query(`
      INSERT INTO audit_logs (actor_type, actor_id, action, entity_type, entity_id,
        old_values, new_values, source, request_id, ip_address, user_agent)
      VALUES ('admin', $1, 'order.address_changed', 'order', $2, $3, $4,
        'admin.address_update', $5, $6, $7)
    `, [options.adminUserId, options.orderId,
      { shipping: row.shipping_address_snapshot, billing: row.billing_address_snapshot },
      { shipping, billing }, options.requestId || null, options.ipAddress || null,
      options.userAgent || null]);
    return { orderId: options.orderId, version: updated.rows[0].version };
  });
}

async function updateAdminShipment(options) {
  return inTransaction(options, async (client) => {
    await authorizeAdmin(client, options.adminUserId, "shipment.update");
    const shipment = await client.query(`
      SELECT id, status, carrier, tracking_number, version FROM shipments
       WHERE id = $1 AND order_id = $2 FOR UPDATE
    `, [options.shipmentId, options.orderId]);
    if (!shipment.rowCount) throw new AdminOrderServiceError("SHIPMENT_NOT_FOUND", "Shipment was not found");
    if (shipment.rows[0].version !== options.expectedShipmentVersion) {
      throw new AdminOrderServiceError("SHIPMENT_VERSION_CONFLICT", "Shipment changed after it was read");
    }
    const state = await transitionOrderStateInTransaction({
      client, orderId: options.orderId,
      changes: options.status ? { shippingStatus: options.status } : {},
      expectedVersion: options.expectedOrderVersion,
      actor: { type: "admin", id: options.adminUserId },
      source: "admin.shipment_update", requestId: options.requestId,
      metadata: { reason: options.reason || null },
    });
    let orderVersion = state.version;
    if (state.noOp) {
      const touched = await client.query(`
        UPDATE orders SET version = version + 1, updated_at = now()
         WHERE id = $1 AND version = $2 RETURNING version
      `, [options.orderId, options.expectedOrderVersion]);
      if (!touched.rowCount) throw new AdminOrderServiceError("ORDER_VERSION_CONFLICT",
        "Order changed during shipment update");
      orderVersion = touched.rows[0].version;
    }
    const updated = await client.query(`
      UPDATE shipments SET status = COALESCE($3, status),
             carrier = COALESCE($4, carrier), tracking_number = COALESCE($5, tracking_number),
             version = version + 1, updated_at = now(),
             label_created_at = CASE WHEN $3='label_created' THEN COALESCE(label_created_at, now()) ELSE label_created_at END,
             handed_to_courier_at = CASE WHEN $3='handed_to_courier' THEN COALESCE(handed_to_courier_at, now()) ELSE handed_to_courier_at END,
             delivered_at = CASE WHEN $3='delivered' THEN COALESCE(delivered_at, now()) ELSE delivered_at END
       WHERE id = $1 AND version = $2 RETURNING version
    `, [options.shipmentId, options.expectedShipmentVersion, options.status || null,
      options.carrier || null, options.trackingNumber || null]);
    if (!updated.rowCount) throw new AdminOrderServiceError("SHIPMENT_VERSION_CONFLICT",
      "Shipment changed during update");
    await client.query(`
      INSERT INTO audit_logs (actor_type, actor_id, action, entity_type, entity_id,
        old_values, new_values, source, request_id)
      VALUES ('admin', $1, 'shipment.updated', 'shipment', $2, $3, $4,
        'admin.shipment_update', $5)
    `, [options.adminUserId, options.shipmentId, shipment.rows[0], {
      status: options.status || shipment.rows[0].status,
      carrier: options.carrier || shipment.rows[0].carrier,
      trackingNumber: options.trackingNumber || shipment.rows[0].tracking_number,
    }, options.requestId || null]);
    if (["handed_to_courier", "in_transit"].includes(options.status)) {
      await enqueueNotification({ client, eventKey: `order_shipped:${options.shipmentId}`,
        eventType: "order_shipped", aggregateType: "order",
        aggregateId: options.orderId, correlationId: options.requestId,
        payload: { orderId: options.orderId, shipmentId: options.shipmentId,
          carrier: options.carrier || shipment.rows[0].carrier,
          trackingNumber: options.trackingNumber || shipment.rows[0].tracking_number } });
    }
    if (options.trackingNumber && options.trackingNumber !== shipment.rows[0].tracking_number) {
      await enqueueNotification({ client,
        eventKey: `tracking_added:${options.shipmentId}:${updated.rows[0].version}`,
        eventType: "tracking_added", aggregateType: "order", aggregateId: options.orderId,
        correlationId: options.requestId, payload: { orderId: options.orderId,
          shipmentId: options.shipmentId, carrier: options.carrier || shipment.rows[0].carrier,
          trackingNumber: options.trackingNumber } });
    }
    return { orderId: options.orderId, orderVersion,
      shipmentVersion: updated.rows[0].version };
  });
}

module.exports = {
  AdminOrderServiceError,
  authorizeAdmin,
  getAdminOrder,
  transitionAdminOrder,
  updateAdminAddress,
  updateAdminShipment,
};
