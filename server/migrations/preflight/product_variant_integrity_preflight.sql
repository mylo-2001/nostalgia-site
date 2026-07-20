-- Every query must return zero rows before migrations 026 and 027 are applied.

SELECT id, product_id, color, sku, price, stock
FROM product_variants
WHERE btrim(color) = ''
   OR btrim(sku) = ''
   OR price IS NULL
   OR price < 0
   OR stock IS NULL
   OR stock < 0
   OR (sale_price IS NOT NULL AND (sale_price <= 0 OR sale_price >= price))
   OR (color_hex <> '' AND color_hex !~ '^#[0-9A-Fa-f]{6}$');

SELECT product_id, lower(btrim(color)) AS normalized_color, COUNT(*) AS duplicates
FROM product_variants
GROUP BY product_id, lower(btrim(color))
HAVING COUNT(*) > 1;

SELECT lower(btrim(sku)) AS normalized_sku, COUNT(*) AS duplicates
FROM product_variants
GROUP BY lower(btrim(sku))
HAVING COUNT(*) > 1;

