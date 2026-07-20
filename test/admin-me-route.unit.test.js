"use strict";

const assert = require("node:assert/strict");
const test = require("node:test");

const originalMfaRequirement = process.env.ADMIN_2FA_REQUIRED;
process.env.ADMIN_2FA_REQUIRED = "true";

const auth = require("../server/auth");
const db = require("../server/db");
const { app } = require("../server/server");

function adminCookie(mfaVerified) {
  const cookies = [];
  auth.startAdminSession({
    append(name, value) { cookies.push([name, value]); },
  }, "admin", { mfaVerified });
  return cookies[0][1].split(";")[0];
}

test("admin session endpoint reports MFA state without accessing protected orders", async () => {
  auth.setSecret("admin-me-route-unit-secret-that-is-long-enough");
  const originalGetSetting = db.getSetting;
  const server = app.listen(0, "127.0.0.1");
  await new Promise((resolve) => server.once("listening", resolve));
  const { port } = server.address();
  const endpoint = `http://127.0.0.1:${port}/api/admin/me`;

  try {
    let response = await fetch(endpoint);
    let body = await response.json();
    assert.equal(response.status, 200);
    assert.equal(body.admin, null);

    db.getSetting = async () => ({ username: "admin", totpEnabled: false });
    response = await fetch(endpoint, { headers: { Cookie: adminCookie(false) } });
    body = await response.json();
    assert.equal(response.status, 200);
    assert.equal(body.admin.username, "admin");
    assert.equal(body.admin.requiresMfaSetup, true);
    assert.equal(body.admin.mfaVerified, false);

    db.getSetting = async () => ({
      username: "admin",
      totpEnabled: true,
      totpSecret: "TESTSECRET",
    });
    response = await fetch(endpoint, { headers: { Cookie: adminCookie(true) } });
    body = await response.json();
    assert.equal(response.status, 200);
    assert.equal(body.admin.mfaEnabled, true);
    assert.equal(body.admin.mfaVerified, true);
    assert.equal(body.admin.requiresMfaSetup, false);

    process.env.ADMIN_2FA_REQUIRED = "false";
    db.getSetting = async () => ({ username: "admin", totpEnabled: false });
    response = await fetch(endpoint, { headers: { Cookie: adminCookie(false) } });
    body = await response.json();
    assert.equal(response.status, 200);
    assert.equal(body.admin.mfaRequired, false);
    assert.equal(body.admin.accessGranted, true);
    assert.equal(body.admin.requiresMfaSetup, false);
  } finally {
    if (originalMfaRequirement === undefined) delete process.env.ADMIN_2FA_REQUIRED;
    else process.env.ADMIN_2FA_REQUIRED = originalMfaRequirement;
    db.getSetting = originalGetSetting;
    await new Promise((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
  }
});
