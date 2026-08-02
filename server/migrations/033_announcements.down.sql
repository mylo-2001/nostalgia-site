-- Refuse to drop a table that still holds delivery evidence: the announcement
-- log is the record of what marketing/service mail actually went out, which is
-- exactly what a consent audit asks for. Clear it deliberately first if you
-- really mean to lose it.
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM announcements WHERE status = 'sent') THEN
    RAISE EXCEPTION
      'announcements still contains sent campaigns — export or delete them before rolling back';
  END IF;
END $$;

DROP INDEX IF EXISTS announcements_created_idx;
DROP TABLE IF EXISTS announcements;
