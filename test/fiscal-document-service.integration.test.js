"use strict";

const assert = require("node:assert/strict");
const crypto = require("node:crypto");
const path = require("node:path");
const test = require("node:test");
const { Pool } = require("pg");

const { runMigrations } = require("../server/migrate");
const { createCheckoutOrder } = require("../server/services/order-creation-service");
const { createCardPaymentSession, processPaymentWebhook } =
  require("../server/services/payment-service");
const { issueFiscalDocument } = require("../server/services/fiscal-document-service");
const { createLegacyOrderSchema, quoteIdentifier, scopedPool } =
  require("./helpers/legacy-order-schema");

const TEST_DATABASE_URL = process.env.TEST_DATABASE_URL || "";
const MIGRATIONS_DIR = path.join(__dirname, "..", "server", "migrations");
const safe = (value) => !!value && new URL(value).pathname.toLowerCase().includes("test");
const opts = { skip: safe(TEST_DATABASE_URL) ? false : "Dedicated test database required" };

function paymentProvider() {
  return { name: "stripe",
    async createCheckoutSession(input) { return { id: `cs_${input.paymentId}`,
      url: `https://checkout.example/${input.paymentId}`,
      expiresAt: new Date(input.expiresAtUnix * 1000) }; },
    verifyWebhook(body) { return JSON.parse(Buffer.from(body).toString("utf8")); },
    normalizeWebhookEvent(event) { return event; } };
}

test("Phase 13 fiscal boundary issues one provider-idempotent sale document", opts, async () => {
  const pool = new Pool({ connectionString: TEST_DATABASE_URL, max: 10 });
  const schema = `phase13_fiscal_${process.pid}_${crypto.randomBytes(4).toString("hex")}`;
  const scoped = scopedPool(pool, schema);
  try {
    await createLegacyOrderSchema(pool, schema);
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
        INSERT INTO products (id,cat_id,title,price,active,sku)
        VALUES ('fiscal-product','cat1','Fiscal candle',10.00,TRUE,'FISCAL-1');
        INSERT INTO catalog_overrides (id,stock) VALUES ('fiscal-product',2);
        INSERT INTO inventory (product_id,sku,stock_on_hand)
        VALUES ('fiscal-product','FISCAL-1',2);
      `);
    } finally { seed.release(); }
    const request = { items: [{ productId: "fiscal-product", quantity: 1 }],
      shippingMethodId: "home", paymentMethod: "card", destinationCountry: "GR",
      customer: { firstName: "Ada", lastName: "Lovelace", email: "fiscal@example.com",
        phone: "+306900000000" },
      shippingAddress: { firstName: "Ada", lastName: "Lovelace", line1: "Example 1",
        city: "Athens", postalCode: "10558", countryCode: "GR", phone: "+306900000000" } };
    const order = await createCheckoutOrder({ pool: scoped, request,
      idempotencyKey: "phase13-fiscal-order-key", guestTokenSecret:
        "phase13-fiscal-guest-secret-long-enough" });
    const pay = paymentProvider();
    const session = await createCardPaymentSession({ pool: scoped, orderId: order.orderId,
      idempotencyKey: "phase13-fiscal-payment-key", provider: pay,
      successUrl: "https://shop.example/success", cancelUrl: "https://shop.example/cancel" });
    const event = Buffer.from(JSON.stringify({ id: "evt_fiscal_paid",
      type: "checkout.session.completed", outcome: "paid", orderId: order.orderId,
      paymentId: session.paymentId, sessionId: `cs_${session.paymentId}`,
      paymentIntentId: "pi_fiscal", amountMinor: 1350, currency: "EUR" }));
    await processPaymentWebhook({ pool: scoped, provider: pay, rawBody: event,
      signature: "ignored", webhookSecret: "ignored" });

    const providerKeys = [];
    const fiscalProvider = { name: "accounting_test",
      async issueDocument(input, context) {
        providerKeys.push(context.idempotencyKey);
        assert.equal(input.snapshot.items[0].unit_price, "10.00");
        return { id: `provider-${input.documentId}`, number: "R-1001",
          metadata: { mark: "safe", accessToken: "must-not-be-saved" } };
      } };
    const concurrent = await Promise.all([
      issueFiscalDocument({ pool: scoped, provider: fiscalProvider,
        orderId: order.orderId, documentType: "retail_receipt" }),
      issueFiscalDocument({ pool: scoped, provider: fiscalProvider,
        orderId: order.orderId, documentType: "retail_receipt" }),
    ]);
    assert.equal(concurrent[0].documentId, concurrent[1].documentId);
    assert.equal(new Set(providerKeys).size, 1);
    const repeated = await issueFiscalDocument({ pool: scoped, provider: fiscalProvider,
      orderId: order.orderId, documentType: "retail_receipt" });
    assert.equal(repeated.idempotent, true);

    const verify = await scoped.connect();
    try {
      const result = await verify.query(`SELECT COUNT(*)::int AS documents,
        (SELECT COUNT(*)::int FROM audit_logs WHERE action='fiscal.issued') AS audits,
        (SELECT payload ? 'accessToken' FROM fiscal_documents LIMIT 1) AS leaked_token
        FROM fiscal_documents WHERE order_id=$1`, [order.orderId]);
      assert.deepEqual(result.rows[0], { documents: 1, audits: 1, leaked_token: false });
    } finally { verify.release(); }
    await assert.rejects(issueFiscalDocument({ pool: scoped, provider: fiscalProvider,
      orderId: order.orderId, documentType: "credit_note" }),
    (error) => error.code === "FISCAL_REFUND_REQUIRED");
  } finally {
    await pool.query(`DROP SCHEMA IF EXISTS ${quoteIdentifier(schema)} CASCADE`);
    await pool.end();
  }
});
