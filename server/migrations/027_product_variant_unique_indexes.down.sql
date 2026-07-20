-- migration: no-transaction

DROP INDEX CONCURRENTLY IF EXISTS product_variants_sku_unique_idx;
DROP INDEX CONCURRENTLY IF EXISTS product_variants_product_color_unique_idx;

