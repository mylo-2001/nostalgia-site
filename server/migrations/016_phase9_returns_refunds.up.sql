ALTER TABLE returns
  ADD COLUMN idempotency_key_hash CHAR(64),
  ADD COLUMN request_hash CHAR(64),
  ADD COLUMN request_id TEXT,
  ADD COLUMN restock_completed_at TIMESTAMPTZ;

ALTER TABLE returns
  ADD CONSTRAINT returns_idempotency_hash_phase9_check CHECK (
    idempotency_key_hash IS NULL OR idempotency_key_hash ~ '^[0-9a-f]{64}$'
  ),
  ADD CONSTRAINT returns_request_hash_phase9_check CHECK (
    request_hash IS NULL OR request_hash ~ '^[0-9a-f]{64}$'
  );

ALTER TABLE refunds
  ADD COLUMN idempotency_key_hash CHAR(64),
  ADD COLUMN request_hash CHAR(64),
  ADD COLUMN requested_by_type TEXT NOT NULL DEFAULT 'system'
             CHECK (requested_by_type IN ('admin', 'customer', 'guest', 'system')),
  ADD COLUMN requested_by_id TEXT,
  ADD COLUMN request_id TEXT;

ALTER TABLE refunds
  ADD CONSTRAINT refunds_idempotency_hash_phase9_check CHECK (
    idempotency_key_hash IS NULL OR idempotency_key_hash ~ '^[0-9a-f]{64}$'
  ),
  ADD CONSTRAINT refunds_request_hash_phase9_check CHECK (
    request_hash IS NULL OR request_hash ~ '^[0-9a-f]{64}$'
  );

ALTER TABLE payments
  ADD COLUMN refunded_amount NUMERIC(14,2) NOT NULL DEFAULT 0
             CHECK (refunded_amount >= 0 AND refunded_amount <= amount);

ALTER TABLE orders
  ADD COLUMN refunded_total NUMERIC(14,2) NOT NULL DEFAULT 0
             CHECK (refunded_total >= 0);

CREATE TABLE refund_events (
  id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  provider           TEXT NOT NULL,
  provider_event_id  TEXT NOT NULL,
  provider_refund_id TEXT,
  refund_id          UUID REFERENCES refunds(id) ON DELETE RESTRICT,
  event_type         TEXT NOT NULL,
  outcome            TEXT NOT NULL CHECK (outcome IN ('confirmed', 'failed', 'ignored')),
  signature_verified BOOLEAN NOT NULL DEFAULT FALSE,
  sanitized_event    JSONB NOT NULL CHECK (jsonb_typeof(sanitized_event) = 'object'),
  raw_event_sha256   CHAR(64) NOT NULL CHECK (raw_event_sha256 ~ '^[0-9a-f]{64}$'),
  request_id         TEXT,
  processed_at       TIMESTAMPTZ,
  received_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (provider, provider_event_id)
);

ALTER TABLE refund_events ENABLE ROW LEVEL SECURITY;

DO $$
DECLARE role_name TEXT;
BEGIN
  FOREACH role_name IN ARRAY ARRAY['anon', 'authenticated'] LOOP
    IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = role_name) THEN
      EXECUTE format('REVOKE ALL PRIVILEGES ON TABLE refund_events FROM %I', role_name);
    END IF;
  END LOOP;
END;
$$;
