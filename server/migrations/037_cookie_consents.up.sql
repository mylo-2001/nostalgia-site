-- Server-side record of cookie-banner choices.
--
-- The banner already stores the visitor's decision in localStorage, which is
-- what the browser needs to honour it. That is not evidence: it lives on the
-- visitor's machine, disappears when they clear the browser, and cannot be
-- produced if the DPA asks us to demonstrate consent (GDPR art. 7(1) —
-- "the controller shall be able to demonstrate that the data subject has
-- consented").
--
-- Deliberately minimal. Proving consent needs the choice, the moment, and the
-- version of the policy that was shown — not an identity. So:
--   * visitor_id is a random value the browser generates for itself. It is not
--     derived from anything about the person and is never linked to an account.
--   * ip_hash is a salted hash, never the address. Enough to show two records
--     came from the same origin during a dispute; useless for tracking anyone.
-- Collecting less here is the point: a consent log that becomes its own
-- privacy problem defeats its purpose.

CREATE TABLE IF NOT EXISTS cookie_consents (
  id              BIGSERIAL PRIMARY KEY,
  -- Random per-browser id, stored alongside the choice in localStorage.
  visitor_id      TEXT NOT NULL,
  analytics       BOOLEAN NOT NULL,
  marketing       BOOLEAN NOT NULL,
  -- Which wording the visitor actually agreed to. Bump the app-side constant
  -- whenever the banner text or the categories change; old records then stay
  -- honest about what was shown at the time.
  policy_version  TEXT NOT NULL DEFAULT 'v1',
  -- 'banner' (first choice), 'settings' (changed later), 'revoked'.
  source          TEXT NOT NULL DEFAULT 'banner',
  ip_hash         TEXT,
  user_agent      TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- The common lookup is "what did this browser last choose".
CREATE INDEX IF NOT EXISTS cookie_consents_visitor_idx
  ON cookie_consents (visitor_id, created_at DESC);

CREATE INDEX IF NOT EXISTS cookie_consents_created_idx
  ON cookie_consents (created_at DESC);
