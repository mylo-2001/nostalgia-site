"use strict";

const assert = require("node:assert/strict");
const crypto = require("node:crypto");
const path = require("node:path");
const test = require("node:test");
const { Pool } = require("pg");

const { runMigrations } = require("../server/migrate");
const { createCheckoutOrder } = require("../server/services/order-creation-service");
const { markCodCollected } = require("../server/services/cod-service");
const { transitionOrderState } = require("../server/services/order-state-service");
const { approveReturn, createReturn, inspectReturn, processRefundWebhook,
  receiveReturn, requestRefund } = require("../server/services/return-refund-service");
const { createLegacyOrderSchema, quoteIdentifier, scopedPool } =
  require("./helpers/legacy-order-schema");

const TEST_DATABASE_URL = process.env.TEST_DATABASE_URL || "";
const MIGRATIONS_DIR = path.join(__dirname, "..", "server", "migrations");
const safe = (value) => !!value && new URL(value).pathname.toLowerCase().includes("test");
const opts = { skip: safe(TEST_DATABASE_URL) ? false : "Dedicated test database required" };

const provider = {
  name: "refund-test",
  async createRefund(input) { return { id: `re_${input.refundId}`, status: "pending" }; },
  verifyWebhook(body, signature) {
    if (signature !== "valid") throw new Error("invalid");
    return JSON.parse(Buffer.from(body).toString("utf8"));
  },
  normalizeRefundEvent(event) { return event; },
};

async function ship(pool, orderId) {
  await transitionOrderState({ pool, orderId, changes: { orderStatus: "processing" },
    actor: { type: "system" }, source: "test.fulfilment" });
  await transitionOrderState({ pool, orderId, changes: { orderStatus: "ready_to_ship" },
    actor: { type: "system" }, source: "test.fulfilment" });
  for (const shippingStatus of ["ready", "label_created", "handed_to_courier",
    "in_transit", "delivered"]) {
    await transitionOrderState({ pool, orderId, changes: { shippingStatus },
      actor: { type: "system" }, source: "test.courier" });
  }
}

test("Phase 9 restocks inspected returns once and confirms refunds by webhook", opts,
  async () => {
    const pool = new Pool({ connectionString: TEST_DATABASE_URL, max: 10 });
    const schema = `phase9_returns_${process.pid}_${crypto.randomBytes(4).toString("hex")}`;
    const scoped = scopedPool(pool, schema);
    try {
      await createLegacyOrderSchema(pool, schema);
      await runMigrations({ pool, schema, directory: MIGRATIONS_DIR,
        direction: "up", targetVersion: 17 });
      const seed = await scoped.connect();
      let adminId;
      try {
        adminId = (await seed.query(`INSERT INTO admin_users
          (username,display_name,totp_enabled) VALUES ('returns-admin','Returns',TRUE)
          RETURNING id`)).rows[0].id;
        await seed.query(`
          INSERT INTO shipping_methods (id,name,base_fee,cod_fee,shipping_vat_rate,
            cod_vat_rate,supported_country_codes) VALUES ('home','Home',0,0,24,24,'["GR"]');
          INSERT INTO tax_rates (country_code,tax_category,rate,prices_include_tax,valid_from)
            VALUES ('GR','standard',24,TRUE,'2020-01-01');
          INSERT INTO products (id,cat_id,title,price,active,sku)
            VALUES ('return-candle','cat','Return candle',10,TRUE,'RETURN-1');
          INSERT INTO catalog_overrides (id,stock) VALUES ('return-candle',2);
          INSERT INTO inventory (product_id,sku,stock_on_hand)
            VALUES ('return-candle','RETURN-1',2);
        `);
      } finally { seed.release(); }
      const order = await createCheckoutOrder({ pool: scoped,
        request: { items: [{ productId: "return-candle", quantity: 1 }],
          shippingMethodId: "home", paymentMethod: "cod", destinationCountry: "GR",
          customer: { firstName: "Ada", lastName: "Lovelace", email: "return@example.com",
            phone: "+306900000021" }, shippingAddress: { firstName: "Ada", lastName: "Lovelace",
            line1: "Return 1", city: "Athens", postalCode: "10558", countryCode: "GR",
            phone: "+306900000021" } }, idempotencyKey: "phase9-order-key-long",
        guestTokenSecret: "phase9-test-secret-that-is-long-enough",
        riskContext: { phoneVerified: true } });
      await ship(scoped, order.orderId);
      await markCodCollected({ pool: scoped, orderId: order.orderId });
      const lookup = await scoped.connect();
      let orderItemId;
      let paymentId;
      try {
        orderItemId = (await lookup.query("SELECT id FROM order_items WHERE order_id=$1",
          [order.orderId])).rows[0].id;
        paymentId = (await lookup.query("SELECT id FROM payments WHERE order_id=$1",
          [order.orderId])).rows[0].id;
      } finally { lookup.release(); }

      const returned = await createReturn({ pool: scoped, orderId: order.orderId,
        items: [{ orderItemId, quantity: 1, reason: "changed_mind" }],
        idempotencyKey: "phase9-return-key-long", actor: { type: "customer", id: "return@example.com" } });
      assert.equal((await createReturn({ pool: scoped, orderId: order.orderId,
        items: [{ orderItemId, quantity: 1, reason: "changed_mind" }],
        idempotencyKey: "phase9-return-key-long", actor: { type: "customer" } })).idempotent, true);
      await approveReturn({ pool: scoped, returnId: returned.returnId, adminUserId: adminId });
      await receiveReturn({ pool: scoped, returnId: returned.returnId, adminUserId: adminId });
      const itemLookup = await scoped.connect();
      let returnItemId;
      try { returnItemId = (await itemLookup.query("SELECT id FROM return_items WHERE return_id=$1",
        [returned.returnId])).rows[0].id; } finally { itemLookup.release(); }
      const inspection = await inspectReturn({ pool: scoped, returnId: returned.returnId,
        adminUserId: adminId, decisions: [{ returnItemId, condition: "sellable",
          restockDecision: "restock" }] });
      assert.equal(inspection.status, "completed");
      assert.equal((await inspectReturn({ pool: scoped, returnId: returned.returnId,
        adminUserId: adminId, decisions: [{ returnItemId, condition: "sellable",
          restockDecision: "restock" }] })).idempotent, true);

      const refund = await requestRefund({ pool: scoped, paymentId, returnId: returned.returnId,
        amount: "10.00", provider, idempotencyKey: "phase9-refund-key-long",
        actor: { type: "admin", id: adminId } });
      assert.equal(refund.status, "processing");
      assert.equal((await requestRefund({ pool: scoped, paymentId, returnId: returned.returnId,
        amount: "10.00", provider, idempotencyKey: "phase9-refund-key-long",
        actor: { type: "admin", id: adminId } })).idempotent, true);
      const event = Buffer.from(JSON.stringify({ id: "refund-event-1", type: "refund.updated",
        outcome: "confirmed", refundId: refund.refundId,
        providerRefundId: refund.providerRefundId, amountMinor: 1000, currency: "EUR" }));
      const settledWebhook = await Promise.allSettled([
        processRefundWebhook({ pool: scoped, provider, rawBody: event, signature: "valid" }),
        processRefundWebhook({ pool: scoped, provider, rawBody: event, signature: "valid" }),
      ]);
      const failures = settledWebhook.filter((result) => result.status === "rejected");
      assert.deepEqual(failures.map((result) => result.reason?.message), []);
      const webhook = settledWebhook.map((result) => result.value);
      assert.equal(webhook.filter((result) => result.processed).length, 1);
      assert.equal(webhook.filter((result) => result.duplicate).length, 1);

      const verify = await scoped.connect();
      try {
        const row = (await verify.query(`SELECT
          (SELECT stock_on_hand FROM inventory WHERE product_id='return-candle') stock,
          (SELECT status FROM refunds WHERE id=$1) refund_status,
          (SELECT status FROM payments WHERE id=$2) payment_status,
          (SELECT COUNT(*)::int FROM inventory_movements WHERE movement_type='return_restock') restocks`,
        [refund.refundId, paymentId])).rows[0];
        assert.deepEqual(row, { stock: 2, refund_status: "confirmed",
          payment_status: "refunded", restocks: 1 });
      } finally { verify.release(); }
    } finally {
      await pool.query(`DROP SCHEMA IF EXISTS ${quoteIdentifier(schema)} CASCADE`);
      await pool.end();
    }
  });
