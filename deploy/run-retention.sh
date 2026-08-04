#!/usr/bin/env bash
# Applies the GDPR data-retention rules — see server/services/retention-service.js.
#
# Safe to schedule before you have settled on the periods: the service is a dry
# run unless RETENTION_ENABLED=true, so until then this only reports what it
# would remove. The response is logged rather than discarded, so the log file
# doubles as the record of what was cleared and when.
#
# Reads CRON_TOKEN straight from the project .env so the secret never lives in
# the crontab or the process list.
set -euo pipefail

APP_DIR="${APP_DIR:-/var/www/nostalgia}"
BASE_URL="${MAINT_URL:-http://127.0.0.1:8000}"

TOKEN="$(grep -E '^CRON_TOKEN=' "$APP_DIR/.env" | head -1 | cut -d= -f2- | tr -d '"' | tr -d "'")"
if [ -z "${TOKEN:-}" ]; then
  echo "$(date -Is) run-retention: CRON_TOKEN not set in $APP_DIR/.env" >&2
  exit 1
fi

curl -fsS -m 120 -H "Authorization: Bearer ${TOKEN}" "${BASE_URL}/api/cron/retention"
echo
echo "$(date -Is) retention ok"
