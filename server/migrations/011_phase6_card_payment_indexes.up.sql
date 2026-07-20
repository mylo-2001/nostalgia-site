-- migration: no-transaction

CREATE UNIQUE INDEX CONCURRENTLY IF NOT EXISTS payments_provider_idempotency_phase6_uidx
  ON payments (provider, provider_idempotency_key_hash)
  WHERE provider_idempotency_key_hash IS NOT NULL;
CREATE UNIQUE INDEX CONCURRENTLY IF NOT EXISTS payments_provider_intent_phase6_uidx
  ON payments (provider, provider_payment_intent_id)
  WHERE provider_payment_intent_id IS NOT NULL;
CREATE INDEX CONCURRENTLY IF NOT EXISTS payment_events_request_phase6_idx
  ON payment_events (request_id)
  WHERE request_id IS NOT NULL;
CREATE INDEX CONCURRENTLY IF NOT EXISTS orders_last_payment_phase6_idx
  ON orders (last_payment_id)
  WHERE last_payment_id IS NOT NULL;

