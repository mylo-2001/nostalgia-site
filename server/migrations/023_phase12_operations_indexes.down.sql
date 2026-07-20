-- migration: no-transaction

DROP INDEX CONCURRENTLY IF EXISTS backup_restore_tests_status_phase12_idx;
DROP INDEX CONCURRENTLY IF EXISTS scheduled_job_runs_name_phase12_idx;
DROP INDEX CONCURRENTLY IF EXISTS operational_events_request_phase12_idx;
DROP INDEX CONCURRENTLY IF EXISTS operational_events_type_phase12_idx;
