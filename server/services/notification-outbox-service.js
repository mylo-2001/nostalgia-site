"use strict";

const EVENT_TYPES = new Set([
  "order_created", "payment_confirmed", "payment_failed", "order_shipped",
  "tracking_added", "order_cancelled", "return_approved", "refund_confirmed",
]);
const FORBIDDEN_KEYS = /(?:password|secret|token|cvv|card_number|pan|authorization)/i;

class NotificationOutboxError extends Error {
  constructor(code, message) {
    super(message);
    this.name = "NotificationOutboxError";
    this.code = code;
  }
}

function assertSafePayload(value, path = "payload") {
  if (value === null || value === undefined) return;
  if (Array.isArray(value)) {
    value.forEach((item, index) => assertSafePayload(item, `${path}[${index}]`));
    return;
  }
  if (typeof value !== "object") return;
  for (const [key, nested] of Object.entries(value)) {
    if (FORBIDDEN_KEYS.test(key)) {
      throw new NotificationOutboxError("UNSAFE_NOTIFICATION_PAYLOAD",
        `Notification payload contains forbidden field: ${path}.${key}`);
    }
    assertSafePayload(nested, `${path}.${key}`);
  }
}

function retryDelayMs(attempt) {
  const exponent = Math.max(0, Math.min(10, Number(attempt) - 1));
  return Math.min(3600000, 5000 * (2 ** exponent));
}

async function enqueueNotification(options) {
  if (!EVENT_TYPES.has(options.eventType)) {
    throw new NotificationOutboxError("INVALID_NOTIFICATION_EVENT", "Notification event is invalid");
  }
  if (!options.eventKey || !options.aggregateType || !options.aggregateId) {
    throw new NotificationOutboxError("INVALID_NOTIFICATION", "Notification identity is required");
  }
  assertSafePayload(options.payload);
  const capabilities = await options.client.query(`SELECT
    EXISTS(SELECT 1 FROM pg_attribute WHERE attrelid='notification_outbox'::regclass
      AND attname='correlation_id' AND NOT attisdropped) AS phase10`);
  const result = capabilities.rows[0].phase10
    ? await options.client.query(`
        INSERT INTO notification_outbox (event_key,event_type,aggregate_type,aggregate_id,
          payload,correlation_id,max_attempts)
        VALUES ($1,$2,$3,$4,$5,$6,$7)
        ON CONFLICT(event_key) DO NOTHING RETURNING id
      `, [options.eventKey, options.eventType, options.aggregateType, options.aggregateId,
        options.payload, options.correlationId || null, options.maxAttempts || 8])
    : await options.client.query(`
        INSERT INTO notification_outbox (event_key,event_type,aggregate_type,aggregate_id,payload)
        VALUES ($1,$2,$3,$4,$5)
        ON CONFLICT(event_key) DO NOTHING RETURNING id
      `, [options.eventKey, options.eventType, options.aggregateType, options.aggregateId,
        options.payload]);
  return { queued: !!result.rowCount, id: result.rows[0]?.id || null };
}

async function claimNotifications(options) {
  const client = await options.pool.connect();
  const now = options.now instanceof Date ? options.now : new Date(options.now || Date.now());
  try {
    await client.query("BEGIN");
    const result = await client.query(`
      WITH candidates AS (
        SELECT id FROM notification_outbox
         WHERE (
           status IN ('pending','failed') AND COALESCE(next_retry_at,created_at) <= $1
         ) OR (
           status='processing' AND locked_at < $1 - interval '10 minutes'
         )
         ORDER BY COALESCE(next_retry_at,created_at),created_at
         FOR UPDATE SKIP LOCKED
         LIMIT $2
      )
      UPDATE notification_outbox n
         SET status='processing',locked_at=$1,locked_by=$3,
             attempts=attempts+1,last_attempt_at=$1,updated_at=$1
        FROM candidates c WHERE n.id=c.id
      RETURNING n.*
    `, [now, options.batchSize || 25, options.workerId]);
    await client.query("COMMIT");
    return result.rows;
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally { client.release(); }
}

async function finishNotification(options) {
  const client = await options.pool.connect();
  try {
    if (options.error) {
      const delay = retryDelayMs(options.notification.attempts);
      await client.query(`
        UPDATE notification_outbox
           SET status=CASE WHEN attempts>=max_attempts THEN 'dead_letter' ELSE 'failed' END,
               last_error=$3,next_retry_at=CASE WHEN attempts>=max_attempts THEN NULL ELSE $4::timestamptz END,
               locked_at=NULL,locked_by=NULL,updated_at=$2
         WHERE id=$1 AND status='processing' AND locked_by=$5
      `, [options.notification.id, options.now,
        String(options.error.message || options.error).slice(0, 1000),
        new Date(options.now.getTime() + delay), options.workerId]);
    } else {
      await client.query(`
        UPDATE notification_outbox SET status='sent',sent_at=$2,last_error=NULL,
          next_retry_at=NULL,locked_at=NULL,locked_by=NULL,updated_at=$2
         WHERE id=$1 AND status='processing' AND locked_by=$3
      `, [options.notification.id, options.now, options.workerId]);
    }
  } finally { client.release(); }
}

async function processNotificationBatch(options) {
  if (!options.sender || typeof options.sender.send !== "function") {
    throw new TypeError("Notification worker requires a sender adapter");
  }
  const now = options.now instanceof Date ? options.now : new Date(options.now || Date.now());
  const notifications = await claimNotifications({ ...options, now });
  const results = [];
  for (const notification of notifications) {
    try {
      await options.sender.send({ eventType: notification.event_type,
        eventKey: notification.event_key, payload: notification.payload,
        correlationId: notification.correlation_id });
      await finishNotification({ ...options, notification, now });
      results.push({ id: notification.id, sent: true });
    } catch (error) {
      await finishNotification({ ...options, notification, now, error });
      results.push({ id: notification.id, sent: false, error: String(error.message || error) });
    }
  }
  return { claimed: notifications.length, results };
}

module.exports = { EVENT_TYPES, NotificationOutboxError, assertSafePayload,
  claimNotifications, enqueueNotification, processNotificationBatch, retryDelayMs };
