# Phase 7: COD and risk assessment

## Delivered

- Explainable COD scoring in `server/domain/risk-engine.js`; no protected personal traits.
- Atomic COD order creation, inventory consumption and persisted `risk_assessments`.
- `low` risk confirms automatically, `medium` enters `requires_review`, and `high`
  returns `card_required` without creating an order.
- Manual approve/reject and COD collection after delivery only.
- Idempotent restock for returned COD shipments.

## API contract

`POST /api/v2/checkout` accepts identifiers, addresses and `paymentMethod: "cod"`.
Phone verification is server-owned and is never accepted from the browser. Admin review is
`POST /api/v2/admin/orders/:id/cod-review` and requires `risk.review`, MFA, CSRF and a
valid database session.

## Migration and rollback

Migrations `012` and `013` add rules, assessment detail and indexes. Roll back only after
disabling V2 checkout and confirming that no Phase 7 data is required. Use the versioned
migration runner; never edit production rows manually.

## Verification

- `test/risk-engine.unit.test.js`
- `test/cod-risk.integration.test.js`

Known limitation: phone/SMS verification is an integration boundary, not a configured
provider. Medium-risk orders therefore require manual review until one is selected.
