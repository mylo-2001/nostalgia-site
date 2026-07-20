ALTER TABLE product_variants
  DROP CONSTRAINT IF EXISTS product_variants_color_hex_check,
  DROP CONSTRAINT IF EXISTS product_variants_sale_price_check,
  DROP CONSTRAINT IF EXISTS product_variants_stock_required_check,
  DROP CONSTRAINT IF EXISTS product_variants_price_required_check,
  DROP CONSTRAINT IF EXISTS product_variants_sku_required_check,
  DROP CONSTRAINT IF EXISTS product_variants_color_required_check;

