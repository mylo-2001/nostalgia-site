ALTER TABLE orders
  DROP COLUMN payment_expires_at,
  DROP COLUMN last_payment_id;

ALTER TABLE payment_events
  DROP COLUMN request_id,
  DROP COLUMN processing_started_at,
  DROP COLUMN payload_sanitized;

ALTER TABLE payments
  DROP CONSTRAINT payments_provider_idempotency_phase6_check,
  DROP COLUMN checkout_expires_at,
  DROP COLUMN provider_payment_intent_id,
  DROP COLUMN provider_checkout_url,
  DROP COLUMN provider_idempotency_key_hash;

