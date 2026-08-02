CREATE TABLE IF NOT EXISTS marketing_campaigns (
  id UUID PRIMARY KEY,
  event_id TEXT NOT NULL UNIQUE,
  kind TEXT NOT NULL CHECK (kind IN ('new_product', 'sale', 'coupon')),
  source_id TEXT NOT NULL,
  subject TEXT NOT NULL,
  snapshot JSONB NOT NULL,
  audience JSONB NOT NULL,
  status TEXT NOT NULL DEFAULT 'queued' CHECK (status IN ('queued', 'sending', 'sent', 'partial', 'failed')),
  recipient_count INTEGER NOT NULL DEFAULT 0,
  sent_count INTEGER NOT NULL DEFAULT 0,
  failed_count INTEGER NOT NULL DEFAULT 0,
  created_by TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  started_at TIMESTAMPTZ,
  finished_at TIMESTAMPTZ
);

ALTER TABLE promotions ADD COLUMN IF NOT EXISTS send_marketing_email BOOLEAN NOT NULL DEFAULT FALSE;

CREATE TABLE IF NOT EXISTS marketing_campaign_recipients (
  id BIGSERIAL PRIMARY KEY,
  campaign_id UUID NOT NULL REFERENCES marketing_campaigns(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  firstname TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL DEFAULT 'queued' CHECK (status IN ('queued', 'sending', 'sent', 'failed')),
  attempts INTEGER NOT NULL DEFAULT 0,
  last_error TEXT,
  sent_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (campaign_id, email)
);

CREATE INDEX IF NOT EXISTS marketing_campaign_recipients_ready_idx
  ON marketing_campaign_recipients (campaign_id, status, id);
CREATE INDEX IF NOT EXISTS marketing_campaigns_created_idx
  ON marketing_campaigns (created_at DESC);
