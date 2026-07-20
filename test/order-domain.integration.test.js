"use strict";

const assert = require("node:assert/strict");
const crypto = require("node:crypto");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const { Pool } = require("pg");

const { loadMigrations, runMigrations } = require("../server/migrate");

const TEST_DATABASE_URL = process.env.TEST_DATABASE_URL || "";
const MIGRATIONS_DIR = path.join(__dirname, "..", "server", "migrations");
const MIGRATION_VERSIONS = loadMigrations(MIGRATIONS_DIR).map((migration) => migration.version);

function safeTestDatabaseUrl(value) {
  if (!value) return false;
  const parsed = new URL(value);
  return parsed.pathname.toLowerCase().includes("test");
}

function schemaName(prefix) {
  return `${prefix}_${process.pid}_${crypto.randomBytes(4).toString("hex")}`;
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
        created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
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

async function dropSchema(pool, schema) {
  await pool.query(`DROP SCHEMA IF EXISTS ${quoteIdentifier(schema)} CASCADE`);
}

const integrationOptions = {
  skip: !safeTestDatabaseUrl(TEST_DATABASE_URL)
    ? "Set TEST_DATABASE_URL to a dedicated database whose name contains 'test'"
    : false,
};

test("Phase 1 migrations enforce domain invariants and idempotency", integrationOptions, async () => {
  const pool = new Pool({ connectionString: TEST_DATABASE_URL });
  const schema = schemaName("phase1_constraints");
  try {
    await createLegacySchema(pool, schema);
    const applied = await runMigrations({
      pool,
      schema,
      directory: MIGRATIONS_DIR,
      direction: "up",
    });
    assert.deepEqual(applied.map((entry) => entry.version), MIGRATION_VERSIONS);

    const client = await pool.connect();
    try {
      await client.query(`SET search_path TO ${quoteIdentifier(schema)}, public`);
      const tables = await client.query(`
        SELECT table_name FROM information_schema.tables
        WHERE table_schema = $1
      `, [schema]);
      const names = new Set(tables.rows.map((row) => row.table_name));
      for (const expected of [
        "order_items", "payments", "payment_events", "shipments", "inventory",
        "inventory_reservations", "inventory_movements", "order_status_history",
        "audit_logs", "returns", "return_items", "refunds", "idempotency_keys",
        "risk_assessments", "notification_outbox", "fiscal_documents",
      ]) {
        assert.equal(names.has(expected), true, `missing ${expected}`);
      }

      await client.query(`
        INSERT INTO orders (id, number, status, payment_status, shipping_status)
        VALUES ('order-1', 'N-1', 'new', 'pending', 'not_ready')
      `);
      await assert.rejects(
        client.query("UPDATE orders SET order_status_v2 = 'anything' WHERE id = 'order-1'"),
        /orders_order_status_v2_check/
      );
      await assert.rejects(
        client.query(`
          INSERT INTO order_items (
            order_id, line_number, product_id, product_name, sku, quantity,
            unit_price, original_unit_price, discount_amount, vat_rate,
            vat_amount, line_subtotal, line_total, currency
          ) VALUES (
            'order-1', 1, 'product-1', 'Product', 'SKU-1', -1,
            10, 10, 0, 24, 1.94, 8.06, 10, 'EUR'
          )
        `),
        /order_items_quantity_check/
      );
      await client.query(`
        INSERT INTO order_items (
          order_id, line_number, product_id, product_name, sku, quantity,
          unit_price, original_unit_price, discount_amount, vat_rate,
          vat_amount, line_subtotal, line_total, currency
        ) VALUES (
          'order-1', 1, 'product-1', 'Product', 'SKU-1', 1,
          10, 10, 0, 24, 1.94, 8.06, 10, 'EUR'
        )
      `);
      await assert.rejects(
        client.query("UPDATE order_items SET product_name = 'Changed'"),
        /append-only/
      );
      await assert.rejects(
        client.query(`
          INSERT INTO order_status_history (
            order_id, axis, from_status, to_status, actor_type, source
          ) VALUES ('order-1', 'order', 'paid', 'confirmed', 'system', 'test')
        `),
        /order_status_history_check/
      );
      await assert.rejects(
        client.query(`
          INSERT INTO inventory (product_id, stock_on_hand, reserved_quantity)
          VALUES ('product-1', 1, 2)
        `),
        /inventory_check/
      );

      const eventPayload = JSON.stringify({ id: "evt_1", type: "checkout.completed" });
      const eventHash = crypto.createHash("sha256").update(eventPayload).digest("hex");
      await client.query(`
        INSERT INTO payment_events (
          provider, provider_event_id, event_type, signature_verified,
          raw_event, raw_event_sha256
        ) VALUES ('stripe', 'evt_1', 'checkout.completed', true, $1, $2)
      `, [eventPayload, eventHash]);
      await assert.rejects(
        client.query(`
          INSERT INTO payment_events (
            provider, provider_event_id, event_type, signature_verified,
            raw_event, raw_event_sha256
          ) VALUES ('stripe', 'evt_1', 'checkout.completed', true, $1, $2)
        `, [eventPayload, eventHash]),
        /payment_events_provider_provider_event_id_key/
      );

      const hashA = "a".repeat(64);
      const hashB = "b".repeat(64);
      await client.query(`
        INSERT INTO idempotency_keys (scope, key_hash, request_hash, expires_at)
        VALUES ('checkout', $1, $2, now() + interval '1 day')
      `, [hashA, hashB]);
      await assert.rejects(
        client.query(`
          INSERT INTO idempotency_keys (scope, key_hash, request_hash, expires_at)
          VALUES ('checkout', $1, $2, now() + interval '1 day')
        `, [hashA, hashB]),
        /idempotency_keys_scope_key_hash_key/
      );

      const rls = await client.query(`
        SELECT relrowsecurity FROM pg_class
        WHERE oid = 'order_items'::regclass
      `);
      assert.equal(rls.rows[0].relrowsecurity, true);

      const downSql = fs.readFileSync(
        path.join(MIGRATIONS_DIR, "001_phase1_order_domain.down.sql"),
        "utf8"
      );
      await assert.rejects(client.query(downSql), /contains V2 data/);
    } finally {
      client.release();
    }

    const status = await runMigrations({
      pool,
      schema,
      directory: MIGRATIONS_DIR,
      direction: "status",
    });
    assert.deepEqual(status.map((entry) => entry.status),
      MIGRATION_VERSIONS.map(() => "applied"));
  } finally {
    await dropSchema(pool, schema);
    await pool.end();
  }
});

test("migration lock serializes concurrent runners and clean rollback works", integrationOptions, async () => {
  const pool = new Pool({ connectionString: TEST_DATABASE_URL, max: 4 });
  const schema = schemaName("phase1_concurrency");
  try {
    await createLegacySchema(pool, schema);
    const initialStatus = await runMigrations({
      pool,
      schema,
      directory: MIGRATIONS_DIR,
      direction: "status",
    });
    assert.deepEqual(initialStatus.map((entry) => entry.status),
      MIGRATION_VERSIONS.map(() => "pending"));
    const ledgerBeforeUp = await pool.query(`
      SELECT to_regclass('${schema}.schema_migrations') AS ledger
    `);
    assert.equal(ledgerBeforeUp.rows[0].ledger, null);

    const [first, second] = await Promise.all([
      runMigrations({ pool, schema, directory: MIGRATIONS_DIR, direction: "up" }),
      runMigrations({ pool, schema, directory: MIGRATIONS_DIR, direction: "up" }),
    ]);
    assert.deepEqual([first.length, second.length].sort((a, b) => a - b),
      [0, MIGRATION_VERSIONS.length]);

    const rolledBack = await runMigrations({
      pool,
      schema,
      directory: MIGRATIONS_DIR,
      direction: "down",
      count: MIGRATION_VERSIONS.length,
    });
    assert.deepEqual(rolledBack.map((entry) => entry.version),
      [...MIGRATION_VERSIONS].sort((a, b) => b - a));

    const client = await pool.connect();
    try {
      await client.query(`SET search_path TO ${quoteIdentifier(schema)}, public`);
      const domainTable = await client.query("SELECT to_regclass('order_items') AS name");
      assert.equal(domainTable.rows[0].name, null);
      const v2Column = await client.query(`
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = $1 AND table_name = 'orders' AND column_name = 'order_status_v2'
      `, [schema]);
      assert.equal(v2Column.rowCount, 0);
    } finally {
      client.release();
    }
  } finally {
    await dropSchema(pool, schema);
    await pool.end();
  }
});
