ALTER TABLE idempotency_keys
  DROP COLUMN updated_at,
  DROP COLUMN last_error_code,
  DROP COLUMN locked_at,
  DROP COLUMN attempts;

ALTER TABLE orders
  DROP CONSTRAINT orders_guest_access_expiry_phase5_check,
  DROP CONSTRAINT orders_pricing_snapshot_phase5_check,
  DROP CONSTRAINT orders_reservation_group_phase5_check,
  DROP CONSTRAINT orders_checkout_hash_phase5_check,
  DROP COLUMN pricing_snapshot,
  DROP COLUMN guest_access_expires_at,
  DROP COLUMN customer_email_normalized,
  DROP COLUMN reservation_group_key,
  DROP COLUMN checkout_request_hash,
  DROP COLUMN checkout_idempotency_id;

