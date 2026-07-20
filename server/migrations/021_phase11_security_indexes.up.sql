-- migration: no-transaction

CREATE INDEX CONCURRENTLY IF NOT EXISTS admin_login_events_user_phase11_idx
  ON admin_login_events (admin_user_id,created_at DESC) WHERE admin_user_id IS NOT NULL;
CREATE INDEX CONCURRENTLY IF NOT EXISTS admin_login_events_hash_phase11_idx
  ON admin_login_events (username_hash,created_at DESC);
CREATE INDEX CONCURRENTLY IF NOT EXISTS admin_security_alerts_open_phase11_idx
  ON admin_security_alerts (severity,created_at DESC) WHERE status='open';
CREATE UNIQUE INDEX CONCURRENTLY IF NOT EXISTS admin_security_alerts_open_user_type_phase11_uidx
  ON admin_security_alerts (admin_user_id,alert_type)
  WHERE status='open' AND admin_user_id IS NOT NULL;
CREATE INDEX CONCURRENTLY IF NOT EXISTS security_rate_limits_expiry_phase11_idx
  ON security_rate_limits (expires_at);
