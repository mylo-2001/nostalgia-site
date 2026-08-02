-- Admin-composed announcements (mass email) with a delivery record.
--
-- Two deliberately separate kinds, because they rest on different legal bases:
--
--   'service'   — security / operational notices (e.g. "phishing emails are
--                 circulating using our name", holiday closures, shipping
--                 delays). Sent to account holders under legitimate interest:
--                 it concerns a service they actively hold with us. Must carry
--                 NO promotional content.
--   'marketing' — anything promotional. Only ever to recipients with a
--                 recorded newsletter consent (newsletter.status =
--                 'subscribed'), always with an unsubscribe link.
--
-- The row is written BEFORE sending and updated after, so a crash mid-send
-- still leaves evidence of what went out and to how many — which is the whole
-- point of keeping a record for a marketing/consent audit.

CREATE TABLE IF NOT EXISTS announcements (
  id               TEXT PRIMARY KEY,
  kind             TEXT NOT NULL CHECK (kind IN ('service', 'marketing')),
  subject          TEXT NOT NULL,
  body             TEXT NOT NULL,
  -- Which audience was requested, kept verbatim for the audit trail even if
  -- the segment definitions later change.
  segments         JSONB NOT NULL DEFAULT '[]'::jsonb,
  status           TEXT NOT NULL DEFAULT 'draft'
                     CHECK (status IN ('draft', 'sending', 'sent', 'failed')),
  recipient_count  INTEGER NOT NULL DEFAULT 0,
  sent_count       INTEGER NOT NULL DEFAULT 0,
  failed_count     INTEGER NOT NULL DEFAULT 0,
  -- First few failures, for a readable "12 failed" drill-down in the admin.
  failures         JSONB NOT NULL DEFAULT '[]'::jsonb,
  created_by       TEXT,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  sent_at          TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS announcements_created_idx ON announcements (created_at DESC);
