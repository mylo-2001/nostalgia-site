-- Greek standard VAT 24% for V2 pricing (candles / room fragrance: CN 3406, 3307 —
-- not listed in Annex III reduced rates under N. 2859/2000 Art. 21).
-- Catalog and shipping amounts are treated as tax-inclusive.

INSERT INTO pricing_policies (id, currency, catalog_prices_include_tax, default_tax_category)
VALUES ('default', 'EUR', TRUE, 'standard')
ON CONFLICT (id) DO UPDATE SET
  catalog_prices_include_tax = TRUE,
  default_tax_category = 'standard',
  currency = COALESCE(pricing_policies.currency, 'EUR'),
  updated_at = now();

-- Idempotent: one active GR/standard row from epoch. If a row already exists for
-- the same natural key, keep rate/include-tax aligned to 24% / inclusive.
INSERT INTO tax_rates (
  country_code, tax_category, rate, prices_include_tax, active, valid_from
) VALUES (
  'GR', 'standard', 24.0000, TRUE, TRUE, '2000-01-01T00:00:00Z'
)
ON CONFLICT (country_code, tax_category, valid_from) DO UPDATE SET
  rate = 24.0000,
  prices_include_tax = TRUE,
  active = TRUE,
  updated_at = now();

-- Shipping / COD fee VAT follows the same standard rate when methods already exist.
UPDATE shipping_methods
SET shipping_vat_rate = 24.0000,
    cod_vat_rate = 24.0000,
    shipping_price_includes_tax = TRUE,
    cod_price_includes_tax = TRUE,
    updated_at = now()
WHERE active = TRUE;
