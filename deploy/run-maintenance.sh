#!/usr/bin/env bash
# Fires the commerce maintenance job (releases expired inventory reservations and
# flushes the notification outbox). Run this every ~5 minutes from cron — this is
# the frequent scheduler that a Vercel Hobby daily cron could not provide.
#
# Reads CRON_TOKEN straight from the project .env so the secret never lives in
# the crontab or the process list.
set -euo pipefail

APP_DIR="${APP_DIR:-/var/www/nostalgia}"
BASE_URL="${MAINT_URL:-http://127.0.0.1:8000}"

TOKEN="$(grep -E '^CRON_TOKEN=' "$APP_DIR/.env" | head -1 | cut -d= -f2- | tr -d '"' | tr -d "'")"
if [ -z "${TOKEN:-}" ]; then
  echo "$(date -Is) run-maintenance: CRON_TOKEN not set in $APP_DIR/.env" >&2
  exit 1
fi

curl -fsS -m 60 -H "Authorization: Bearer ${TOKEN}" "${BASE_URL}/api/cron/maintenance" >/dev/null
echo "$(date -Is) maintenance ok"
