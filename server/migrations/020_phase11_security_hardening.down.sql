DROP TABLE security_rate_limits;
DROP TABLE admin_security_alerts;
DROP TABLE admin_login_events;
ALTER TABLE admin_sessions DROP COLUMN session_family_id, DROP COLUMN mfa_verified;
