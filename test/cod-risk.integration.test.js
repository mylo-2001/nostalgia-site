"use strict";

const assert = require("node:assert/strict");
const crypto = require("node:crypto");
const path = require("node:path");
const test = require("node:test");
const { Pool } = require("pg");

const { runMigrations } = require("../server/migrate");
const { createCheckoutOrder } = require("../server/services/order-creation-service");
const { markCodCollected, restockReturnedCodOrder, reviewCodOrder } =
  require("../server/services/cod-service");
const { transitionOrderState } = require("../server/services/order-state-service");
const { createLegacyOrderSchema, quoteIdentifier, scopedPool } =
  require("./helpers/legacy-order-schema");

const TEST_DATABASE_URL = process.env.TEST_DATABASE_URL || "";
const MIGRATIONS_DIR = path.join(__dirname, "..", "server", "migrations");
const GUEST_SECRET = "phase7-test-secret-that-is-long-enough";

function safeUrl(value) {
  return !!value && new URL(value).pathname.toLowerCase().includes("test");
}

function request(productId, email, phone) {
  return {
    items: [{ productId, quantity: 1 }], shippingMethodId: "home",
    paymentMethod: "cod", destinationCountry: "GR",
    customer: { firstName: "Ada", lastName: "Lovelace", email, phone },
    shippingAddress: { firstName: "Ada", lastName: "Lovelace", line1: "Example 1",
      city: "Athens", postalCode: "10558", countryCode: "GR", phone },
  };
}

async function moveShipping(pool, orderId, statuses) {
  for (const shippingStatus of statuses) {
    await transitionOrderState({ pool, orderId, changes: { shippingStatus },
      actor: { type: "system", id: "test-courier" }, source: "test.courier" });
  }
}

const integrationOptions = { skip: safeUrl(TEST_DATABASE_URL) ? false :
  "Set TEST_DATABASE_URL to a dedicated database whose name contains 'test'" };

test("Phase 7 applies explainable and idempotent COD risk lifecycle", integrationOptions,
  async () => {
    const pool = new Pool({ connectionString: TEST_DATABASE_URL, max: 10 });
    const schema = `phase7_cod_${process.pid}_${crypto.randomBytes(4).toString("hex")}`;
    const scoped = scopedPool(pool, schema);
    let reviewerId;
    try {
      await createLegacyOrderSchema(pool, schema);
      await runMigrations({ pool, schema, directory: MIGRATIONS_DIR,
        direction: "up", targetVersion: 13 });
      const seed = await scoped.connect();
      try {
        const reviewer = await seed.query(`
          INSERT INTO admin_users (username, display_name, totp_enabled)
          VALUES ('risk-reviewer', 'Risk Reviewer', TRUE) RETURNING id
        `);
        reviewerId = reviewer.rows[0].id;
        await seed.query(`
          INSERT INTO shipping_methods (id, name, base_fee, cod_fee,
            shipping_vat_rate, cod_vat_rate, supported_country_codes)
          VALUES ('home', 'Home', 0, 0, 24, 24, '["GR"]');
          INSERT INTO tax_rates (country_code, tax_category, rate,
            prices_include_tax, valid_from)
          VALUES ('GR', 'standard', 24, TRUE, '2020-01-01T00:00:00Z');
          INSERT INTO products (id, cat_id, title, price, active, sku) VALUES
            ('cod-low', 'cat1', 'Low candle', 10, TRUE, 'COD-L'),
            ('cod-medium', 'cat1', 'Medium candle', 250, TRUE, 'COD-M'),
            ('cod-high', 'cat1', 'High candle', 250, TRUE, 'COD-H'),
            ('cod-return', 'cat1', 'Return candle', 10, TRUE, 'COD-R');
          INSERT INTO catalog_overrides (id, stock) VALUES
            ('cod-low', 2), ('cod-medium', 2), ('cod-high', 2), ('cod-return', 2);
          INSERT INTO inventory (product_id, sku, stock_on_hand) VALUES
            ('cod-low', 'COD-L', 2), ('cod-medium', 'COD-M', 2),
            ('cod-high', 'COD-H', 2), ('cod-return', 'COD-R', 2);
        `);
      } finally { seed.release(); }

      const low = await createCheckoutOrder({ pool: scoped,
        request: request("cod-low", "low@example.com", "+306900000001"),
        idempotencyKey: "phase7-low-order-key", guestTokenSecret: GUEST_SECRET,
        riskContext: { phoneVerified: true } });
      assert.equal(low.orderStatus, "confirmed");
      assert.equal(low.riskLevel, "low");

      const medium = await createCheckoutOrder({ pool: scoped,
        request: request("cod-medium", "medium@example.com", "+306900000002"),
        idempotencyKey: "phase7-medium-order-key", guestTokenSecret: GUEST_SECRET,
        riskContext: { phoneVerified: true } });
      assert.equal(medium.orderStatus, "requires_review");
      const approved = await reviewCodOrder({ pool: scoped, orderId: medium.orderId,
        reviewerId, decision: "approved" });
      assert.equal(approved.idempotent, false);
      assert.equal((await reviewCodOrder({ pool: scoped, orderId: medium.orderId,
        reviewerId, decision: "approved" })).idempotent, true);

      const blocked = await createCheckoutOrder({ pool: scoped,
        request: request("cod-high", "high@example.com", "+306900000003"),
        idempotencyKey: "phase7-high-order-key", guestTokenSecret: GUEST_SECRET,
        riskContext: { phoneVerified: false, checkoutAnomalyScore: 10 } });
      assert.equal(blocked.outcome, "card_required");
      assert.equal(blocked.orderId, null);

      await transitionOrderState({ pool: scoped, orderId: low.orderId,
        changes: { orderStatus: "processing" }, actor: { type: "system" },
        source: "test.fulfilment" });
      await moveShipping(scoped, low.orderId,
        ["ready", "label_created", "handed_to_courier", "in_transit", "delivered"]);
      assert.equal((await markCodCollected({ pool: scoped, orderId: low.orderId })).idempotent,
        false);
      assert.equal((await markCodCollected({ pool: scoped, orderId: low.orderId })).idempotent,
        true);

      const returned = await createCheckoutOrder({ pool: scoped,
        request: request("cod-return", "return@example.com", "+306900000004"),
        idempotencyKey: "phase7-return-order-key", guestTokenSecret: GUEST_SECRET,
        riskContext: { phoneVerified: true } });
      await transitionOrderState({ pool: scoped, orderId: returned.orderId,
        changes: { orderStatus: "processing" }, actor: { type: "system" },
        source: "test.fulfilment" });
      await moveShipping(scoped, returned.orderId,
        ["ready", "label_created", "handed_to_courier", "in_transit",
          "delivery_failed", "returned"]);
      assert.equal((await restockReturnedCodOrder({ pool: scoped,
        orderId: returned.orderId })).idempotent, false);
      assert.equal((await restockReturnedCodOrder({ pool: scoped,
        orderId: returned.orderId })).idempotent, true);

      const verify = await scoped.connect();
      try {
        const row = await verify.query(`
          SELECT
            (SELECT stock_on_hand FROM inventory WHERE product_id='cod-low') low_stock,
            (SELECT stock_on_hand FROM inventory WHERE product_id='cod-medium') medium_stock,
            (SELECT stock_on_hand FROM inventory WHERE product_id='cod-high') high_stock,
            (SELECT stock_on_hand FROM inventory WHERE product_id='cod-return') return_stock,
            (SELECT COUNT(*)::int FROM risk_assessment_attempts) attempts
        `);
        assert.deepEqual(row.rows[0], { low_stock: 1, medium_stock: 1,
          high_stock: 2, return_stock: 2, attempts: 1 });
      } finally { verify.release(); }
    } finally {
      await pool.query(`DROP SCHEMA IF EXISTS ${quoteIdentifier(schema)} CASCADE`);
      await pool.end();
    }
  });
