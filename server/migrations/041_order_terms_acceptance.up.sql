-- Evidence of the Terms of Sale version accepted when an order was placed.
ALTER TABLE orders ADD COLUMN IF NOT EXISTS terms_version TEXT;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS terms_accepted_at TIMESTAMPTZ;
