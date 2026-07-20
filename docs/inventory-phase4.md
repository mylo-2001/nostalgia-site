# Inventory Reservations Phase 4

Phase 4 adds atomic stock reservations, consumption, release, expiry, restock,
append-only movements, and audit events. All balance changes lock the inventory row
and run in one PostgreSQL transaction. Generated `available_quantity` remains
`stock_on_hand - reserved_quantity`, and database constraints prevent negative stock.

Reservation and operation keys are SHA-256 hashed before persistence. Repeating the
same request returns the existing group. Reusing a key with different lines fails.
The expiry worker uses `FOR UPDATE SKIP LOCKED`, so multiple worker instances can run
without processing the same active group.

`bootstrapInventory()` is dry-run by default. Applying candidates requires the exact
confirmation string `APPLY_INVENTORY_BOOTSTRAP` and inserts missing rows only. It
does not overwrite existing inventory balances.

The pricing repository now prefers `inventory.available_quantity` when a matching
inventory row exists, and falls back to legacy stock during gradual migration.

Known limitations:

- Legacy checkout does not create reservations yet. Phase 5 connects order creation.
- Inventory rows must be reviewed and bootstrapped before V2 checkout activation.
- Reservation expiry needs a scheduled caller, configured in Phase 12.
- Unlimited products require an inventory row with `tracks_stock = false` once V2
  checkout is activated.

