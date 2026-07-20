ALTER TABLE notification_outbox
  DROP COLUMN correlation_id,
  DROP COLUMN last_attempt_at,
  DROP COLUMN max_attempts,
  DROP CONSTRAINT notification_outbox_status_check;

ALTER TABLE notification_outbox
  ADD CONSTRAINT notification_outbox_status_check CHECK (
    status IN ('pending', 'processing', 'sent', 'failed')
  );
