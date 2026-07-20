# Phase 5 Manual QA

- [ ] Two simultaneous identical checkout requests create one order.
- [ ] The same key with different items returns an idempotency conflict.
- [ ] Browser totals are rejected.
- [ ] Pricing is recalculated inside the creation transaction.
- [ ] Order and item snapshots do not change with later catalog edits.
- [ ] Inventory is reserved once and coupon usage is reserved once.
- [ ] Guest plaintext token is absent from orders, logs, and idempotency responses.
- [ ] Registered orders bind to the trusted session email.
- [ ] Legacy admin fields and V2 fields represent the same totals and products.
- [ ] Transaction failure leaves no order, reservation, or idempotency residue.
- [ ] Phase 5 rollback preserves orders and earlier phase schema.

