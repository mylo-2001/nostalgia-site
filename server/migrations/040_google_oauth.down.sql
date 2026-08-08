-- Reverses 040_google_oauth.
--
-- Dropping google_sub unlinks any account that was created through Google.
-- Those rows keep their email and orders but, with pass_hash = '', become
-- unreachable: no password works and the Google link is gone. Re-running the
-- up migration does not restore the link either — the sub is not recoverable
-- from anything left behind. Export google_sub before rolling this back if
-- any Google account exists.

DROP INDEX IF EXISTS users_google_sub_uidx;

ALTER TABLE users DROP COLUMN IF EXISTS auth_provider;
ALTER TABLE users DROP COLUMN IF EXISTS google_sub;
