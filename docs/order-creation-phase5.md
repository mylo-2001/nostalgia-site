# Idempotent Order Creation Phase 5

Phase 5 creates the order, immutable item snapshots, shipment shell, coupon
reservation, audit/history records, and inventory reservation in one PostgreSQL
transaction. Pricing is recalculated inside that same transaction with database
locks. Browser totals are rejected.

Checkout requires a high-entropy idempotency key. Only its SHA-256 hash is stored.
Concurrent identical requests return the same order. Reuse with different canonical
request data fails. A guest capability token is derived with HMAC, only its hash is
stored, and repeated checkout can reproduce the same token without persisting it.

The service writes legacy `customer`, `items`, status, payment, and total fields in
parallel with V2 snapshots so the current admin remains readable during migration.

Card orders start as `pending/pending/not_ready`. COD activation is intentionally
blocked until the Phase 7 risk decision is connected.

Known limitations:

- No public HTTP route calls V2 order creation yet.
- Card provider sessions and webhook confirmation are Phase 6.
- The reservation expiry scheduler is connected in Phase 12.

