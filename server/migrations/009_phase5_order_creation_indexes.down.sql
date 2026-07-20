-- migration: no-transaction

DROP INDEX CONCURRENTLY IF EXISTS orders_reservation_group_phase5_idx;
DROP INDEX CONCURRENTLY IF EXISTS orders_customer_email_phase5_idx;
DROP INDEX CONCURRENTLY IF EXISTS orders_checkout_idempotency_phase5_uidx;
