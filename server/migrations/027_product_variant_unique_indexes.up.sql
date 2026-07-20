-- migration: no-transaction

-- A failed concurrent build can leave an INVALID index behind. Removing these
-- known names makes a migration retry deterministic.
DROP INDEX CONCURRENTLY IF EXISTS product_variants_product_color_unique_idx;
DROP INDEX CONCURRENTLY IF EXISTS product_variants_sku_unique_idx;

CREATE UNIQUE INDEX CONCURRENTLY IF NOT EXISTS product_variants_product_color_unique_idx
  ON product_variants (product_id, lower(btrim(color)));

CREATE UNIQUE INDEX CONCURRENTLY IF NOT EXISTS product_variants_sku_unique_idx
  ON product_variants (lower(btrim(sku)));
