"use strict";

const assert = require("node:assert/strict");
const crypto = require("node:crypto");
const path = require("node:path");
const test = require("node:test");
const { Pool } = require("pg");

const { runMigrations } = require("../server/migrate");
const { createCheckoutOrder } = require("../server/services/order-creation-service");
const { transitionAdminOrder } = require("../server/services/admin-order-service");
const { createLegacyOrderSchema, quoteIdentifier, scopedPool } =
  require("./helpers/legacy-order-schema");

const TEST_DATABASE_URL = process.env.TEST_DATABASE_URL || "";
const MIGRATIONS_DIR = path.join(__dirname, "..", "server", "migrations");
const safe = (value) => !!value && new URL(value).pathname.toLowerCase().includes("test");
const opts = { skip: safe(TEST_DATABASE_URL) ? false : "Dedicated test database required" };

function checkout() {
  return {
    items: [{ productId: "admin-candle", quantity: 1 }], shippingMethodId: "home",
    paymentMethod: "cod", destinationCountry: "GR",
    customer: { firstName: "Ada", lastName: "Lovelace",
      email: "admin-test@example.com", phone: "+306900000011" },
    shippingAddress: { firstName: "Ada", lastName: "Lovelace", line1: "One 1",
      city: "Athens", postalCode: "10558", countryCode: "GR", phone: "+306900000011" },
  };
}

test("Phase 8 enforces RBAC and optimistic admin updates", opts, async () => {
  const pool = new Pool({ connectionString: TEST_DATABASE_URL, max: 10 });
  const schema = `phase8_admin_${process.pid}_${crypto.randomBytes(4).toString("hex")}`;
  const scoped = scopedPool(pool, schema);
  try {
    await createLegacyOrderSchema(pool, schema);
    await runMigrations({ pool, schema, directory: MIGRATIONS_DIR,
      direction: "up", targetVersion: 15 });
    const seed = await scoped.connect();
    let firstId;
    let secondId;
    let readOnlyId;
    try {
      const admins = await seed.query(`
        INSERT INTO admin_users (username, display_name, totp_enabled) VALUES
          ('first-manager', 'First', TRUE), ('second-manager', 'Second', TRUE),
          ('reader', 'Reader', TRUE) RETURNING id, username
      `);
      firstId = admins.rows.find((row) => row.username === "first-manager").id;
      secondId = admins.rows.find((row) => row.username === "second-manager").id;
      readOnlyId = admins.rows.find((row) => row.username === "reader").id;
      await seed.query(`
        INSERT INTO admin_user_roles (admin_user_id, role_code) VALUES
          ($1, 'order_manager'), ($2, 'order_manager'), ($3, 'read_only')
      `, [firstId, secondId, readOnlyId]);
      await seed.query(`
        INSERT INTO shipping_methods (id, name, base_fee, cod_fee,
          shipping_vat_rate, cod_vat_rate, supported_country_codes)
        VALUES ('home', 'Home', 0, 0, 24, 24, '["GR"]');
        INSERT INTO tax_rates (country_code, tax_category, rate,
          prices_include_tax, valid_from)
        VALUES ('GR', 'standard', 24, TRUE, '2020-01-01T00:00:00Z');
        INSERT INTO products (id, cat_id, title, price, active, sku)
        VALUES ('admin-candle', 'cat', 'Admin candle', 10, TRUE, 'ADMIN-1');
        INSERT INTO catalog_overrides (id, stock) VALUES ('admin-candle', 3);
        INSERT INTO inventory (product_id, sku, stock_on_hand)
        VALUES ('admin-candle', 'ADMIN-1', 3);
      `);
    } finally { seed.release(); }

    const order = await createCheckoutOrder({ pool: scoped, request: checkout(),
      idempotencyKey: "phase8-admin-order-key", riskContext: { phoneVerified: true },
      guestTokenSecret: "phase8-test-secret-that-is-long-enough" });
    const results = await Promise.allSettled([
      transitionAdminOrder({ pool: scoped, orderId: order.orderId, adminUserId: firstId,
        expectedVersion: 1, changes: { orderStatus: "processing" } }),
      transitionAdminOrder({ pool: scoped, orderId: order.orderId, adminUserId: secondId,
        expectedVersion: 1, changes: { orderStatus: "requires_review" } }),
    ]);
    assert.equal(results.filter((result) => result.status === "fulfilled").length, 1);
    assert.equal(results.filter((result) => result.status === "rejected" &&
      result.reason.code === "ORDER_VERSION_CONFLICT").length, 1);
    await assert.rejects(transitionAdminOrder({ pool: scoped, orderId: order.orderId,
      adminUserId: readOnlyId, expectedVersion: 2,
      changes: { orderStatus: "cancelled" } }),
    (error) => error.code === "ADMIN_PERMISSION_DENIED");

    const verify = await scoped.connect();
    try {
      const result = await verify.query(`
        SELECT version, (SELECT COUNT(*)::int FROM audit_logs
          WHERE action='order.state_transition' AND entity_id=$1) audit_count
          FROM orders WHERE id=$1
      `, [order.orderId]);
      assert.equal(result.rows[0].version, 2);
      assert.equal(result.rows[0].audit_count, 1);
    } finally { verify.release(); }
  } finally {
    await pool.query(`DROP SCHEMA IF EXISTS ${quoteIdentifier(schema)} CASCADE`);
    await pool.end();
  }
});
