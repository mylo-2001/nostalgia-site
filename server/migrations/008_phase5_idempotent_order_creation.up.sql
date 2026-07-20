CREATE SEQUENCE IF NOT EXISTS order_number_seq;

ALTER TABLE orders
  ADD COLUMN checkout_idempotency_id UUID REFERENCES idempotency_keys(id) ON DELETE RESTRICT,
  ADD COLUMN checkout_request_hash CHAR(64),
  ADD COLUMN reservation_group_key CHAR(64)
             REFERENCES inventory_reservation_groups(group_key) ON DELETE RESTRICT,
  ADD COLUMN customer_email_normalized TEXT,
  ADD COLUMN guest_access_expires_at TIMESTAMPTZ,
  ADD COLUMN pricing_snapshot JSONB;

ALTER TABLE orders
  ADD CONSTRAINT orders_checkout_hash_phase5_check CHECK (
    checkout_request_hash IS NULL OR checkout_request_hash ~ '^[0-9a-f]{64}$'
  ),
  ADD CONSTRAINT orders_reservation_group_phase5_check CHECK (
    reservation_group_key IS NULL OR reservation_group_key ~ '^[0-9a-f]{64}$'
  ),
  ADD CONSTRAINT orders_pricing_snapshot_phase5_check CHECK (
    pricing_snapshot IS NULL OR jsonb_typeof(pricing_snapshot) = 'object'
  ),
  ADD CONSTRAINT orders_guest_access_expiry_phase5_check CHECK (
    guest_access_expires_at IS NULL OR guest_access_token_hash IS NOT NULL
  );

ALTER TABLE idempotency_keys
  ADD COLUMN attempts INTEGER NOT NULL DEFAULT 1 CHECK (attempts > 0),
  ADD COLUMN locked_at TIMESTAMPTZ,
  ADD COLUMN last_error_code TEXT,
  ADD COLUMN updated_at TIMESTAMPTZ;

COMMENT ON COLUMN orders.pricing_snapshot IS
  'Exact server-side quote used to create the order. Browser totals are never stored here.';
COMMENT ON COLUMN orders.guest_access_expires_at IS
  'Guest capability expiry. Only the SHA-256 token hash is persisted.';

