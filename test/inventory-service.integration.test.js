"use strict";

const assert = require("node:assert/strict");
const crypto = require("node:crypto");
const path = require("node:path");
const test = require("node:test");
const { Pool } = require("pg");

const { runMigrations } = require("../server/migrate");
const {
  consumeInventoryReservation,
  expireInventoryReservations,
  releaseInventoryReservation,
  reserveInventory,
} = require("../server/services/inventory-service");
const {
  createLegacyOrderSchema,
  quoteIdentifier,
  scopedPool,
} = require("./helpers/legacy-order-schema");

const TEST_DATABASE_URL = process.env.TEST_DATABASE_URL || "";
const MIGRATIONS_DIR = path.join(__dirname, "..", "server", "migrations");

function safeTestDatabaseUrl(value) {
  return !!value && new URL(value).pathname.toLowerCase().includes("test");
}

async function seedOrder(client, id, number, productId, sku) {
  await client.query(`
    INSERT INTO orders (id, number, status, payment_status, shipping_status)
    VALUES ($1, $2, 'new', 'pending', 'not_ready')
  `, [id, number]);
  const item = await client.query(`
    INSERT INTO order_items (
      order_id, line_number, product_id, product_name, sku, quantity,
      unit_price, original_unit_price, discount_amount, vat_rate,
      vat_amount, line_subtotal, line_total, currency
    ) VALUES ($1, 1, $2, 'Test product', $3, 1, 10, 10, 0, 24, 1.94, 10, 10, 'EUR')
    RETURNING id
  `, [id, productId, sku]);
  return item.rows[0].id;
}

const integrationOptions = {
  skip: !safeTestDatabaseUrl(TEST_DATABASE_URL)
    ? "Set TEST_DATABASE_URL to a dedicated database whose name contains 'test'"
    : false,
};

test("Phase 4 prevents overselling and handles consume, release and expiry races", integrationOptions, async () => {
  const pool = new Pool({ connectionString: TEST_DATABASE_URL, max: 8 });
  const schema = `phase4_inventory_${process.pid}_${crypto.randomBytes(4).toString("hex")}`;
  const scoped = scopedPool(pool, schema);
  try {
    await createLegacyOrderSchema(pool, schema);
    await runMigrations({
      pool,
      schema,
      directory: MIGRATIONS_DIR,
      direction: "up",
      targetVersion: 7,
    });
    const seed = await scoped.connect();
    let itemA;
    let itemB;
    try {
      itemA = await seedOrder(seed, "order-a", "INV-A", "last-one", "LAST-1");
      itemB = await seedOrder(seed, "order-b", "INV-B", "last-one", "LAST-1");
      await seed.query(`
        INSERT INTO inventory (product_id, sku, stock_on_hand)
        VALUES ('last-one', 'LAST-1', 1)
      `);
    } finally {
      seed.release();
    }

    const attempts = await Promise.allSettled([
      reserveInventory({
        pool: scoped,
        orderId: "order-a",
        reservationKey: "checkout-reservation-order-a",
        lines: [{ productId: "last-one", orderItemId: itemA, quantity: 1 }],
      }),
      reserveInventory({
        pool: scoped,
        orderId: "order-b",
        reservationKey: "checkout-reservation-order-b",
        lines: [{ productId: "last-one", orderItemId: itemB, quantity: 1 }],
      }),
    ]);
    assert.equal(attempts.filter((entry) => entry.status === "fulfilled").length, 1);
    assert.equal(attempts.filter((entry) => entry.status === "rejected").length, 1);
    const winnerIndex = attempts.findIndex((entry) => entry.status === "fulfilled");
    const winnerKey = winnerIndex === 0
      ? "checkout-reservation-order-a"
      : "checkout-reservation-order-b";

    const consumed = await consumeInventoryReservation({
      pool: scoped,
      reservationKey: winnerKey,
      operationKey: `consume-${winnerKey}`,
      source: "payment.webhook",
    });
    assert.equal(consumed.status, "consumed");
    const duplicate = await consumeInventoryReservation({
      pool: scoped,
      reservationKey: winnerKey,
      operationKey: `consume-${winnerKey}`,
      source: "payment.webhook",
    });
    assert.equal(duplicate.idempotent, true);

    const verify = await scoped.connect();
    try {
      const inventory = await verify.query(`
        SELECT stock_on_hand, reserved_quantity, available_quantity
          FROM inventory WHERE product_id = 'last-one'
      `);
      assert.deepEqual(inventory.rows[0], {
        stock_on_hand: 0,
        reserved_quantity: 0,
        available_quantity: 0,
      });
      const sales = await verify.query(`
        SELECT COUNT(*)::int AS count FROM inventory_movements
         WHERE movement_type = 'sale' AND inventory_id = (
           SELECT id FROM inventory WHERE product_id = 'last-one'
         )
      `);
      assert.equal(sales.rows[0].count, 1);

      const itemC = await seedOrder(verify, "order-c", "INV-C", "release-one", "REL-1");
      await verify.query(`
        INSERT INTO inventory (product_id, sku, stock_on_hand)
        VALUES ('release-one', 'REL-1', 2)
      `);
      await reserveInventory({
        client: verify,
        orderId: "order-c",
        reservationKey: "checkout-reservation-order-c",
        lines: [{ productId: "release-one", orderItemId: itemC, quantity: 1 }],
      });
    } finally {
      verify.release();
    }
    const released = await releaseInventoryReservation({
      pool: scoped,
      reservationKey: "checkout-reservation-order-c",
      operationKey: "release-checkout-order-c",
      reason: "payment_failed",
    });
    assert.equal(released.status, "released");

    const raceSeed = await scoped.connect();
    try {
      const itemD = await seedOrder(raceSeed, "order-d", "INV-D", "race-one", "RACE-1");
      await raceSeed.query(`
        INSERT INTO inventory (product_id, sku, stock_on_hand)
        VALUES ('race-one', 'RACE-1', 1)
      `);
      await reserveInventory({
        client: raceSeed,
        orderId: "order-d",
        reservationKey: "checkout-reservation-order-d",
        lines: [{ productId: "race-one", orderItemId: itemD, quantity: 1 }],
        ttlSeconds: 60,
      });
    } finally {
      raceSeed.release();
    }
    const future = new Date(Date.now() + 61000);
    await Promise.allSettled([
      consumeInventoryReservation({
        pool: scoped,
        reservationKey: "checkout-reservation-order-d",
        operationKey: "consume-checkout-order-d",
        now: future,
      }),
      expireInventoryReservations({ pool: scoped, now: future, batchSize: 10 }),
    ]);
    const raceCheck = await scoped.connect();
    try {
      const state = await raceCheck.query(`
        SELECT g.status, i.stock_on_hand, i.reserved_quantity, i.available_quantity
          FROM inventory_reservation_groups g
          JOIN inventory_reservations r ON r.reservation_group_key = g.group_key
          JOIN inventory i ON i.id = r.inventory_id
         WHERE g.order_id = 'order-d'
      `);
      assert.ok(['consumed', 'expired'].includes(state.rows[0].status));
      assert.equal(state.rows[0].reserved_quantity, 0);
      assert.equal(state.rows[0].available_quantity, state.rows[0].stock_on_hand);
    } finally {
      raceCheck.release();
    }

    await runMigrations({
      pool,
      schema,
      directory: MIGRATIONS_DIR,
      direction: "down",
      count: 2,
      targetVersion: 7,
    });
    const rolledBack = await scoped.connect();
    try {
      const result = await rolledBack.query(`
        SELECT to_regclass('inventory_reservation_groups') IS NULL AS groups_removed
      `);
      assert.equal(result.rows[0].groups_removed, true);
    } finally {
      rolledBack.release();
    }
  } finally {
    await pool.query(`DROP SCHEMA IF EXISTS ${quoteIdentifier(schema)} CASCADE`);
    await pool.end();
  }
});

