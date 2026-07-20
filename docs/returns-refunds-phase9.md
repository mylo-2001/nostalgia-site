# Phase 9: Returns and refunds

Returns and refunds are independent records. A return can contain part of an order and
each item stores quantity, reason, condition, inspection notes and a restock decision.
Stock returns only after receipt, inspection and a sellable decision; the unique inventory
movement prevents a second restock.

A refund remains `pending`/`processing` until a signature-verified provider webhook marks
it `confirmed`. Provider event IDs and refund IDs are unique, so duplicate or concurrent
webhooks do not duplicate money or state changes.

Customer endpoint:

- `POST /api/v2/orders/:id/returns` with account ownership or guest capability token.

Admin endpoints require MFA, CSRF and `return.manage`/`refund.manage`.

Migrations `016` and `017` are additive. Rollback is allowed only after exporting or
otherwise preserving return/refund records. Verification is in
`test/return-refund-service.integration.test.js` and includes partial return, one-time
restock, provider confirmation and duplicate webhook concurrency.
