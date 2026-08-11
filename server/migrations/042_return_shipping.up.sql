ALTER TABLE returns
  ADD COLUMN return_carrier TEXT,
  ADD COLUMN return_tracking_number TEXT,
  ADD COLUMN handed_to_return_courier_at TIMESTAMPTZ;

ALTER TABLE returns
  ADD CONSTRAINT returns_shipping_pair_check CHECK (
    (return_carrier IS NULL AND return_tracking_number IS NULL) OR
    (return_carrier IS NOT NULL AND return_tracking_number IS NOT NULL)
  ),
  ADD CONSTRAINT returns_tracking_number_check CHECK (
    return_tracking_number IS NULL OR return_tracking_number ~ '^[A-Za-z0-9-]{5,80}$'
  );

CREATE INDEX returns_return_tracking_idx
  ON returns (return_carrier, return_tracking_number)
  WHERE return_tracking_number IS NOT NULL;
