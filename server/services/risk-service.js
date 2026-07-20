"use strict";

const { moneyToMinor } = require("../domain/money");
const { evaluateRisk } = require("../domain/risk-engine");
const { sha256 } = require("./inventory-service");

class RiskServiceError extends Error {
  constructor(code, message, details = {}) {
    super(message);
    this.name = "RiskServiceError";
    this.code = code;
    this.details = details;
  }
}

function normalizePhone(value) {
  const normalized = String(value || "").replace(/[^0-9+]/g, "");
  if (normalized.length < 8 || normalized.length > 20) {
    throw new RiskServiceError("INVALID_RISK_PHONE", "Phone cannot be normalized for COD risk");
  }
  return normalized;
}

function addressFingerprint(address) {
  return [
    address.line1,
    address.line2,
    address.city,
    address.region,
    address.postalCode,
    address.countryCode,
  ].map((value) => String(value || "").trim().toLowerCase()).join("|");
}

async function assessCodRisk(options) {
  const phoneHash = sha256(`risk-phone:${normalizePhone(options.checkout.customer.phone)}`);
  const addressHash = sha256(`risk-address:${addressFingerprint(options.checkout.shippingAddress)}`);
  const history = await options.client.query(`
    SELECT
      COUNT(*) FILTER (
        WHERE created_at >= $2::timestamptz - interval '24 hours'
      )::int AS orders_24h,
      COUNT(*) FILTER (
        WHERE payment_method_v2 = 'cod'
          AND shipping_status_v2 IN ('delivery_failed', 'returned')
      )::int AS prior_refusals,
      COUNT(DISTINCT lower(COALESCE(customer->>'firstname', '')) || '|' ||
                           lower(COALESCE(customer->>'lastname', '')))::int AS distinct_names,
      COUNT(DISTINCT shipping_address_hash)::int AS distinct_addresses
      FROM orders
     WHERE customer_phone_hash = $1
  `, [phoneHash, options.now]);
  const rules = await options.client.query(`
    SELECT code, metric, operator, threshold, weight, reason_code, active
      FROM risk_rules WHERE active = TRUE ORDER BY code
  `);
  const policy = await options.client.query(`
    SELECT medium_score, high_score, version
      FROM risk_policies WHERE id = 'cod_default'
  `);
  if (!policy.rowCount) throw new RiskServiceError("RISK_POLICY_MISSING", "COD risk policy is missing");
  const totalQuantity = options.checkout.items.reduce((sum, item) => sum + item.quantity, 0);
  const amountMinor = moneyToMinor(options.quote.breakdown.grandTotal, "grandTotal");
  if (amountMinor > BigInt(Number.MAX_SAFE_INTEGER)) {
    throw new RiskServiceError("RISK_AMOUNT_TOO_LARGE", "Order amount exceeds risk engine range");
  }
  const metrics = {
    amount_minor: Number(amountMinor),
    total_quantity: totalQuantity,
    orders_24h: history.rows[0].orders_24h,
    prior_refusals: history.rows[0].prior_refusals,
    distinct_names: history.rows[0].distinct_names,
    distinct_addresses: history.rows[0].distinct_addresses,
    phone_unverified: options.context?.phoneVerified === true ? 0 : 1,
    checkout_anomaly_score: Math.max(0, Math.min(100,
      Number(options.context?.checkoutAnomalyScore || 0))),
  };
  const assessment = evaluateRisk({
    metrics,
    policy: {
      mediumScore: policy.rows[0].medium_score,
      highScore: policy.rows[0].high_score,
    },
    rules: rules.rows.map((rule) => ({
      code: rule.code,
      metric: rule.metric,
      operator: rule.operator,
      threshold: rule.threshold,
      weight: rule.weight,
      reasonCode: rule.reason_code,
      active: rule.active,
    })),
  });
  return {
    ...assessment,
    metrics,
    phoneHash,
    addressHash,
    policyVersion: policy.rows[0].version,
  };
}

async function persistOrderRisk(options) {
  const result = await options.client.query(`
    INSERT INTO risk_assessments (
      order_id, risk_score, risk_level, reasons, rules_triggered,
      decision, policy_version, input_snapshot, request_id
    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
    RETURNING id
  `, [
    options.orderId,
    options.assessment.score,
    options.assessment.level,
    JSON.stringify(options.assessment.reasons),
    JSON.stringify(options.assessment.rulesTriggered),
    options.assessment.decision === "auto_approved" ? "approved" : "pending",
    options.assessment.policyVersion,
    options.assessment.metrics,
    options.requestId || null,
  ]);
  await options.client.query(`
    UPDATE orders
       SET customer_phone_hash = $2, shipping_address_hash = $3,
           risk_level = $4, risk_decision = $5
     WHERE id = $1
  `, [
    options.orderId,
    options.assessment.phoneHash,
    options.assessment.addressHash,
    options.assessment.level,
    options.assessment.decision,
  ]);
  return result.rows[0].id;
}

async function persistBlockedRiskAttempt(options) {
  const inserted = await options.client.query(`
    INSERT INTO risk_assessment_attempts (
      checkout_hash, risk_score, risk_level, reasons, rules_triggered,
      input_snapshot, decision, request_id
    ) VALUES ($1, $2, $3, $4, $5, $6, 'card_required', $7)
    ON CONFLICT (checkout_hash) DO UPDATE SET request_id = EXCLUDED.request_id
    RETURNING id
  `, [
    options.checkoutHash,
    options.assessment.score,
    options.assessment.level,
    JSON.stringify(options.assessment.reasons),
    JSON.stringify(options.assessment.rulesTriggered),
    options.assessment.metrics,
    options.requestId || null,
  ]);
  await options.client.query(`
    INSERT INTO audit_logs (
      actor_type, action, entity_type, entity_id, new_values, source, request_id
    ) VALUES ('system', 'risk.card_required', 'checkout', $1, $2,
              'checkout.cod_risk', $3)
  `, [options.checkoutHash, {
    riskLevel: options.assessment.level,
    riskScore: options.assessment.score,
    reasons: options.assessment.reasons,
  }, options.requestId || null]);
  return inserted.rows[0].id;
}

module.exports = {
  RiskServiceError,
  assessCodRisk,
  persistBlockedRiskAttempt,
  persistOrderRisk,
};
