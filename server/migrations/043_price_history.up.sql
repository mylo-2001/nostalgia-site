-- Append-only intervals of prices actually exposed by the storefront.
-- The open interval is reconciled by /api/catalog whenever pricing rules
-- change, including time-based promotions.
CREATE TABLE IF NOT EXISTS product_price_history (
  id                BIGSERIAL PRIMARY KEY,
  item_id           TEXT NOT NULL,
  price             NUMERIC(14,2) NOT NULL CHECK (price > 0),
  regular_price     NUMERIC(14,2) NOT NULL CHECK (regular_price > 0),
  source_type       TEXT CHECK (source_type IN ('manual', 'promotion')),
  source_id         TEXT,
  source_started_at TIMESTAMPTZ,
  source_ends_at    TIMESTAMPTZ,
  valid_from        TIMESTAMPTZ NOT NULL,
  valid_to          TIMESTAMPTZ,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  CHECK (valid_to IS NULL OR valid_to >= valid_from)
);

CREATE UNIQUE INDEX IF NOT EXISTS product_price_history_one_open_idx
  ON product_price_history (item_id)
  WHERE valid_to IS NULL;

CREATE INDEX IF NOT EXISTS product_price_history_reference_idx
  ON product_price_history (item_id, valid_from DESC);

CREATE INDEX IF NOT EXISTS product_price_history_window_idx
  ON product_price_history (item_id, valid_to, valid_from);

