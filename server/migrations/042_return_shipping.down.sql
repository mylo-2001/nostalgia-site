DROP INDEX IF EXISTS returns_return_tracking_idx;

ALTER TABLE returns
  DROP CONSTRAINT IF EXISTS returns_tracking_number_check,
  DROP CONSTRAINT IF EXISTS returns_shipping_pair_check,
  DROP COLUMN IF EXISTS handed_to_return_courier_at,
  DROP COLUMN IF EXISTS return_tracking_number,
  DROP COLUMN IF EXISTS return_carrier;
