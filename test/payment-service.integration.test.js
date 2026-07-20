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
const GUEST_SECRET = "phase6-test-secret-that-is-long-enough";

function safeTestDatabaseUrl(value) {
  return !!value && new URL(value).pathname.toLowerCase().includes("test");
}

function fakeProvider() {
  return {
    name: "stripe",
    async createCheckoutSession(input) {
      return {
        id: `cs_${input.paymentId}`,
        url: `https://checkout.example/${input.paymentId}`,
        paymentIntentId: null,
        expiresAt: new Date(input.expiresAtUnix * 1000),
      };
    },
    verifyWebhook(rawBody, signature, secret) {
      if (signature !== "valid" || secret !== "webhook-secret") throw new Error("invalid");
      return JSON.parse(Buffer.from(rawBody).toString("utf8"));
    },
    normalizeWebhookEvent(event) {
      return event;
    },
  };
}

function request(productId, email) {
  return {
    items: [{ productId, quantity: 1 }],
    shippingMethodId: "home",
    paymentMethod: "card",
    destinationCountry: "GR",
    customer: {
      firstName: "Ada", lastName: "Lovelace", email, phone: "+306900000000",
    },
    shippingAddress: {
      firstName: "Ada", lastName: "Lovelace", line1: "Example 1",
      city: "Athens", postalCode: "10558", countryCode: "GR", phone: "+306900000000",
    },
  };
}

const integrationOptions = {
  skip: !safeTestDatabaseUrl(TEST_DATABASE_URL)
    ? "Set TEST_DATABASE_URL to a dedicated database whose name contains 'test'"
    : false,
};

test("Phase 6 verifies and idempotently applies payment success and failure webhooks", integrationOptions, async () => {
  const pool = new Pool({ connectionString: TEST_DATABASE_URL, max: 10 });
  const schema = `phase6_payment_${process.pid}_${crypto.randomBytes(4).toString("hex")}`;
  const scoped = scopedPool(pool, schema);
  const provider = fakeProvider();
  try {
    await createLegacyOrderSchema(pool, schema);
    await runMigrations({
      pool, schema, directory: MIGRATIONS_DIR, direction: "up", targetVersion: 11,
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
        INSERT INTO products (id, cat_id, title, price, active, sku) VALUES
          ('pay-success', 'cat1', 'Success candle', 10.00, TRUE, 'PAY-S'),
          ('pay-failure', 'cat1', 'Failure candle', 10.00, TRUE, 'PAY-F');
        INSERT INTO catalog_overrides (id, stock) VALUES
          ('pay-success', 2), ('pay-failure', 2);
        INSERT INTO inventory (product_id, sku, stock_on_hand) VALUES
          ('pay-success', 'PAY-S', 2), ('pay-failure', 'PAY-F', 2);
      `);
    } finally {
      seed.release();
    }

    const successOrder = await createCheckoutOrder({
      pool: scoped,
      request: request("pay-success", "success@example.com"),
      idempotencyKey: "phase6-success-order-key",
      guestTokenSecret: GUEST_SECRET,
      logger: null,
    });
    const session = await createCardPaymentSession({
      pool: scoped,
      orderId: successOrder.orderId,
      idempotencyKey: "phase6-success-session-key",
      provider,
      successUrl: "https://shop.example/success",
      cancelUrl: "https://shop.example/cancel",
    });
    const sameSession = await createCardPaymentSession({
      pool: scoped,
      orderId: successOrder.orderId,
      idempotencyKey: "phase6-success-session-key",
      provider,
      successUrl: "https://shop.example/success",
      cancelUrl: "https://shop.example/cancel",
    });
    assert.equal(sameSession.paymentId, session.paymentId);
    assert.equal(sameSession.idempotent, true);

    const paidEvent = Buffer.from(JSON.stringify({
      id: "evt_paid_1",
      type: "checkout.session.completed",
      outcome: "paid",
      orderId: successOrder.orderId,
      paymentId: session.paymentId,
      sessionId: `cs_${session.paymentId}`,
      paymentIntentId: "pi_paid_1",
      amountMinor: 1350,
      currency: "EUR",
    }));
    const webhookResults = await Promise.all([
      processPaymentWebhook({
        pool: scoped, provider, rawBody: paidEvent, signature: "valid",
        webhookSecret: "webhook-secret",
      }),
      processPaymentWebhook({
        pool: scoped, provider, rawBody: paidEvent, signature: "valid",
        webhookSecret: "webhook-secret",
      }),
    ]);
    assert.equal(webhookResults.filter((result) => result.processed).length, 1);
    assert.equal(webhookResults.filter((result) => result.duplicate).length, 1);

    const status = await getOrderPaymentStatus({
      pool: scoped,
      orderId: successOrder.orderId,
      guestAccessToken: successOrder.guestAccessToken,
    });
    assert.equal(status.paymentStatus, "paid");
    assert.equal(status.orderStatus, "confirmed");

    const failedOrder = await createCheckoutOrder({
      pool: scoped,
      request: request("pay-failure", "failure@example.com"),
      idempotencyKey: "phase6-failure-order-key",
      guestTokenSecret: GUEST_SECRET,
      logger: null,
    });
    const failedSession = await createCardPaymentSession({
      pool: scoped,
      orderId: failedOrder.orderId,
      idempotencyKey: "phase6-failure-session-key",
      provider,
      successUrl: "https://shop.example/success",
      cancelUrl: "https://shop.example/cancel",
    });
    const failedEvent = Buffer.from(JSON.stringify({
      id: "evt_failed_1",
      type: "checkout.session.async_payment_failed",
      outcome: "failed",
      orderId: failedOrder.orderId,
      paymentId: failedSession.paymentId,
      sessionId: `cs_${failedSession.paymentId}`,
      paymentIntentId: null,
      amountMinor: null,
      currency: null,
      failureCode: "card_declined",
    }));
    await processPaymentWebhook({
      pool: scoped, provider, rawBody: failedEvent, signature: "valid",
      webhookSecret: "webhook-secret",
    });

    const verify = await scoped.connect();
    try {
      const rows = await verify.query(`
        SELECT
          (SELECT stock_on_hand FROM inventory WHERE product_id = 'pay-success') AS paid_stock,
          (SELECT reserved_quantity FROM inventory WHERE product_id = 'pay-success') AS paid_reserved,
          (SELECT stock_on_hand FROM inventory WHERE product_id = 'pay-failure') AS failed_stock,
          (SELECT reserved_quantity FROM inventory WHERE product_id = 'pay-failure') AS failed_reserved,
          (SELECT COUNT(*)::int FROM payment_events) AS events
      `);
      assert.deepEqual(rows.rows[0], {
        paid_stock: 1,
        paid_reserved: 0,
        failed_stock: 2,
        failed_reserved: 0,
        events: 2,
      });
      const failedState = await verify.query(`
        SELECT order_status_v2, payment_status_v2 FROM orders WHERE id = $1
      `, [failedOrder.orderId]);
      assert.equal(failedState.rows[0].order_status_v2, "pending");
      assert.equal(failedState.rows[0].payment_status_v2, "failed");
    } finally {
      verify.release();
    }

    await assert.rejects(
      processPaymentWebhook({
        pool: scoped, provider, rawBody: paidEvent, signature: "invalid",
        webhookSecret: "webhook-secret",
      }),
      (error) => error.code === "INVALID_WEBHOOK_SIGNATURE"
    );

    await runMigrations({
      pool, schema, directory: MIGRATIONS_DIR, direction: "down", count: 2, targetVersion: 11,
    });
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
