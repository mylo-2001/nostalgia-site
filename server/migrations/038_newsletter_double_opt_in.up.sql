-- Verifiable newsletter consent (double opt-in).
-- A submitted address remains pending until the owner follows the emailed
-- confirmation link. Only status='subscribed' is eligible for marketing.

ALTER TABLE newsletter DROP CONSTRAINT IF EXISTS newsletter_status_check;
ALTER TABLE newsletter ADD CONSTRAINT newsletter_status_check
  CHECK (status IN ('pending', 'subscribed', 'unsubscribed'));

ALTER TABLE newsletter ADD COLUMN IF NOT EXISTS confirmation_token_hash CHAR(64);
ALTER TABLE newsletter ADD COLUMN IF NOT EXISTS confirmation_expires_at TIMESTAMPTZ;
ALTER TABLE newsletter ADD COLUMN IF NOT EXISTS confirmed_at TIMESTAMPTZ;
ALTER TABLE newsletter ADD COLUMN IF NOT EXISTS consent_notice TEXT NOT NULL DEFAULT '';

CREATE UNIQUE INDEX IF NOT EXISTS newsletter_confirmation_token_uidx
  ON newsletter (confirmation_token_hash)
  WHERE confirmation_token_hash IS NOT NULL;

CREATE INDEX IF NOT EXISTS newsletter_unsubscribed_retention_idx
  ON newsletter (unsubscribed_at)
  WHERE status = 'unsubscribed';

-- Date of birth was collected for a vague future promotion and was not
-- necessary for an account. Stop retaining legacy preview data as well.
UPDATE users SET birth_date = '' WHERE birth_date <> '';
