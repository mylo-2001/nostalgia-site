# Phase 11: Security hardening

## Controls

- Mandatory TOTP enrollment for admin access. Only MFA setup/status/enable and logout are
  available to a pre-enrollment session.
- `ADMIN_2FA_REQUIRED` defaults to `true`. It may be `false` only during local
  development; production must explicitly keep it `true`.
- `ALLOW_ADMIN_2FA_DISABLE=false` by default; the override is emergency-only.
- HttpOnly, Secure-in-production, SameSite=Strict admin cookies.
- Database-backed revocable sessions, expiry, logout-all and CSRF validation on V2 writes.
- RBAC, database rate limits and legacy login throttling.
- Login event history plus deduplicated high-severity repeated-failure and new-IP alerts.
- Password reset codes are hashed; passwords use Argon2id.

Migrations `020` and `021` add session metadata, login events, alerts, limits and indexes.
The first legacy administrator is synchronized into the scalable role tables after login.

Tests in `test/admin-session.unit.test.js` and `test/admin-session.integration.test.js`
cover MFA claims, revocation, atomic rate limiting, repeated failures and new-IP alerts.

Operational requirement: monitor open `admin_security_alerts`. Database records alone do
not page an operator until an external alert destination is configured.
