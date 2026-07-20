# Phase 12: Monitoring and backups

## Monitoring

Structured requests receive an `X-Request-Id`. Operational metrics cover checkout and
payment failures, webhook delay, expired reservations, stock invariants, notification
failures and refund failures. Open alerts are deduplicated. Job runs record success/failure.
Metadata sanitization removes passwords, secrets, tokens, authorization and card fields.

Health: `GET /api/health` verifies PostgreSQL. Maintenance:
`GET /api/cron/maintenance` with a bearer secret. Operations metrics are available to an
authenticated administrator.

## Backups

`npm run backup:database` streams `pg_dump` into AES-256-GCM encrypted storage and applies
local retention. `npm run restore:test -- <backup-file>` only accepts an isolated target
database whose name contains `restore_test`, restores it and records the drill result.

Proposed, not yet business-approved: RPO 24 hours and RTO 4 hours. Schedule an encrypted
daily backup outside the Vercel function runtime and a quarterly restore drill. Restrict
backup/key access to operations owners and store the encryption key separately.

Migrations `022` and `023`; tests `test/monitoring.unit.test.js` and
`test/monitoring.integration.test.js`.
