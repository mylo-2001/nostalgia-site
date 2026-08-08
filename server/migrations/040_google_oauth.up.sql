-- Sign in with Google.
--
-- A password account and a Google account for the same person share one row.
-- Anything else and a customer who signed up with a password, then later used
-- the Google button, would find their order history gone.
--
-- google_sub is Google's stable subject identifier. Email alone is not enough
-- as the durable link: a Google account's email can be changed by its owner,
-- and matching on it would silently orphan that customer's orders. Email is
-- only the first bridge — once linked, the sub is what identifies them.
--
-- pass_hash and birth_date deliberately stay NOT NULL. The existing register
-- flow already writes '' for an unknown birth date, and auth.verifyPassword
-- returns false for an empty stored hash, so a Google row carrying
-- pass_hash = '' cannot be signed into with a password at all. Relaxing the
-- constraints would buy nothing and weaken the table.

ALTER TABLE users ADD COLUMN IF NOT EXISTS google_sub TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS auth_provider TEXT NOT NULL DEFAULT 'password';

-- Partial: many rows legitimately have no google_sub, and only the non-null
-- ones must be unique.
CREATE UNIQUE INDEX IF NOT EXISTS users_google_sub_uidx
  ON users (google_sub)
  WHERE google_sub IS NOT NULL;
