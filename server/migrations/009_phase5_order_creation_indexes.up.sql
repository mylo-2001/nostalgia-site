-- migration: no-transaction

CREATE UNIQUE INDEX CONCURRENTLY IF NOT EXISTS orders_checkout_idempotency_phase5_uidx
  ON orders (checkout_idempotency_id)
  WHERE checkout_idempotency_id IS NOT NULL;
CREATE INDEX CONCURRENTLY IF NOT EXISTS orders_customer_email_phase5_idx
  ON orders (customer_email_normalized, created_at DESC)
  WHERE customer_email_normalized IS NOT NULL;
CREATE INDEX CONCURRENTLY IF NOT EXISTS orders_reservation_group_phase5_idx
  ON orders (reservation_group_key)
  WHERE reservation_group_key IS NOT NULL;

