# Phase 2 Rollback Runbook

1. Disable every caller of the V2 transition service.
2. Confirm no migration or backfill job is running.
3. Run the migration status command and confirm migration 003 is applied.
4. Enable the destructive migration flag for the controlled rollback job only.
5. Run `node server/migrate.js down --confirm-down`.
6. Verify migration 003 is pending and Phase 1 tables/data remain intact.
7. Remove the destructive migration flag.

Migration 003 rollback removes only transition triggers and their function. It does
not delete orders, history, audit logs, or any Phase 1 schema. If V2 runtime callers
are already active, prefer a forward fix because removing the database guard permits
invalid direct updates.
