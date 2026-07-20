# Phase 1 Manual QA

- [ ] `npm test` passes.
- [ ] Integration tests run against a database whose name contains `test`.
- [ ] Two concurrent migration runners apply each migration once.
- [ ] `migrate:status` reports versions 1 and 2 as applied.
- [ ] Existing orders retain all legacy columns and values.
- [ ] New V2 status columns are nullable and contain no invented values.
- [ ] All required domain tables exist.
- [ ] New domain tables have RLS enabled and no public policies.
- [ ] `anon` and `authenticated` have no privileges on new tables.
- [ ] Invalid status values and negative amounts are rejected.
- [ ] `reserved_quantity > stock_on_hand` is rejected.
- [ ] Duplicate provider events, provider transactions, idempotency keys, and
      outbox event keys are rejected.
- [ ] Order item, inventory movement, status history, and audit updates are rejected.
- [ ] A clean down migration preserves the legacy `orders` table.
- [ ] A down migration is blocked after V2 data exists.
- [ ] Checkout, card payment, COD, admin, and storefront behaviour is unchanged.
- [ ] Migration output and logs contain no database password or payment secret.
