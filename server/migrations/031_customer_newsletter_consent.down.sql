DROP INDEX IF EXISTS newsletter_status_idx;

ALTER TABLE newsletter DROP COLUMN IF EXISTS consent_policy_version;
ALTER TABLE newsletter DROP COLUMN IF EXISTS unsubscribed_at;
ALTER TABLE newsletter DROP COLUMN IF EXISTS consented_at;
ALTER TABLE newsletter DROP COLUMN IF EXISTS status;

ALTER TABLE users DROP COLUMN IF EXISTS active;
