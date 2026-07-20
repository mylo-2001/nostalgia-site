"use strict";

const assert = require("node:assert/strict");
const crypto = require("node:crypto");
const path = require("node:path");
const test = require("node:test");
const { Pool } = require("pg");

const { runMigrations } = require("../server/migrate");
const { consumeDatabaseRateLimit, createAdminDatabaseSession, revokeAdminSessions,
  recordAdminLoginEvent, validateAdminDatabaseSession } =
  require("../server/services/admin-session-service");
const { sha256 } = require("../server/services/inventory-service");
const { createLegacyOrderSchema, quoteIdentifier, scopedPool } =
  require("./helpers/legacy-order-schema");

const TEST_DATABASE_URL = process.env.TEST_DATABASE_URL || "";
const MIGRATIONS_DIR = path.join(__dirname, "..", "server", "migrations");
const safe = (value) => !!value && new URL(value).pathname.toLowerCase().includes("test");
const opts = { skip: safe(TEST_DATABASE_URL) ? false : "Dedicated test database required" };

test("Phase 11 persists MFA sessions, revokes all devices and rate-limits atomically", opts,
  async () => {
    const pool = new Pool({ connectionString: TEST_DATABASE_URL, max: 10 });
    const schema = `phase11_security_${process.pid}_${crypto.randomBytes(4).toString("hex")}`;
    const scoped = scopedPool(pool, schema);
    try {
      await createLegacyOrderSchema(pool, schema);
      await runMigrations({ pool, schema, directory: MIGRATIONS_DIR,
        direction: "up", targetVersion: 21 });
      const sid = crypto.randomUUID();
      const csrf = "phase11-csrf-token";
      const session = { sid, mfa: true };
      const created = await createAdminDatabaseSession({ pool: scoped, username: "owner",
        mfaVerified: true, sessionId: sid, sessionFamilyId: crypto.randomUUID(),
        csrfHash: sha256(csrf), expiresAt: new Date(Date.now() + 3600000) });
      const valid = await validateAdminDatabaseSession({ pool: scoped, session });
      assert.equal(valid.adminUserId, created.adminUserId);

      await createAdminDatabaseSession({ pool: scoped, username: "owner",
        mfaVerified: true, sessionId: crypto.randomUUID(),
        sessionFamilyId: crypto.randomUUID(), csrfHash: sha256("second-csrf"),
        expiresAt: new Date(Date.now() + 3600000), ipAddress: "203.0.113.20" });
      for (let attempt = 0; attempt < 5; attempt += 1) {
        await recordAdminLoginEvent({ pool: scoped, username: "owner",
          outcome: "invalid_credentials", ipAddress: "203.0.113.21" });
      }
      const security = await scoped.connect();
      try {
        const alerts = await security.query(`SELECT alert_type FROM admin_security_alerts
          WHERE admin_user_id=$1 ORDER BY alert_type`, [created.adminUserId]);
        assert.deepEqual(alerts.rows.map((row) => row.alert_type),
          ["new_ip_login", "repeated_login_failures"]);
      } finally { security.release(); }

      const limits = await Promise.all(Array.from({ length: 6 }, () =>
        consumeDatabaseRateLimit({ pool: scoped, scope: "checkout", key: "same-client",
          limit: 5, windowMs: 60000, now: new Date("2026-07-19T10:00:00Z") })));
      assert.equal(limits.filter((result) => result.allowed).length, 5);
      assert.equal(limits.filter((result) => !result.allowed).length, 1);

      const revoked = await revokeAdminSessions({ pool: scoped,
        adminUserId: created.adminUserId, reason: "security_test" });
      assert.equal(revoked.revoked, 2);
      await assert.rejects(validateAdminDatabaseSession({ pool: scoped, session }),
        (error) => error.code === "ADMIN_SESSION_INVALID");
    } finally {
      await pool.query(`DROP SCHEMA IF EXISTS ${quoteIdentifier(schema)} CASCADE`);
      await pool.end();
    }
  });
