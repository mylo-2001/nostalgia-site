"use strict";

const assert = require("node:assert/strict");
const test = require("node:test");

const auth = require("../server/auth");
const { secureEqualHash, validateAdminDatabaseSession } =
  require("../server/services/admin-session-service");

test("admin cookie binds a CSRF token and MFA claim to a signed session", () => {
  auth.setSecret("phase11-unit-secret-that-is-long-enough");
  const cookies = [];
  const response = { append(name, value) { cookies.push([name, value]); } };
  const created = auth.startAdminSession(response, "admin", { mfaVerified: true });
  const cookie = cookies[0][1].split(";")[0];
  const request = { headers: { cookie } };
  const session = auth.getAdminSession(request);
  assert.equal(session.sub, "admin");
  assert.equal(session.mfa, true);
  assert.equal(secureEqualHash(created.csrfToken, session.csrfHash), true);
  assert.equal(secureEqualHash("wrong", session.csrfHash), false);
});

test("database admin session bypasses MFA only when policy explicitly disables it", async () => {
  const row = {
    session_id: "session-id",
    admin_user_id: "admin-id",
    csrf_secret_hash: "csrf-hash",
    status: "active",
    requires_2fa: true,
    totp_enabled: false,
    mfa_verified: false,
  };
  const client = {
    async query(sql) {
      if (/^\s*SELECT/i.test(sql)) return { rowCount: 1, rows: [row] };
      return { rowCount: 1, rows: [] };
    },
    release() {},
  };
  const pool = { async connect() { return client; } };
  const session = { sid: "session-token", mfa: false };

  await assert.rejects(
    validateAdminDatabaseSession({ pool, session }),
    (error) => error.code === "ADMIN_2FA_REQUIRED"
  );
  const allowed = await validateAdminDatabaseSession({ pool, session, requireMfa: false });
  assert.equal(allowed.adminUserId, "admin-id");
});
