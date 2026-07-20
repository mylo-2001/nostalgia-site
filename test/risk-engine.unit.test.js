"use strict";

const assert = require("node:assert/strict");
const test = require("node:test");

const { evaluateRisk, RiskEngineError } = require("../server/domain/risk-engine");

const policy = { mediumScore: 25, highScore: 60 };
const rules = [
  { code: "amount", metric: "amount", operator: "gte", threshold: 20000,
    weight: 30, reasonCode: "high_amount", active: true },
  { code: "phone", metric: "unverified", operator: "eq", threshold: 1,
    weight: 20, reasonCode: "unverified_phone", active: true },
  { code: "anomaly", metric: "anomaly", operator: "gte", threshold: 1,
    weight: 20, reasonCode: "checkout_anomaly", active: true },
];

test("COD risk returns explainable low, medium and high decisions", () => {
  assert.equal(evaluateRisk({ metrics: { amount: 1000 }, policy, rules }).decision,
    "auto_approved");
  const medium = evaluateRisk({ metrics: { amount: 20000 }, policy, rules });
  assert.equal(medium.level, "medium");
  assert.deepEqual(medium.reasons, ["high_amount"]);
  const high = evaluateRisk({
    metrics: { amount: 20000, unverified: 1, anomaly: 1 }, policy, rules,
  });
  assert.equal(high.level, "high");
  assert.equal(high.score, "70.00");
  assert.equal(high.rulesTriggered.length, 3);
});

test("COD risk rejects invalid rule configuration", () => {
  assert.throws(() => evaluateRisk({
    metrics: {}, policy, rules: [{ ...rules[0], operator: "contains" }],
  }), (error) => error instanceof RiskEngineError && error.code === "INVALID_RISK_OPERATOR");
});
