DROP TRIGGER IF EXISTS orders_v2_state_guard_update ON orders;
DROP TRIGGER IF EXISTS orders_v2_state_guard_insert ON orders;
DROP FUNCTION IF EXISTS nostalgia_validate_order_state_transition();
