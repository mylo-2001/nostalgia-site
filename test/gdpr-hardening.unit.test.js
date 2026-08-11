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

test("storefront payments remain Worldline-only and disabled until implemented", () => {
  const server = read("server/server.js");
  assert.match(server, /WORLDLINE_INTEGRATION_IMPLEMENTED = false/);
  assert.match(server, /async function getStripe\(\)\s*\{[\s\S]*return null;/);
  assert.doesNotMatch(server, /stripePublishableKey:/);
  assert.match(server, /worldlinePaymentsEnabled:/);
  assert.match(server, /card_provider_not_configured/);
  assert.match(read("js/privacy-content.js"), /Worldline for hosted card payments when enabled/);
});

test("legal pages and checkout terms acceptance are wired end to end", () => {
  ["terms", "cookie-policy", "warranty", "cancellations"].forEach((page) => {
    assert.match(read(`html/${page}.html`), /legal-dynamic-content/);
  });
  const checkout = read("html/checkout.html");
  const client = read("js/checkout.js");
  const server = read("server/server.js");
  assert.match(checkout, /id="checkout-terms-accepted"[^>]*required/);
  assert.match(client, /!cardPaymentsEnabled \|\| !isTermsAccepted\(\)/);
  assert.match(client, /terms\.addEventListener\("change"[\s\S]*updateCta\(\)/);
  assert.match(client, /termsAccepted: true/);
  assert.match(client, /termsVersion: TERMS_VERSION/);
  assert.match(server, /terms_not_accepted/);
  assert.match(read("server/migrations/041_order_terms_acceptance.up.sql"), /terms_accepted_at/);
  assert.match(read("js/privacy.js"), /eur-lex\.europa\.eu\/eli\/reg\/2016\/679\/oj\/eng/);
  assert.match(read("js/privacy.js"), /commission\.europa\.eu\/law\/law-topic\/data-protection\/information-individuals_en/);
  assert.match(read("js/privacy.js"), /dpa\.gr\/el\/enimerwtiko\/nomothesia\/proswpika\/nomothesia_prwsopikwn/);
  assert.match(read("js/privacy.js"), /dpa\.gr\/el\/foreis\/asfaleia_dedomenwn\/gnwstopoiisi_paraviasis/);
  assert.match(read("js/legal-pages.js"), /eur-lex\.europa\.eu\/eli\/dir\/2011\/83\/oj\/eng/);
  assert.match(read("js/legal-pages.js"), /CELEX%3A32019L2161/);
  assert.match(read("js/review-policy.js"), /CELEX%3A32019L2161/);
  assert.match(read("js/legal-pages.js"), /gov\.gr\/ipiresies\/polites-kai-kathemerinoteta\/kataggelies\/kataggelia-katanalote/);
  assert.match(read("js/legal-pages.js"), /european-union\.europa\.eu\/contact-eu\/make-complaint_el/);
  assert.doesNotMatch(read("js/legal-pages.js"), /ec\.europa\.eu\/consumers\/odr/);
});

test("admin return workflow supports inspection but keeps Worldline refunds disabled", () => {
  const app = read("admin/src/App.tsx");
  const page = read("admin/src/pages/Returns.tsx");
  const router = read("server/routes/v2-router.js");
  const service = read("server/services/return-refund-service.js");
  assert.match(app, /id: "returns"/);
  assert.match(page, /value="defective"/);
  assert.match(page, /<button[^>]*disabled>Refund μέσω Worldline/);
  assert.match(router, /get\("\/admin\/returns"/);
  assert.match(router, /\/admin\/returns\/:id\/reject/);
  assert.match(service, /RETURN_NOT_COMPLETED/);
  assert.match(service, /UNSELLABLE_RESTOCK/);
});
