-- migration: no-transaction

CREATE INDEX CONCURRENTLY IF NOT EXISTS operational_events_type_phase12_idx
  ON operational_events (event_type,created_at DESC);
CREATE INDEX CONCURRENTLY IF NOT EXISTS operational_events_request_phase12_idx
  ON operational_events (request_id) WHERE request_id IS NOT NULL;
CREATE INDEX CONCURRENTLY IF NOT EXISTS scheduled_job_runs_name_phase12_idx
  ON scheduled_job_runs (job_name,started_at DESC);
CREATE INDEX CONCURRENTLY IF NOT EXISTS backup_restore_tests_status_phase12_idx
  ON backup_restore_tests (status,started_at DESC);
