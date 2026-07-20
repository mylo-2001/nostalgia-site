"use strict";

const crypto = require("node:crypto");

class InventoryServiceError extends Error {
  constructor(code, message, details = {}) {
    super(message);
    this.name = "InventoryServiceError";
    this.code = code;
    this.details = details;
  }
}

function fail(code, message, details) {
  throw new InventoryServiceError(code, message, details);
}

function sha256(value) {
  return crypto.createHash("sha256").update(String(value), "utf8").digest("hex");
}

function stableLines(lines) {
  return [...lines]
    .map((line) => ({
      productId: line.productId,
      variantId: line.variantId || null,
      orderItemId: line.orderItemId || null,
      quantity: line.quantity,
    }))
    .sort((left, right) => {
      const a = `${left.productId}\u0000${left.variantId || ""}`;
      const b = `${right.productId}\u0000${right.variantId || ""}`;
      return a.localeCompare(b);
    });
}

function normalizeLines(lines) {
  if (!Array.isArray(lines) || !lines.length || lines.length > 100) {
    fail("INVALID_INVENTORY_LINES", "Inventory operation requires between 1 and 100 lines");
  }
  const seen = new Set();
  return stableLines(lines).map((line) => {
    if (!line.productId || typeof line.productId !== "string" || line.productId.length > 200) {
      fail("INVALID_PRODUCT_IDENTIFIER", "Inventory product identifier is invalid");
    }
    if (line.variantId && (typeof line.variantId !== "string" || line.variantId.length > 200)) {
      fail("INVALID_PRODUCT_IDENTIFIER", "Inventory variant identifier is invalid");
    }
    if (!Number.isSafeInteger(line.quantity) || line.quantity < 1 || line.quantity > 10000) {
      fail("INVALID_INVENTORY_QUANTITY", "Inventory quantity must be a positive safe integer");
    }
    const key = `${line.productId}\u0000${line.variantId || ""}`;
    if (seen.has(key)) fail("DUPLICATE_INVENTORY_LINE", "Inventory lines must be pre-aggregated", { key });
    seen.add(key);
    return line;
  });
}

function normalizeActor(actor = {}) {
  const type = actor.type || "system";
  if (!['system', 'admin', 'customer', 'guest', 'provider'].includes(type)) {
    fail("INVALID_ACTOR", "Inventory actor type is invalid");
  }
  return { type, id: actor.id || null };
}

function movementActorType(type) {
  return type === "provider" ? "system" : type;
}

async function withTransaction(options, work) {
  if (options.client) return work(options.client);
  if (!options.pool || typeof options.pool.connect !== "function") {
    throw new TypeError("Inventory operation requires a PostgreSQL pool or transaction client");
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

async function insertAudit(client, input) {
  await client.query(`
    INSERT INTO audit_logs (
      actor_type, actor_id, action, entity_type, entity_id,
      old_values, new_values, source, request_id
    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
  `, [
    input.actor.type,
    input.actor.id,
    input.action,
    input.entityType,
    input.entityId,
    input.oldValues || null,
    input.newValues || null,
    input.source,
    input.requestId || null,
  ]);
}

async function loadGroupResult(client, groupKey, idempotent) {
  const group = await client.query(`
    SELECT group_key, order_id, status, expires_at, created_at, updated_at
      FROM inventory_reservation_groups
     WHERE group_key = $1
  `, [groupKey]);
  const reservations = await client.query(`
    SELECT r.id, r.order_item_id, r.inventory_id, r.quantity, r.status,
           r.expires_at, i.product_id, i.variant_id, i.tracks_stock,
           i.stock_on_hand, i.reserved_quantity, i.available_quantity
      FROM inventory_reservations r
      JOIN inventory i ON i.id = r.inventory_id
     WHERE r.reservation_group_key = $1
     ORDER BY i.product_id, COALESCE(i.variant_id, '')
  `, [groupKey]);
  return {
    groupKey,
    orderId: group.rows[0].order_id,
    status: group.rows[0].status,
    expiresAt: group.rows[0].expires_at,
    reservations: reservations.rows.map((row) => ({
      id: row.id,
      orderItemId: row.order_item_id,
      inventoryId: row.inventory_id,
      productId: row.product_id,
      variantId: row.variant_id,
      quantity: row.quantity,
      status: row.status,
      stockOnHand: row.stock_on_hand,
      reservedQuantity: row.reserved_quantity,
      availableQuantity: row.available_quantity,
    })),
    idempotent,
  };
}

async function reserveInventory(options) {
  const lines = normalizeLines(options.lines);
  const actor = normalizeActor(options.actor);
  const reservationKey = String(options.reservationKey || "");
  if (reservationKey.length < 16 || reservationKey.length > 500) {
    fail("INVALID_RESERVATION_KEY", "Reservation key must contain between 16 and 500 characters");
  }
  const orderId = String(options.orderId || "");
  if (!orderId) fail("ORDER_ID_REQUIRED", "Reservation requires an order ID");
  const groupKey = sha256(`inventory-reservation:${reservationKey}`);
  const requestHash = sha256(JSON.stringify({ orderId, lines }));
  const now = options.now instanceof Date ? options.now : new Date(options.now || Date.now());

  return withTransaction(options, async (client) => {
    let ttlSeconds = options.ttlSeconds;
    if (ttlSeconds === undefined || ttlSeconds === null) {
      const policy = await client.query(`
        SELECT reservation_ttl_seconds FROM pricing_policies WHERE id = 'default'
      `);
      if (!policy.rowCount) fail("PRICING_POLICY_MISSING", "Default pricing policy is missing");
      ttlSeconds = policy.rows[0].reservation_ttl_seconds;
    }
    if (!Number.isInteger(ttlSeconds) || ttlSeconds < 60 || ttlSeconds > 86400) {
      fail("INVALID_RESERVATION_TTL", "Reservation TTL is outside the configured safety range");
    }
    const expiresAt = new Date(now.getTime() + (ttlSeconds * 1000));

    const inserted = await client.query(`
      INSERT INTO inventory_reservation_groups (
        group_key, order_id, request_hash, expires_at
      ) VALUES ($1, $2, $3, $4)
      ON CONFLICT (group_key) DO NOTHING
      RETURNING group_key
    `, [groupKey, orderId, requestHash, expiresAt]);

    const group = await client.query(`
      SELECT group_key, order_id, request_hash, status
        FROM inventory_reservation_groups
       WHERE group_key = $1
       FOR UPDATE
    `, [groupKey]);
    if (!group.rowCount) fail("RESERVATION_GROUP_MISSING", "Reservation group could not be created");
    const existing = group.rows[0];
    if (existing.order_id !== orderId || existing.request_hash.trim() !== requestHash) {
      fail("RESERVATION_KEY_REUSED", "Reservation key was already used for a different request");
    }
    if (!inserted.rowCount) return loadGroupResult(client, groupKey, true);

    for (const line of lines) {
      const inventoryResult = await client.query(`
        SELECT id, product_id, variant_id, tracks_stock, stock_on_hand,
               reserved_quantity, available_quantity
          FROM inventory
         WHERE product_id = $1
           AND COALESCE(variant_id, '') = COALESCE($2, '')
         FOR UPDATE
      `, [line.productId, line.variantId]);
      if (!inventoryResult.rowCount) {
        fail("INVENTORY_NOT_CONFIGURED", "Inventory record is missing", {
          productId: line.productId,
          variantId: line.variantId,
        });
      }
      const inventory = inventoryResult.rows[0];
      if (!inventory.tracks_stock) continue;
      if (inventory.available_quantity < line.quantity) {
        fail("INSUFFICIENT_STOCK", "Requested quantity exceeds available stock", {
          productId: line.productId,
          variantId: line.variantId,
          requested: line.quantity,
          available: inventory.available_quantity,
        });
      }

      const updated = await client.query(`
        UPDATE inventory
           SET reserved_quantity = reserved_quantity + $2,
               version = version + 1,
               updated_at = $3
         WHERE id = $1
           AND available_quantity >= $2
         RETURNING stock_on_hand, reserved_quantity, available_quantity
      `, [inventory.id, line.quantity, now]);
      if (!updated.rowCount) fail("INSUFFICIENT_STOCK", "Stock changed during reservation");

      const reservation = await client.query(`
        INSERT INTO inventory_reservations (
          order_id, order_item_id, inventory_id, quantity, expires_at,
          reservation_group_key, metadata
        ) VALUES ($1, $2, $3, $4, $5, $6, $7)
        RETURNING id
      `, [
        orderId,
        line.orderItemId,
        inventory.id,
        line.quantity,
        expiresAt,
        groupKey,
        { requestId: options.requestId || null },
      ]);
      const balance = updated.rows[0];
      await client.query(`
        INSERT INTO inventory_movements (
          inventory_id, order_id, reservation_id, movement_type,
          stock_delta, reserved_delta, event_key, actor_type, actor_id,
          source, request_id, stock_on_hand_after, reserved_quantity_after
        ) VALUES ($1, $2, $3, 'reservation', 0, $4, $5, $6, $7, $8, $9, $10, $11)
      `, [
        inventory.id,
        orderId,
        reservation.rows[0].id,
        line.quantity,
        sha256(`${groupKey}:reserve:${inventory.id}`),
        movementActorType(actor.type),
        actor.id,
        options.source || "checkout.inventory",
        options.requestId || null,
        balance.stock_on_hand,
        balance.reserved_quantity,
      ]);
    }

    await insertAudit(client, {
      actor,
      action: "inventory.reserved",
      entityType: "order",
      entityId: orderId,
      newValues: { reservationGroupKey: groupKey, expiresAt: expiresAt.toISOString() },
      source: options.source || "checkout.inventory",
      requestId: options.requestId,
    });
    return loadGroupResult(client, groupKey, false);
  });
}

async function transitionGroup(client, options) {
  const actor = normalizeActor(options.actor);
  const now = options.now instanceof Date ? options.now : new Date(options.now || Date.now());
  const group = await client.query(`
    SELECT group_key, order_id, status, expires_at
      FROM inventory_reservation_groups
     WHERE group_key = $1
     FOR UPDATE
  `, [options.groupKey]);
  if (!group.rowCount) fail("RESERVATION_NOT_FOUND", "Inventory reservation group does not exist");
  const current = group.rows[0];
  if (current.status === options.targetStatus) {
    return loadGroupResult(client, options.groupKey, true);
  }
  if (current.status !== "active") {
    fail("RESERVATION_NOT_ACTIVE", `Reservation is already ${current.status}`, {
      status: current.status,
    });
  }

  const rows = await client.query(`
    SELECT r.id, r.inventory_id, r.quantity, i.stock_on_hand, i.reserved_quantity
      FROM inventory_reservations r
      JOIN inventory i ON i.id = r.inventory_id
     WHERE r.reservation_group_key = $1 AND r.status = 'active'
     ORDER BY i.id
     FOR UPDATE OF r, i
  `, [options.groupKey]);

  for (const row of rows.rows) {
    const consume = options.targetStatus === "consumed";
    const updated = await client.query(consume ? `
      UPDATE inventory
         SET stock_on_hand = stock_on_hand - $2,
             reserved_quantity = reserved_quantity - $2,
             version = version + 1,
             updated_at = $3
       WHERE id = $1 AND stock_on_hand >= $2 AND reserved_quantity >= $2
       RETURNING stock_on_hand, reserved_quantity
    ` : `
      UPDATE inventory
         SET reserved_quantity = reserved_quantity - $2,
             version = version + 1,
             updated_at = $3
       WHERE id = $1 AND reserved_quantity >= $2
       RETURNING stock_on_hand, reserved_quantity
    `, [row.inventory_id, row.quantity, now]);
    if (!updated.rowCount) fail("INVENTORY_INVARIANT_VIOLATION", "Inventory balance is inconsistent");

    await client.query(`
      UPDATE inventory_reservations
         SET status = $2,
             consumed_at = CASE WHEN $2 = 'consumed' THEN $3 ELSE consumed_at END,
             released_at = CASE WHEN $2 IN ('released', 'expired') THEN $3 ELSE released_at END,
             release_reason = CASE WHEN $2 IN ('released', 'expired') THEN $4 ELSE release_reason END,
             version = version + 1,
             updated_at = $3
       WHERE id = $1
    `, [row.id, options.targetStatus, now, options.reason || null]);

    const balance = updated.rows[0];
    await client.query(`
      INSERT INTO inventory_movements (
        inventory_id, order_id, reservation_id, movement_type,
        stock_delta, reserved_delta, event_key, reason,
        actor_type, actor_id, source, request_id,
        stock_on_hand_after, reserved_quantity_after
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
      ON CONFLICT (event_key) DO NOTHING
    `, [
      row.inventory_id,
      current.order_id,
      row.id,
      consume ? "sale" : "reservation_release",
      consume ? -row.quantity : 0,
      -row.quantity,
      sha256(`${options.operationKey}:${row.id}:${options.targetStatus}`),
      options.reason || null,
      movementActorType(actor.type),
      actor.id,
      options.source,
      options.requestId || null,
      balance.stock_on_hand,
      balance.reserved_quantity,
    ]);
  }

  await client.query(`
    UPDATE inventory_reservation_groups
       SET status = $2, updated_at = $3
     WHERE group_key = $1
  `, [options.groupKey, options.targetStatus, now]);
  await insertAudit(client, {
    actor,
    action: options.targetStatus === "consumed" ? "inventory.consumed" : "inventory.released",
    entityType: "order",
    entityId: current.order_id,
    oldValues: { reservationStatus: "active" },
    newValues: { reservationStatus: options.targetStatus, reason: options.reason || null },
    source: options.source,
    requestId: options.requestId,
  });
  return loadGroupResult(client, options.groupKey, false);
}

async function changeReservation(options, targetStatus) {
  const reservationKey = String(options.reservationKey || "");
  if (reservationKey.length < 16) fail("INVALID_RESERVATION_KEY", "Reservation key is invalid");
  const operationKey = String(options.operationKey || "");
  if (operationKey.length < 16) fail("INVALID_OPERATION_KEY", "Inventory operation key is invalid");
  const groupKey = sha256(`inventory-reservation:${reservationKey}`);
  return withTransaction(options, (client) => transitionGroup(client, {
    ...options,
    groupKey,
    operationKey,
    targetStatus,
    source: options.source || "inventory.lifecycle",
  }));
}

function consumeInventoryReservation(options) {
  return changeReservation(options, "consumed");
}

async function consumeInventoryReservationGroup(options) {
  if (!/^[0-9a-f]{64}$/.test(String(options.groupKey || ""))) {
    fail("INVALID_RESERVATION_GROUP_KEY", "Reservation group hash is invalid");
  }
  const operationKey = String(options.operationKey || "");
  if (operationKey.length < 16) fail("INVALID_OPERATION_KEY", "Inventory operation key is invalid");
  return withTransaction(options, (client) => transitionGroup(client, {
    ...options,
    groupKey: String(options.groupKey),
    operationKey,
    targetStatus: "consumed",
    source: options.source || "inventory.lifecycle",
  }));
}

function releaseInventoryReservation(options) {
  return changeReservation(options, options.expired ? "expired" : "released");
}

async function releaseInventoryReservationGroup(options) {
  if (!/^[0-9a-f]{64}$/.test(String(options.groupKey || ""))) {
    fail("INVALID_RESERVATION_GROUP_KEY", "Reservation group hash is invalid");
  }
  const operationKey = String(options.operationKey || "");
  if (operationKey.length < 16) fail("INVALID_OPERATION_KEY", "Inventory operation key is invalid");
  return withTransaction(options, (client) => transitionGroup(client, {
    ...options,
    groupKey: String(options.groupKey),
    operationKey,
    targetStatus: options.expired ? "expired" : "released",
    source: options.source || "inventory.lifecycle",
  }));
}

async function expireInventoryReservations(options) {
  const now = options.now instanceof Date ? options.now : new Date(options.now || Date.now());
  return withTransaction(options, async (client) => {
    let batchSize = options.batchSize;
    if (!batchSize) {
      const policy = await client.query(`
        SELECT reservation_expiry_batch_size FROM pricing_policies WHERE id = 'default'
      `);
      batchSize = policy.rows[0]?.reservation_expiry_batch_size || 100;
    }
    const groups = await client.query(`
      SELECT group_key
        FROM inventory_reservation_groups
       WHERE status = 'active' AND expires_at <= $1
       ORDER BY expires_at
       FOR UPDATE SKIP LOCKED
       LIMIT $2
    `, [now, batchSize]);
    const results = [];
    for (const row of groups.rows) {
      results.push(await transitionGroup(client, {
        groupKey: row.group_key.trim(),
        targetStatus: "expired",
        operationKey: `expiry:${row.group_key.trim()}`,
        reason: "reservation_expired",
        actor: { type: "system", id: options.workerId || "inventory-expiry" },
        source: "inventory.expiry_worker",
        requestId: options.requestId || null,
        now,
      }));
    }
    return { processed: results.length, groups: results };
  });
}

async function restockInventory(options) {
  const quantity = options.quantity;
  if (!Number.isSafeInteger(quantity) || quantity < 1) {
    fail("INVALID_INVENTORY_QUANTITY", "Restock quantity must be a positive integer");
  }
  const operationKey = String(options.operationKey || "");
  if (operationKey.length < 16) fail("INVALID_OPERATION_KEY", "Restock operation key is invalid");
  const actor = normalizeActor(options.actor);
  const now = options.now instanceof Date ? options.now : new Date(options.now || Date.now());
  return withTransaction(options, async (client) => {
    const eventKey = sha256(`inventory-restock:${operationKey}`);
    const existing = await client.query(`
      SELECT inventory_id, stock_on_hand_after, reserved_quantity_after
        FROM inventory_movements WHERE event_key = $1
    `, [eventKey]);
    if (existing.rowCount) return { idempotent: true, ...existing.rows[0] };
    const inventory = await client.query(`
      SELECT id FROM inventory WHERE id = $1 FOR UPDATE
    `, [options.inventoryId]);
    if (!inventory.rowCount) fail("INVENTORY_NOT_FOUND", "Inventory record does not exist");
    const updated = await client.query(`
      UPDATE inventory
         SET stock_on_hand = stock_on_hand + $2,
             version = version + 1,
             updated_at = $3
       WHERE id = $1
       RETURNING stock_on_hand, reserved_quantity, available_quantity
    `, [options.inventoryId, quantity, now]);
    const balance = updated.rows[0];
    const movement = await client.query(`
      INSERT INTO inventory_movements (
        inventory_id, order_id, movement_type, stock_delta, reserved_delta,
        event_key, reason, actor_type, actor_id, source, request_id,
        stock_on_hand_after, reserved_quantity_after
      ) VALUES ($1, $2, $3, $4, 0, $5, $6, $7, $8, $9, $10, $11, $12)
      RETURNING id
    `, [
      options.inventoryId,
      options.orderId || null,
      options.movementType === "return_restock" ? "return_restock" : "restock",
      quantity,
      eventKey,
      options.reason || null,
      movementActorType(actor.type),
      actor.id,
      options.source || "inventory.restock",
      options.requestId || null,
      balance.stock_on_hand,
      balance.reserved_quantity,
    ]);
    await insertAudit(client, {
      actor,
      action: "inventory.restocked",
      entityType: "inventory",
      entityId: options.inventoryId,
      newValues: { quantity, stockOnHand: balance.stock_on_hand },
      source: options.source || "inventory.restock",
      requestId: options.requestId,
    });
    return {
      idempotent: false,
      movementId: movement.rows[0].id,
      inventoryId: options.inventoryId,
      stockOnHand: balance.stock_on_hand,
      reservedQuantity: balance.reserved_quantity,
      availableQuantity: balance.available_quantity,
    };
  });
}

module.exports = {
  InventoryServiceError,
  consumeInventoryReservation,
  consumeInventoryReservationGroup,
  expireInventoryReservations,
  releaseInventoryReservation,
  releaseInventoryReservationGroup,
  reserveInventory,
  restockInventory,
  sha256,
};
