# Database Migrations

## Safety rules

Migrations never run during application startup. They use checksums, a PostgreSQL
advisory lock, and a `schema_migrations` ledger. Applied migration files must never
be edited; add a new migration instead.

Remote writes require `ALLOW_REMOTE_MIGRATIONS=true`. Production additionally
requires `ALLOW_PRODUCTION_MIGRATIONS=true`. Down migrations also require
`ALLOW_DESTRUCTIVE_MIGRATIONS=true` and `--confirm-down`.

The CLI prints only host and database name. It never prints credentials.

## Commands

```powershell
npm.cmd run migrate:status
npm.cmd run migrate:up
npm.cmd run migrate:down
```

`migrate:down` rolls back one migration by default. A multi-migration rollback must
use the phase-specific runbook and an explicit `--count=N --confirm-down` after the
destructive migration flag is set.

## Integration database

```powershell
docker compose -f docker-compose.test.yml up -d
$env:TEST_DATABASE_URL='postgresql://postgres:postgres@localhost:55432/nostalgia_phase1_test'
npm.cmd run test:integration
docker compose -f docker-compose.test.yml down
```

When a local PostgreSQL service already uses the `PG*` values from `.env`, run:

```powershell
npm.cmd run test:integration:local
```

The tests create and drop random schemas only. They reject database names that do
not contain `test`.

## Production procedure

1. Commit and tag the exact application baseline.
2. Take and verify an encrypted database backup.
3. Run the applicable read-only preflight scripts under `server/migrations/preflight`.
4. Review status distributions, duplicates, database role privileges, and locks.
5. Run `migrate:status` and record its output.
6. Enable the remote/production migration flags for the migration job only.
7. Run `migrate:up` once from a controlled job, not from every application instance.
8. Re-run status and the manual QA checklist.
9. Remove the temporary migration flags.

No production backfill or feature switch is performed automatically by migrations.
Phase 3 shipping and VAT rows require separately approved business configuration.
