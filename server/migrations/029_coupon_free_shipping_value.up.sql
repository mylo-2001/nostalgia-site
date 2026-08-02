-- Fixes coupons_value_phase3_check (added in 004, before the free_shipping
-- column existed): it required value > 0 unconditionally, which made it
-- impossible to create a coupon that grants ONLY free shipping (value = 0).
--
-- New rule: value > 0 as before, UNLESS the coupon grants free shipping, in
-- which case value = 0 is also allowed (a free-shipping-only code).

ALTER TABLE coupons DROP CONSTRAINT IF EXISTS coupons_value_phase3_check;

ALTER TABLE coupons
  ADD CONSTRAINT coupons_value_phase3_check CHECK (
    (type = 'percent' AND value > 0 AND value <= 100)
    OR (type = 'fixed' AND value > 0)
    OR (free_shipping AND value = 0)
  );
