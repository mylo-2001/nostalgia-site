ALTER TABLE product_variants
  ADD COLUMN IF NOT EXISTS color_hex TEXT NOT NULL DEFAULT '';

ALTER TABLE product_variants
  ADD CONSTRAINT product_variants_color_required_check
    CHECK (btrim(color) <> '') NOT VALID,
  ADD CONSTRAINT product_variants_sku_required_check
    CHECK (btrim(sku) <> '') NOT VALID,
  ADD CONSTRAINT product_variants_price_required_check
    CHECK (price IS NOT NULL AND price >= 0) NOT VALID,
  ADD CONSTRAINT product_variants_stock_required_check
    CHECK (stock IS NOT NULL AND stock >= 0) NOT VALID,
  ADD CONSTRAINT product_variants_sale_price_check
    CHECK (sale_price IS NULL OR (sale_price > 0 AND sale_price < price)) NOT VALID,
  ADD CONSTRAINT product_variants_color_hex_check
    CHECK (color_hex = '' OR color_hex ~ '^#[0-9A-Fa-f]{6}$') NOT VALID;

ALTER TABLE product_variants VALIDATE CONSTRAINT product_variants_color_required_check;
ALTER TABLE product_variants VALIDATE CONSTRAINT product_variants_sku_required_check;
ALTER TABLE product_variants VALIDATE CONSTRAINT product_variants_price_required_check;
ALTER TABLE product_variants VALIDATE CONSTRAINT product_variants_stock_required_check;
ALTER TABLE product_variants VALIDATE CONSTRAINT product_variants_sale_price_check;
ALTER TABLE product_variants VALIDATE CONSTRAINT product_variants_color_hex_check;
