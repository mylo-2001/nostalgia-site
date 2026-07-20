"use strict";

const assert = require("node:assert/strict");
const test = require("node:test");

const originalMfaRequirement = process.env.ADMIN_2FA_REQUIRED;
process.env.ADMIN_2FA_REQUIRED = "false";

const auth = require("../server/auth");
const db = require("../server/db");
const { app } = require("../server/server");

function adminCookie() {
  const cookies = [];
  auth.startAdminSession({ append(name, value) { cookies.push([name, value]); } },
    "admin", { mfaVerified: false });
  return cookies[0][1].split(";")[0];
}

test("product content API normalizes complete bilingual details", async () => {
  auth.setSecret("product-content-unit-secret-that-is-long-enough");
  const originals = {
    getCustomProduct: db.getCustomProduct,
    getOverrides: db.getOverrides,
    setProductDetails: db.setProductDetails,
    getProductDetails: db.getProductDetails,
    logEvent: db.logEvent,
  };
  let stored = null;
  db.getCustomProduct = async () => null;
  db.getOverrides = async () => ({});
  db.setProductDetails = async (_id, details) => { stored = details; };
  db.getProductDetails = async () => ({ details: stored });
  db.logEvent = async () => {};

  const server = app.listen(0, "127.0.0.1");
  await new Promise((resolve) => server.once("listening", resolve));
  const { port } = server.address();

  try {
    const response = await fetch(`http://127.0.0.1:${port}/api/admin/products/cat1-1`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json", Cookie: adminCookie() },
      body: JSON.stringify({ details: {
        legacyMarker: { keep: true },
        colorFamily: "gold",
        description: "Σύντομη περιγραφή",
        descriptionEn: "Short description",
        badges: "Χειροποίητο, Limited",
        badgesEn: "Handmade, Limited",
        features: "Πρώτο\nΔεύτερο",
        featuresEn: "First\nSecond",
        specs: "Υλικό: Κερί\nΒάρος: 200 g",
        specsEn: "Material: Wax\nWeight: 200 g",
        care: "Κόψτε το φυτίλι\nΜην αφήνετε χωρίς επίβλεψη",
        shipping: "Αποστολή 1-3 ημέρες",
        includes: "Κερί\nΣυσκευασία",
        scentNotes: { top: "  Περγαμόντο ", heart: " Γιασεμί ", base: " Κέδρος " },
        scentNotesEn: { top: " Bergamot ", heart: " Jasmine ", base: " Cedar " },
        diffuser: { notes: " Σύκο ", duration: " 3 μήνες ", capacity: " 200 ml " },
        diffuserEn: { notes: " Fig ", duration: " 3 months ", capacity: " 200 ml " },
      } }),
    });
    const body = await response.json();

    assert.equal(response.status, 200);
    assert.equal(body.ok, true);
    assert.deepEqual(stored.legacyMarker, { keep: true });
    assert.deepEqual(stored.badges, ["Χειροποίητο", "Limited"]);
    assert.deepEqual(stored.features, ["Πρώτο", "Δεύτερο"]);
    assert.deepEqual(stored.specs, [
      { label: "Υλικό", value: "Κερί" },
      { label: "Βάρος", value: "200 g" },
    ]);
    assert.deepEqual(stored.scentNotes, { top: "Περγαμόντο", heart: "Γιασεμί", base: "Κέδρος" });
    assert.deepEqual(stored.diffuser, { notes: "Σύκο", duration: "3 μήνες", capacity: "200 ml" });
    assert.deepEqual(stored.diffuserEn, { notes: "Fig", duration: "3 months", capacity: "200 ml" });
  } finally {
    Object.assign(db, originals);
    if (originalMfaRequirement === undefined) delete process.env.ADMIN_2FA_REQUIRED;
    else process.env.ADMIN_2FA_REQUIRED = originalMfaRequirement;
    await new Promise((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
  }
});
