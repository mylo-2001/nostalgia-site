"use strict";

const {
  planStateTransition,
} = require("../domain/order-state-machine");

const ACTOR_TYPES = new Set(["system", "admin", "customer", "guest", "provider"]);

class OrderStateServiceError extends Error {
  constructor(code, message, details = {}) {
    super(message);
    this.name = "OrderStateServiceError";
    this.code = code;
    this.details = details;
  }
}

function normalizeActor(actor) {
  const value = actor || { type: "system", id: null };
  if (!ACTOR_TYPES.has(value.type)) {
    throw new OrderStateServiceError(
      "INVALID_ACTOR_TYPE",
      `Unsupported actor type: ${value.type}`
    );
  }
  return { type: value.type, id: value.id == null ? null : String(value.id) };
}

function rowState(row) {
  return {
    orderStatus: row.order_status_v2,
    paymentStatus: row.payment_status_v2,
    shippingStatus: row.shipping_status_v2,
  };
}

async function transitionOrderStateInTransaction(options) {
  const {
    client,
    orderId,
    changes,
    source,
    requestId = null,
    expectedVersion = null,
    metadata = {},
    ipAddress = null,
    userAgent = null,
  } = options || {};
  if (!client || typeof client.query !== "function") {
    throw new OrderStateServiceError("INVALID_CLIENT", "A PostgreSQL transaction client is required");
  }
  if (!orderId || !String(orderId).trim()) {
    throw new OrderStateServiceError("INVALID_ORDER_ID", "orderId is required");
  }
  if (!source || !String(source).trim()) {
    throw new OrderStateServiceError("INVALID_SOURCE", "source is required");
  }
  if (expectedVersion !== null &&
      (!Number.isInteger(expectedVersion) || expectedVersion < 1)) {
    throw new OrderStateServiceError(
      "INVALID_EXPECTED_VERSION",
      "expectedVersion must be a positive integer"
    );
  }
  const actor = normalizeActor(options.actor);
  const selected = await client.query(`
      SELECT id, order_status_v2, payment_status_v2, shipping_status_v2,
             payment_method_v2, version
      FROM orders
      WHERE id = $1
      FOR UPDATE
    `, [String(orderId)]);
    if (!selected.rowCount) {
      throw new OrderStateServiceError("ORDER_NOT_FOUND", "Order was not found");
    }

    const row = selected.rows[0];
    if (!row.order_status_v2 || !row.payment_status_v2 || !row.shipping_status_v2) {
      throw new OrderStateServiceError(
        "ORDER_STATE_UNINITIALIZED",
        "Order V2 statuses must be initialized before transitions"
      );
    }
    if (expectedVersion !== null && row.version !== expectedVersion) {
      throw new OrderStateServiceError(
        "ORDER_VERSION_CONFLICT",
        "Order changed after it was read",
        { expectedVersion, actualVersion: row.version }
      );
    }

    const current = rowState(row);
    const plan = planStateTransition(current, changes, {
      paymentMethod: row.payment_method_v2,
    });
    if (!plan.transitions.length) {
    return {
        orderId: String(orderId),
        state: plan.next,
        version: row.version,
        transitions: [],
        noOp: true,
    };
  }

    const updated = await client.query(`
      UPDATE orders
      SET order_status_v2 = $2,
          payment_status_v2 = $3,
          shipping_status_v2 = $4,
          version = version + 1,
          request_id = COALESCE($5, request_id),
          confirmed_at = CASE
            WHEN $2 = 'confirmed' THEN COALESCE(confirmed_at, now())
            ELSE confirmed_at
          END,
          cancelled_at = CASE
            WHEN $2 = 'cancelled' THEN COALESCE(cancelled_at, now())
            ELSE cancelled_at
          END,
          completed_at = CASE
            WHEN $2 = 'completed' THEN COALESCE(completed_at, now())
            ELSE completed_at
          END,
          updated_at = now()
      WHERE id = $1 AND version = $6
      RETURNING version, confirmed_at, cancelled_at, completed_at
    `, [
      String(orderId),
      plan.next.orderStatus,
      plan.next.paymentStatus,
      plan.next.shippingStatus,
      requestId,
      row.version,
    ]);
    if (!updated.rowCount) {
      throw new OrderStateServiceError(
        "ORDER_VERSION_CONFLICT",
        "Order changed during transition",
        { expectedVersion: row.version }
      );
    }

    for (const transition of plan.transitions) {
      await client.query(`
        INSERT INTO order_status_history (
          order_id, axis, from_status, to_status, actor_type, actor_id,
          reason, metadata, source, request_id
        ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8::jsonb,$9,$10)
      `, [
        String(orderId),
        transition.axis,
        transition.from,
        transition.to,
        actor.type,
        actor.id,
        metadata.reason || null,
        JSON.stringify(metadata),
        String(source),
        requestId,
      ]);
    }

    await client.query(`
      INSERT INTO audit_logs (
        actor_type, actor_id, action, entity_type, entity_id,
        old_values, new_values, source, request_id, ip_address, user_agent
      ) VALUES ($1,$2,$3,'order',$4,$5::jsonb,$6::jsonb,$7,$8,$9,$10)
    `, [
      actor.type,
      actor.id,
      "order.state_transition",
      String(orderId),
      JSON.stringify({ ...current, version: row.version }),
      JSON.stringify({ ...plan.next, version: updated.rows[0].version }),
      String(source),
      requestId,
      ipAddress,
      userAgent,
    ]);

  return {
      orderId: String(orderId),
      state: plan.next,
      version: updated.rows[0].version,
      transitions: plan.transitions,
      noOp: false,
    };
}

async function transitionOrderState(options) {
  const { pool, logger = null } = options || {};
  if (!pool || typeof pool.connect !== "function") {
    throw new OrderStateServiceError("INVALID_POOL", "A PostgreSQL pool is required");
  }
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const result = await transitionOrderStateInTransaction({ ...options, client });
    await client.query("COMMIT");
    if (logger && typeof logger.info === "function") {
      try {
        logger.info({
          event: "order_state_transition_committed",
          orderId: result.orderId,
          version: result.version,
          axes: result.transitions.map((transition) => transition.axis),
          requestId: options.requestId || null,
        });
      } catch (_) {
        // Logging must not turn a committed transition into an apparent failure.
      }
    }
    return result;
  } catch (error) {
    try {
      await client.query("ROLLBACK");
    } catch (_) {
      // Preserve the original transition error.
    }
    throw error;
  } finally {
    client.release();
  }
}

module.exports = {
  OrderStateServiceError,
  transitionOrderState,
  transitionOrderStateInTransaction,
};
