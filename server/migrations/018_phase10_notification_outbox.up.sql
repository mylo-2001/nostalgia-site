ALTER TABLE notification_outbox
  DROP CONSTRAINT notification_outbox_status_check;

ALTER TABLE notification_outbox
  ADD CONSTRAINT notification_outbox_status_check CHECK (
    status IN ('pending', 'processing', 'sent', 'failed', 'dead_letter')
  ),
  ADD COLUMN max_attempts INTEGER NOT NULL DEFAULT 8 CHECK (max_attempts BETWEEN 1 AND 100),
  ADD COLUMN last_attempt_at TIMESTAMPTZ,
  ADD COLUMN correlation_id TEXT;

COMMENT ON TABLE notification_outbox IS
  'Transactional outbox. Workers claim with SKIP LOCKED and event_key prevents duplicate sends.';
