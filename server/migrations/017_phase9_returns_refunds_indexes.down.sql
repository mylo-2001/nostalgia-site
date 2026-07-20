-- migration: no-transaction

DROP INDEX CONCURRENTLY IF EXISTS refund_events_refund_phase9_idx;
DROP INDEX CONCURRENTLY IF EXISTS refunds_idempotency_phase9_uidx;
DROP INDEX CONCURRENTLY IF EXISTS returns_idempotency_phase9_uidx;
