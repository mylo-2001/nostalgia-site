-- Promotions engine: scheduled/rule-based discounts that never mutate a
-- product's base price. Coexists with the existing manual per-product
-- sale_price/sale_until mechanism (catalog_overrides / products / variants) —
-- at read time the server picks whichever gives the lowest price ("best
-- discount wins"), see server/promotions.js.

CREATE TABLE IF NOT EXISTS promotions (
  id                      BIGSERIAL PRIMARY KEY,
  name                    TEXT NOT NULL,
  code                    TEXT,
  discount_type           TEXT NOT NULL CHECK (discount_type IN ('percentage', 'fixed_amount', 'fixed_sale_price')),
  discount_value          NUMERIC(10,2) NOT NULL CHECK (discount_value > 0),
  max_discount_per_product NUMERIC(10,2) CHECK (max_discount_per_product IS NULL OR max_discount_per_product > 0),
  status                  TEXT NOT NULL DEFAULT 'draft'
                            CHECK (status IN ('draft', 'scheduled', 'active', 'paused', 'expired', 'cancelled')),
  starts_at               TIMESTAMPTZ,
  ends_at                 TIMESTAMPTZ,
  timezone                TEXT NOT NULL DEFAULT 'Europe/Athens',
  priority                INTEGER NOT NULL DEFAULT 100,
  created_by              TEXT,
  created_at              TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at              TIMESTAMPTZ NOT NULL DEFAULT now(),
  CHECK (starts_at IS NULL OR ends_at IS NULL OR ends_at > starts_at)
);

-- Internal reference code, optional but unique when set (case-insensitive).
CREATE UNIQUE INDEX IF NOT EXISTS promotions_code_uniq
  ON promotions (upper(btrim(code)))
  WHERE code IS NOT NULL AND btrim(code) <> '';

CREATE INDEX IF NOT EXISTS promotions_status_idx ON promotions (status);

-- Where a promotion applies: one row per product, per category, or a single
-- 'all_products' row (target_id NULL) meaning "every product".
CREATE TABLE IF NOT EXISTS promotion_targets (
  id            BIGSERIAL PRIMARY KEY,
  promotion_id  BIGINT NOT NULL REFERENCES promotions(id) ON DELETE CASCADE,
  target_type   TEXT NOT NULL CHECK (target_type IN ('product', 'category', 'all_products')),
  target_id     TEXT,
  CHECK (
    (target_type = 'all_products' AND target_id IS NULL) OR
    (target_type IN ('product', 'category') AND target_id IS NOT NULL)
  )
);

CREATE INDEX IF NOT EXISTS promotion_targets_promotion_idx ON promotion_targets (promotion_id);
CREATE INDEX IF NOT EXISTS promotion_targets_lookup_idx ON promotion_targets (target_type, target_id);

-- What a promotion excludes, even if a target above would otherwise match.
-- 'new_products' has no exclusion_id (it means "any product currently new").
CREATE TABLE IF NOT EXISTS promotion_exclusions (
  id             BIGSERIAL PRIMARY KEY,
  promotion_id   BIGINT NOT NULL REFERENCES promotions(id) ON DELETE CASCADE,
  exclusion_type TEXT NOT NULL CHECK (exclusion_type IN ('product', 'new_products')),
  exclusion_id   TEXT,
  CHECK (
    (exclusion_type = 'new_products' AND exclusion_id IS NULL) OR
    (exclusion_type = 'product' AND exclusion_id IS NOT NULL)
  )
);

CREATE INDEX IF NOT EXISTS promotion_exclusions_promotion_idx ON promotion_exclusions (promotion_id);

-- History trail: reuses the existing generic `audit_log` table (type,
-- actor, ip, meta JSONB) rather than a dedicated one — promotion events are
-- written as type 'promotion.<action>' with meta->>'promotionId' set, so a
-- per-promotion trail is just a filtered query against it. An index on that
-- JSON path keeps the per-promotion lookup fast.
CREATE INDEX IF NOT EXISTS audit_log_promotion_id_idx
  ON audit_log ((meta->>'promotionId'))
  WHERE type LIKE 'promotion.%';

-- Order-line promotion attribution snapshot (order history must keep showing
-- the price actually charged even after the promotion changes or ends).
ALTER TABLE orders ADD COLUMN IF NOT EXISTS promotion_snapshots JSONB NOT NULL DEFAULT '[]'::jsonb;
