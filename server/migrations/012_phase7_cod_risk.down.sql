DROP TABLE risk_assessment_attempts;

ALTER TABLE risk_assessments
  DROP COLUMN updated_at,
  DROP COLUMN request_id,
  DROP COLUMN input_snapshot,
  DROP COLUMN policy_version;

ALTER TABLE orders
  DROP CONSTRAINT orders_risk_decision_phase7_check,
  DROP CONSTRAINT orders_risk_level_phase7_check,
  DROP CONSTRAINT orders_address_hash_phase7_check,
  DROP CONSTRAINT orders_phone_hash_phase7_check,
  DROP COLUMN risk_decision,
  DROP COLUMN risk_level,
  DROP COLUMN shipping_address_hash,
  DROP COLUMN customer_phone_hash;

DROP TABLE risk_rules;
DROP TABLE risk_policies;

