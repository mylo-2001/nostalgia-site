DROP INDEX IF EXISTS newsletter_unsubscribed_retention_idx;
DROP INDEX IF EXISTS newsletter_confirmation_token_uidx;

ALTER TABLE newsletter DROP COLUMN IF EXISTS consent_notice;
ALTER TABLE newsletter DROP COLUMN IF EXISTS confirmed_at;
ALTER TABLE newsletter DROP COLUMN IF EXISTS confirmation_expires_at;
ALTER TABLE newsletter DROP COLUMN IF EXISTS confirmation_token_hash;

DELETE FROM newsletter WHERE status = 'pending';

ALTER TABLE newsletter DROP CONSTRAINT IF EXISTS newsletter_status_check;
ALTER TABLE newsletter ADD CONSTRAINT newsletter_status_check
  CHECK (status IN ('subscribed', 'unsubscribed'));
