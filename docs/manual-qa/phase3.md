# Phase 3 Manual QA

- [ ] Migration status shows 004 and 005 pending before the controlled deployment.
- [ ] Phase 3 preflight reports no negative prices, stock, or invalid coupon values.
- [ ] An approved shipping method exists for every enabled destination country.
- [ ] An approved active VAT rule exists for every enabled country and tax category.
- [ ] Static, custom, inherited-price variant, and own-price variant quotes are checked.
- [ ] Active and expired sale prices produce the expected unit price.
- [ ] Percent and fixed coupons allocate exact cents across multiple lines.
- [ ] Coupon start/end, minimum, maximum discount, allow-list, and usage limits work.
- [ ] Free shipping threshold is evaluated after product discounts.
- [ ] COD fee appears only for COD and COD-disabled shipping methods reject it.
- [ ] Unsupported destination countries fail closed.
- [ ] Missing VAT or shipping configuration fails closed.
- [ ] Finite stock rejects quantities above the current visible stock.
- [ ] Duplicate product lines are merged before quantity checks.
- [ ] Browser monetary fields are rejected.
- [ ] Structured logs contain no customer identifiers or secrets.
- [ ] `lockRows: true` is exercised inside a database transaction.
- [ ] Unit and integration suites pass against a dedicated PostgreSQL test database.
- [ ] Rolling back 005 then 004 removes only Phase 3 schema after an approved export.
- [ ] Legacy storefront and `/api/orders` behavior remain unchanged in this phase.

