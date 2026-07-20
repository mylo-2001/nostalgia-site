-- migration: no-transaction

CREATE INDEX CONCURRENTLY IF NOT EXISTS products_sku_phase3_idx
  ON products (sku) WHERE sku IS NOT NULL AND btrim(sku) <> '';
CREATE INDEX CONCURRENTLY IF NOT EXISTS catalog_overrides_sku_phase3_idx
  ON catalog_overrides (sku) WHERE sku IS NOT NULL AND btrim(sku) <> '';
CREATE INDEX CONCURRENTLY IF NOT EXISTS product_variants_sku_phase3_idx
  ON product_variants (sku) WHERE btrim(sku) <> '';

CREATE INDEX CONCURRENTLY IF NOT EXISTS coupons_lookup_phase3_idx
  ON coupons (upper(code), active, starts_at, ends_at);
CREATE INDEX CONCURRENTLY IF NOT EXISTS shipping_methods_active_phase3_idx
  ON shipping_methods (active, currency, position, id);
CREATE INDEX CONCURRENTLY IF NOT EXISTS shipping_methods_countries_phase3_idx
  ON shipping_methods USING gin (supported_country_codes);
CREATE INDEX CONCURRENTLY IF NOT EXISTS tax_rates_lookup_phase3_idx
  ON tax_rates (country_code, tax_category, active, valid_from DESC, valid_to);
CREATE INDEX CONCURRENTLY IF NOT EXISTS coupon_redemptions_usage_phase3_idx
  ON coupon_redemptions (coupon_code, status, created_at DESC)
  WHERE status IN ('reserved', 'consumed');
CREATE INDEX CONCURRENTLY IF NOT EXISTS coupon_redemptions_customer_phase3_idx
  ON coupon_redemptions (coupon_code, customer_key_hash, status)
  WHERE customer_key_hash IS NOT NULL AND status IN ('reserved', 'consumed');
CREATE INDEX CONCURRENTLY IF NOT EXISTS coupon_redemptions_expiry_phase3_idx
  ON coupon_redemptions (expires_at)
  WHERE status = 'reserved';

