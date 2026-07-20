"use strict";

const crypto = require("node:crypto");

const { moneyToMinor } = require("../domain/money");
const {
  consumeInventoryReservationGroup,
  releaseInventoryReservationGroup,
  reserveInventory,
  sha256,
} = require("./inventory-service");
const { transitionOrderStateInTransaction } = require("./order-state-service");
const { enqueueNotification } = require("./notification-outbox-service");

class PaymentServiceError extends Error {
  constructor(code, message, details = {}) {
    super(message);
    this.name = "PaymentServiceError";
    this.code = code;
    this.details = details;
  }
}

function fail(code, message, details) {
  throw new PaymentServiceError(code, message, details);
}

function minorNumber(value, field) {
  const minor = moneyToMinor(value, field);
  if (minor > BigInt(Number.MAX_SAFE_INTEGER)) fail("PAYMENT_AMOUNT_TOO_LARGE", "Payment amount is too large");
  return Number(minor);
}

function validateUrl(value, field) {
  let parsed;
  try {
    parsed = new URL(value);
  } catch (_) {
    fail("INVALID_RETURN_URL", `${field} must be an absolute URL`);
  }
  if (!['https:', 'http:'].includes(parsed.protocol)) fail("INVALID_RETURN_URL", `${field} is invalid`);
  return parsed.toString();
}

async function createCardPaymentSession(options) {
  if (!options.pool || typeof options.pool.connect !== "function") {
    throw new TypeError("createCardPaymentSession requires a PostgreSQL pool");
  }
  if (!options.provider || typeof options.provider.createCheckoutSession !== "function") {
    throw new TypeError("createCardPaymentSession requires a payment provider adapter");
  }
  const idempotencyKey = String(options.idempotencyKey || "");
  if (idempotencyKey.length < 16 || idempotencyKey.length > 500) {
    fail("PAYMENT_IDEMPOTENCY_KEY_REQUIRED", "Payment session requires an idempotency key");
  }
  const providerName = options.provider.name;
  const keyHash = sha256(`payment-session:${providerName}:${idempotencyKey}`);
  const now = options.now instanceof Date ? options.now : new Date(options.now || Date.now());
  const client = await options.pool.connect();
  let payment;
  let providerInput;
  let reservationGroupKey;
  try {
    await client.query("BEGIN");
    const order = await client.query(`
      SELECT id, number, payment_method_v2, payment_status_v2, order_status_v2,
             grand_total, currency, customer_email_normalized,
             reservation_group_key, payment_expires_at
        FROM orders WHERE id = $1 FOR UPDATE
    `, [options.orderId]);
    if (!order.rowCount) fail("ORDER_NOT_FOUND", "Order does not exist");
    const row = order.rows[0];
    if (row.payment_method_v2 !== "card") fail("ORDER_NOT_CARD_PAYMENT", "Order is not a card payment");
    if (['paid', 'refunded', 'partially_refunded'].includes(row.payment_status_v2)) {
      fail("ORDER_ALREADY_PAID", "Order payment is already settled");
    }
    const existing = await client.query(`
      SELECT id, provider_session_id, provider_checkout_url, checkout_expires_at,
             status, amount, currency
        FROM payments
       WHERE provider = $1 AND provider_idempotency_key_hash = $2
       FOR UPDATE
    `, [providerName, keyHash]);
    if (existing.rowCount) {
      const previous = existing.rows[0];
      if (previous.provider_checkout_url) {
        await client.query("COMMIT");
        return {
          paymentId: previous.id,
          checkoutUrl: previous.provider_checkout_url,
          expiresAt: previous.checkout_expires_at,
          idempotent: true,
        };
      }
      fail("PAYMENT_SESSION_IN_PROGRESS", "Payment session is still being created");
    }

    const activeAttempt = await client.query(`
      SELECT id,provider_checkout_url,checkout_expires_at
        FROM payments
       WHERE order_id=$1 AND provider=$2 AND status='pending'
         AND (checkout_expires_at IS NULL OR checkout_expires_at > $3)
       ORDER BY attempt DESC
       LIMIT 1
       FOR UPDATE
    `, [row.id, providerName, now]);
    if (activeAttempt.rowCount) {
      const active = activeAttempt.rows[0];
      if (!active.provider_checkout_url) {
        fail("PAYMENT_SESSION_IN_PROGRESS", "An order payment session is still being created");
      }
      await client.query("COMMIT");
      return { paymentId: active.id, checkoutUrl: active.provider_checkout_url,
        expiresAt: active.checkout_expires_at, idempotent: true };
    }

    if (row.payment_status_v2 === "failed") {
      const retryLines = await client.query(`
        SELECT id AS order_item_id,product_id,variant_id,quantity
          FROM order_items WHERE order_id=$1 ORDER BY line_number
      `, [row.id]);
      const retryReservation = await reserveInventory({
        client,
        orderId: row.id,
        reservationKey: `payment-retry:${idempotencyKey}`,
        lines: retryLines.rows.map((line) => ({
          orderItemId: line.order_item_id,
          productId: line.product_id,
          variantId: line.variant_id,
          quantity: line.quantity,
        })),
        actor: { type: "customer", id: row.customer_email_normalized },
        source: "payment.retry",
        requestId: options.requestId,
        now,
      });
      await transitionOrderStateInTransaction({
        client,
        orderId: row.id,
        changes: { paymentStatus: "pending" },
        actor: { type: "customer", id: row.customer_email_normalized },
        source: "payment.retry",
        requestId: options.requestId,
        metadata: { reason: "new_payment_attempt" },
      });
      await client.query(`UPDATE orders SET reservation_group_key=$2,payment_expires_at=NULL
        WHERE id=$1`, [row.id, retryReservation.groupKey]);
      await client.query(`UPDATE coupon_redemptions SET status='reserved',released_at=NULL,
        expires_at=$2 WHERE order_id=$1 AND status='released'`,
      [row.id, retryReservation.expiresAt]);
      row.reservation_group_key = retryReservation.groupKey;
      row.payment_status_v2 = "pending";
    }

    const attempt = await client.query(`
      SELECT COALESCE(MAX(attempt), 0)::int + 1 AS next_attempt
        FROM payments WHERE order_id = $1
    `, [row.id]);
    const inserted = await client.query(`
      INSERT INTO payments (
        order_id, attempt, provider, payment_method, status, amount, currency,
        provider_idempotency_key_hash, metadata
      ) VALUES ($1, $2, $3, 'card', 'pending', $4, $5, $6, $7)
      RETURNING id, amount, currency
    `, [
      row.id,
      attempt.rows[0].next_attempt,
      providerName,
      row.grand_total,
      row.currency,
      keyHash,
      { requestId: options.requestId || null },
    ]);
    payment = inserted.rows[0];
    await client.query("UPDATE orders SET last_payment_id = $2 WHERE id = $1", [row.id, payment.id]);
    const items = await client.query(`
      SELECT product_id, variant_id, product_name, sku, quantity, line_total
        FROM order_items WHERE order_id = $1 ORDER BY line_number
    `, [row.id]);
    const charges = items.rows.reduce((sum, item) => sum + minorNumber(item.line_total, "lineTotal"), 0);
    const totalMinor = minorNumber(row.grand_total, "grandTotal");
    const shippingMinor = totalMinor - charges;
    if (shippingMinor < 0) fail("PAYMENT_BREAKDOWN_INVALID", "Order item totals exceed grand total");
    const reservation = await client.query(`
      SELECT expires_at, status FROM inventory_reservation_groups
       WHERE group_key = $1 FOR SHARE
    `, [row.reservation_group_key]);
    if (!reservation.rowCount || reservation.rows[0].status !== "active") {
      fail("RESERVATION_NOT_ACTIVE", "Order inventory reservation is not active");
    }
    const expiresAt = new Date(reservation.rows[0].expires_at);
    if (expiresAt <= new Date(now.getTime() + 1800000)) {
      fail("RESERVATION_TOO_CLOSE_TO_EXPIRY", "Reservation must have at least 30 minutes remaining");
    }
    providerInput = {
      orderId: row.id,
      paymentId: payment.id,
      customerEmail: row.customer_email_normalized,
      currency: row.currency,
      amountMinor: totalMinor,
      shippingMinor,
      codFeeMinor: 0,
      items: items.rows.map((item) => ({
        productId: item.product_id,
        variantId: item.variant_id,
        productName: item.product_name,
        sku: item.sku,
        quantity: item.quantity,
        lineTotalMinor: minorNumber(item.line_total, "lineTotal"),
      })),
      successUrl: validateUrl(options.successUrl, "successUrl"),
      cancelUrl: validateUrl(options.cancelUrl, "cancelUrl"),
      expiresAtUnix: Math.floor(expiresAt.getTime() / 1000),
      providerIdempotencyKey: `nostalgia-payment-${payment.id}`,
    };
    reservationGroupKey = row.reservation_group_key.trim();
    await client.query("COMMIT");
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }

  let session;
  try {
    session = await options.provider.createCheckoutSession(providerInput);
    if (!session?.id || !session?.url) {
      throw new Error("Provider session response is invalid");
    }
  } catch (error) {
    const failure = await options.pool.connect();
    try {
      await failure.query("BEGIN");
      await failure.query(`
        UPDATE payments
           SET status = 'failed', failure_code = 'session_creation_failed',
               failure_message = $2, updated_at = now()
         WHERE id = $1 AND status = 'pending'
      `, [payment.id, String(error.message || "provider error").slice(0, 300)]);
      await transitionOrderStateInTransaction({
        client: failure,
        orderId: options.orderId,
        changes: { paymentStatus: "failed" },
        actor: { type: "system", id: "payment-session" },
        source: "payment.session_failure",
        requestId: options.requestId,
        metadata: { paymentId: payment.id },
      });
      const group = await failure.query(`
        SELECT status FROM inventory_reservation_groups WHERE group_key=$1 FOR UPDATE
      `, [reservationGroupKey]);
      if (group.rows[0]?.status === "active") {
        await releaseInventoryReservationGroup({
          client: failure,
          groupKey: reservationGroupKey,
          operationKey: `payment-session-failure:${payment.id}`,
          reason: "session_creation_failed",
          actor: { type: "system", id: "payment-session" },
          source: "payment.session_failure",
          requestId: options.requestId,
        });
      }
      await failure.query("UPDATE orders SET payment_status='failed' WHERE id=$1",
        [options.orderId]);
      await failure.query("COMMIT");
    } catch (cleanupError) {
      await failure.query("ROLLBACK");
      throw cleanupError;
    } finally {
      failure.release();
    }
    fail("PAYMENT_PROVIDER_UNAVAILABLE", "Payment session could not be created");
  }
  const update = await options.pool.connect();
  try {
    await update.query("BEGIN");
    const saved = await update.query(`
      UPDATE payments
         SET provider_session_id = $2, provider_checkout_url = $3,
             provider_payment_intent_id = $4, checkout_expires_at = $5,
             updated_at = now()
       WHERE id = $1 AND status = 'pending'
       RETURNING id
    `, [payment.id, session.id, session.url, session.paymentIntentId || null, session.expiresAt]);
    if (!saved.rowCount) fail("PAYMENT_ATTEMPT_CHANGED", "Payment attempt changed before session was saved");
    await update.query(`
      UPDATE orders SET payment_expires_at = $2 WHERE id = $1
    `, [options.orderId, session.expiresAt]);
    await update.query("COMMIT");
  } catch (error) {
    await update.query("ROLLBACK");
    throw error;
  } finally {
    update.release();
  }
  return {
    paymentId: payment.id,
    checkoutUrl: session.url,
    expiresAt: session.expiresAt,
    idempotent: false,
  };
}

async function processPaymentWebhook(options) {
  if (!options.provider || typeof options.provider.verifyWebhook !== "function") {
    throw new TypeError("processPaymentWebhook requires a payment provider adapter");
  }
  let verified;
  try {
    verified = options.provider.verifyWebhook(
      options.rawBody,
      options.signature,
      options.webhookSecret
    );
  } catch (_) {
    fail("INVALID_WEBHOOK_SIGNATURE", "Payment webhook signature is invalid");
  }
  const event = options.provider.normalizeWebhookEvent(verified);
  if (!event.id || !event.type) fail("INVALID_PROVIDER_EVENT", "Provider event is invalid");
  const rawHash = crypto.createHash("sha256").update(options.rawBody).digest("hex");
  const sanitized = { ...event };
  const client = await options.pool.connect();
  try {
    await client.query("BEGIN");
    const inserted = await client.query(`
      INSERT INTO payment_events (
        provider, provider_event_id, event_type, signature_verified,
        raw_event, raw_event_sha256, processing_status, attempts,
        processing_started_at, request_id
      ) VALUES ($1, $2, $3, TRUE, $4, $5, 'received', 1, now(), $6)
      ON CONFLICT (provider, provider_event_id) DO NOTHING
      RETURNING id
    `, [
      options.provider.name,
      event.id,
      event.type,
      sanitized,
      rawHash,
      options.requestId || null,
    ]);
    if (!inserted.rowCount) {
      await client.query("COMMIT");
      return { received: true, duplicate: true };
    }
    if (event.outcome === "ignored") {
      await client.query(`
        UPDATE payment_events SET processing_status = 'ignored', processed_at = now()
         WHERE id = $1
      `, [inserted.rows[0].id]);
      await client.query("COMMIT");
      return { received: true, ignored: true };
    }

    const payment = await client.query(`
      SELECT p.*, o.reservation_group_key, o.order_status_v2,
             o.payment_status_v2, o.shipping_status_v2
        FROM payments p
        JOIN orders o ON o.id = p.order_id
       WHERE p.provider = $1
         AND (
           ($2::uuid IS NOT NULL AND p.id = $2::uuid)
           OR ($3::text IS NOT NULL AND p.provider_session_id = $3)
           OR ($4::text IS NOT NULL AND p.provider_payment_intent_id = $4)
         )
       FOR UPDATE OF p, o
    `, [
      options.provider.name,
      event.paymentId,
      event.sessionId,
      event.paymentIntentId,
    ]);
    if (!payment.rowCount) {
      await client.query(`
        UPDATE payment_events SET processing_status = 'ignored', processed_at = now(),
               last_error = 'payment_not_found'
         WHERE id = $1
      `, [inserted.rows[0].id]);
      await client.query("COMMIT");
      return { received: true, ignored: true };
    }
    const row = payment.rows[0];
    await client.query(`
      UPDATE payment_events SET payment_id = $2, order_id = $3 WHERE id = $1
    `, [inserted.rows[0].id, row.id, row.order_id]);
    if (event.orderId && event.orderId !== row.order_id) {
      fail("WEBHOOK_ORDER_MISMATCH", "Provider event order metadata does not match payment");
    }
    if (event.outcome === "paid") {
      const expectedMinor = minorNumber(row.amount, "payment.amount");
      if (event.amountMinor !== expectedMinor || event.currency !== row.currency) {
        await client.query(`
          UPDATE payment_events
             SET processing_status = 'failed', processed_at = now(),
                 last_error = 'amount_or_currency_mismatch'
           WHERE id = $1
        `, [inserted.rows[0].id]);
        await client.query(`
          INSERT INTO audit_logs (
            actor_type, actor_id, action, entity_type, entity_id,
            new_values, source, request_id
          ) VALUES ('provider', $1, 'payment.amount_mismatch', 'payment', $2, $3,
                    'payment.webhook', $4)
        `, [options.provider.name, row.id, {
          expectedAmount: expectedMinor,
          receivedAmount: event.amountMinor,
          expectedCurrency: row.currency,
          receivedCurrency: event.currency,
        }, options.requestId || null]);
        await client.query("COMMIT");
        return { received: true, requiresReview: true };
      }
      if (row.status === "paid") {
        await client.query(`
          UPDATE payment_events SET processing_status = 'processed', processed_at = now()
           WHERE id = $1
        `, [inserted.rows[0].id]);
        await client.query("COMMIT");
        return { received: true, duplicateEffect: true };
      }
      await client.query(`
        UPDATE payments
           SET status = 'paid', provider_payment_intent_id = COALESCE($2, provider_payment_intent_id),
               provider_transaction_id = COALESCE($2, provider_transaction_id),
               paid_at = now(), updated_at = now(), version = version + 1
         WHERE id = $1
      `, [row.id, event.paymentIntentId]);
      const group = await client.query(`
        SELECT status FROM inventory_reservation_groups WHERE group_key = $1 FOR UPDATE
      `, [row.reservation_group_key]);
      if (group.rows[0]?.status === "active") {
        await transitionOrderStateInTransaction({
          client,
          orderId: row.order_id,
          changes: { paymentStatus: "paid", orderStatus: "confirmed" },
          actor: { type: "provider", id: options.provider.name },
          source: "payment.webhook",
          requestId: options.requestId,
          metadata: { providerEventId: event.id },
        });
        await consumeInventoryReservationGroup({
          client,
          groupKey: row.reservation_group_key.trim(),
          operationKey: `payment-success:${options.provider.name}:${event.id}`,
          actor: { type: "provider", id: options.provider.name },
          source: "payment.webhook",
          requestId: options.requestId,
        });
        await client.query(`
          UPDATE coupon_redemptions
             SET status = 'consumed', consumed_at = now()
           WHERE order_id = $1 AND status = 'reserved'
        `, [row.order_id]);
        await client.query(`
          UPDATE orders SET payment_status = 'paid', status = 'processing'
           WHERE id = $1
        `, [row.order_id]);
      } else {
        if (row.order_status_v2 === "pending" && row.payment_status_v2 === "pending") {
          await transitionOrderStateInTransaction({
            client,
            orderId: row.order_id,
            changes: { paymentStatus: "paid", orderStatus: "requires_review" },
            actor: { type: "provider", id: options.provider.name },
            source: "payment.webhook.late",
            requestId: options.requestId,
            metadata: { providerEventId: event.id, reservationStatus: group.rows[0]?.status },
          });
        }
        await client.query(`
          INSERT INTO audit_logs (
            actor_type, actor_id, action, entity_type, entity_id,
            new_values, source, request_id
          ) VALUES ('provider', $1, 'payment.late_success', 'payment', $2, $3,
                    'payment.webhook', $4)
        `, [options.provider.name, row.id, {
          orderId: row.order_id,
          reservationStatus: group.rows[0]?.status || "missing",
        }, options.requestId || null]);
      }
      await enqueueNotification({
        client,
        eventKey: `payment_confirmed:${row.id}`,
        eventType: "payment_confirmed",
        aggregateType: "order",
        aggregateId: row.order_id,
        correlationId: options.requestId,
        payload: { orderId: row.order_id, paymentId: row.id },
      });
    } else {
      if (row.status !== "paid") {
        const paymentStatus = event.outcome === "cancelled" ? "cancelled" : "failed";
        await client.query(`
          UPDATE payments
             SET status = $2, failure_code = $3, failure_message = $4,
                 cancelled_at = CASE WHEN $2 = 'cancelled' THEN now() ELSE cancelled_at END,
                 updated_at = now(), version = version + 1
           WHERE id = $1
        `, [row.id, paymentStatus, event.failureCode, event.type]);
        await transitionOrderStateInTransaction({
          client,
          orderId: row.order_id,
          changes: event.outcome === "cancelled"
            ? { paymentStatus, orderStatus: "cancelled" }
            : { paymentStatus },
          actor: { type: "provider", id: options.provider.name },
          source: "payment.webhook",
          requestId: options.requestId,
          metadata: { providerEventId: event.id },
        });
        const group = await client.query(`
          SELECT status FROM inventory_reservation_groups WHERE group_key = $1 FOR UPDATE
        `, [row.reservation_group_key]);
        if (group.rows[0]?.status === "active") {
          await releaseInventoryReservationGroup({
            client,
            groupKey: row.reservation_group_key.trim(),
            operationKey: `payment-failure:${options.provider.name}:${event.id}`,
            reason: paymentStatus,
            actor: { type: "provider", id: options.provider.name },
            source: "payment.webhook",
            requestId: options.requestId,
          });
        }
        if (event.outcome === "cancelled") await client.query(`
          UPDATE coupon_redemptions
             SET status = 'released', released_at = now()
           WHERE order_id = $1 AND status = 'reserved'
        `, [row.order_id]);
        await client.query(`
          UPDATE orders SET payment_status = $2,
            status = CASE WHEN $2='cancelled' THEN 'cancelled' ELSE status END
          WHERE id = $1
        `, [row.order_id, paymentStatus]);
        await enqueueNotification({
          client,
          eventKey: `payment_failed:${row.id}:${paymentStatus}`,
          eventType: "payment_failed",
          aggregateType: "order",
          aggregateId: row.order_id,
          correlationId: options.requestId,
          payload: { orderId: row.order_id, paymentId: row.id, paymentStatus },
        });
      }
    }
    await client.query(`
      UPDATE payment_events
         SET processing_status = 'processed', processed_at = now()
       WHERE id = $1
    `, [inserted.rows[0].id]);
    await client.query(`
      INSERT INTO audit_logs (
        actor_type, actor_id, action, entity_type, entity_id,
        new_values, source, request_id
      ) VALUES ('provider', $1, 'payment.webhook_processed', 'payment', $2, $3,
                'payment.webhook', $4)
    `, [options.provider.name, row.id, {
      providerEventId: event.id,
      eventType: event.type,
      outcome: event.outcome,
    }, options.requestId || null]);
    await client.query("COMMIT");
    return { received: true, processed: true, outcome: event.outcome };
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

async function getOrderPaymentStatus(options) {
  const client = await options.pool.connect();
  try {
    const result = await client.query(`
      SELECT id, number, user_email, guest_access_token_hash, guest_access_expires_at,
             order_status_v2, payment_status_v2, shipping_status_v2,
             grand_total, currency
        FROM orders WHERE id = $1
    `, [options.orderId]);
    if (!result.rowCount) fail("ORDER_NOT_FOUND", "Order does not exist");
    const row = result.rows[0];
    const identityEmail = options.identity?.type === "user"
      ? String(options.identity.email || "").toLowerCase().trim()
      : String(options.userEmail || "").toLowerCase().trim() || null;
    let authorized = !!identityEmail && identityEmail === row.user_email;
    if (!authorized && options.guestAccessToken && row.guest_access_token_hash) {
      const supplied = Buffer.from(sha256(options.guestAccessToken), "hex");
      const expected = Buffer.from(row.guest_access_token_hash.trim(), "hex");
      authorized = supplied.length === expected.length
        && crypto.timingSafeEqual(supplied, expected)
        && (!row.guest_access_expires_at || new Date(row.guest_access_expires_at) > new Date());
    }
    if (!authorized) fail("ORDER_ACCESS_DENIED", "Order access is denied");
    return {
      orderId: row.id,
      orderNumber: row.number,
      orderStatus: row.order_status_v2,
      paymentStatus: row.payment_status_v2,
      shippingStatus: row.shipping_status_v2,
      grandTotal: row.grand_total,
      currency: row.currency,
      paymentConfirming: row.payment_status_v2 === "pending",
      retryAllowed: row.payment_status_v2 === "failed",
    };
  } finally {
    client.release();
  }
}

module.exports = {
  PaymentServiceError,
  createCardPaymentSession,
  getOrderPaymentStatus,
  processPaymentWebhook,
};
