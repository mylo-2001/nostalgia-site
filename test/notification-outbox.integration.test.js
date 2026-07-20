"use strict";

const assert = require("node:assert/strict");
const crypto = require("node:crypto");
const path = require("node:path");
const test = require("node:test");
const { Pool } = require("pg");

const { runMigrations } = require("../server/migrate");
const { enqueueNotification, processNotificationBatch } =
  require("../server/services/notification-outbox-service");
const { createLegacyOrderSchema, quoteIdentifier, scopedPool } =
  require("./helpers/legacy-order-schema");

const TEST_DATABASE_URL = process.env.TEST_DATABASE_URL || "";
const MIGRATIONS_DIR = path.join(__dirname, "..", "server", "migrations");
const safe = (value) => !!value && new URL(value).pathname.toLowerCase().includes("test");
const opts = { skip: safe(TEST_DATABASE_URL) ? false : "Dedicated test database required" };

test("Phase 10 claims each notification once and schedules failed retries", opts, async () => {
  const pool = new Pool({ connectionString: TEST_DATABASE_URL, max: 8 });
  const schema = `phase10_outbox_${process.pid}_${crypto.randomBytes(4).toString("hex")}`;
  const scoped = scopedPool(pool, schema);
  try {
    await createLegacyOrderSchema(pool, schema);
    await runMigrations({ pool, schema, directory: MIGRATIONS_DIR,
      direction: "up", targetVersion: 19 });
    const client = await scoped.connect();
    try {
      const first = await enqueueNotification({ client, eventKey: "order_created:test-1",
        eventType: "order_created", aggregateType: "order", aggregateId: "test-1",
        payload: { orderId: "test-1" } });
      const duplicate = await enqueueNotification({ client, eventKey: "order_created:test-1",
        eventType: "order_created", aggregateType: "order", aggregateId: "test-1",
        payload: { orderId: "test-1" } });
      assert.equal(first.queued, true);
      assert.equal(duplicate.queued, false);
    } finally { client.release(); }

    const sent = [];
    const sender = { async send(message) { sent.push(message.eventKey); } };
    const batches = await Promise.all([
      processNotificationBatch({ pool: scoped, workerId: "worker-a", sender }),
      processNotificationBatch({ pool: scoped, workerId: "worker-b", sender }),
    ]);
    assert.equal(batches.reduce((sum, batch) => sum + batch.claimed, 0), 1);
    assert.deepEqual(sent, ["order_created:test-1"]);

    const failureClient = await scoped.connect();
    try {
      await enqueueNotification({ client: failureClient, eventKey: "payment_failed:test-2",
        eventType: "payment_failed", aggregateType: "order", aggregateId: "test-2",
        payload: { orderId: "test-2" }, maxAttempts: 2 });
    } finally { failureClient.release(); }
    await processNotificationBatch({ pool: scoped, workerId: "worker-fail",
      sender: { async send() { throw new Error("mail unavailable"); } },
      now: new Date("2026-07-19T10:00:00Z") });
    const verify = await scoped.connect();
    try {
      const rows = await verify.query(`SELECT event_key,status,attempts,next_retry_at,sent_at
        FROM notification_outbox ORDER BY event_key`);
      assert.equal(rows.rows[0].status, "sent");
      assert.equal(rows.rows[1].status, "failed");
      assert.equal(rows.rows[1].attempts, 1);
      assert.equal(new Date(rows.rows[1].next_retry_at).toISOString(), "2026-07-19T10:00:05.000Z");
    } finally { verify.release(); }
  } finally {
    await pool.query(`DROP SCHEMA IF EXISTS ${quoteIdentifier(schema)} CASCADE`);
    await pool.end();
  }
});
