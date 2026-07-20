ALTER TABLE pricing_policies
  ADD COLUMN reservation_ttl_seconds INTEGER NOT NULL DEFAULT 3600
             CHECK (reservation_ttl_seconds BETWEEN 60 AND 86400),
  ADD COLUMN reservation_expiry_batch_size INTEGER NOT NULL DEFAULT 100
             CHECK (reservation_expiry_batch_size BETWEEN 1 AND 1000);

CREATE TABLE inventory_reservation_groups (
  group_key    CHAR(64) PRIMARY KEY CHECK (group_key ~ '^[0-9a-f]{64}$'),
  order_id     TEXT NOT NULL REFERENCES orders(id) ON DELETE RESTRICT,
  request_hash CHAR(64) NOT NULL CHECK (request_hash ~ '^[0-9a-f]{64}$'),
  status       TEXT NOT NULL DEFAULT 'active'
               CHECK (status IN ('active', 'consumed', 'released', 'expired')),
  expires_at   TIMESTAMPTZ NOT NULL,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at   TIMESTAMPTZ,
  CHECK (expires_at > created_at)
);

ALTER TABLE inventory_reservations
  ADD COLUMN reservation_group_key CHAR(64)
             REFERENCES inventory_reservation_groups(group_key) ON DELETE RESTRICT,
  ADD COLUMN version INTEGER NOT NULL DEFAULT 1 CHECK (version > 0),
  ADD COLUMN metadata JSONB NOT NULL DEFAULT '{}'::jsonb
             CHECK (jsonb_typeof(metadata) = 'object'),
  ADD COLUMN updated_at TIMESTAMPTZ;

ALTER TABLE inventory_reservations
  ADD CONSTRAINT inventory_reservations_group_key_phase4_check CHECK (
    reservation_group_key IS NULL OR reservation_group_key ~ '^[0-9a-f]{64}$'
  );

ALTER TABLE inventory_movements
  ADD COLUMN stock_on_hand_after INTEGER,
  ADD COLUMN reserved_quantity_after INTEGER,
  ADD COLUMN metadata JSONB NOT NULL DEFAULT '{}'::jsonb
             CHECK (jsonb_typeof(metadata) = 'object');

ALTER TABLE inventory_movements
  ADD CONSTRAINT inventory_movements_balances_phase4_check CHECK (
    (stock_on_hand_after IS NULL OR stock_on_hand_after >= 0)
    AND (reserved_quantity_after IS NULL OR reserved_quantity_after >= 0)
    AND (
      stock_on_hand_after IS NULL
      OR reserved_quantity_after IS NULL
      OR reserved_quantity_after <= stock_on_hand_after
    )
  );

ALTER TABLE inventory_reservation_groups ENABLE ROW LEVEL SECURITY;

DO $$
DECLARE
  role_name TEXT;
BEGIN
  FOREACH role_name IN ARRAY ARRAY['anon', 'authenticated'] LOOP
    IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = role_name) THEN
      EXECUTE format(
        'REVOKE ALL PRIVILEGES ON TABLE inventory_reservation_groups FROM %I',
        role_name
      );
    END IF;
  END LOOP;
END;
$$;

CREATE OR REPLACE FUNCTION nostalgia_validate_inventory_reservation_transition()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = pg_catalog
AS $$
BEGIN
  IF OLD.status IS DISTINCT FROM NEW.status THEN
    IF OLD.status <> 'active'
       OR NEW.status NOT IN ('consumed', 'released', 'expired')
    THEN
      RAISE EXCEPTION 'Invalid inventory reservation transition: % -> %',
        OLD.status, NEW.status USING ERRCODE = '23514';
    END IF;
  END IF;

  IF NEW.status = 'consumed' AND NEW.consumed_at IS NULL THEN
    RAISE EXCEPTION 'Consumed reservation requires consumed_at'
      USING ERRCODE = '23514';
  END IF;
  IF NEW.status IN ('released', 'expired') AND NEW.released_at IS NULL THEN
    RAISE EXCEPTION 'Released reservation requires released_at'
      USING ERRCODE = '23514';
  END IF;
  IF NEW.version < OLD.version THEN
    RAISE EXCEPTION 'Reservation version cannot decrease'
      USING ERRCODE = '23514';
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER inventory_reservations_phase4_state_guard
  BEFORE UPDATE ON inventory_reservations
  FOR EACH ROW EXECUTE FUNCTION nostalgia_validate_inventory_reservation_transition();

REVOKE EXECUTE ON FUNCTION nostalgia_validate_inventory_reservation_transition() FROM PUBLIC;

DO $$
DECLARE
  role_name TEXT;
BEGIN
  FOREACH role_name IN ARRAY ARRAY['anon', 'authenticated'] LOOP
    IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = role_name) THEN
      EXECUTE format(
        'REVOKE EXECUTE ON FUNCTION nostalgia_validate_inventory_reservation_transition() FROM %I',
        role_name
      );
    END IF;
  END LOOP;
END;
$$;

COMMENT ON COLUMN inventory_reservations.reservation_group_key IS
  'SHA-256 idempotency group key. Never store a browser idempotency key in plaintext.';
COMMENT ON TABLE inventory_reservation_groups IS
  'Idempotent reservation operation, including orders whose inventory is not tracked.';
COMMENT ON COLUMN inventory_movements.stock_on_hand_after IS
  'Balance snapshot written in the same transaction as the movement.';
