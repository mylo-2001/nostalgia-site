DROP TABLE refund_events;

ALTER TABLE orders DROP COLUMN refunded_total;
ALTER TABLE payments DROP COLUMN refunded_amount;

ALTER TABLE refunds
  DROP CONSTRAINT refunds_request_hash_phase9_check,
  DROP CONSTRAINT refunds_idempotency_hash_phase9_check,
  DROP COLUMN request_id,
  DROP COLUMN requested_by_id,
  DROP COLUMN requested_by_type,
  DROP COLUMN request_hash,
  DROP COLUMN idempotency_key_hash;

ALTER TABLE returns
  DROP CONSTRAINT returns_request_hash_phase9_check,
  DROP CONSTRAINT returns_idempotency_hash_phase9_check,
  DROP COLUMN restock_completed_at,
  DROP COLUMN request_id,
  DROP COLUMN request_hash,
  DROP COLUMN idempotency_key_hash;
