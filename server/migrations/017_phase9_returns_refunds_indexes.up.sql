-- migration: no-transaction

CREATE UNIQUE INDEX CONCURRENTLY IF NOT EXISTS returns_idempotency_phase9_uidx
  ON returns (idempotency_key_hash) WHERE idempotency_key_hash IS NOT NULL;
CREATE UNIQUE INDEX CONCURRENTLY IF NOT EXISTS refunds_idempotency_phase9_uidx
  ON refunds (idempotency_key_hash) WHERE idempotency_key_hash IS NOT NULL;
CREATE INDEX CONCURRENTLY IF NOT EXISTS refund_events_refund_phase9_idx
  ON refund_events (refund_id, received_at DESC) WHERE refund_id IS NOT NULL;
