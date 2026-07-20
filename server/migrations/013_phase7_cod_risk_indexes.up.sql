-- migration: no-transaction

CREATE INDEX CONCURRENTLY IF NOT EXISTS orders_phone_risk_phase7_idx
  ON orders (customer_phone_hash, created_at DESC)
  WHERE customer_phone_hash IS NOT NULL;
CREATE INDEX CONCURRENTLY IF NOT EXISTS orders_address_risk_phase7_idx
  ON orders (shipping_address_hash, created_at DESC)
  WHERE shipping_address_hash IS NOT NULL;
CREATE INDEX CONCURRENTLY IF NOT EXISTS risk_rules_active_phase7_idx
  ON risk_rules (active, code);
CREATE INDEX CONCURRENTLY IF NOT EXISTS risk_assessment_attempts_created_phase7_idx
  ON risk_assessment_attempts (created_at DESC);

