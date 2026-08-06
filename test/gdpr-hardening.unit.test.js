"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const db = require("../server/db");

const ROOT = path.resolve(__dirname, "..");
const read = (name) => fs.readFileSync(path.join(ROOT, name), "utf8");

test("browser authentication has no local account fallback", () => {
  const account = read("js/account.js");
  const api = read("js/api.js");
  assert.doesNotMatch(account, /function\s+(?:registerUserLocal|loginUserLocal|hashPassword)\b/);
  assert.doesNotMatch(account, /localStorage\.setItem\(\s*LEGACY_USERS_KEY/);
  assert.match(account, /sessionStorage\.setItem\(\s*SESSION_KEY/);
  assert.match(api, /sessionStorage\.setItem\(\s*SESSION_KEY/);
  assert.match(account, /service_unavailable/);
});

test("account erasure removes delivery identity but preserves required invoice identity", () => {
  const erase = db._test.customerAfterErasure;
  const common = {
    firstname: "Maria", lastname: "Customer", email: "m@example.test",
    phone: "123", street: "Main", city: "Athens", notes: "door code",
    company: "Example PC", afm: "123456789", doy: "Athens", activity: "Retail",
    companyAddress: "Invoice Street", countryCode: "GR", country: "Greece",
  };
  const receipt = erase({ ...common, docType: "receipt" });
  assert.equal(receipt.email, "");
  assert.equal(receipt.street, "");
  assert.equal(receipt.notes, "");
  assert.equal(receipt.company, "");

  const invoice = erase({ ...common, docType: "invoice" });
  assert.equal(invoice.email, "");
  assert.equal(invoice.street, "");
  assert.equal(invoice.company, common.company);
  assert.equal(invoice.afm, common.afm);
});

test("newsletter and campaign audiences require an active subscription", () => {
  const source = read("server/db.js");
  assert.match(source, /listMarketingRecipients[\s\S]*status = 'subscribed'/);
  assert.match(source, /specific_email[\s\S]*status = 'subscribed'/);
  assert.doesNotMatch(source, /a\.type === "past_customers"/);
  assert.match(source, /confirmation_token_hash/);
});

test("tracking is consent gated and clears optional provider storage on withdrawal", () => {
  const tracking = read("js/tracking.js");
  assert.match(tracking, /if \(c\.analytics\)[\s\S]*loadGA\(\)/);
  assert.match(tracking, /if \(c\.marketing\)[\s\S]*loadKlaviyo\(\)/);
  assert.match(tracking, /clearOptionalTrackingStorage\("analytics"\)/);
  assert.match(tracking, /clearOptionalTrackingStorage\("marketing"\)/);
  assert.match(tracking, /fbq\("consent", "revoke"\)/);
});

test("legacy Stripe cannot activate accidentally during the Worldline migration", () => {
  const server = read("server/server.js");
  assert.match(server, /PAYMENT_PROVIDER[\s\S]*!== "stripe"\) return null/);
  assert.match(server, /card_provider_not_configured/);
  assert.match(read("js/privacy-content.js"), /Worldline for hosted card payments when enabled/);
});

