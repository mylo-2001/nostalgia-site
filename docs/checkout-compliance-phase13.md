# Phase 13: Checkout, accessibility and compliance review

## Delivered

- Feature-flagged V2 checkout; default is `CHECKOUT_V2_ENABLED=false`.
- Server quote displays authoritative subtotal, discount, shipping, COD fee, VAT and total.
- Browser checkout sends identifiers/options only and requires an idempotency key.
- Submit locks on first click and exposes an `aria-live` status.
- Hosted-payment returns read backend status through account ownership or a guest capability token; URL parameters never mark an order paid.
- Failed card payment retries the same order, reserves stock again and cannot create a
  second active payment session. The success URL never changes payment state.
- Required checkout controls have labels, keyboard focus is visible and the final action
  states the payment obligation in Greek and English.
- Expired cookie consent is denied; revocation disables tracking and reloads the page.
- Provider-neutral fiscal interface supports the four document types without encoding
  unapproved myDATA rules.

Migrations `024` and `025` add the controlled `failed -> pending` payment retry and fiscal
business-key index. Migration `024` stores the exact prior database trigger and restores it
verbatim on rollback.

Tests include `payment-retry.integration`, `checkout-accessibility.unit`,
`cookie-consent.unit`, `v2-router.unit`, `fiscal-provider.unit` and
`fiscal-document-service.integration`.

Gift packaging is free (no add-on fee) and is persisted on the V2 order `gift` JSONB
column. Keep the feature flag off until production shipping/tax/inventory rows are
configured and the Worldline adapter has passed its launch gate.
