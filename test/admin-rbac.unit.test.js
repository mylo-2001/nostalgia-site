"use strict";

const assert = require("node:assert/strict");
const test = require("node:test");

const { assertPermission, AdminAuthorizationError } = require("../server/domain/admin-rbac");

test("RBAC authorizes only an explicitly granted permission", () => {
  assert.equal(assertPermission([{ permission_code: "order.read" }], "order.read"), true);
  assert.throws(() => assertPermission([{ permission_code: "order.read" }],
    "order.update_status"), (error) => error instanceof AdminAuthorizationError &&
      error.code === "ADMIN_PERMISSION_DENIED");
});
