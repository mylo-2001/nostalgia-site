"use strict";

class StripePaymentProvider {
  constructor(stripe) {
    if (!stripe || !stripe.checkout?.sessions || !stripe.webhooks) {
      throw new TypeError("StripePaymentProvider requires an initialized Stripe client");
    }
    this.stripe = stripe;
    this.name = "stripe";
  }

  async createCheckoutSession(input) {
    const lineItems = input.items.map((item) => ({
      quantity: 1,
      price_data: {
        currency: input.currency.toLowerCase(),
        unit_amount: item.lineTotalMinor,
        product_data: {
          name: item.quantity > 1
            ? `${item.productName} x ${item.quantity}`
            : item.productName,
          metadata: {
            product_id: item.productId,
            variant_id: item.variantId || "",
            sku: item.sku,
          },
        },
      },
    }));
    if (input.shippingMinor > 0) {
      lineItems.push({
        quantity: 1,
        price_data: {
          currency: input.currency.toLowerCase(),
          unit_amount: input.shippingMinor,
          product_data: { name: "Shipping" },
        },
      });
    }
    if (input.codFeeMinor > 0) {
      throw new Error("Card checkout cannot include a COD fee");
    }
    const session = await this.stripe.checkout.sessions.create({
      mode: "payment",
      client_reference_id: input.orderId,
      customer_email: input.customerEmail,
      line_items: lineItems,
      success_url: input.successUrl,
      cancel_url: input.cancelUrl,
      expires_at: input.expiresAtUnix,
      metadata: {
        order_id: input.orderId,
        payment_id: input.paymentId,
      },
      payment_intent_data: {
        metadata: {
          order_id: input.orderId,
          payment_id: input.paymentId,
        },
      },
    }, { idempotencyKey: input.providerIdempotencyKey });
    return {
      id: session.id,
      url: session.url,
      paymentIntentId: typeof session.payment_intent === "string"
        ? session.payment_intent
        : session.payment_intent?.id || null,
      expiresAt: session.expires_at ? new Date(session.expires_at * 1000) : null,
    };
  }

  verifyWebhook(rawBody, signature, secret) {
    return this.stripe.webhooks.constructEvent(rawBody, signature, secret);
  }

  normalizeWebhookEvent(event) {
    const object = event?.data?.object || {};
    const metadata = object.metadata || {};
    const type = String(event?.type || "");
    let outcome = "ignored";
    if (type === "checkout.session.completed" && object.payment_status === "paid") {
      outcome = "paid";
    } else if (type === "checkout.session.async_payment_succeeded") {
      outcome = "paid";
    } else if (type === "checkout.session.expired") {
      outcome = "cancelled";
    } else if (type === "checkout.session.async_payment_failed"
      || type === "payment_intent.payment_failed") {
      outcome = "failed";
    }
    return {
      id: String(event.id || ""),
      type,
      created: event.created || null,
      livemode: !!event.livemode,
      outcome,
      objectId: String(object.id || ""),
      objectType: String(object.object || ""),
      orderId: metadata.order_id || null,
      paymentId: metadata.payment_id || null,
      sessionId: object.object === "checkout.session" ? object.id : null,
      paymentIntentId: typeof object.payment_intent === "string"
        ? object.payment_intent
        : object.object === "payment_intent" ? object.id : null,
      amountMinor: object.amount_total ?? object.amount_received ?? object.amount ?? null,
      currency: object.currency ? String(object.currency).toUpperCase() : null,
      paymentStatus: object.payment_status || object.status || null,
      failureCode: object.last_payment_error?.code || null,
    };
  }

  async createRefund(input) {
    const refund = await this.stripe.refunds.create({
      payment_intent: input.providerTransactionId,
      amount: input.amountMinor,
      metadata: { refund_id: input.refundId, order_id: input.orderId },
    }, { idempotencyKey: input.providerIdempotencyKey });
    return { id: refund.id, status: refund.status || "pending" };
  }

  normalizeRefundEvent(event) {
    const object = event?.data?.object || {};
    const type = String(event?.type || "");
    let outcome = "ignored";
    if ((type === "refund.created" || type === "refund.updated") &&
        object.status === "succeeded") outcome = "confirmed";
    if (type === "refund.failed" || object.status === "failed") outcome = "failed";
    return {
      id: String(event?.id || ""), type, outcome,
      refundId: object.metadata?.refund_id || null,
      orderId: object.metadata?.order_id || null,
      providerRefundId: object.id || null,
      amountMinor: object.amount ?? null,
      currency: object.currency ? String(object.currency).toUpperCase() : null,
      failureCode: object.failure_reason || null,
    };
  }
}

module.exports = { StripePaymentProvider };
