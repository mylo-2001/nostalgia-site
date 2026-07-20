# Tests

Zero-dependency tests using Node's built-in runner (`node:test` + `node:assert`).
No install needed — requires Node 18+ (this project runs on Node 24).

## Run

```bash
npm test
```

or directly:

```bash
node --test test/
```

## What is covered

| File | Catches |
|------|---------|
| `syntax.test.js` | Any syntax error in every file under `js/` and `server/` (`node --check`). The broad safety net. |
| `catalog.test.js` | `server/catalog.js` integrity: category counts, cat9 = 8 colour products, unique ids, **every product image file actually exists on disk**, colour labels in titles. |
| `products.test.js` | `js/products.js` logic: built-in colour variants (6 + 2 groups), admin-declared `variantGroup` linking, sale helpers, custom multi-image products. |
| `images.test.js` | `js/images.js`: `webp()` path building and `hasDerivatives()` (uploads/CDN must NOT get a broken `.webp`). |
| `order-domain.unit.test.js` | Status state machines, legacy mappings and migration discovery. |
| `order-domain.integration.test.js` | PostgreSQL constraints, RLS, migration locking and rollback. |
| `order-state-machine.unit.test.js` | Cross-axis invariants and atomic transition planning. |
| `order-state-service.integration.test.js` | Transactional state updates, history, audit, locking and DB transition guards. |
| `pricing-engine.unit.test.js` | Exact cents, half-up rounding, VAT, sales, coupons, shipping, COD and pricing invariants. |
| `pricing-service.unit.test.js` | Identifier-only request validation and rejection of browser monetary fields. |
| `pricing-service.integration.test.js` | Hybrid catalog pricing from PostgreSQL, shared row locks, rule failures and Phase 3 rollback. |
| `inventory-service.unit.test.js` | Inventory key and line validation before database access. |
| `inventory-service.integration.test.js` | Last-item concurrency, consume/release idempotency, expiry races and rollback. |
| `order-creation-service.unit.test.js` | Checkout normalization, forbidden totals and guest token derivation. |
| `order-creation-service.integration.test.js` | Concurrent duplicate checkout, transaction snapshots, reservations and rollback. |
| `stripe-provider.unit.test.js` | Exact provider minor units, metadata and sanitized webhook normalization. |
| `payment-service.integration.test.js` | Verified payment success/failure, duplicate webhooks, stock and status atomicity. |
| `cod-risk.integration.test.js` | COD low/medium/high decisions, review and stock lifecycle. |
| `admin-order-service.integration.test.js` | RBAC, audit and concurrent optimistic-lock conflicts. |
| `return-refund-service.integration.test.js` | Partial returns, inspection, one-time restock and verified refunds. |
| `notification-outbox.integration.test.js` | Concurrent workers, retry and duplicate-email prevention. |
| `admin-session.integration.test.js` | MFA sessions, logout-all, rate limits and login alerts. |
| `product-variants.unit.test.js` | Admin variant validation, unique identity fields and independent commercial data. |
| `product-content.unit.test.js` | Complete bilingual product details, list/spec normalization and diffuser/scent shapes. |
| `monitoring.integration.test.js` | Metrics, deduplicated alerts and tracked jobs. |
| `payment-retry.integration.test.js` | Same-order card retry, stock safety and exact trigger rollback. |
| `fiscal-document-service.integration.test.js` | Provider-neutral, idempotent fiscal issuance boundary. |
| `checkout-accessibility.unit.test.js` | Labels, focus, live status, payment wording and identifier-only payload. |
| `cookie-consent.unit.test.js` | Consent expiry and independent optional categories. |

## Notes

- Frontend scripts (`js/*.js`) are browser IIFEs; `helpers/browser-env.js` loads
  them in an isolated VM with a minimal `window`/`document` stub so their
  `window.Nostalgia*` API can be asserted in Node.
- Unit and browser tests are offline. Integration tests are skipped unless
  `TEST_DATABASE_URL` points to a dedicated database whose name contains `test`.
  See `docs/migrations.md`.
- Integration tests exercise migrations and isolated service modules, not legacy
  HTTP checkout routes or the production database.
