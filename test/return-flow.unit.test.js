"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const root = path.join(__dirname, "..");
const read = (file) => fs.readFileSync(path.join(root, file), "utf8");

test("customer account creates returns from server-authorized order items", () => {
  const router = read("server/routes/v2-router.js");
  const account = read("js/account.js");
  assert.match(router, /\/orders\/:id\/return-options/);
  assert.match(router, /getOrderPaymentStatus[\s\S]*getReturnOptions/);
  assert.match(account, /data-return-order/);
  assert.match(account, /postWithHeaders[\s\S]*Idempotency-Key/);
});

test("admin return workflow records courier handoff with ACS tracking", () => {
  const router = read("server/routes/v2-router.js");
  const service = read("server/services/return-refund-service.js");
  const admin = read("admin/src/pages/Returns.tsx");
  const migration = read("server/migrations/042_return_shipping.up.sql");
  assert.match(router, /\/admin\/orders\/:id\/returns/);
  assert.match(router, /\/admin\/returns\/:id\/handoff/);
  assert.match(router, /\/admin\/returns\/:id\/tracking/);
  assert.match(router, /options\.acs\.trackingDetails/);
  assert.match(service, /return\.handed_to_courier/);
  assert.match(admin, /Παραδόθηκε στον courier επιστροφής/);
  assert.match(migration, /return_tracking_number/);
});

test("reverse voucher generation is not fabricated without documented ACS parameters", () => {
  const admin = read("admin/src/pages/Returns.tsx");
  const acs = read("server/acs.js");
  assert.match(admin, /Voucher \/ tracking ACS/);
  assert.doesNotMatch(acs, /ACS_Create_Return_Voucher/);
});
