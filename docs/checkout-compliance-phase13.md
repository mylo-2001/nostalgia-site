# Phase 13: Checkout, accessibility and compliance review

## Delivered

- Feature-flagged V2 checkout; default is `CHECKOUT_V2_ENABLED=false`.
- Server quote displays authoritative subtotal, discount, shipping, COD fee, VAT and total.
- Browser checkout sends identifiers/options only and requires an idempotency key.
- Submit locks on first click and exposes an `aria-live` status.
- Stripe success reads backend status through account ownership or a guest capability token.
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

Known limitation: paid gift packaging is not in the V2 pricing model. V2 deliberately
blocks gift checkout instead of trusting the browser fee. Keep the feature flag off until
gift add-ons and production shipping/tax/inventory rows are configured.
