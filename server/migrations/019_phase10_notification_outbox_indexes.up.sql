-- migration: no-transaction

CREATE INDEX CONCURRENTLY IF NOT EXISTS notification_outbox_worker_phase10_idx
  ON notification_outbox (status, COALESCE(next_retry_at, created_at), created_at)
  WHERE status IN ('pending', 'failed', 'processing');
CREATE INDEX CONCURRENTLY IF NOT EXISTS notification_outbox_correlation_phase10_idx
  ON notification_outbox (correlation_id) WHERE correlation_id IS NOT NULL;
