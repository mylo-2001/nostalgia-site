-- migration: no-transaction

CREATE INDEX CONCURRENTLY IF NOT EXISTS admin_user_roles_role_phase8_idx
  ON admin_user_roles (role_code, admin_user_id);
CREATE INDEX CONCURRENTLY IF NOT EXISTS admin_sessions_active_phase8_idx
  ON admin_sessions (admin_user_id, expires_at)
  WHERE revoked_at IS NULL;
CREATE INDEX CONCURRENTLY IF NOT EXISTS audit_logs_entity_phase8_idx
  ON audit_logs (entity_type, entity_id, created_at DESC);
