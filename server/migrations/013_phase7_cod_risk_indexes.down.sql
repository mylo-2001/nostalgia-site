-- migration: no-transaction

DROP INDEX CONCURRENTLY IF EXISTS risk_assessment_attempts_created_phase7_idx;
DROP INDEX CONCURRENTLY IF EXISTS risk_rules_active_phase7_idx;
DROP INDEX CONCURRENTLY IF EXISTS orders_address_risk_phase7_idx;
DROP INDEX CONCURRENTLY IF EXISTS orders_phone_risk_phase7_idx;
