# Phase 2 Manual QA

- [ ] Unit tests cover every status axis and all terminal states.
- [ ] A paid pending order can become confirmed.
- [ ] A pending unpaid order cannot become confirmed.
- [ ] Shipping cannot start while an order is pending.
- [ ] COD cannot be collected before delivery.
- [ ] Atomic order completion plus delivery increments version once.
- [ ] One history row exists for every changed axis.
- [ ] One audit event exists for each atomic transition operation.
- [ ] Invalid transitions roll back without history or audit rows.
- [ ] A repeated same-state request is a no-op.
- [ ] A stale expected version returns a conflict and changes nothing.
- [ ] Direct SQL invalid transitions are blocked by migration 003.
- [ ] Logger failure after commit does not fail the transition response.
- [ ] Migration 003 rollback preserves all Phase 1 tables and data.
- [ ] Legacy checkout, Stripe, admin, and storefront behaviour is unchanged.
