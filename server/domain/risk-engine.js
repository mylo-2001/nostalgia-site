"use strict";

class RiskEngineError extends Error {
  constructor(code, message) {
    super(message);
    this.name = "RiskEngineError";
    this.code = code;
  }
}

function compare(value, operator, threshold) {
  if (operator === "gte") return value >= threshold;
  if (operator === "gt") return value > threshold;
  if (operator === "eq") return value === threshold;
  throw new RiskEngineError("INVALID_RISK_OPERATOR", `Unsupported risk operator: ${operator}`);
}

function evaluateRisk(input) {
  const metrics = input.metrics || {};
  const triggered = [];
  let score = 0;
  for (const rule of input.rules || []) {
    if (!rule.active) continue;
    const value = Number(metrics[rule.metric] || 0);
    const threshold = Number(rule.threshold);
    const weight = Number(rule.weight);
    if (![value, threshold, weight].every(Number.isFinite) || weight < 0) {
      throw new RiskEngineError("INVALID_RISK_CONFIGURATION", `Invalid risk rule: ${rule.code}`);
    }
    if (compare(value, rule.operator, threshold)) {
      score += weight;
      triggered.push({
        code: rule.code,
        metric: rule.metric,
        value,
        threshold,
        weight,
        reason: rule.reasonCode,
      });
    }
  }
  score = Math.round(score * 100) / 100;
  const medium = Number(input.policy.mediumScore);
  const high = Number(input.policy.highScore);
  if (!Number.isFinite(medium) || !Number.isFinite(high) || high <= medium) {
    throw new RiskEngineError("INVALID_RISK_POLICY", "Risk score thresholds are invalid");
  }
  const level = score >= high ? "high" : score >= medium ? "medium" : "low";
  const decision = level === "high"
    ? "card_required"
    : level === "medium" ? "manual_review" : "auto_approved";
  return {
    score: score.toFixed(2),
    level,
    decision,
    reasons: triggered.map((rule) => rule.reason),
    rulesTriggered: triggered,
  };
}

module.exports = { RiskEngineError, evaluateRisk };

