"use strict";

const assert = require("node:assert/strict");
const test = require("node:test");

const { sameOriginReturnUrl, statusForError } = require("../server/routes/v2-router");

test("V2 API maps authorization failures without confusing RBAC and authentication", () => {
  assert.equal(statusForError({ code: "ADMIN_PERMISSION_DENIED" }), 403);
  assert.equal(statusForError({ code: "ORDER_ACCESS_DENIED" }), 401);
  assert.equal(statusForError({ code: "ADMIN_SESSION_INVALID" }), 401);
  assert.equal(statusForError({ code: "ORDER_VERSION_CONFLICT" }), 409);
});

test("payment return URLs are restricted to the storefront origin", () => {
  const previous = process.env.SITE_URL;
  process.env.SITE_URL = "https://shop.example";
  const req = { protocol: "https", get: () => "ignored.example" };
  try {
    assert.equal(sameOriginReturnUrl(req,
      "https://shop.example/checkout?stripe=success&session_id={CHECKOUT_SESSION_ID}"),
    "https://shop.example/checkout?stripe=success&session_id={CHECKOUT_SESSION_ID}");
    assert.throws(() => sameOriginReturnUrl(req, "https://attacker.example/complete"),
      (error) => error.code === "RETURN_URL_ORIGIN_FORBIDDEN");
    assert.throws(() => sameOriginReturnUrl(req, "not-a-url"),
      (error) => error.code === "INVALID_RETURN_URL");
  } finally {
    if (previous === undefined) delete process.env.SITE_URL;
    else process.env.SITE_URL = previous;
  }
});
