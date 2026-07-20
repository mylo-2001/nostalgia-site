DROP TRIGGER inventory_reservations_phase4_state_guard ON inventory_reservations;
DROP FUNCTION nostalgia_validate_inventory_reservation_transition();

ALTER TABLE inventory_movements
  DROP CONSTRAINT inventory_movements_balances_phase4_check,
  DROP COLUMN metadata,
  DROP COLUMN reserved_quantity_after,
  DROP COLUMN stock_on_hand_after;

ALTER TABLE inventory_reservations
  DROP CONSTRAINT inventory_reservations_group_key_phase4_check,
  DROP COLUMN updated_at,
  DROP COLUMN metadata,
  DROP COLUMN version,
  DROP COLUMN reservation_group_key;

DROP TABLE inventory_reservation_groups;

ALTER TABLE pricing_policies
  DROP COLUMN reservation_expiry_batch_size,
  DROP COLUMN reservation_ttl_seconds;
