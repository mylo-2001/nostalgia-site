-- migration: no-transaction

DROP INDEX CONCURRENTLY IF EXISTS audit_logs_entity_phase8_idx;
DROP INDEX CONCURRENTLY IF EXISTS admin_sessions_active_phase8_idx;
DROP INDEX CONCURRENTLY IF EXISTS admin_user_roles_role_phase8_idx;
