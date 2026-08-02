ALTER TABLE orders DROP COLUMN IF EXISTS promotion_snapshots;

DROP INDEX IF EXISTS audit_log_promotion_id_idx;
DROP TABLE IF EXISTS promotion_exclusions;
DROP TABLE IF EXISTS promotion_targets;

DROP INDEX IF EXISTS promotions_status_idx;
DROP INDEX IF EXISTS promotions_code_uniq;
DROP TABLE IF EXISTS promotions;
