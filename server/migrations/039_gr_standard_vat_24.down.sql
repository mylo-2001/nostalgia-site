-- Remove only the seeded GR/standard epoch row. Do not wipe other tax_rates.
DELETE FROM tax_rates
WHERE country_code = 'GR'
  AND tax_category = 'standard'
  AND valid_from = '2000-01-01T00:00:00Z'
  AND rate = 24.0000;

-- Leave pricing_policies.default row in place (created by 004); only undo the
-- shipping VAT bump if methods still show the seeded 24% values.
UPDATE shipping_methods
SET shipping_vat_rate = 0,
    cod_vat_rate = 0,
    updated_at = now()
WHERE shipping_vat_rate = 24.0000
  AND cod_vat_rate = 24.0000;
