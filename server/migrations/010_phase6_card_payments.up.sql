ALTER TABLE payments
  ADD COLUMN provider_idempotency_key_hash CHAR(64),
  ADD COLUMN provider_checkout_url TEXT,
  ADD COLUMN provider_payment_intent_id TEXT,
  ADD COLUMN checkout_expires_at TIMESTAMPTZ;

ALTER TABLE payments
  ADD CONSTRAINT payments_provider_idempotency_phase6_check CHECK (
    provider_idempotency_key_hash IS NULL
    OR provider_idempotency_key_hash ~ '^[0-9a-f]{64}$'
  );

ALTER TABLE payment_events
  ADD COLUMN payload_sanitized BOOLEAN NOT NULL DEFAULT TRUE,
  ADD COLUMN processing_started_at TIMESTAMPTZ,
  ADD COLUMN request_id TEXT;

ALTER TABLE orders
  ADD COLUMN last_payment_id UUID REFERENCES payments(id) ON DELETE RESTRICT,
  ADD COLUMN payment_expires_at TIMESTAMPTZ;

COMMENT ON COLUMN payment_events.raw_event IS
  'Sanitized provider event only. Never store PAN, CVV, signatures, or credentials.';
COMMENT ON COLUMN payments.provider_checkout_url IS
  'Server-only hosted checkout URL. Never expose through order status endpoints.';

