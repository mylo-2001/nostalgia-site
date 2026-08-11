# VPS deployment (moving off Vercel)

The app is a single long-lived Node/Express process — no serverless split. On a VPS
this runs better than Vercel because the maintenance job (reservation TTL release +
notification outbox) can run every ~5 minutes instead of once a day.

Artifacts in `deploy/`:
- `nostalgia.service` — systemd unit (auto start/restart)
- `nginx-nostalgia.conf` — reverse proxy + TLS + raw-body-safe webhook path
- `run-maintenance.sh` + `nostalgia.crontab` — the frequent maintenance scheduler

## 0. Prerequisites
- **Node 20 or 22 LTS** (needs ≥ 20.6 for the built-in `.env` loader). `node -v`.
- **nginx** + **certbot** (Let's Encrypt).
- A **PostgreSQL** database. You can keep Supabase (`DATABASE_URL`, session pooler on
  port 5432) or self-host Postgres on the VPS.
- Domain DNS A/AAAA records pointing at the VPS.

## 1. Get the code + install
```bash
sudo useradd --system --home /var/www/nostalgia --shell /usr/sbin/nologin nostalgia
sudo mkdir -p /var/www/nostalgia && sudo chown nostalgia:nostalgia /var/www/nostalgia
# copy the repo to /var/www/nostalgia (git clone or rsync), then:
cd /var/www/nostalgia
npm ci --omit=dev
sudo chmod +x deploy/run-maintenance.sh
```

## 2. Environment (.env at project root)
The app auto-loads `/var/www/nostalgia/.env`. Required / important keys:

| Key | Why |
|-----|-----|
| `NODE_ENV=production` | turns on trust-proxy, **Secure** cookies, and the production migration guard |
| `PORT=8000` | must match nginx `proxy_pass` (default 8000) |
| `DATABASE_URL` | Postgres connection (Supabase session pooler or self-hosted) |
| `SITE_URL=https://your-domain` | absolute links in emails + guest tracking link |
| `CRON_TOKEN` | Bearer secret for `/api/cron/maintenance` (used by `run-maintenance.sh`) |
| Worldline credentials (names pending official docs) | add only after the Worldline adapter and callback verification are implemented |
| `RESEND_API_KEY`+`EMAIL_FROM` **or** `SMTP_*` | order/notification emails |
| `CHECKOUT_V2_ENABLED` | keep `false` until the go-live gate is done |

> Rotate any secret ever pasted into chat/screenshots before go-live.

## 3. Run the service
```bash
sudo cp deploy/nostalgia.service /etc/systemd/system/nostalgia.service
sudo systemctl daemon-reload
sudo systemctl enable --now nostalgia
journalctl -u nostalgia -f      # confirm "Server is running"
curl -fsS http://127.0.0.1:8000/api/health
```

## 4. nginx + TLS
```bash
sudo cp deploy/nginx-nostalgia.conf /etc/nginx/sites-available/nostalgia
# edit server_name to your domain
sudo ln -s /etc/nginx/sites-available/nostalgia /etc/nginx/sites-enabled/
sudo certbot --nginx -d your-domain
sudo nginx -t && sudo systemctl reload nginx
```
Preserve the raw request body on the future Worldline callback path once the official
integration documentation defines its signature-verification requirements.

## 5. Maintenance scheduler (the Vercel-killer step)
```bash
sudo crontab -u nostalgia deploy/nostalgia.crontab   # runs run-maintenance.sh every 5 min
```

## 6. Database migrations (V2 schema)
Additive, reversible. On a remote/production DB the guards require explicit flags:
```bash
npm run migrate:status
ALLOW_REMOTE_MIGRATIONS=true ALLOW_PRODUCTION_MIGRATIONS=true npm run migrate:up
```
(Already applied on the current shared DB — status shows 25/25.)

## 7. Worldline payments
Keep card checkout disabled. Implement the hosted-payment adapter, signed callback,
refund and reconciliation flow from the official Worldline documentation before adding
credentials or enabling checkout. Legacy Stripe routes are disabled and are not a
production integration path.

## 8. Seed real data, then enable V2
1. Replace the **sample** VAT/shipping/prices (`npm run seed:test:clear` to remove them)
   with real, accountant-approved `shipping_methods`, `tax_rates`, and prices/stock for
   **all** products.
2. Smoke test guest and signed-in card checkout, including cancellation, delayed callback,
   duplicate callback, failed payment and refund behavior.
3. Set `PAYMENT_PROVIDER=worldline` and `CHECKOUT_V2_ENABLED=true` only after the adapter's
   launch gate passes; restart and monitor.

## Update / redeploy
```bash
cd /var/www/nostalgia && git pull   # or rsync
npm ci --omit=dev
npm run migrate:status              # apply new migrations if any (with the flags)
sudo systemctl restart nostalgia
```

## Rollback
- App: `git checkout <previous-tag>` → `npm ci --omit=dev` → `systemctl restart nostalgia`.
- Feature: `CHECKOUT_V2_ENABLED=false` + restart → instantly back to legacy checkout,
  without deleting V2 orders.
- DB: down migrations are guarded (`--confirm-down` + `ALLOW_DESTRUCTIVE_MIGRATIONS=true`)
  and block when business data would be lost — take a backup first.

## Removing Vercel (at production cutover)
Once traffic is on the VPS: delete `vercel.json` and the `api/` folder (both are Vercel
serverless wrappers — unused by the VPS process), and remove the project from Vercel.
```
git rm -r api vercel.json && git commit -m "Remove Vercel wrappers; VPS is production host"
```
