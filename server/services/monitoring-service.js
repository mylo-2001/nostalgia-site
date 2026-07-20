"use strict";

const FORBIDDEN = /(?:password|secret|token|cvv|card_number|authorization)/i;

function sanitizeMetadata(value, depth = 0) {
  if (depth > 5 || value === null || value === undefined) return value;
  if (Array.isArray(value)) return value.slice(0, 50).map((item) => sanitizeMetadata(item, depth + 1));
  if (typeof value !== "object") return typeof value === "string" ? value.slice(0, 1000) : value;
  const output = {};
  for (const [key, nested] of Object.entries(value)) {
    if (!FORBIDDEN.test(key)) output[key] = sanitizeMetadata(nested, depth + 1);
  }
  return output;
}

async function recordOperationalEvent(options) {
  const result = await options.client.query(`INSERT INTO operational_events
    (event_type,severity,entity_type,entity_id,request_id,correlation_id,metadata)
    VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING id`, [options.eventType,
    options.severity || "info", options.entityType || null, options.entityId || null,
    options.requestId || null, options.correlationId || options.requestId || null,
    sanitizeMetadata(options.metadata || {})]);
  return result.rows[0].id;
}

async function collectOperationalMetrics(options) {
  const client = await options.pool.connect();
  try {
    const result = await client.query(`SELECT
      (SELECT COUNT(*)::int FROM idempotency_keys WHERE status='failed'
        AND created_at>=now()-interval '1 hour') checkout_errors_1h,
      (SELECT COUNT(*)::int FROM payments WHERE status='failed'
        AND updated_at>=now()-interval '1 hour') payment_failures_1h,
      (SELECT COUNT(*)::int FROM payment_events WHERE processing_status='failed'
        AND received_at>=now()-interval '1 hour') webhook_failures_1h,
      (SELECT COUNT(*)::int FROM payment_events WHERE processing_status='received'
        AND received_at<now()-interval '5 minutes') webhook_delayed,
      (SELECT COUNT(*)::int FROM inventory_reservation_groups WHERE status='active'
        AND expires_at<now()) expired_reservations,
      (SELECT COUNT(*)::int FROM inventory WHERE stock_on_hand<0 OR reserved_quantity<0
        OR reserved_quantity>stock_on_hand) negative_stock_invariants,
      (SELECT COUNT(*)::int FROM notification_outbox WHERE status IN ('failed','dead_letter'))
        notification_failures,
      (SELECT COUNT(*)::int FROM refunds WHERE status='failed'
        AND updated_at>=now()-interval '24 hours') refund_failures_24h`);
    return result.rows[0];
  } finally { client.release(); }
}

const ALERT_RULES = [
  ["negative_stock_invariants", 1, "negative_stock_invariant", "critical"],
  ["webhook_delayed", 1, "webhook_processing_delay", "error"],
  ["expired_reservations", 10, "expired_stock_reservations", "warning"],
  ["notification_failures", 10, "notification_failures", "warning"],
  ["refund_failures_24h", 5, "refund_failures", "error"],
  ["checkout_errors_1h", 10, "checkout_error_rate", "error"],
];

async function evaluateOperationalAlerts(options) {
  const metrics = options.metrics || await collectOperationalMetrics(options);
  const client = await options.pool.connect();
  const alerts = [];
  try {
    for (const [metric, threshold, type, severity] of ALERT_RULES) {
      if (Number(metrics[metric]) < threshold) continue;
      const result = await client.query(`INSERT INTO operational_alerts
        (dedupe_key,alert_type,severity,details) VALUES ($1,$2,$3,$4)
        ON CONFLICT(dedupe_key) WHERE status='open' DO UPDATE SET
          last_seen_at=now(),occurrences=operational_alerts.occurrences+1,
          details=EXCLUDED.details RETURNING id`,
      [`${type}:active`, type, severity, { metric, value: metrics[metric], threshold }]);
      alerts.push({ id: result.rows[0].id, type, severity });
    }
    return { metrics, alerts };
  } finally { client.release(); }
}

async function runTrackedJob(options) {
  const client = await options.pool.connect();
  let runId;
  try {
    runId = (await client.query(`INSERT INTO scheduled_job_runs
      (job_name,status,worker_id,correlation_id) VALUES ($1,'running',$2,$3) RETURNING id`,
    [options.jobName, options.workerId, options.correlationId || null])).rows[0].id;
  } finally { client.release(); }
  try {
    const result = await options.work();
    const done = await options.pool.connect();
    try { await done.query(`UPDATE scheduled_job_runs SET status='succeeded',result=$2,
      completed_at=now() WHERE id=$1`, [runId, result || {}]); } finally { done.release(); }
    return result;
  } catch (error) {
    const failed = await options.pool.connect();
    try { await failed.query(`UPDATE scheduled_job_runs SET status='failed',error_message=$2,
      completed_at=now() WHERE id=$1`, [runId, String(error.message || error).slice(0,1000)]); }
    finally { failed.release(); }
    throw error;
  }
}

module.exports = { ALERT_RULES, collectOperationalMetrics, evaluateOperationalAlerts,
  recordOperationalEvent, runTrackedJob, sanitizeMetadata };
