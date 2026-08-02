-- Customer account status + newsletter consent trail.
--
-- Newsletter: previously a bare (email, name, source, created_at) row with no
-- record of WHEN/HOW consent was given, and "removing" a subscriber meant a
-- hard DELETE (so a later re-signup looked identical to a first-time one).
-- Adds an explicit subscribed/unsubscribed status with timestamps, so opt-in
-- and opt-out history is actually auditable (GDPR / Greek DPA marketing
-- consent record-keeping).

ALTER TABLE users ADD COLUMN IF NOT EXISTS active BOOLEAN NOT NULL DEFAULT TRUE;

ALTER TABLE newsletter ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'subscribed'
  CHECK (status IN ('subscribed', 'unsubscribed'));
ALTER TABLE newsletter ADD COLUMN IF NOT EXISTS consented_at TIMESTAMPTZ;
ALTER TABLE newsletter ADD COLUMN IF NOT EXISTS unsubscribed_at TIMESTAMPTZ;
ALTER TABLE newsletter ADD COLUMN IF NOT EXISTS consent_policy_version TEXT NOT NULL DEFAULT 'v1';

-- Backfill: every existing row's original signup time becomes its consent
-- timestamp (best available evidence at migration time).
UPDATE newsletter SET consented_at = created_at WHERE consented_at IS NULL;

CREATE INDEX IF NOT EXISTS newsletter_status_idx ON newsletter (status);
