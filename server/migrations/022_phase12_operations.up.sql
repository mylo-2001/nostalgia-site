CREATE TABLE operational_events (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_type     TEXT NOT NULL CHECK (length(event_type) BETWEEN 3 AND 120),
  severity       TEXT NOT NULL CHECK (severity IN ('info','warning','error','critical')),
  entity_type    TEXT,
  entity_id      TEXT,
  request_id     TEXT,
  correlation_id TEXT,
  metadata       JSONB NOT NULL DEFAULT '{}'::jsonb CHECK (jsonb_typeof(metadata)='object'),
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE operational_alerts (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  dedupe_key     TEXT NOT NULL,
  alert_type     TEXT NOT NULL,
  severity       TEXT NOT NULL CHECK (severity IN ('warning','error','critical')),
  details        JSONB NOT NULL DEFAULT '{}'::jsonb CHECK (jsonb_typeof(details)='object'),
  status         TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open','acknowledged','resolved')),
  first_seen_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_seen_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  occurrences    INTEGER NOT NULL DEFAULT 1 CHECK (occurrences > 0),
  resolved_at    TIMESTAMPTZ
);

CREATE UNIQUE INDEX operational_alerts_open_dedupe_uidx
  ON operational_alerts (dedupe_key) WHERE status='open';

CREATE TABLE scheduled_job_runs (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  job_name       TEXT NOT NULL,
  status         TEXT NOT NULL CHECK (status IN ('running','succeeded','failed')),
  worker_id      TEXT NOT NULL,
  correlation_id TEXT,
  result         JSONB NOT NULL DEFAULT '{}'::jsonb CHECK (jsonb_typeof(result)='object'),
  error_message  TEXT,
  started_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  completed_at   TIMESTAMPTZ
);

CREATE TABLE backup_restore_tests (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  backup_reference TEXT NOT NULL,
  status          TEXT NOT NULL CHECK (status IN ('running','succeeded','failed')),
  checksum_sha256 CHAR(64) CHECK (checksum_sha256 IS NULL OR checksum_sha256 ~ '^[0-9a-f]{64}$'),
  tested_by       TEXT NOT NULL,
  notes           TEXT,
  started_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  completed_at    TIMESTAMPTZ
);

CREATE TRIGGER operational_events_append_only
  BEFORE UPDATE OR DELETE ON operational_events
  FOR EACH ROW EXECUTE FUNCTION nostalgia_prevent_append_only_mutation();

ALTER TABLE operational_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE operational_alerts ENABLE ROW LEVEL SECURITY;
ALTER TABLE scheduled_job_runs ENABLE ROW LEVEL SECURITY;
ALTER TABLE backup_restore_tests ENABLE ROW LEVEL SECURITY;

DO $$
DECLARE role_name TEXT; table_name TEXT;
BEGIN
  FOREACH role_name IN ARRAY ARRAY['anon','authenticated'] LOOP
    IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname=role_name) THEN
      FOREACH table_name IN ARRAY ARRAY[
        'operational_events','operational_alerts','scheduled_job_runs','backup_restore_tests'
      ] LOOP
        EXECUTE format('REVOKE ALL PRIVILEGES ON TABLE %I FROM %I',table_name,role_name);
      END LOOP;
    END IF;
  END LOOP;
END;
$$;
