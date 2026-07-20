# Phase 6 Payment Contract

- `createCardPaymentSession()` returns hosted checkout URL, payment ID and expiry.
- `processPaymentWebhook()` requires raw body, provider signature and webhook secret.
- `getOrderPaymentStatus()` returns independent statuses and retry eligibility after
  account or guest capability authorization.

The success URL carries no payment truth. Only a verified provider event can mark a
payment paid.

