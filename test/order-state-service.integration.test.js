"use strict";

const assert = require("node:assert/strict");
const crypto = require("node:crypto");
const path = require("node:path");
const test = require("node:test");
const { Pool } = require("pg");

const { runMigrations } = require("../server/migrate");
const {
  OrderStateServiceError,
  transitionOrderState,
} = require("../server/services/order-state-service");

const TEST_DATABASE_URL = process.env.TEST_DATABASE_URL || "";
const MIGRATIONS_DIR = path.join(__dirname, "..", "server", "migrations");

function safeTestDatabaseUrl(value) {
  if (!value) return false;
  return new URL(value).pathname.toLowerCase().includes("test");
}

function quoteIdentifier(value) {
  return `"${value.replace(/"/g, '""')}"`;
}

async function createLegacySchema(pool, schema) {
  await pool.query(`CREATE SCHEMA ${quoteIdentifier(schema)}`);
  const client = await pool.connect();
  try {
    await client.query(`SET search_path TO ${quoteIdentifier(schema)}, public`);
    await client.query(`
      CREATE TABLE orders (
        id              TEXT PRIMARY KEY,
        number          TEXT UNIQUE NOT NULL,
        status          TEXT NOT NULL DEFAULT 'new',
        payment_status  TEXT NOT NULL DEFAULT 'pending',
        shipping_status TEXT NOT NULL DEFAULT 'not_ready',
        user_email      TEXT,
        created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
        updated_at      TIMESTAMPTZ
      );

      CREATE TABLE products (
        id TEXT PRIMARY KEY,
        cat_id TEXT NOT NULL,
        title TEXT NOT NULL,
        price NUMERIC(10,2),
        sale_price NUMERIC(10,2),
        sale_until TIMESTAMPTZ,
        active BOOLEAN NOT NULL DEFAULT TRUE,
        created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
        updated_at TIMESTAMPTZ
      );
      CREATE TABLE catalog_overrides (
        id TEXT PRIMARY KEY,
        stock INTEGER,
        price NUMERIC(10,2),
        sale_price NUMERIC(10,2),
        sale_until TIMESTAMPTZ
      );
      CREATE TABLE coupons (
        code TEXT PRIMARY KEY,
        type TEXT NOT NULL CHECK (type IN ('percent', 'fixed')),
        value NUMERIC(10,2) NOT NULL,
        active BOOLEAN NOT NULL DEFAULT TRUE,
        expires_at DATE,
        uses INTEGER NOT NULL DEFAULT 0,
        name TEXT NOT NULL DEFAULT '',
        max_uses INTEGER,
        free_shipping BOOLEAN NOT NULL DEFAULT FALSE,
        created_at TIMESTAMPTZ NOT NULL DEFAULT now()
      );
      CREATE TABLE product_variants (
        id TEXT PRIMARY KEY,
        product_id TEXT NOT NULL,
        color TEXT NOT NULL DEFAULT '',
        color_en TEXT NOT NULL DEFAULT '',
        sku TEXT NOT NULL DEFAULT '',
        price NUMERIC(10,2),
        sale_price NUMERIC(10,2),
        sale_until TIMESTAMPTZ,
        stock INTEGER,
        available BOOLEAN NOT NULL DEFAULT TRUE,
        position INTEGER NOT NULL DEFAULT 0,
        created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
        updated_at TIMESTAMPTZ
      )
    `);
  } finally {
    client.release();
  }
}

const integrationOptions = {
  skip: !safeTestDatabaseUrl(TEST_DATABASE_URL)
    ? "Set TEST_DATABASE_URL to a dedicated database whose name contains 'test'"
    : false,
};

test("state service commits transition, history and audit atomically", integrationOptions, async () => {
  const pool = new Pool({ connectionString: TEST_DATABASE_URL, max: 4 });
  const schema = `phase2_service_${process.pid}_${crypto.randomBytes(4).toString("hex")}`;
  const scopedPool = {
    async connect() {
      const client = await pool.connect();
      await client.query(`SET search_path TO ${quoteIdentifier(schema)}, public`);
      return client;
    },
  };
  try {
    await createLegacySchema(pool, schema);
    await runMigrations({ pool, schema, directory: MIGRATIONS_DIR, direction: "up" });
    const client = await scopedPool.connect();
    try {
      await client.query(`
        INSERT INTO orders (
          id, number, order_status_v2, payment_status_v2,
          shipping_status_v2, payment_method_v2
        ) VALUES ('state-1', 'STATE-1', 'pending', 'pending', 'not_ready', 'card')
      `);
    } finally {
      client.release();
    }

    const logs = [];
    const paid = await transitionOrderState({
      pool: scopedPool,
      orderId: "state-1",
      changes: { paymentStatus: "paid" },
      actor: { type: "provider", id: "stripe" },
      source: "stripe.webhook",
      requestId: "request-paid-1",
      metadata: { reason: "verified_provider_event", providerEventId: "evt_test_1" },
      logger: { info(entry) { logs.push(entry); } },
      expectedVersion: 1,
    });
    assert.equal(paid.version, 2);
    assert.deepEqual(paid.transitions.map((item) => item.axis), ["payment"]);
    assert.equal(logs[0].event, "order_state_transition_committed");

    await assert.rejects(
      transitionOrderState({
        pool: scopedPool,
        orderId: "state-1",
        changes: { orderStatus: "confirmed" },
        source: "admin.order",
        actor: { type: "admin", id: "admin-1" },
        expectedVersion: 1,
      }),
      (error) => error instanceof OrderStateServiceError &&
        error.code === "ORDER_VERSION_CONFLICT"
    );

    const confirmed = await transitionOrderState({
      pool: scopedPool,
      orderId: "state-1",
      changes: { orderStatus: "confirmed" },
      source: "admin.order",
      actor: { type: "admin", id: "admin-1" },
      expectedVersion: 2,
    });
    assert.equal(confirmed.version, 3);

    const noOp = await transitionOrderState({
      pool: scopedPool,
      orderId: "state-1",
      changes: { orderStatus: "confirmed" },
      source: "admin.order",
      actor: { type: "admin", id: "admin-1" },
      expectedVersion: 3,
    });
    assert.equal(noOp.noOp, true);
    assert.equal(noOp.version, 3);

    await assert.rejects(
      transitionOrderState({
        pool: scopedPool,
        orderId: "state-1",
        changes: { orderStatus: "completed" },
        source: "admin.order",
        actor: { type: "admin", id: "admin-1" },
        expectedVersion: 3,
      }),
      /Invalid order status transition/
    );

    const verification = await scopedPool.connect();
    try {
      const order = await verification.query(`
        SELECT order_status_v2, payment_status_v2, shipping_status_v2,
               version, confirmed_at
        FROM orders WHERE id = 'state-1'
      `);
      assert.deepEqual({
        orderStatus: order.rows[0].order_status_v2,
        paymentStatus: order.rows[0].payment_status_v2,
        shippingStatus: order.rows[0].shipping_status_v2,
        version: order.rows[0].version,
      }, {
        orderStatus: "confirmed",
        paymentStatus: "paid",
        shippingStatus: "not_ready",
        version: 3,
      });
      assert.ok(order.rows[0].confirmed_at);

      const history = await verification.query(
        "SELECT axis, from_status, to_status FROM order_status_history WHERE order_id = 'state-1' ORDER BY created_at"
      );
      assert.deepEqual(history.rows, [
        { axis: "payment", from_status: "pending", to_status: "paid" },
        { axis: "order", from_status: "pending", to_status: "confirmed" },
      ]);
      const audit = await verification.query(
        "SELECT action, source, request_id FROM audit_logs WHERE entity_id = 'state-1' ORDER BY created_at"
      );
      assert.equal(audit.rowCount, 2);
      assert.equal(audit.rows[0].action, "order.state_transition");
      assert.equal(audit.rows[0].source, "stripe.webhook");
      assert.equal(audit.rows[0].request_id, "request-paid-1");

      await verification.query(`
        INSERT INTO orders (
          id, number, order_status_v2, payment_status_v2,
          shipping_status_v2, payment_method_v2
        ) VALUES ('state-guard', 'STATE-GUARD', 'pending', 'pending', 'not_ready', 'card')
      `);
      await assert.rejects(
        verification.query(
          "UPDATE orders SET order_status_v2 = 'confirmed' WHERE id = 'state-guard'"
        ),
        /requires payment ready for fulfilment/
      );
      const guarded = await verification.query(
        "SELECT order_status_v2 FROM orders WHERE id = 'state-guard'"
      );
      assert.equal(guarded.rows[0].order_status_v2, "pending");
    } finally {
      verification.release();
    }
  } finally {
    await pool.query(`DROP SCHEMA IF EXISTS ${quoteIdentifier(schema)} CASCADE`);
    await pool.end();
  }
});

test("multi-axis completion is one version and one audit event", integrationOptions, async () => {
  const pool = new Pool({ connectionString: TEST_DATABASE_URL, max: 3 });
  const schema = `phase2_atomic_${process.pid}_${crypto.randomBytes(4).toString("hex")}`;
  const scopedPool = {
    async connect() {
      const client = await pool.connect();
      await client.query(`SET search_path TO ${quoteIdentifier(schema)}, public`);
      return client;
    },
  };
  try {
    await createLegacySchema(pool, schema);
    await runMigrations({ pool, schema, directory: MIGRATIONS_DIR, direction: "up" });
    const client = await scopedPool.connect();
    try {
      await client.query(`
        INSERT INTO orders (
          id, number, order_status_v2, payment_status_v2,
          shipping_status_v2, payment_method_v2
        ) VALUES ('atomic-1', 'ATOMIC-1', 'ready_to_ship', 'paid', 'in_transit', 'card')
      `);
    } finally {
      client.release();
    }

    const result = await transitionOrderState({
      pool: scopedPool,
      orderId: "atomic-1",
      changes: { orderStatus: "completed", shippingStatus: "delivered" },
      source: "courier.webhook",
      actor: { type: "provider", id: "courier" },
      expectedVersion: 1,
      logger: { info() { throw new Error("logger unavailable"); } },
    });
    assert.equal(result.version, 2);
    assert.deepEqual(result.transitions.map((item) => item.axis), ["order", "shipping"]);

    const verification = await scopedPool.connect();
    try {
      const counts = await verification.query(`
        SELECT
          (SELECT COUNT(*)::int FROM order_status_history WHERE order_id = 'atomic-1') AS history,
          (SELECT COUNT(*)::int FROM audit_logs WHERE entity_id = 'atomic-1') AS audit,
          (SELECT version FROM orders WHERE id = 'atomic-1') AS version,
          (SELECT completed_at IS NOT NULL FROM orders WHERE id = 'atomic-1') AS completed
      `);
      assert.deepEqual(counts.rows[0], {
        history: 2,
        audit: 1,
        version: 2,
        completed: true,
      });

      await verification.query(`
        INSERT INTO orders (
          id, number, order_status_v2, payment_status_v2,
          shipping_status_v2, payment_method_v2
        ) VALUES ('cancel-1', 'CANCEL-1', 'ready_to_ship', 'paid', 'in_transit', 'card')
      `);
    } finally {
      verification.release();
    }

    const cancelled = await transitionOrderState({
      pool: scopedPool,
      orderId: "cancel-1",
      changes: { orderStatus: "cancelled", shippingStatus: "returning" },
      source: "admin.order",
      actor: { type: "admin", id: "admin-1" },
      expectedVersion: 1,
    });
    assert.equal(cancelled.state.orderStatus, "cancelled");
    assert.equal(cancelled.state.shippingStatus, "returning");
  } finally {
    await pool.query(`DROP SCHEMA IF EXISTS ${quoteIdentifier(schema)} CASCADE`);
    await pool.end();
  }
});
