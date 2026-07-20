-- Read-only checks. Run manually before applying Phase 3 migrations.

SELECT 'products_negative_prices' AS check_name, COUNT(*) AS violations
  FROM products
 WHERE price < 0 OR sale_price < 0;

SELECT 'catalog_overrides_negative_values' AS check_name, COUNT(*) AS violations
  FROM catalog_overrides
 WHERE stock < 0 OR price < 0 OR sale_price < 0;

SELECT 'product_variants_negative_values' AS check_name, COUNT(*) AS violations
  FROM product_variants
 WHERE stock < 0 OR price < 0 OR sale_price < 0;

SELECT 'coupons_invalid_values' AS check_name, COUNT(*) AS violations
  FROM coupons
 WHERE value <= 0
    OR (type = 'percent' AND value > 100)
    OR uses < 0
    OR (max_uses IS NOT NULL AND max_uses <= 0);

SELECT upper(code) AS normalized_code, COUNT(*) AS duplicates
  FROM coupons
 GROUP BY upper(code)
HAVING COUNT(*) > 1;

SELECT sku, COUNT(*) AS duplicates
  FROM product_variants
 WHERE btrim(sku) <> ''
 GROUP BY sku
HAVING COUNT(*) > 1;

