DROP TABLE IF EXISTS review_helpful_votes;

DROP INDEX IF EXISTS review_replies_review_uniq;
DROP TABLE IF EXISTS review_replies;

DROP INDEX IF EXISTS reviews_moderation_status_idx;
DROP INDEX IF EXISTS reviews_order_item_uniq;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM reviews WHERE status IN ('flagged', 'removed')) THEN
    RAISE EXCEPTION
      'Cannot roll back 032: reviews with status flagged/removed exist. Resolve them (approve/reject/delete) first.';
  END IF;
END $$;

ALTER TABLE reviews DROP CONSTRAINT IF EXISTS reviews_status_check;
ALTER TABLE reviews ADD CONSTRAINT reviews_status_check
  CHECK (status IN ('pending', 'approved', 'rejected'));

ALTER TABLE reviews DROP COLUMN IF EXISTS updated_at;
ALTER TABLE reviews DROP COLUMN IF EXISTS helpful_count;
ALTER TABLE reviews DROP COLUMN IF EXISTS moderated_at;
ALTER TABLE reviews DROP COLUMN IF EXISTS moderated_by;
ALTER TABLE reviews DROP COLUMN IF EXISTS moderation_reason;
ALTER TABLE reviews DROP COLUMN IF EXISTS is_verified_purchase;
ALTER TABLE reviews DROP COLUMN IF EXISTS order_item_id;
ALTER TABLE reviews DROP COLUMN IF EXISTS order_id;
