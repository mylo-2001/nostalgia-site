# React admin

The admin is a React + TypeScript + Vite app in `admin/`. It talks to the existing
Express `/api/admin/*` endpoints — **no backend contract changes**. The legacy vanilla
admin has been replaced.

- Admin UI URL: set `ADMIN_UI_PATH` in `.env` (e.g. `/ni-ops-k7m2xq9p`).
- `/admin` always returns **404** (not guessable).
- `/admin-react` also 404s unless `ADMIN_UI_PATH=/admin-react`.
- The React **source** (`admin/src`, `admin/node_modules`, config) is blocked from the
  static server — only the built `admin/dist` bundle is exposed.
- Vite builds with `base: "./"` so you can change `ADMIN_UI_PATH` without rebuilding
  for asset paths (still run `npm run build:admin` when source changes).

## Status — migration complete ✅
Every section is a real React page (no stubs):
- **Overview** — stat tiles (clickable → section) + recent orders.
- **Orders** — tabs + counts, search, filters, 3-axis badges, expandable detail with
  courier/tracking/shipping-status, payment/order-status selects with confirmation,
  assignee, internal notes, history.
- **New product** — create form with full EL/EN content, colour filter, badges,
  features, specifications, care, shipping, package contents, scent notes and diffuser data.
- **Products & Stock** — grouped by category, inline edit of price / sale price /
  sale days / stock with save, full content editor, custom-product metadata and gallery,
  active toggle + delete, variant management and search.
- **Coupons** — create (percent/fixed/free-shipping, max uses, duration), list, toggle, delete.
- **Reviews** — list, approve / reject, delete.
- **Users** — paginated customer table (read-only).
- **Newsletter** — paginated subscriber table + delete.
- **Messages** — expandable contact messages, mark read/unread, mailto reply, delete.
- **Analytics** — GA4 status (Measurement ID from `.env`), consent/privacy notes, open-dashboard link.
- **System operations** — live checkout, payment, webhook, inventory, notification and refund metrics.
- **Audit log** — paginated security/action history with exact event-type filtering.
- **Settings** — system status, Stripe key, password change, MFA status/setup/disable and logout-all.

## Run everything with one command
From the repo root:
```bash
npm start            # builds the admin, then starts Express — ALL from one port
```
`npm start` (→ `scripts/start.js`) installs admin deps if missing, builds the React
admin to `admin/dist`, then boots the Express server. One process on `PORT` (default 8000)
serves all three surfaces:
- storefront (frontend) → `http://localhost:8000/`
- API (backend) → `http://localhost:8000/api`
- admin (React) → `http://localhost:8000` + your `ADMIN_UI_PATH`

Log in with your normal admin credentials (dev with Turnstile unset accepts the empty captcha).

## Develop the admin with hot reload
```bash
npm run dev:all      # server on :8000 + admin Vite dev server on :5174 (hot reload)
```
`dev:all` (→ `scripts/dev-all.js`) runs both processes with prefixed logs. Work on the
admin at `http://localhost:5174` (instant reload; `/api` is proxied to `:8000`). Ctrl+C stops both.

Other root scripts: `npm run server` (Express only, no admin build), `npm run build:admin`
(build the admin bundle only).

## Build (production)
```bash
npm run build:admin  # → admin/dist  (Express serves it at ADMIN_UI_PATH)
```
`npm start` already does this for you. The build must run whenever `admin/src` changes,
since Express serves the static `admin/dist`.

## Type safety
```bash
cd admin
npm run typecheck    # strict tsc over the whole admin app
```

## Notes / follow-ups
- The login form posts to `/api/admin/login`. Before production, wire a real Cloudflare
  Turnstile widget (the field is currently an empty token, accepted only when Turnstile is unset).
- Settings → 2FA shows the TOTP secret + otpauth URL as text; a scannable QR image could be
  added later (would need a QR lib or a small inline SVG generator).
- Shared types live in `admin/src/types`; static catalog data (categories, colour families)
  is mirrored in `admin/src/lib/catalog.ts` — keep it in sync with `server/catalog.js` and
  `js/products.js`.
- The current **Orders** screen still uses the legacy list/detail contract. Advanced V2
  COD review, returns, refunds and optimistic shipment controls need a V2 list endpoint
  plus related payment/shipment/return records before they can be exposed safely. See
  `docs/admin-react-coverage.md`.
