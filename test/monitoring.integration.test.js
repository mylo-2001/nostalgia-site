"use strict";

const assert = require("node:assert/strict");
const crypto = require("node:crypto");
const path = require("node:path");
const test = require("node:test");
const { Pool } = require("pg");

const { runMigrations } = require("../server/migrate");
const { collectOperationalMetrics, evaluateOperationalAlerts,
  recordOperationalEvent, runTrackedJob } = require("../server/services/monitoring-service");
const { createLegacyOrderSchema, quoteIdentifier, scopedPool } =
  require("./helpers/legacy-order-schema");

const TEST_DATABASE_URL = process.env.TEST_DATABASE_URL || "";
const MIGRATIONS_DIR = path.join(__dirname, "..", "server", "migrations");
const safe = (value) => !!value && new URL(value).pathname.toLowerCase().includes("test");
const opts = { skip: safe(TEST_DATABASE_URL) ? false : "Dedicated test database required" };

test("Phase 12 records operations, emits deduplicated alerts and tracks jobs", opts, async () => {
  const pool = new Pool({ connectionString: TEST_DATABASE_URL, max: 8 });
  const schema = `phase12_ops_${process.pid}_${crypto.randomBytes(4).toString("hex")}`;
  const scoped = scopedPool(pool, schema);
  try {
    await createLegacyOrderSchema(pool, schema);
    await runMigrations({ pool, schema, directory: MIGRATIONS_DIR,
      direction: "up", targetVersion: 23 });
    const client = await scoped.connect();
    try {
      await recordOperationalEvent({ client, eventType: "checkout.failed", severity: "error",
        requestId: "request-phase12", metadata: { errorCode: "TEST", secret: "removed" } });
      for (let index = 0; index < 10; index += 1) {
        await client.query(`INSERT INTO notification_outbox
          (event_key,event_type,aggregate_type,aggregate_id,payload,status)
          VALUES ($1,'payment_failed','order',$2,'{}','failed')`,
        [`failed-notification-${index}`, `order-${index}`]);
      }
    } finally { client.release(); }
    const metrics = await collectOperationalMetrics({ pool: scoped });
    assert.equal(metrics.notification_failures, 10);
    const first = await evaluateOperationalAlerts({ pool: scoped, metrics });
    const second = await evaluateOperationalAlerts({ pool: scoped, metrics });
    assert.equal(first.alerts.some((alert) => alert.type === "notification_failures"), true);
    assert.equal(second.alerts.length, first.alerts.length);
    const job = await runTrackedJob({ pool: scoped, jobName: "test-job", workerId: "test",
      work: async () => ({ processed: 3 }) });
    assert.deepEqual(job, { processed: 3 });

    const verify = await scoped.connect();
    try {
      const row = (await verify.query(`SELECT
        (SELECT COUNT(*)::int FROM operational_alerts WHERE alert_type='notification_failures') alerts,
        (SELECT occurrences FROM operational_alerts WHERE alert_type='notification_failures') occurrences,
        (SELECT status FROM scheduled_job_runs WHERE job_name='test-job') job_status,
        (SELECT metadata ? 'secret' FROM operational_events LIMIT 1) leaked_secret`)).rows[0];
      assert.deepEqual(row, { alerts: 1, occurrences: 2,
        job_status: "succeeded", leaked_secret: false });
    } finally { verify.release(); }
  } finally {
    await pool.query(`DROP SCHEMA IF EXISTS ${quoteIdentifier(schema)} CASCADE`);
    await pool.end();
  }
});
