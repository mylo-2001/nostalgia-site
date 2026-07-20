ALTER TABLE admin_sessions
  ADD COLUMN mfa_verified BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN session_family_id UUID NOT NULL DEFAULT gen_random_uuid();

CREATE TABLE admin_login_events (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  admin_user_id UUID REFERENCES admin_users(id) ON DELETE RESTRICT,
  username_hash CHAR(64) NOT NULL CHECK (username_hash ~ '^[0-9a-f]{64}$'),
  outcome       TEXT NOT NULL CHECK (outcome IN (
    'success', 'invalid_credentials', 'invalid_mfa', 'blocked', 'mfa_required'
  )),
  ip_address    INET,
  user_agent    TEXT,
  request_id    TEXT,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE admin_security_alerts (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  admin_user_id UUID REFERENCES admin_users(id) ON DELETE RESTRICT,
  alert_type    TEXT NOT NULL CHECK (alert_type IN (
    'repeated_login_failures', 'new_ip_login', 'session_anomaly'
  )),
  severity      TEXT NOT NULL CHECK (severity IN ('low', 'medium', 'high')),
  details       JSONB NOT NULL DEFAULT '{}'::jsonb CHECK (jsonb_typeof(details)='object'),
  status        TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open','acknowledged','closed')),
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  resolved_at   TIMESTAMPTZ
);

CREATE TABLE security_rate_limits (
  scope        TEXT NOT NULL,
  key_hash     CHAR(64) NOT NULL CHECK (key_hash ~ '^[0-9a-f]{64}$'),
  window_start TIMESTAMPTZ NOT NULL,
  window_ms    INTEGER NOT NULL CHECK (window_ms BETWEEN 1000 AND 86400000),
  hit_count    INTEGER NOT NULL DEFAULT 1 CHECK (hit_count > 0),
  expires_at   TIMESTAMPTZ NOT NULL,
  PRIMARY KEY (scope, key_hash),
  CHECK (expires_at > window_start)
);

ALTER TABLE admin_login_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE admin_security_alerts ENABLE ROW LEVEL SECURITY;
ALTER TABLE security_rate_limits ENABLE ROW LEVEL SECURITY;

DO $$
DECLARE role_name TEXT; table_name TEXT;
BEGIN
  FOREACH role_name IN ARRAY ARRAY['anon', 'authenticated'] LOOP
    IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname=role_name) THEN
      FOREACH table_name IN ARRAY ARRAY[
        'admin_login_events','admin_security_alerts','security_rate_limits'
      ] LOOP
        EXECUTE format('REVOKE ALL PRIVILEGES ON TABLE %I FROM %I',table_name,role_name);
      END LOOP;
    END IF;
  END LOOP;
END;
$$;
