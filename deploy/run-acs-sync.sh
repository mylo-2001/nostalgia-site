#!/usr/bin/env bash
# Syncs ACS tracking status for every active shipment onto our own orders
# (shipping_status) — the automatic counterpart to the admin's manual
# "Ανανέωση tracking ACS" button. No-ops quietly if ACS isn't configured yet.
#
# Reads CRON_TOKEN straight from the project .env so the secret never lives in
# the crontab or the process list.
set -euo pipefail

APP_DIR="${APP_DIR:-/var/www/nostalgia}"
BASE_URL="${MAINT_URL:-http://127.0.0.1:8000}"

TOKEN="$(grep -E '^CRON_TOKEN=' "$APP_DIR/.env" | head -1 | cut -d= -f2- | tr -d '"' | tr -d "'")"
if [ -z "${TOKEN:-}" ]; then
  echo "$(date -Is) run-acs-sync: CRON_TOKEN not set in $APP_DIR/.env" >&2
  exit 1
fi

curl -fsS -m 60 -H "Authorization: Bearer ${TOKEN}" "${BASE_URL}/api/cron/acs-tracking-sync" >/dev/null
echo "$(date -Is) acs-sync ok"
