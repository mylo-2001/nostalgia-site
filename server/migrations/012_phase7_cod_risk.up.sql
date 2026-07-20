CREATE TABLE risk_policies (
  id           TEXT PRIMARY KEY,
  medium_score NUMERIC(7,2) NOT NULL CHECK (medium_score >= 0),
  high_score   NUMERIC(7,2) NOT NULL CHECK (high_score > medium_score),
  version      INTEGER NOT NULL DEFAULT 1 CHECK (version > 0),
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at   TIMESTAMPTZ
);

INSERT INTO risk_policies (id, medium_score, high_score)
VALUES ('cod_default', 25, 60);

CREATE TABLE risk_rules (
  code        TEXT PRIMARY KEY,
  metric      TEXT NOT NULL CHECK (metric IN (
    'amount_minor', 'total_quantity', 'orders_24h', 'prior_refusals',
    'distinct_names', 'distinct_addresses', 'phone_unverified',
    'checkout_anomaly_score'
  )),
  operator    TEXT NOT NULL CHECK (operator IN ('gte', 'gt', 'eq')),
  threshold   NUMERIC(14,2) NOT NULL,
  weight      NUMERIC(7,2) NOT NULL CHECK (weight >= 0),
  reason_code TEXT NOT NULL,
  active      BOOLEAN NOT NULL DEFAULT TRUE,
  version     INTEGER NOT NULL DEFAULT 1 CHECK (version > 0),
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ
);

INSERT INTO risk_rules (code, metric, operator, threshold, weight, reason_code) VALUES
  ('cod_high_amount', 'amount_minor', 'gte', 20000, 30, 'high_order_amount'),
  ('cod_large_quantity', 'total_quantity', 'gte', 10, 20, 'large_item_quantity'),
  ('cod_velocity_24h', 'orders_24h', 'gte', 3, 25, 'multiple_recent_orders'),
  ('cod_prior_refusal', 'prior_refusals', 'gte', 1, 40, 'prior_delivery_refusal'),
  ('cod_multiple_names', 'distinct_names', 'gte', 3, 15, 'multiple_names_for_phone'),
  ('cod_multiple_addresses', 'distinct_addresses', 'gte', 3, 15, 'multiple_addresses_for_phone'),
  ('cod_phone_unverified', 'phone_unverified', 'eq', 1, 20, 'phone_not_verified'),
  ('cod_checkout_anomaly', 'checkout_anomaly_score', 'gte', 1, 20, 'unusual_checkout_behavior');

ALTER TABLE orders
  ADD COLUMN customer_phone_hash CHAR(64),
  ADD COLUMN shipping_address_hash CHAR(64),
  ADD COLUMN risk_level TEXT,
  ADD COLUMN risk_decision TEXT;

ALTER TABLE orders
  ADD CONSTRAINT orders_phone_hash_phase7_check CHECK (
    customer_phone_hash IS NULL OR customer_phone_hash ~ '^[0-9a-f]{64}$'
  ),
  ADD CONSTRAINT orders_address_hash_phase7_check CHECK (
    shipping_address_hash IS NULL OR shipping_address_hash ~ '^[0-9a-f]{64}$'
  ),
  ADD CONSTRAINT orders_risk_level_phase7_check CHECK (
    risk_level IS NULL OR risk_level IN ('low', 'medium', 'high')
  ),
  ADD CONSTRAINT orders_risk_decision_phase7_check CHECK (
    risk_decision IS NULL OR risk_decision IN (
      'auto_approved', 'manual_review', 'approved', 'rejected', 'card_required'
    )
  );

ALTER TABLE risk_assessments
  ADD COLUMN policy_version INTEGER NOT NULL DEFAULT 1 CHECK (policy_version > 0),
  ADD COLUMN input_snapshot JSONB NOT NULL DEFAULT '{}'::jsonb
             CHECK (jsonb_typeof(input_snapshot) = 'object'),
  ADD COLUMN request_id TEXT,
  ADD COLUMN updated_at TIMESTAMPTZ;

CREATE TABLE risk_assessment_attempts (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  checkout_hash   CHAR(64) NOT NULL UNIQUE CHECK (checkout_hash ~ '^[0-9a-f]{64}$'),
  risk_score      NUMERIC(7,2) NOT NULL CHECK (risk_score >= 0),
  risk_level      TEXT NOT NULL CHECK (risk_level IN ('low', 'medium', 'high')),
  reasons         JSONB NOT NULL DEFAULT '[]'::jsonb CHECK (jsonb_typeof(reasons) = 'array'),
  rules_triggered JSONB NOT NULL DEFAULT '[]'::jsonb
                  CHECK (jsonb_typeof(rules_triggered) = 'array'),
  input_snapshot  JSONB NOT NULL DEFAULT '{}'::jsonb
                  CHECK (jsonb_typeof(input_snapshot) = 'object'),
  decision        TEXT NOT NULL CHECK (decision IN ('manual_review', 'card_required')),
  request_id      TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE risk_policies ENABLE ROW LEVEL SECURITY;
ALTER TABLE risk_rules ENABLE ROW LEVEL SECURITY;
ALTER TABLE risk_assessment_attempts ENABLE ROW LEVEL SECURITY;

DO $$
DECLARE
  role_name TEXT;
  table_name TEXT;
BEGIN
  FOREACH role_name IN ARRAY ARRAY['anon', 'authenticated'] LOOP
    IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = role_name) THEN
      FOREACH table_name IN ARRAY ARRAY[
        'risk_policies', 'risk_rules', 'risk_assessment_attempts'
      ] LOOP
        EXECUTE format('REVOKE ALL PRIVILEGES ON TABLE %I FROM %I', table_name, role_name);
      END LOOP;
    END IF;
  END LOOP;
END;
$$;

COMMENT ON TABLE risk_rules IS
  'Explainable COD rules only. Protected personal characteristics are prohibited.';

