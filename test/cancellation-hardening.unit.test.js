"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const root = path.join(__dirname, "..");
const read = (file) => fs.readFileSync(path.join(root, file), "utf8");

test("guest cancellation requires an order capability token", () => {
  const server = read("server/server.js");
  const route = server.slice(server.indexOf('app.post("/api/orders/:id/cancel"'),
    server.indexOf('app.get("/api/orders/mine"'));
  assert.match(route, /x-order-access-token/);
  assert.match(route, /timingSafeEqualStr/);
  assert.match(route, /order_access_denied/);
  assert.doesNotMatch(route, /stripe\.refunds|checkout\.sessions/);
});

test("paid cancellation requires a confirmed full provider refund", () => {
  const server = read("server/server.js");
  const adminService = read("server/services/admin-order-service.js");
  assert.match(server, /hasConfirmedFullRefund/);
  assert.match(server, /r\.status='confirmed'/);
  assert.match(server, /provider_refund_required/);
  assert.match(adminService, /PROVIDER_REFUND_REQUIRED/);
});

test("admin cannot manually select a card refund status", () => {
  const labels = read("admin/src/lib/labels.ts");
  const orders = read("admin/src/pages/Orders.tsx");
  assert.match(labels, /PAY_CARD_ORDER[^\n]+\["pending", "paid", "failed"\]/);
  assert.match(orders, /o\.payment === "cod" \?/);
  assert.match(orders, /Ενημερώνεται μόνο από επιβεβαιωμένη απάντηση του παρόχου/);
  const router = read("server/routes/v2-router.js");
  assert.match(router, /WORLDLINE_REFUNDS_NOT_CONFIGURED/);
});

test("ACS RDO return voucher is not used as a commercial reverse shipment", () => {
  const acs = read("server/acs.js");
  const apiDocs = read("docs/api-v2.md");
  assert.match(acs, /not a post-delivery commercial product return/);
  assert.match(apiDocs, /With_Return_Voucher=1/);
});
