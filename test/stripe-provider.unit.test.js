"use strict";

const assert = require("node:assert/strict");
const test = require("node:test");

const { StripePaymentProvider } = require("../server/payments/stripe-provider");

function fakeStripe() {
  const calls = [];
  return {
    calls,
    checkout: {
      sessions: {
        async create(payload, options) {
          calls.push({ payload, options });
          return { id: "cs_test", url: "https://checkout.example/session", expires_at: 2000000000 };
        },
      },
    },
    webhooks: {
      constructEvent(body, signature, secret) {
        return { body, signature, secret };
      },
    },
  };
}

test("Stripe adapter sends exact minor amounts and provider idempotency", async () => {
  const stripe = fakeStripe();
  const provider = new StripePaymentProvider(stripe);
  await provider.createCheckoutSession({
    orderId: "order-1",
    paymentId: "payment-1",
    customerEmail: "customer@example.com",
    currency: "EUR",
    items: [{
      productId: "p-1",
      variantId: null,
      productName: "Candle",
      sku: "SKU-1",
      quantity: 2,
      lineTotalMinor: 1999,
    }],
    shippingMinor: 350,
    codFeeMinor: 0,
    successUrl: "https://shop.example/success",
    cancelUrl: "https://shop.example/cancel",
    expiresAtUnix: 2000000000,
    providerIdempotencyKey: "provider-key",
  });
  assert.equal(stripe.calls[0].payload.line_items[0].price_data.unit_amount, 1999);
  assert.equal(stripe.calls[0].payload.line_items[1].price_data.unit_amount, 350);
  assert.equal(stripe.calls[0].options.idempotencyKey, "provider-key");
});

test("Stripe adapter normalizes only required webhook fields", () => {
  const provider = new StripePaymentProvider(fakeStripe());
  const event = provider.normalizeWebhookEvent({
    id: "evt_1",
    type: "checkout.session.completed",
    livemode: true,
    data: { object: {
      id: "cs_1",
      object: "checkout.session",
      payment_status: "paid",
      payment_intent: "pi_1",
      amount_total: 1350,
      currency: "eur",
      metadata: { order_id: "order-1", payment_id: "payment-1" },
      card: { number: "must-not-survive" },
    } },
  });
  assert.equal(event.outcome, "paid");
  assert.equal(event.amountMinor, 1350);
  assert.equal(event.currency, "EUR");
  assert.equal(Object.prototype.hasOwnProperty.call(event, "card"), false);
});

