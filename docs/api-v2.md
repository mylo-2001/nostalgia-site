# Commerce API V2

All JSON responses include `ok`; errors include a stable `error` code and request ID.
Monetary values are strings in order currency. Browser-supplied totals are rejected.

## Public and customer

- `POST /api/v2/quote`: product/variant IDs, quantity, coupon, shipping method, payment
  method, destination and email. Returns the server price breakdown; it does not reserve.
- `POST /api/v2/checkout`: same identifiers plus customer and address snapshots. Requires
  `Idempotency-Key` (16-500 characters). Returns order ID/number, statuses, total,
  reservation expiry and a guest access token when not authenticated.
- `POST /api/v2/orders/:id/card-session`: requires a new `Idempotency-Key` and order
  ownership (`X-Order-Access-Token` for guests). Returns the provider checkout URL.
- `GET /api/v2/orders/:id/payment-status`: requires account ownership or guest token.
- `POST /api/v2/orders/:id/returns`: requires ownership, guest token when applicable and
  `Idempotency-Key`.
- `POST /api/v2/stripe/webhook`: raw Stripe body and signature. Browser calls are invalid.

## Admin

`/api/v2/admin/*` requires a signed admin cookie, an active database session and verified
MFA. Writes require `X-CSRF-Token`. Permissions are checked independently per action.
Versioned order/shipment writes return HTTP 409 when the resource changed after it was read.

## Status codes

- `400`: validation/state error
- `401`: missing identity or order ownership
- `403`: RBAC, CSRF, MFA or return-origin denial
- `404`: resource not found
- `409`: idempotency conflict, stale version or insufficient stock
- `429`: database-backed rate limit
- `503`: payment/cron integration not configured

Do not expose guest tokens in logs, analytics, email query strings or referrer-bearing URLs.
