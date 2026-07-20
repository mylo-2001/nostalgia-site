# Phase 5 Rollback Runbook

1. Disable the V2 checkout caller before rollback.
2. Allow in-flight checkout transactions to finish.
3. Export orders created through V2 and reconcile their active reservations.
4. Verify an encrypted backup.
5. Roll back migrations 009 and 008 with the controlled migration flags.
6. Confirm migrations 001 through 007 remain applied.
7. Verify legacy checkout and admin order rendering.

Rollback removes Phase 5 linkage columns, not order or item rows. Existing V2 order
data must be retained and reconciled; do not blindly return traffic to a stock model
that does not understand its reservations.

