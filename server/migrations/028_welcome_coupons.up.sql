-- Welcome-offer coupons: newsletter (10%) + account (5%), stackable, but each
-- redeemable once per customer and only on that customer's FIRST order.
--
-- Enforcement is keyed on the order email (lower/trimmed) so guest checkouts
-- are covered too, not just registered accounts.
--
-- NOTE: the V2 order system already owns a `coupon_redemptions` table with a
-- different shape (coupon_code / customer_key_hash / reservation states). This
-- feature belongs to the legacy checkout, so it gets its own table rather than
-- overloading that one.

ALTER TABLE coupons ADD COLUMN IF NOT EXISTS first_order_only  BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE coupons ADD COLUMN IF NOT EXISTS once_per_customer BOOLEAN NOT NULL DEFAULT FALSE;
-- Auto-issued coupons are handed out by email, not advertised as a public code.
ALTER TABLE coupons ADD COLUMN IF NOT EXISTS auto_issued       BOOLEAN NOT NULL DEFAULT FALSE;

-- One row per (coupon, customer email) actually redeemed on an order.
CREATE TABLE IF NOT EXISTS welcome_coupon_redemptions (
  id          BIGSERIAL PRIMARY KEY,
  code        TEXT NOT NULL,
  email       TEXT NOT NULL,
  order_id    TEXT,
  discount    NUMERIC(10,2) NOT NULL DEFAULT 0,
  redeemed_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- "Once per customer" is enforced at the database level, not just in code, so a
-- double-submit or a race between two checkouts cannot redeem twice.
CREATE UNIQUE INDEX IF NOT EXISTS welcome_coupon_redemptions_code_email_uniq
  ON welcome_coupon_redemptions (code, lower(btrim(email)));

CREATE INDEX IF NOT EXISTS welcome_coupon_redemptions_email_idx
  ON welcome_coupon_redemptions (lower(btrim(email)));

CREATE INDEX IF NOT EXISTS welcome_coupon_redemptions_order_idx
  ON welcome_coupon_redemptions (order_id);

-- The two fixed welcome coupons. ON CONFLICT keeps re-runs safe and never
-- resets a live "uses" counter.
INSERT INTO coupons (code, type, value, active, name, first_order_only, once_per_customer, auto_issued)
VALUES
  ('NOSTALGIACANDLE10', 'percent', 10, TRUE, 'Newsletter — 10% πρώτης παραγγελίας', TRUE, TRUE, TRUE),
  ('NOSTALGIACANDLE5',  'percent',  5, TRUE, 'Λογαριασμός — επιπλέον 5%',          TRUE, TRUE, TRUE)
ON CONFLICT (code) DO UPDATE
  SET first_order_only  = EXCLUDED.first_order_only,
      once_per_customer = EXCLUDED.once_per_customer,
      auto_issued       = EXCLUDED.auto_issued;
