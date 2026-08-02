-- Persist the fee breakdown that was actually charged on an order.
--
-- Until now `orders` stored only coupon, discount and total. Shipping and COD
-- fees lived in memory just long enough to build the confirmation email, and
-- every later read recomputed them from the current fee rules. That is wrong
-- in two ways:
--
--   1. A coupon granting free shipping left no trace, so a recompute charged
--      shipping that the customer was never asked to pay, and the receipt
--      stopped adding up.
--   2. If the shop later changes SHIPPING_FEE or the free-shipping threshold,
--      old orders silently re-price themselves.
--
-- A receipt has to stay reproducible, so the numbers are recorded once, at
-- the moment they were charged.

ALTER TABLE orders ADD COLUMN IF NOT EXISTS shipping_fee NUMERIC(14,2);
ALTER TABLE orders ADD COLUMN IF NOT EXISTS cod_fee NUMERIC(14,2);

-- Why shipping was free: a coupon, rather than the order-value threshold.
-- Lets the confirmation email tell the customer what their coupon actually
-- did for them instead of just showing a zero.
ALTER TABLE orders ADD COLUMN IF NOT EXISTS coupon_free_shipping BOOLEAN NOT NULL DEFAULT FALSE;
