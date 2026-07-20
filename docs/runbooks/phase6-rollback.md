# Phase 6 Rollback Runbook

1. Disable creation of new V2 card sessions.
2. Keep the verified webhook endpoint available until outstanding sessions settle.
3. Reconcile pending provider sessions and export payment/event records.
4. Disable the webhook only after the reconciliation window is approved.
5. Verify an encrypted backup.
6. Roll back migrations 011 and 010.
7. Confirm migrations 001 through 009 remain applied.

Never roll back while the provider can still deliver successful events. A missing
webhook consumer can produce charged customers whose orders remain unconfirmed.

