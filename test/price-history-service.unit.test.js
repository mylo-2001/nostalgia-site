"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const service = require("../server/services/price-history-service");

test("price observations keep exact commercial state and reject invalid values", () => {
  assert.deepEqual(service.normalizeObservation({
    itemId: "pv-1",
    price: "79.90",
    regularPrice: "100",
    sourceType: "promotion",
    sourceId: 12,
    sourceStartedAt: "2026-08-01T00:00:00.000Z",
  }), {
    itemId: "pv-1",
    price: 79.9,
    regularPrice: 100,
    sourceType: "promotion",
    sourceId: "12",
    sourceStartedAt: new Date("2026-08-01T00:00:00.000Z"),
    sourceEndsAt: null,
  });
  assert.equal(service.normalizeObservation({ itemId: "", price: 10, regularPrice: 20 }), null);
  assert.equal(service.normalizeObservation({ itemId: "x", price: 0, regularPrice: 20 }), null);
});

test("scheduled promotion transitions are backdated to their real start", () => {
  const transition = service.transitionTime(
    { valid_from: "2026-07-01T00:00:00.000Z" },
    { sourceStartedAt: new Date("2026-08-01T12:00:00.000Z") },
    new Date("2026-08-02T00:00:00.000Z")
  );
  assert.equal(transition.toISOString(), "2026-08-01T12:00:00.000Z");
});

test("expired promotion transitions use the configured end time", () => {
  const transition = service.transitionTime(
    { valid_from: "2026-08-01T00:00:00.000Z", source_ends_at: "2026-08-05T12:00:00.000Z" },
    { sourceType: null, sourceStartedAt: null },
    new Date("2026-08-06T00:00:00.000Z")
  );
  assert.equal(transition.toISOString(), "2026-08-05T12:00:00.000Z");
});

test("reference window is exactly 30 days before reduction start", () => {
  assert.equal(
    service.referenceWindowStart("2026-08-11T00:00:00.000Z").toISOString(),
    "2026-07-12T00:00:00.000Z"
  );
});

