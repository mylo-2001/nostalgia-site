-- migration: no-transaction

CREATE UNIQUE INDEX CONCURRENTLY IF NOT EXISTS inventory_reservations_group_inventory_phase4_uidx
  ON inventory_reservations (reservation_group_key, inventory_id)
  WHERE reservation_group_key IS NOT NULL;
CREATE INDEX CONCURRENTLY IF NOT EXISTS inventory_reservations_order_status_phase4_idx
  ON inventory_reservations (order_id, status, created_at DESC);
CREATE INDEX CONCURRENTLY IF NOT EXISTS inventory_movements_event_inventory_phase4_idx
  ON inventory_movements (event_key, inventory_id);
CREATE INDEX CONCURRENTLY IF NOT EXISTS inventory_reservation_groups_expiry_phase4_idx
  ON inventory_reservation_groups (expires_at)
  WHERE status = 'active';
