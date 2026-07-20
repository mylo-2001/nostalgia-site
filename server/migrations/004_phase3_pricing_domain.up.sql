ALTER TABLE products
  ADD COLUMN sku TEXT,
  ADD COLUMN vat_rate NUMERIC(7,4),
  ADD COLUMN tax_category TEXT NOT NULL DEFAULT 'standard';

ALTER TABLE products
  ADD CONSTRAINT products_vat_rate_phase3_check CHECK (
    vat_rate IS NULL OR (vat_rate >= 0 AND vat_rate <= 100)
  ),
  ADD CONSTRAINT products_tax_category_phase3_check CHECK (
    btrim(tax_category) <> ''
  );

ALTER TABLE catalog_overrides
  ADD COLUMN active BOOLEAN NOT NULL DEFAULT TRUE,
  ADD COLUMN sku TEXT,
  ADD COLUMN vat_rate NUMERIC(7,4),
  ADD COLUMN tax_category TEXT NOT NULL DEFAULT 'standard';

ALTER TABLE catalog_overrides
  ADD CONSTRAINT catalog_overrides_stock_phase3_check CHECK (
    stock IS NULL OR stock >= 0
  ) NOT VALID,
  ADD CONSTRAINT catalog_overrides_vat_rate_phase3_check CHECK (
    vat_rate IS NULL OR (vat_rate >= 0 AND vat_rate <= 100)
  ),
  ADD CONSTRAINT catalog_overrides_tax_category_phase3_check CHECK (
    btrim(tax_category) <> ''
  );

ALTER TABLE product_variants
  ADD COLUMN vat_rate NUMERIC(7,4),
  ADD COLUMN tax_category TEXT;

ALTER TABLE product_variants
  ADD CONSTRAINT product_variants_stock_phase3_check CHECK (
    stock IS NULL OR stock >= 0
  ) NOT VALID,
  ADD CONSTRAINT product_variants_vat_rate_phase3_check CHECK (
    vat_rate IS NULL OR (vat_rate >= 0 AND vat_rate <= 100)
  ),
  ADD CONSTRAINT product_variants_tax_category_phase3_check CHECK (
    tax_category IS NULL OR btrim(tax_category) <> ''
  );

ALTER TABLE coupons
  ADD COLUMN starts_at TIMESTAMPTZ,
  ADD COLUMN ends_at TIMESTAMPTZ,
  ADD COLUMN min_subtotal NUMERIC(14,2) NOT NULL DEFAULT 0,
  ADD COLUMN max_discount NUMERIC(14,2),
  ADD COLUMN allowed_product_ids JSONB NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN allowed_variant_ids JSONB NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN per_customer_limit INTEGER,
  ADD COLUMN currency TEXT NOT NULL DEFAULT 'EUR',
  ADD COLUMN version INTEGER NOT NULL DEFAULT 1,
  ADD COLUMN updated_at TIMESTAMPTZ;

ALTER TABLE coupons
  ADD CONSTRAINT coupons_value_phase3_check CHECK (
    (type = 'percent' AND value > 0 AND value <= 100)
    OR (type = 'fixed' AND value > 0)
  ) NOT VALID,
  ADD CONSTRAINT coupons_uses_phase3_check CHECK (uses >= 0) NOT VALID,
  ADD CONSTRAINT coupons_max_uses_phase3_check CHECK (
    max_uses IS NULL OR max_uses > 0
  ) NOT VALID,
  ADD CONSTRAINT coupons_window_phase3_check CHECK (
    starts_at IS NULL OR ends_at IS NULL OR ends_at > starts_at
  ),
  ADD CONSTRAINT coupons_min_subtotal_phase3_check CHECK (min_subtotal >= 0),
  ADD CONSTRAINT coupons_max_discount_phase3_check CHECK (
    max_discount IS NULL OR max_discount > 0
  ),
  ADD CONSTRAINT coupons_allowed_products_phase3_check CHECK (
    jsonb_typeof(allowed_product_ids) = 'array'
  ),
  ADD CONSTRAINT coupons_allowed_variants_phase3_check CHECK (
    jsonb_typeof(allowed_variant_ids) = 'array'
  ),
  ADD CONSTRAINT coupons_per_customer_phase3_check CHECK (
    per_customer_limit IS NULL OR per_customer_limit > 0
  ),
  ADD CONSTRAINT coupons_currency_phase3_check CHECK (currency ~ '^[A-Z]{3}$'),
  ADD CONSTRAINT coupons_version_phase3_check CHECK (version > 0);

CREATE TABLE pricing_policies (
  id                         TEXT PRIMARY KEY,
  currency                   TEXT NOT NULL DEFAULT 'EUR'
                             CHECK (currency ~ '^[A-Z]{3}$'),
  max_line_quantity          INTEGER NOT NULL DEFAULT 99
                             CHECK (max_line_quantity BETWEEN 1 AND 10000),
  rounding_mode              TEXT NOT NULL DEFAULT 'half_up'
                             CHECK (rounding_mode = 'half_up'),
  default_tax_category       TEXT NOT NULL DEFAULT 'standard'
                             CHECK (btrim(default_tax_category) <> ''),
  catalog_prices_include_tax BOOLEAN NOT NULL DEFAULT TRUE,
  version                    INTEGER NOT NULL DEFAULT 1 CHECK (version > 0),
  created_at                 TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at                 TIMESTAMPTZ
);

INSERT INTO pricing_policies (id) VALUES ('default');

CREATE TABLE shipping_methods (
  id                          TEXT PRIMARY KEY,
  name                        TEXT NOT NULL CHECK (btrim(name) <> ''),
  active                      BOOLEAN NOT NULL DEFAULT TRUE,
  currency                    TEXT NOT NULL DEFAULT 'EUR'
                              CHECK (currency ~ '^[A-Z]{3}$'),
  base_fee                    NUMERIC(14,2) NOT NULL CHECK (base_fee >= 0),
  free_shipping_threshold     NUMERIC(14,2)
                              CHECK (free_shipping_threshold IS NULL OR free_shipping_threshold >= 0),
  cod_fee                     NUMERIC(14,2) NOT NULL DEFAULT 0 CHECK (cod_fee >= 0),
  cod_allowed                 BOOLEAN NOT NULL DEFAULT TRUE,
  shipping_vat_rate           NUMERIC(7,4) NOT NULL DEFAULT 0
                              CHECK (shipping_vat_rate BETWEEN 0 AND 100),
  cod_vat_rate                NUMERIC(7,4) NOT NULL DEFAULT 0
                              CHECK (cod_vat_rate BETWEEN 0 AND 100),
  shipping_price_includes_tax BOOLEAN NOT NULL DEFAULT TRUE,
  cod_price_includes_tax      BOOLEAN NOT NULL DEFAULT TRUE,
  supported_country_codes     JSONB NOT NULL DEFAULT '[]'::jsonb
                              CHECK (jsonb_typeof(supported_country_codes) = 'array'),
  position                    INTEGER NOT NULL DEFAULT 0,
  version                     INTEGER NOT NULL DEFAULT 1 CHECK (version > 0),
  created_at                  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at                  TIMESTAMPTZ
);

CREATE TABLE tax_rates (
  id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  country_code       CHAR(2) NOT NULL CHECK (country_code ~ '^[A-Z]{2}$'),
  tax_category       TEXT NOT NULL CHECK (btrim(tax_category) <> ''),
  rate               NUMERIC(7,4) NOT NULL CHECK (rate BETWEEN 0 AND 100),
  prices_include_tax BOOLEAN NOT NULL DEFAULT TRUE,
  active             BOOLEAN NOT NULL DEFAULT TRUE,
  valid_from         TIMESTAMPTZ NOT NULL,
  valid_to           TIMESTAMPTZ,
  version            INTEGER NOT NULL DEFAULT 1 CHECK (version > 0),
  created_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at         TIMESTAMPTZ,
  UNIQUE (country_code, tax_category, valid_from),
  CHECK (valid_to IS NULL OR valid_to > valid_from)
);

CREATE TABLE coupon_redemptions (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  coupon_code       TEXT NOT NULL REFERENCES coupons(code) ON DELETE RESTRICT,
  order_id          TEXT NOT NULL REFERENCES orders(id) ON DELETE RESTRICT,
  customer_key_hash CHAR(64) CHECK (
    customer_key_hash IS NULL OR customer_key_hash ~ '^[0-9a-f]{64}$'
  ),
  status            TEXT NOT NULL DEFAULT 'reserved'
                    CHECK (status IN ('reserved', 'consumed', 'released')),
  discount_amount   NUMERIC(14,2) NOT NULL CHECK (discount_amount >= 0),
  currency          TEXT NOT NULL CHECK (currency ~ '^[A-Z]{3}$'),
  event_key         TEXT NOT NULL UNIQUE,
  expires_at        TIMESTAMPTZ,
  consumed_at       TIMESTAMPTZ,
  released_at       TIMESTAMPTZ,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (coupon_code, order_id),
  CHECK (consumed_at IS NULL OR status = 'consumed'),
  CHECK (released_at IS NULL OR status = 'released')
);

ALTER TABLE pricing_policies ENABLE ROW LEVEL SECURITY;
ALTER TABLE shipping_methods ENABLE ROW LEVEL SECURITY;
ALTER TABLE tax_rates ENABLE ROW LEVEL SECURITY;
ALTER TABLE coupon_redemptions ENABLE ROW LEVEL SECURITY;

DO $$
DECLARE
  role_name TEXT;
  table_name TEXT;
  protected_tables TEXT[] := ARRAY[
    'pricing_policies', 'shipping_methods', 'tax_rates', 'coupon_redemptions'
  ];
BEGIN
  FOREACH role_name IN ARRAY ARRAY['anon', 'authenticated'] LOOP
    IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = role_name) THEN
      FOREACH table_name IN ARRAY protected_tables LOOP
        EXECUTE format('REVOKE ALL PRIVILEGES ON TABLE %I FROM %I', table_name, role_name);
      END LOOP;
    END IF;
  END LOOP;
END;
$$;

COMMENT ON TABLE pricing_policies IS
  'Server-side pricing policy. Browser-provided totals and rounding modes are never trusted.';
COMMENT ON TABLE shipping_methods IS
  'Server-owned shipping and COD charges. No production rates are seeded by this migration.';
COMMENT ON TABLE tax_rates IS
  'Versioned VAT rules configured after legal and accounting approval.';
COMMENT ON TABLE coupon_redemptions IS
  'Idempotent coupon reservation and consumption records for later checkout phases.';
COMMENT ON COLUMN shipping_methods.supported_country_codes IS
  'Uppercase ISO 3166-1 alpha-2 codes. An empty array means no country restriction.';
