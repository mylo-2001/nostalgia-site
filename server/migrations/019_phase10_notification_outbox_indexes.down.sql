-- migration: no-transaction

DROP INDEX CONCURRENTLY IF EXISTS notification_outbox_correlation_phase10_idx;
DROP INDEX CONCURRENTLY IF EXISTS notification_outbox_worker_phase10_idx;
