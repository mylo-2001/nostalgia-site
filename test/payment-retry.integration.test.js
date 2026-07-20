"use strict";

const assert = require("node:assert/strict");
const crypto = require("node:crypto");
const path = require("node:path");
const test = require("node:test");
const { Pool } = require("pg");

const { runMigrations } = require("../server/migrate");
const { createCheckoutOrder } = require("../server/services/order-creation-service");
const {
  createCardPaymentSession,
  getOrderPaymentStatus,
  processPaymentWebhook,
} = require("../server/services/payment-service");
const {
  createLegacyOrderSchema,
  quoteIdentifier,
  scopedPool,
} = require("./helpers/legacy-order-schema");

const TEST_DATABASE_URL = process.env.TEST_DATABASE_URL || "";
const MIGRATIONS_DIR = path.join(__dirname, "..", "server", "migrations");
const GUEST_SECRET = "phase13-guest-secret-that-is-long-enough";

function safeTestDatabaseUrl(value) {
  return !!value && new URL(value).pathname.toLowerCase().includes("test");
}

function provider(overrides = {}) {
  return {
    name: "stripe",
    async createCheckoutSession(input) {
      if (overrides.failSession) throw new Error("provider unavailable");
      return {
        id: `cs_${input.paymentId}`,
        url: `https://checkout.example/${input.paymentId}`,
        paymentIntentId: null,
        expiresAt: new Date(input.expiresAtUnix * 1000),
      };
    },
    verifyWebhook(rawBody, signature, secret) {
      if (signature !== "valid" || secret !== "secret") throw new Error("invalid");
      return JSON.parse(Buffer.from(rawBody).toString("utf8"));
    },
    normalizeWebhookEvent(event) { return event; },
  };
}

function checkoutRequest(productId, email) {
  return {
    items: [{ productId, quantity: 1 }],
    shippingMethodId: "home",
    paymentMethod: "card",
    destinationCountry: "GR",
    customer: { firstName: "Ada", lastName: "Lovelace", email,
      phone: "+306900000000" },
    shippingAddress: { firstName: "Ada", lastName: "Lovelace",
      line1: "Example 1", city: "Athens", postalCode: "10558",
      countryCode: "GR", phone: "+306900000000" },
  };
}

const integrationOptions = {
  skip: !safeTestDatabaseUrl(TEST_DATABASE_URL)
    ? "Set TEST_DATABASE_URL to a dedicated database whose name contains 'test'"
    : false,
};

test("Phase 13 retries a failed card payment on the same order without double stock", integrationOptions,
  async () => {
    const pool = new Pool({ connectionString: TEST_DATABASE_URL, max: 10 });
    const schema = `phase13_retry_${process.pid}_${crypto.randomBytes(4).toString("hex")}`;
    const scoped = scopedPool(pool, schema);
    try {
      await createLegacyOrderSchema(pool, schema);
      await runMigrations({ pool, schema, directory: MIGRATIONS_DIR,
        direction: "up", targetVersion: 23 });
      const before = await scoped.connect();
      let previousGuard;
      try {
        const result = await before.query(`SELECT pg_get_functiondef(
          'nostalgia_validate_order_state_transition()'::regprocedure) AS definition`);
        previousGuard = result.rows[0].definition;
      } finally { before.release(); }
      await runMigrations({ pool, schema, directory: MIGRATIONS_DIR,
        direction: "up", targetVersion: 25 });

      const seed = await scoped.connect();
      try {
        await seed.query(`
          INSERT INTO shipping_methods (id,name,base_fee,cod_fee,shipping_vat_rate,
            cod_vat_rate,supported_country_codes)
          VALUES ('home','Home',3.50,3.50,24,24,'["GR"]');
          INSERT INTO tax_rates (country_code,tax_category,rate,prices_include_tax,valid_from)
          VALUES ('GR','standard',24,TRUE,'2020-01-01T00:00:00Z');
          INSERT INTO products (id,cat_id,title,price,active,sku) VALUES
            ('retry-product','cat1','Retry candle',10.00,TRUE,'RETRY-1'),
            ('provider-failure','cat1','Failure candle',10.00,TRUE,'FAIL-1');
          INSERT INTO catalog_overrides (id,stock) VALUES
            ('retry-product',2),('provider-failure',2);
          INSERT INTO inventory (product_id,sku,stock_on_hand) VALUES
            ('retry-product','RETRY-1',2),('provider-failure','FAIL-1',2);
        `);
      } finally { seed.release(); }

      const order = await createCheckoutOrder({ pool: scoped,
        request: checkoutRequest("retry-product", "retry@example.com"),
        idempotencyKey: "phase13-retry-order-idempotency", guestTokenSecret: GUEST_SECRET });
      const first = await createCardPaymentSession({ pool: scoped, orderId: order.orderId,
        idempotencyKey: "phase13-first-payment-attempt", provider: provider(),
        successUrl: "https://shop.example/success", cancelUrl: "https://shop.example/cancel" });
      const activeSession = await createCardPaymentSession({ pool: scoped,
        orderId: order.orderId, idempotencyKey: "phase13-different-click-same-active-session",
        provider: provider(), successUrl: "https://shop.example/success",
        cancelUrl: "https://shop.example/cancel" });
      assert.equal(activeSession.paymentId, first.paymentId);
      assert.equal(activeSession.idempotent, true);
      const failedEvent = Buffer.from(JSON.stringify({ id: "evt_phase13_failed",
        type: "checkout.session.async_payment_failed", outcome: "failed",
        orderId: order.orderId, paymentId: first.paymentId,
        sessionId: `cs_${first.paymentId}`, failureCode: "card_declined" }));
      await processPaymentWebhook({ pool: scoped, provider: provider(), rawBody: failedEvent,
        signature: "valid", webhookSecret: "secret" });

      const afterFailure = await scoped.connect();
      try {
        const state = await afterFailure.query(`SELECT order_status_v2,payment_status_v2,
          (SELECT reserved_quantity FROM inventory WHERE product_id='retry-product') AS reserved
          FROM orders WHERE id=$1`, [order.orderId]);
        assert.deepEqual(state.rows[0], {
          order_status_v2: "pending", payment_status_v2: "failed", reserved: 0,
        });
      } finally { afterFailure.release(); }

      const retry = await createCardPaymentSession({ pool: scoped, orderId: order.orderId,
        idempotencyKey: "phase13-second-payment-attempt", provider: provider(),
        successUrl: "https://shop.example/success", cancelUrl: "https://shop.example/cancel" });
      const duplicateRetry = await createCardPaymentSession({ pool: scoped,
        orderId: order.orderId, idempotencyKey: "phase13-second-payment-attempt",
        provider: provider(), successUrl: "https://shop.example/success",
        cancelUrl: "https://shop.example/cancel" });
      assert.notEqual(retry.paymentId, first.paymentId);
      assert.equal(duplicateRetry.paymentId, retry.paymentId);
      assert.equal(duplicateRetry.idempotent, true);

      const paidEvent = Buffer.from(JSON.stringify({ id: "evt_phase13_paid",
        type: "checkout.session.completed", outcome: "paid", orderId: order.orderId,
        paymentId: retry.paymentId, sessionId: `cs_${retry.paymentId}`,
        paymentIntentId: "pi_phase13_paid", amountMinor: 1350, currency: "EUR" }));
      await processPaymentWebhook({ pool: scoped, provider: provider(), rawBody: paidEvent,
        signature: "valid", webhookSecret: "secret" });

      const status = await getOrderPaymentStatus({ pool: scoped, orderId: order.orderId,
        guestAccessToken: order.guestAccessToken });
      assert.equal(status.orderStatus, "confirmed");
      assert.equal(status.paymentStatus, "paid");
      const verified = await scoped.connect();
      try {
        const state = await verified.query(`SELECT
          (SELECT COUNT(*)::int FROM orders WHERE id=$1) AS orders,
          (SELECT COUNT(*)::int FROM payments WHERE order_id=$1) AS payments,
          (SELECT stock_on_hand FROM inventory WHERE product_id='retry-product') AS stock,
          (SELECT reserved_quantity FROM inventory WHERE product_id='retry-product') AS reserved`,
        [order.orderId]);
        assert.deepEqual(state.rows[0], { orders: 1, payments: 2, stock: 1, reserved: 0 });
      } finally { verified.release(); }

      const unavailableOrder = await createCheckoutOrder({ pool: scoped,
        request: checkoutRequest("provider-failure", "failure@example.com"),
        idempotencyKey: "phase13-provider-failure-order", guestTokenSecret: GUEST_SECRET });
      await assert.rejects(createCardPaymentSession({ pool: scoped,
        orderId: unavailableOrder.orderId,
        idempotencyKey: "phase13-provider-failure-attempt", provider: provider({ failSession: true }),
        successUrl: "https://shop.example/success", cancelUrl: "https://shop.example/cancel" }),
      (error) => error.code === "PAYMENT_PROVIDER_UNAVAILABLE");
      const cleaned = await scoped.connect();
      try {
        const result = await cleaned.query(`SELECT payment_status_v2,
          (SELECT reserved_quantity FROM inventory WHERE product_id='provider-failure') AS reserved
          FROM orders WHERE id=$1`, [unavailableOrder.orderId]);
        assert.deepEqual(result.rows[0], { payment_status_v2: "failed", reserved: 0 });
      } finally { cleaned.release(); }

      await runMigrations({ pool, schema, directory: MIGRATIONS_DIR,
        direction: "down", count: 2, targetVersion: 25 });
      const restored = await scoped.connect();
      try {
        const result = await restored.query(`SELECT pg_get_functiondef(
          'nostalgia_validate_order_state_transition()'::regprocedure) AS definition`);
        assert.equal(result.rows[0].definition, previousGuard);
      } finally { restored.release(); }
    } finally {
      await pool.end();
      const cleanup = new Pool({ connectionString: TEST_DATABASE_URL, max: 1 });
      try { await cleanup.query(`DROP SCHEMA IF EXISTS ${quoteIdentifier(schema)} CASCADE`); }
      finally { await cleanup.end(); }
    }
  });
