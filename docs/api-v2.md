# Commerce API V2

All JSON responses include `ok`; errors include a stable `error` code and request ID.
Monetary values are strings in order currency. Browser-supplied totals are rejected.

The catalog also reconciles append-only effective-price periods for regular,
manual-sale and promotion prices. It exposes `priorPrice`, the lowest price
applied during the 30 days before the current reduction began. Administrators
can inspect the evidence with `GET /api/admin/products/:id/price-history?days=90`.

## Public and customer

- `POST /api/v2/quote`: product/variant IDs, quantity, coupon, shipping method, payment
  method, destination and email. Returns the server price breakdown; it does not reserve.
- `POST /api/v2/checkout`: same identifiers plus customer and address snapshots. Requires
  `Idempotency-Key` (16-500 characters). Returns order ID/number, statuses, total,
  reservation expiry and a guest access token when not authenticated.
- `POST /api/v2/orders/:id/card-session`: requires a new `Idempotency-Key` and order
  ownership (`X-Order-Access-Token` for guests). Returns the provider checkout URL.
- `GET /api/v2/orders/:id/payment-status`: requires account ownership or guest token.
- `GET /api/v2/orders/:id/return-options`: requires ownership and returns only order-item
  quantities still eligible for a new return request.
- `POST /api/v2/orders/:id/returns`: requires ownership, guest token when applicable and
  `Idempotency-Key`.
- Worldline callback endpoint: pending the official integration documentation. It must
  verify the provider signature over the unmodified request and reject browser calls.

## Admin

`/api/v2/admin/*` requires a signed admin cookie, an active database session and verified
MFA. Writes require `X-CSRF-Token`. Permissions are checked independently per action.
Versioned order/shipment writes return HTTP 409 when the resource changed after it was read.

- `GET /api/v2/admin/returns`: lists return requests with items, latest payment and refunds;
  accepts an optional `status` filter.
- `GET /api/v2/admin/orders/:id/return-options` and `POST .../returns`: let an authorised
  operator open a request by order ID or order number using unclaimed order-item quantities.
- `POST /api/v2/admin/returns/:id/approve|reject|cancel|receive`: advances the return
  lifecycle. Reject and cancel require an audit reason.
- `POST /api/v2/admin/returns/:id/handoff`: records the courier and voucher/tracking number
  and moves an approved return to `in_transit`.
- `GET /api/v2/admin/returns/:id/tracking`: retrieves the current checkpoints from ACS for
  a recorded ACS return voucher. The official ACS June 2024 manual states that
  `With_Return_Voucher=1` is the simultaneous RDO/document-return service and not a
  post-delivery commercial return. It is therefore not used for customer product returns.
- `POST /api/v2/admin/returns/:id/inspect`: records each item's condition and restock
  decision. Damaged or defective items cannot be restored to stock.
- Refund creation remains disabled until the Worldline refund API and signed callback are
  implemented. A linked return must be fully inspected before a refund can be requested.

## Status codes

- `400`: validation/state error
- `401`: missing identity or order ownership
- `403`: RBAC, CSRF, MFA or return-origin denial
- `404`: resource not found
- `409`: idempotency conflict, stale version or insufficient stock
- `429`: database-backed rate limit
- `503`: payment/cron integration not configured

Do not expose guest tokens in logs, analytics, email query strings or referrer-bearing URLs.
