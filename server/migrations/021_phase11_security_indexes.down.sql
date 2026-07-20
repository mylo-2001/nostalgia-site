-- migration: no-transaction

DROP INDEX CONCURRENTLY IF EXISTS security_rate_limits_expiry_phase11_idx;
DROP INDEX CONCURRENTLY IF EXISTS admin_security_alerts_open_phase11_idx;
DROP INDEX CONCURRENTLY IF EXISTS admin_login_events_hash_phase11_idx;
DROP INDEX CONCURRENTLY IF EXISTS admin_login_events_user_phase11_idx;
DROP INDEX CONCURRENTLY IF EXISTS admin_security_alerts_open_user_type_phase11_uidx;
