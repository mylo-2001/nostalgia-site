-- Read-only checks before Phase 4 inventory bootstrap or activation.

SELECT 'inventory_negative_or_overreserved' AS check_name, COUNT(*) AS violations
  FROM inventory
 WHERE stock_on_hand < 0
    OR reserved_quantity < 0
    OR reserved_quantity > stock_on_hand;

SELECT product_id, COALESCE(variant_id, '') AS variant_key, COUNT(*) AS duplicates
  FROM inventory
 GROUP BY product_id, COALESCE(variant_id, '')
HAVING COUNT(*) > 1;

SELECT 'legacy_negative_stock' AS check_name, COUNT(*) AS violations
  FROM (
    SELECT stock FROM catalog_overrides
    UNION ALL
    SELECT stock FROM product_variants
  ) legacy_stock
 WHERE stock < 0;

