# AGENTS.md

## Cursor Cloud specific instructions

### What this is
Single Node/Express app (`server/server.js`) that serves the static storefront (root `*.html`, `js/`, `css/`, images), a JSON API under `/api/*`, and a hidden admin panel at `/admin`. Data is stored in PostgreSQL (`server/db.js`, `pg` driver). Stripe, Cloudinary, email (Resend/SMTP) and Cloudflare Turnstile are all optional and feature-gated — the app runs and degrades gracefully without them.

### Services
- App server: `npm run dev` (same as `npm start` → `node server/server.js`), listens on `http://localhost:8000`; admin at `/admin`.
- PostgreSQL: required — the server calls `db.init()` before `app.listen()` and `process.exit(1)`s if it cannot connect. There is NO in-memory/SQLite fallback (`server/store.js` is dead legacy code).

### PostgreSQL must be started manually each session
Docker is not used here; PostgreSQL 16 is installed as a system package but is NOT auto-started (no systemd in the container). Start it before running the app:
```
sudo pg_ctlcluster 16 main start
```
The DB `nostalgia`, user `postgres` / password `postgres` already exist in the persisted snapshot. If the `nostalgia` database is ever missing, the app auto-creates it on boot (via the `PG*` vars); you can also create it manually with `sudo -u postgres createdb nostalgia`.

### Environment
Local config lives in the git-ignored root `.env` (loaded via `process.loadEnvFile`). It is preconfigured with `PGHOST/PGPORT/PGUSER/PGPASSWORD/PGDATABASE`, `SITE_URL=http://localhost:8000`, `NODE_ENV=development`, and deterministic admin creds (`ADMIN_USERNAME=admin`, `ADMIN_PASSWORD=admin12345`). Template is `.env.example`. Do NOT set `DATABASE_URL` for local runs — it overrides the `PG*` vars.

### Schema / data
`db.init()` runs all `CREATE TABLE IF NOT EXISTS` and seeds defaults on every boot, so a fresh empty `nostalgia` DB is fine. The public catalog shown on the storefront comes from the static `server/catalog.js` file; `GET /api/products` only returns admin-created custom products (empty by default).

### Lint / test / build / run
- Test: `npm test` (Node built-in runner, `node --test test/`). Offline — does not need PostgreSQL or a running server.
- Lint: no linter configured in this repo.
- Build: none — static frontend is served directly; no bundler/build step.
- Run (dev): `npm run dev`.
