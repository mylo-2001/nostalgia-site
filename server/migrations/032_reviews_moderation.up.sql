-- Reviews moderation overhaul: verified-purchase linkage, content-neutral
-- rejection reasons, a proper flagged/removed lifecycle (audit trail instead
-- of hard delete), store replies, and "helpful" votes.
--
-- The existing "Verified purchase" badge in the storefront (js/review-page.js,
-- js/reviews-page.js) is rendered UNCONDITIONALLY today — there is no
-- is_verified_purchase column to gate it on. This migration adds the column;
-- the client is fixed separately to only show the badge when it's true.

ALTER TABLE reviews ADD COLUMN IF NOT EXISTS order_id TEXT;
ALTER TABLE reviews ADD COLUMN IF NOT EXISTS order_item_id TEXT;
ALTER TABLE reviews ADD COLUMN IF NOT EXISTS is_verified_purchase BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE reviews ADD COLUMN IF NOT EXISTS moderation_reason TEXT;
ALTER TABLE reviews ADD COLUMN IF NOT EXISTS moderated_by TEXT;
ALTER TABLE reviews ADD COLUMN IF NOT EXISTS moderated_at TIMESTAMPTZ;
ALTER TABLE reviews ADD COLUMN IF NOT EXISTS helpful_count INTEGER NOT NULL DEFAULT 0;
ALTER TABLE reviews ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT now();

-- Widen the status lifecycle: 'flagged' (needs a closer look, stays hidden
-- like pending) and 'removed' (was published, later taken down for a
-- specific, recorded reason — never a silent hard delete).
ALTER TABLE reviews DROP CONSTRAINT IF EXISTS reviews_status_check;
ALTER TABLE reviews ADD CONSTRAINT reviews_status_check
  CHECK (status IN ('pending', 'approved', 'rejected', 'flagged', 'removed'));

-- One review per purchased order item — the actual duplicate-review guard.
CREATE UNIQUE INDEX IF NOT EXISTS reviews_order_item_uniq
  ON reviews (order_item_id) WHERE order_item_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS reviews_moderation_status_idx ON reviews (status, created_at DESC);

-- A public store reply to a review. One reply per review keeps this simple
-- (edit in place rather than threading) and matches "μία δημόσια απάντηση".
CREATE TABLE IF NOT EXISTS review_replies (
  id         BIGSERIAL PRIMARY KEY,
  review_id  TEXT NOT NULL REFERENCES reviews(id) ON DELETE CASCADE,
  admin_id   TEXT,
  body       TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS review_replies_review_uniq ON review_replies (review_id);

-- Lightweight "was this helpful" dedup — keyed by an anonymous per-browser
-- voter id (no account needed), just enough to stop trivial repeat-clicking.
CREATE TABLE IF NOT EXISTS review_helpful_votes (
  review_id  TEXT NOT NULL REFERENCES reviews(id) ON DELETE CASCADE,
  voter_key  TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (review_id, voter_key)
);
