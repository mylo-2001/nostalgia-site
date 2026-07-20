"use strict";

const assert = require("node:assert/strict");
const crypto = require("node:crypto");
const path = require("node:path");
const test = require("node:test");
const { Pool } = require("pg");

const { runMigrations } = require("../server/migrate");
const {
  createCheckoutOrder,
  OrderCreationError,
} = require("../server/services/order-creation-service");
const {
  createLegacyOrderSchema,
  quoteIdentifier,
  scopedPool,
} = require("./helpers/legacy-order-schema");

const TEST_DATABASE_URL = process.env.TEST_DATABASE_URL || "";
const MIGRATIONS_DIR = path.join(__dirname, "..", "server", "migrations");
const GUEST_SECRET = "phase5-test-secret-that-is-long-enough";

function safeTestDatabaseUrl(value) {
  return !!value && new URL(value).pathname.toLowerCase().includes("test");
}

function checkoutRequest(quantity = 1) {
  return {
    items: [{ productId: "cu-order", quantity }],
    shippingMethodId: "home",
    paymentMethod: "card",
    destinationCountry: "GR",
    customer: {
      firstName: "Ada",
      lastName: "Lovelace",
      email: "ada@example.com",
      phone: "+306900000000",
    },
    shippingAddress: {
      firstName: "Ada",
      lastName: "Lovelace",
      line1: "Example 1",
      city: "Athens",
      postalCode: "10558",
      countryCode: "GR",
      phone: "+306900000000",
    },
  };
}

const integrationOptions = {
  skip: !safeTestDatabaseUrl(TEST_DATABASE_URL)
    ? "Set TEST_DATABASE_URL to a dedicated database whose name contains 'test'"
    : false,
};

test("Phase 5 creates one server-priced order for duplicate checkout requests", integrationOptions, async () => {
  const pool = new Pool({ connectionString: TEST_DATABASE_URL, max: 8 });
  const schema = `phase5_order_${process.pid}_${crypto.randomBytes(4).toString("hex")}`;
  const scoped = scopedPool(pool, schema);
  try {
    await createLegacyOrderSchema(pool, schema);
    await runMigrations({
      pool,
      schema,
      directory: MIGRATIONS_DIR,
      direction: "up",
      targetVersion: 9,
    });
    const seed = await scoped.connect();
    try {
      await seed.query(`
        INSERT INTO shipping_methods (
          id, name, base_fee, cod_fee, shipping_vat_rate, cod_vat_rate,
          supported_country_codes
        ) VALUES ('home', 'Home', 3.50, 3.50, 24, 24, '["GR"]');
        INSERT INTO tax_rates (
          country_code, tax_category, rate, prices_include_tax, valid_from
        ) VALUES ('GR', 'standard', 24, TRUE, '2020-01-01T00:00:00Z');
        INSERT INTO products (id, cat_id, title, price, active, sku)
        VALUES ('cu-order', 'cat1', 'Order candle', 10.00, TRUE, 'ORDER-1');
        INSERT INTO catalog_overrides (id, stock) VALUES ('cu-order', 2);
        INSERT INTO inventory (product_id, sku, stock_on_hand)
        VALUES ('cu-order', 'ORDER-1', 2);
      `);
    } finally {
      seed.release();
    }

    const options = {
      pool: scoped,
      request: checkoutRequest(),
      idempotencyKey: "checkout-idempotency-key-0001",
      identity: { type: "guest" },
      guestTokenSecret: GUEST_SECRET,
      logger: null,
    };
    const results = await Promise.all([
      createCheckoutOrder(options),
      createCheckoutOrder(options),
    ]);
    assert.equal(results[0].orderId, results[1].orderId);
    assert.equal(results[0].guestAccessToken, results[1].guestAccessToken);
    assert.equal(results[0].grandTotal, "13.50");

    const verify = await scoped.connect();
    try {
      const counts = await verify.query(`
        SELECT
          (SELECT COUNT(*)::int FROM orders) AS orders,
          (SELECT COUNT(*)::int FROM order_items) AS items,
          (SELECT COUNT(*)::int FROM inventory_reservation_groups) AS groups,
          (SELECT COUNT(*)::int FROM audit_logs WHERE action = 'order.created') AS order_audits,
          (SELECT reserved_quantity FROM inventory WHERE product_id = 'cu-order') AS reserved
      `);
      assert.deepEqual(counts.rows[0], {
        orders: 1,
        items: 1,
        groups: 1,
        order_audits: 1,
        reserved: 1,
      });
      const tokenStorage = await verify.query(`
        SELECT guest_access_token_hash, pricing_snapshot->'breakdown'->>'grandTotal' AS total,
               checkout_request_hash, reservation_group_key
          FROM orders
      `);
      assert.match(tokenStorage.rows[0].guest_access_token_hash.trim(), /^[0-9a-f]{64}$/);
      assert.notEqual(tokenStorage.rows[0].guest_access_token_hash.trim(), results[0].guestAccessToken);
      assert.equal(tokenStorage.rows[0].total, "13.50");
      assert.match(tokenStorage.rows[0].checkout_request_hash.trim(), /^[0-9a-f]{64}$/);
      assert.match(tokenStorage.rows[0].reservation_group_key.trim(), /^[0-9a-f]{64}$/);
    } finally {
      verify.release();
    }

    await assert.rejects(
      createCheckoutOrder({ ...options, request: checkoutRequest(2) }),
      (error) => error instanceof OrderCreationError && error.code === "IDEMPOTENCY_KEY_REUSED"
    );
    await assert.rejects(
      createCheckoutOrder({
        ...options,
        idempotencyKey: "checkout-idempotency-key-0002",
        request: { ...checkoutRequest(), total: "0.01" },
      }),
      (error) => error.code === "CLIENT_PRICING_FIELD_FORBIDDEN"
    );

    await runMigrations({
      pool,
      schema,
      directory: MIGRATIONS_DIR,
      direction: "down",
      count: 2,
      targetVersion: 9,
    });
    const rollback = await scoped.connect();
    try {
      const result = await rollback.query(`
        SELECT NOT EXISTS (
          SELECT 1 FROM information_schema.columns
           WHERE table_schema = $1 AND table_name = 'orders'
             AND column_name = 'checkout_request_hash'
        ) AS removed
      `, [schema]);
      assert.equal(result.rows[0].removed, true);
    } finally {
      rollback.release();
    }
  } finally {
    await pool.end();
    const cleanup = new Pool({ connectionString: TEST_DATABASE_URL, max: 1 });
    try {
      await cleanup.query(`DROP SCHEMA IF EXISTS ${quoteIdentifier(schema)} CASCADE`);
    } finally {
      await cleanup.end();
    }
  }
});
