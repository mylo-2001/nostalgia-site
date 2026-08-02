-- Reverses 029. Refuses to restore the stricter constraint if it would
-- immediately be violated by an existing free-shipping-only (value = 0) coupon.

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM coupons
     WHERE free_shipping AND value = 0
       AND NOT ((type = 'percent' AND value > 0 AND value <= 100) OR (type = 'fixed' AND value > 0))
  ) THEN
    RAISE EXCEPTION
      'Cannot roll back 029: one or more free-shipping-only coupons (value=0) exist. Delete or repurpose them first.';
  END IF;
END $$;

ALTER TABLE coupons DROP CONSTRAINT IF EXISTS coupons_value_phase3_check;

ALTER TABLE coupons
  ADD CONSTRAINT coupons_value_phase3_check CHECK (
    (type = 'percent' AND value > 0 AND value <= 100)
    OR (type = 'fixed' AND value > 0)
  ) NOT VALID;
