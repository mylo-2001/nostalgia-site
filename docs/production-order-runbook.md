# Production order rollout and rollback

## Release gate

1. Rotate any secret ever pasted into chat, screenshots or source history.
2. Take and verify an encrypted backup. Record the backup ID and restore-test result.
3. Run `npm test` and the dedicated PostgreSQL integration suite.
4. Run migration preflight SQL and `npm run migrate:status` with production changes blocked.
5. Apply additive migrations `001` through `025` in a maintenance window using the
   explicit remote/production migration flags. Do not run down migrations on live data.
6. Seed and verify real inventory, shipping methods, destination rules and accountant-
   approved tax rates. No sample shipping/tax rows are installed in production.
7. Configure Stripe and the V2 webhook `/api/v2/stripe/webhook`; subscribe to checkout
   completed, async payment failed/session expiry and refund events required by the adapter.
8. Configure email and a maintenance scheduler more frequent than the reservation TTL.
   Recommended cadence is every 5 minutes. Vercel Hobby daily cron is not sufficient for
   one-hour reservations; use an external scheduler or an appropriate Vercel plan.
9. Smoke-test guest/account card and COD orders with test products and low stock.
10. Set `CHECKOUT_V2_ENABLED=true`, deploy, monitor metrics and keep the legacy route during
    the observation window.

## Immediate rollback

1. Set `CHECKOUT_V2_ENABLED=false` and redeploy. This restores legacy checkout without
   deleting V2 orders.
2. Keep webhook and maintenance processing online for already-created V2 orders.
3. Roll back application code only to a version that can coexist with additive columns.
4. Database down migrations require a backup, maintenance approval and explicit destructive
   flags. Phase down migrations intentionally block when business data would be lost.
5. For payment incidents, stop new checkout first; never manually mark payment paid from a
   browser redirect. Reconcile provider events by transaction ID.

## Manual QA

- Guest card, guest COD and signed-in checkout on desktop/mobile.
- Duplicate click, refresh, provider return, delayed/duplicate webhook and failed-card retry.
- Last-item concurrency and reservation expiry.
- Medium/high COD review, shipment progression and COD collection after delivery.
- Partial/full refund, partial return, inspection and one-time restock.
- Two admins editing one order, MFA enrollment, logout-all and denied-role checks.
- Keyboard-only checkout, visible focus, announced errors and cookie consent withdrawal.

## Ownership decisions still required

- Accountant/legal approval of VAT, retention, invoice/receipt and myDATA behavior.
- Choice and credentials for fiscal, courier, SMS/phone verification and alert providers.
- Approved RPO/RTO and backup storage/retention.
