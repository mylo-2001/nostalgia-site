# Phase 1 Rollback Runbook

## Before V2 data exists

1. Stop any migration or backfill job.
2. Confirm both Phase 1 migrations are applied with `migrate:status`.
3. Confirm all new domain tables are empty and V2 order statuses are null.
4. Set `ALLOW_DESTRUCTIVE_MIGRATIONS=true` for the rollback job only.
5. Run `node server/migrate.js down --count=2 --confirm-down`.
6. Verify the legacy `orders` table, API, checkout, and admin remain available.
7. Remove the destructive migration flag.

The schema down migration refuses to run when it detects V2 data.

## After V2 data exists

Do not run the down migration. Roll back the application feature flag/code and
keep the additive schema. Diagnose and apply a forward fix. Preserve normalized
orders, audit history, payment events, idempotency records, and inventory ledgers.

Restore the database backup only for a catastrophic database failure and only
after recording the incident, recovery point, expected data loss, and approval.

## Proposed recovery objectives

- Proposed RPO: 15 minutes.
- Proposed RTO: 2 hours.

These values are proposals only and require an explicit business decision plus a
tested backup product that can meet them.
