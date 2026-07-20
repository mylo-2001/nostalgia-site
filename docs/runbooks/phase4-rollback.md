# Phase 4 Rollback Runbook

1. Disable V2 checkout and reservation-expiry workers.
2. Wait for active inventory transactions to finish.
3. Export reservation groups and inventory movement/balance snapshots.
4. Verify an encrypted backup.
5. Confirm migrations 006 and 007 are the latest applied migrations.
6. Run `node server/migrate.js down --count=2 --confirm-down` with the controlled
   destructive migration flags.
7. Confirm migrations 001 through 005 remain applied.
8. Reconcile legacy stock before accepting orders through the legacy checkout.

Rollback removes Phase 4 group records and metadata. It does not reverse stock
already consumed or restocked. Those balances must be reconciled from the exported
movement ledger before rollback approval.

