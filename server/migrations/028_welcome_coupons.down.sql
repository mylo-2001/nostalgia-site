-- Reverses 028. The two welcome coupons are removed only if they were never
-- redeemed, so a rollback can never erase real order history.

DELETE FROM coupons
 WHERE code IN ('NOSTALGIACANDLE10', 'NOSTALGIACANDLE5')
   AND uses = 0
   AND NOT EXISTS (
     SELECT 1 FROM welcome_coupon_redemptions r WHERE r.code = coupons.code
   );

DROP INDEX IF EXISTS welcome_coupon_redemptions_order_idx;
DROP INDEX IF EXISTS welcome_coupon_redemptions_email_idx;
DROP INDEX IF EXISTS welcome_coupon_redemptions_code_email_uniq;
DROP TABLE IF EXISTS welcome_coupon_redemptions;

ALTER TABLE coupons DROP COLUMN IF EXISTS auto_issued;
ALTER TABLE coupons DROP COLUMN IF EXISTS once_per_customer;
ALTER TABLE coupons DROP COLUMN IF EXISTS first_order_only;
