-- Refuse to drop a log that is the only evidence of what visitors agreed to.
-- Clear it deliberately first if you really mean to lose it.
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM cookie_consents LIMIT 1) THEN
    RAISE EXCEPTION
      'cookie_consents still holds consent records — export or delete them before rolling back';
  END IF;
END $$;

DROP INDEX IF EXISTS cookie_consents_created_idx;
DROP INDEX IF EXISTS cookie_consents_visitor_idx;
DROP TABLE IF EXISTS cookie_consents;
