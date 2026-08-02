#!/usr/bin/env bash
# Nightly encrypted database backup.
#
# scripts/backup-database.js pg_dumps the database, encrypts it with
# BACKUP_ENCRYPTION_KEY (AES-256) and prunes anything older than
# BACKUP_RETENTION_DAYS. It reads those from process.env and does NOT parse
# .env itself, so this wrapper exports them first — cron gives us almost no
# environment of its own.
set -euo pipefail

APP_DIR="${APP_DIR:-/var/www/nostalgia}"
cd "$APP_DIR"

if [ ! -f "$APP_DIR/.env" ]; then
  echo "$(date -Is) run-backup: $APP_DIR/.env not found" >&2
  exit 1
fi

# Export only the keys the backup needs. `set -a` marks assignments for export;
# the grep keeps us from sourcing unrelated (or malformed) lines.
set -a
# shellcheck disable=SC1090
. <(grep -E '^(DATABASE_URL|BACKUP_ENCRYPTION_KEY|BACKUP_DIR|BACKUP_RETENTION_DAYS)=' "$APP_DIR/.env")
set +a

if [ -z "${DATABASE_URL:-}" ]; then
  echo "$(date -Is) run-backup: DATABASE_URL not set in $APP_DIR/.env" >&2
  exit 1
fi

# pg_dump must be on PATH (install postgresql-client on the VPS).
if ! command -v pg_dump >/dev/null 2>&1; then
  echo "$(date -Is) run-backup: pg_dump not found — install postgresql-client" >&2
  exit 1
fi

node scripts/backup-database.js
echo "$(date -Is) backup ok"
