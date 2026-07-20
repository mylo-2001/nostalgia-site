# Phase 3 Rollback Runbook

Phase 3 is not connected to a production HTTP route. If it is later connected, first
disable every pricing-service caller and return traffic to the prior deployment.

1. Confirm no migration, quote, checkout, or coupon reservation job is running.
2. Run `npm.cmd run migrate:status` and confirm 004 and 005 are applied.
3. Export `shipping_methods`, `tax_rates`, `pricing_policies`, and
   `coupon_redemptions`; rollback deletes these Phase 3 records.
4. Take and verify an encrypted database backup.
5. Enable remote, production, and destructive migration flags only for the controlled
   migration job.
6. Run `node server/migrate.js down --count=2 --confirm-down`.
7. Confirm 005 and 004 are pending while 001 through 003 remain applied.
8. Verify legacy product, coupon, order, admin, and storefront flows.
9. Remove all temporary migration flags.

Migration 005 removes only Phase 3 indexes. Migration 004 drops the new pricing
tables and the added product, variant, override, and coupon columns. Existing legacy
prices, sales, stock, coupons, and orders remain. Prefer a forward fix after Phase 4
or later migrations depend on the Phase 3 schema.

