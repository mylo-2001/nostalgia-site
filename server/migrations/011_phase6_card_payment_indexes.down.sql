-- migration: no-transaction

DROP INDEX CONCURRENTLY IF EXISTS orders_last_payment_phase6_idx;
DROP INDEX CONCURRENTLY IF EXISTS payment_events_request_phase6_idx;
DROP INDEX CONCURRENTLY IF EXISTS payments_provider_intent_phase6_uidx;
DROP INDEX CONCURRENTLY IF EXISTS payments_provider_idempotency_phase6_uidx;

