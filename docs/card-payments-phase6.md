# Card Payments and Webhooks Phase 6

Phase 6 adds provider-adapter card sessions, exact minor-unit line amounts, verified
webhook processing, duplicate-event protection, amount/currency validation, payment
attempts, and authenticated order payment status.

The Stripe adapter uses hosted Checkout and attaches only order/payment identifiers
to provider metadata. Webhook storage contains a sanitized projection and a raw-body
SHA-256 hash, never card numbers, CVV, signatures, or credentials.

Payment success atomically marks payment/order state, consumes inventory, consumes
coupon reservation, writes history/audit, and marks the provider event processed.
Failure or expiry atomically cancels the order and releases stock/coupon reservation.
A success after reservation expiry becomes `requires_review` when the state permits;
stock is never deducted without an active reservation.

The success page must call `getOrderPaymentStatus()`. Query parameters never update
payment state. Guest access requires the capability token; account orders require the
trusted session email.

Known limitations:

- Notification delivery is deferred to the Phase 10 outbox.
- Public route wiring and rate limits are completed in Phase 11.
- Refund provider calls belong to Phase 9.

