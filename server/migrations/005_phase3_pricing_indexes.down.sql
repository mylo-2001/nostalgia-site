-- migration: no-transaction

DROP INDEX CONCURRENTLY IF EXISTS coupon_redemptions_expiry_phase3_idx;
DROP INDEX CONCURRENTLY IF EXISTS coupon_redemptions_customer_phase3_idx;
DROP INDEX CONCURRENTLY IF EXISTS coupon_redemptions_usage_phase3_idx;
DROP INDEX CONCURRENTLY IF EXISTS tax_rates_lookup_phase3_idx;
DROP INDEX CONCURRENTLY IF EXISTS shipping_methods_countries_phase3_idx;
DROP INDEX CONCURRENTLY IF EXISTS shipping_methods_active_phase3_idx;
DROP INDEX CONCURRENTLY IF EXISTS coupons_lookup_phase3_idx;
DROP INDEX CONCURRENTLY IF EXISTS product_variants_sku_phase3_idx;
DROP INDEX CONCURRENTLY IF EXISTS catalog_overrides_sku_phase3_idx;
DROP INDEX CONCURRENTLY IF EXISTS products_sku_phase3_idx;
