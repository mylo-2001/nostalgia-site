ALTER TABLE orders
  ADD COLUMN IF NOT EXISTS order_status_v2 TEXT,
  ADD COLUMN IF NOT EXISTS payment_status_v2 TEXT,
  ADD COLUMN IF NOT EXISTS shipping_status_v2 TEXT,
  ADD COLUMN IF NOT EXISTS payment_method_v2 TEXT,
  ADD COLUMN IF NOT EXISTS currency TEXT,
  ADD COLUMN IF NOT EXISTS subtotal NUMERIC(14,2),
  ADD COLUMN IF NOT EXISTS discount_total NUMERIC(14,2),
  ADD COLUMN IF NOT EXISTS shipping_total NUMERIC(14,2),
  ADD COLUMN IF NOT EXISTS cod_fee NUMERIC(14,2),
  ADD COLUMN IF NOT EXISTS vat_total NUMERIC(14,2),
  ADD COLUMN IF NOT EXISTS other_charges_total NUMERIC(14,2),
  ADD COLUMN IF NOT EXISTS grand_total NUMERIC(14,2),
  ADD COLUMN IF NOT EXISTS tax_included BOOLEAN,
  ADD COLUMN IF NOT EXISTS shipping_method_id TEXT,
  ADD COLUMN IF NOT EXISTS billing_address_snapshot JSONB,
  ADD COLUMN IF NOT EXISTS shipping_address_snapshot JSONB,
  ADD COLUMN IF NOT EXISTS guest_access_token_hash CHAR(64),
  ADD COLUMN IF NOT EXISTS version INTEGER NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS request_id TEXT,
  ADD COLUMN IF NOT EXISTS confirmed_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS cancelled_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS completed_at TIMESTAMPTZ;

ALTER TABLE orders
  ADD CONSTRAINT orders_order_status_v2_check CHECK (
    order_status_v2 IS NULL OR order_status_v2 IN (
      'draft', 'pending', 'confirmed', 'processing', 'ready_to_ship',
      'completed', 'cancelled', 'requires_review'
    )
  ),
  ADD CONSTRAINT orders_payment_status_v2_check CHECK (
    payment_status_v2 IS NULL OR payment_status_v2 IN (
      'pending', 'authorized', 'paid', 'failed', 'cancelled',
      'partially_refunded', 'refunded', 'cod_pending', 'cod_collected'
    )
  ),
  ADD CONSTRAINT orders_shipping_status_v2_check CHECK (
    shipping_status_v2 IS NULL OR shipping_status_v2 IN (
      'not_ready', 'ready', 'label_created', 'handed_to_courier',
      'in_transit', 'delivered', 'delivery_failed', 'returning', 'returned'
    )
  ),
  ADD CONSTRAINT orders_payment_method_v2_check CHECK (
    payment_method_v2 IS NULL OR payment_method_v2 IN ('card', 'cod')
  ),
  ADD CONSTRAINT orders_currency_v2_check CHECK (
    currency IS NULL OR currency ~ '^[A-Z]{3}$'
  ),
  ADD CONSTRAINT orders_amounts_v2_check CHECK (
    (subtotal IS NULL OR subtotal >= 0) AND
    (discount_total IS NULL OR discount_total >= 0) AND
    (shipping_total IS NULL OR shipping_total >= 0) AND
    (cod_fee IS NULL OR cod_fee >= 0) AND
    (vat_total IS NULL OR vat_total >= 0) AND
    (other_charges_total IS NULL OR other_charges_total >= 0) AND
    (grand_total IS NULL OR grand_total >= 0)
  ),
  ADD CONSTRAINT orders_version_v2_check CHECK (version > 0),
  ADD CONSTRAINT orders_guest_token_hash_v2_check CHECK (
    guest_access_token_hash IS NULL OR guest_access_token_hash ~ '^[0-9a-f]{64}$'
  );

CREATE TABLE admin_users (
  id                     UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  username               TEXT NOT NULL,
  email                  TEXT,
  display_name           TEXT NOT NULL DEFAULT '',
  password_hash          TEXT,
  totp_secret_ciphertext BYTEA,
  totp_enabled           BOOLEAN NOT NULL DEFAULT FALSE,
  requires_2fa           BOOLEAN NOT NULL DEFAULT TRUE,
  status                 TEXT NOT NULL DEFAULT 'active'
                         CHECK (status IN ('active', 'suspended', 'disabled')),
  version                INTEGER NOT NULL DEFAULT 1 CHECK (version > 0),
  last_login_at          TIMESTAMPTZ,
  password_changed_at    TIMESTAMPTZ,
  created_at             TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at             TIMESTAMPTZ
);

CREATE TABLE admin_roles (
  code        TEXT PRIMARY KEY CHECK (code IN (
    'administrator', 'order_manager', 'warehouse',
    'customer_support', 'accounting', 'read_only'
  )),
  description TEXT NOT NULL DEFAULT '',
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

INSERT INTO admin_roles (code, description) VALUES
  ('administrator', 'Full administrative access'),
  ('order_manager', 'Order lifecycle management'),
  ('warehouse', 'Inventory and shipment operations'),
  ('customer_support', 'Customer support and limited order access'),
  ('accounting', 'Payments, refunds and fiscal documents'),
  ('read_only', 'Read-only operational access');

CREATE TABLE admin_user_roles (
  admin_user_id UUID NOT NULL REFERENCES admin_users(id) ON DELETE RESTRICT,
  role_code     TEXT NOT NULL REFERENCES admin_roles(code) ON DELETE RESTRICT,
  granted_by   UUID REFERENCES admin_users(id) ON DELETE RESTRICT,
  granted_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (admin_user_id, role_code)
);

CREATE TABLE admin_sessions (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  admin_user_id     UUID NOT NULL REFERENCES admin_users(id) ON DELETE RESTRICT,
  token_hash        CHAR(64) NOT NULL UNIQUE CHECK (token_hash ~ '^[0-9a-f]{64}$'),
  csrf_secret_hash  CHAR(64) CHECK (
    csrf_secret_hash IS NULL OR csrf_secret_hash ~ '^[0-9a-f]{64}$'
  ),
  ip_address        INET,
  user_agent        TEXT,
  expires_at        TIMESTAMPTZ NOT NULL,
  last_seen_at      TIMESTAMPTZ,
  revoked_at        TIMESTAMPTZ,
  revoke_reason     TEXT,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  CHECK (expires_at > created_at)
);

CREATE TABLE order_items (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id            TEXT NOT NULL REFERENCES orders(id) ON DELETE RESTRICT,
  line_number         INTEGER NOT NULL CHECK (line_number > 0),
  product_id          TEXT NOT NULL,
  variant_id          TEXT,
  product_name        TEXT NOT NULL,
  variant_name        TEXT,
  sku                 TEXT,
  quantity            INTEGER NOT NULL CHECK (quantity > 0),
  unit_price          NUMERIC(14,2),
  original_unit_price NUMERIC(14,2),
  discount_amount     NUMERIC(14,2),
  vat_rate            NUMERIC(7,4),
  vat_amount          NUMERIC(14,2),
  line_subtotal       NUMERIC(14,2),
  line_total          NUMERIC(14,2),
  currency            TEXT,
  snapshot_quality    TEXT NOT NULL DEFAULT 'complete'
                      CHECK (snapshot_quality IN ('complete', 'legacy_partial')),
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (order_id, line_number),
  CHECK (currency IS NULL OR currency ~ '^[A-Z]{3}$'),
  CHECK (unit_price IS NULL OR unit_price >= 0),
  CHECK (original_unit_price IS NULL OR original_unit_price >= 0),
  CHECK (discount_amount IS NULL OR discount_amount >= 0),
  CHECK (vat_rate IS NULL OR (vat_rate >= 0 AND vat_rate <= 100)),
  CHECK (vat_amount IS NULL OR vat_amount >= 0),
  CHECK (line_subtotal IS NULL OR line_subtotal >= 0),
  CHECK (line_total IS NULL OR line_total >= 0),
  CHECK (
    snapshot_quality = 'legacy_partial' OR (
      btrim(product_name) <> '' AND btrim(COALESCE(sku, '')) <> '' AND
      unit_price IS NOT NULL AND original_unit_price IS NOT NULL AND
      discount_amount IS NOT NULL AND vat_rate IS NOT NULL AND
      vat_amount IS NOT NULL AND line_subtotal IS NOT NULL AND
      line_total IS NOT NULL AND currency IS NOT NULL
    )
  )
);

CREATE TABLE payments (
  id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id                TEXT NOT NULL REFERENCES orders(id) ON DELETE RESTRICT,
  attempt                 INTEGER NOT NULL CHECK (attempt > 0),
  provider                TEXT NOT NULL,
  payment_method          TEXT NOT NULL CHECK (payment_method IN ('card', 'cod')),
  status                  TEXT NOT NULL CHECK (status IN (
    'pending', 'authorized', 'paid', 'failed', 'cancelled',
    'partially_refunded', 'refunded', 'cod_pending', 'cod_collected'
  )),
  amount                  NUMERIC(14,2) NOT NULL CHECK (amount >= 0),
  currency                TEXT NOT NULL CHECK (currency ~ '^[A-Z]{3}$'),
  provider_customer_id    TEXT,
  provider_session_id     TEXT,
  provider_transaction_id TEXT,
  failure_code            TEXT,
  failure_message         TEXT,
  metadata                JSONB NOT NULL DEFAULT '{}'::jsonb,
  version                 INTEGER NOT NULL DEFAULT 1 CHECK (version > 0),
  authorized_at           TIMESTAMPTZ,
  paid_at                 TIMESTAMPTZ,
  cancelled_at            TIMESTAMPTZ,
  created_at              TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at              TIMESTAMPTZ,
  UNIQUE (order_id, attempt)
);

CREATE TABLE payment_events (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  provider          TEXT NOT NULL,
  provider_event_id TEXT NOT NULL,
  event_type        TEXT NOT NULL,
  payment_id        UUID REFERENCES payments(id) ON DELETE RESTRICT,
  order_id          TEXT REFERENCES orders(id) ON DELETE RESTRICT,
  signature_verified BOOLEAN NOT NULL DEFAULT FALSE,
  raw_event         JSONB NOT NULL,
  raw_event_sha256  CHAR(64) NOT NULL CHECK (raw_event_sha256 ~ '^[0-9a-f]{64}$'),
  processing_status TEXT NOT NULL DEFAULT 'received'
                    CHECK (processing_status IN ('received', 'processed', 'ignored', 'failed')),
  attempts          INTEGER NOT NULL DEFAULT 0 CHECK (attempts >= 0),
  last_error        TEXT,
  received_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  processed_at      TIMESTAMPTZ,
  UNIQUE (provider, provider_event_id)
);

CREATE TABLE shipments (
  id                        UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id                  TEXT NOT NULL REFERENCES orders(id) ON DELETE RESTRICT,
  shipment_number           INTEGER NOT NULL DEFAULT 1 CHECK (shipment_number > 0),
  status                    TEXT NOT NULL DEFAULT 'not_ready' CHECK (status IN (
    'not_ready', 'ready', 'label_created', 'handed_to_courier',
    'in_transit', 'delivered', 'delivery_failed', 'returning', 'returned'
  )),
  shipping_method_id        TEXT,
  carrier                   TEXT,
  tracking_number           TEXT,
  shipping_address_snapshot JSONB NOT NULL,
  version                   INTEGER NOT NULL DEFAULT 1 CHECK (version > 0),
  label_created_at          TIMESTAMPTZ,
  handed_to_courier_at      TIMESTAMPTZ,
  delivered_at              TIMESTAMPTZ,
  created_at                TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at                TIMESTAMPTZ,
  UNIQUE (order_id, shipment_number)
);

CREATE TABLE inventory (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id          TEXT NOT NULL,
  variant_id          TEXT,
  sku                 TEXT,
  tracks_stock        BOOLEAN NOT NULL DEFAULT TRUE,
  stock_on_hand       INTEGER NOT NULL DEFAULT 0 CHECK (stock_on_hand >= 0),
  reserved_quantity   INTEGER NOT NULL DEFAULT 0 CHECK (reserved_quantity >= 0),
  available_quantity  INTEGER GENERATED ALWAYS AS (stock_on_hand - reserved_quantity) STORED,
  low_stock_threshold INTEGER NOT NULL DEFAULT 0 CHECK (low_stock_threshold >= 0),
  version             INTEGER NOT NULL DEFAULT 1 CHECK (version > 0),
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at          TIMESTAMPTZ,
  CHECK (reserved_quantity <= stock_on_hand)
);

CREATE TABLE inventory_reservations (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id       TEXT NOT NULL REFERENCES orders(id) ON DELETE RESTRICT,
  order_item_id  UUID REFERENCES order_items(id) ON DELETE RESTRICT,
  inventory_id   UUID NOT NULL REFERENCES inventory(id) ON DELETE RESTRICT,
  quantity       INTEGER NOT NULL CHECK (quantity > 0),
  status         TEXT NOT NULL DEFAULT 'active'
                 CHECK (status IN ('active', 'consumed', 'released', 'expired')),
  expires_at     TIMESTAMPTZ NOT NULL,
  consumed_at    TIMESTAMPTZ,
  released_at    TIMESTAMPTZ,
  release_reason TEXT,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  CHECK (expires_at > created_at),
  CHECK (status <> 'consumed' OR consumed_at IS NOT NULL),
  CHECK (status NOT IN ('released', 'expired') OR released_at IS NOT NULL)
);

CREATE TABLE inventory_movements (
  id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  inventory_id       UUID NOT NULL REFERENCES inventory(id) ON DELETE RESTRICT,
  order_id           TEXT REFERENCES orders(id) ON DELETE RESTRICT,
  reservation_id     UUID REFERENCES inventory_reservations(id) ON DELETE RESTRICT,
  movement_type      TEXT NOT NULL CHECK (movement_type IN (
    'reservation', 'reservation_release', 'sale', 'restock',
    'return_restock', 'adjustment', 'correction'
  )),
  stock_delta        INTEGER NOT NULL DEFAULT 0,
  reserved_delta     INTEGER NOT NULL DEFAULT 0,
  event_key          TEXT NOT NULL UNIQUE,
  reason             TEXT,
  actor_type         TEXT NOT NULL CHECK (actor_type IN ('system', 'admin', 'customer', 'guest')),
  actor_id           TEXT,
  source             TEXT NOT NULL,
  request_id         TEXT,
  created_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
  CHECK (stock_delta <> 0 OR reserved_delta <> 0)
);

CREATE TABLE order_status_history (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id    TEXT NOT NULL REFERENCES orders(id) ON DELETE RESTRICT,
  axis        TEXT NOT NULL CHECK (axis IN ('order', 'payment', 'shipping')),
  from_status TEXT,
  to_status   TEXT NOT NULL,
  actor_type  TEXT NOT NULL CHECK (actor_type IN ('system', 'admin', 'customer', 'guest', 'provider')),
  actor_id    TEXT,
  reason      TEXT,
  metadata    JSONB NOT NULL DEFAULT '{}'::jsonb,
  source      TEXT NOT NULL,
  request_id  TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  CHECK (
    (axis = 'order' AND to_status IN (
      'draft', 'pending', 'confirmed', 'processing', 'ready_to_ship',
      'completed', 'cancelled', 'requires_review'
    )) OR
    (axis = 'payment' AND to_status IN (
      'pending', 'authorized', 'paid', 'failed', 'cancelled',
      'partially_refunded', 'refunded', 'cod_pending', 'cod_collected'
    )) OR
    (axis = 'shipping' AND to_status IN (
      'not_ready', 'ready', 'label_created', 'handed_to_courier',
      'in_transit', 'delivered', 'delivery_failed', 'returning', 'returned'
    ))
  ),
  CHECK (
    from_status IS NULL OR
    (axis = 'order' AND from_status IN (
      'draft', 'pending', 'confirmed', 'processing', 'ready_to_ship',
      'completed', 'cancelled', 'requires_review'
    )) OR
    (axis = 'payment' AND from_status IN (
      'pending', 'authorized', 'paid', 'failed', 'cancelled',
      'partially_refunded', 'refunded', 'cod_pending', 'cod_collected'
    )) OR
    (axis = 'shipping' AND from_status IN (
      'not_ready', 'ready', 'label_created', 'handed_to_courier',
      'in_transit', 'delivered', 'delivery_failed', 'returning', 'returned'
    ))
  )
);

CREATE TABLE audit_logs (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_type  TEXT NOT NULL CHECK (actor_type IN ('system', 'admin', 'customer', 'guest', 'provider')),
  actor_id    TEXT,
  action      TEXT NOT NULL,
  entity_type TEXT NOT NULL,
  entity_id   TEXT NOT NULL,
  old_values  JSONB,
  new_values  JSONB,
  source      TEXT NOT NULL,
  request_id  TEXT,
  ip_address  INET,
  user_agent  TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE returns (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id     TEXT NOT NULL REFERENCES orders(id) ON DELETE RESTRICT,
  status       TEXT NOT NULL DEFAULT 'requested' CHECK (status IN (
    'requested', 'approved', 'in_transit', 'received', 'inspected',
    'completed', 'rejected', 'cancelled'
  )),
  reason       TEXT,
  requested_by_type TEXT NOT NULL CHECK (
    requested_by_type IN ('admin', 'customer', 'guest', 'system')
  ),
  requested_by_id TEXT,
  version      INTEGER NOT NULL DEFAULT 1 CHECK (version > 0),
  approved_at  TIMESTAMPTZ,
  received_at  TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at   TIMESTAMPTZ
);

CREATE TABLE return_items (
  id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  return_id          UUID NOT NULL REFERENCES returns(id) ON DELETE RESTRICT,
  order_item_id      UUID NOT NULL REFERENCES order_items(id) ON DELETE RESTRICT,
  quantity           INTEGER NOT NULL CHECK (quantity > 0),
  reason             TEXT NOT NULL,
  condition          TEXT NOT NULL DEFAULT 'unknown'
                     CHECK (condition IN ('unknown', 'unopened', 'sellable', 'damaged', 'defective')),
  restock_decision   TEXT NOT NULL DEFAULT 'pending'
                     CHECK (restock_decision IN ('pending', 'restock', 'do_not_restock')),
  inspection_notes   TEXT,
  inspected_by       UUID REFERENCES admin_users(id) ON DELETE RESTRICT,
  inspected_at       TIMESTAMPTZ,
  restocked_at       TIMESTAMPTZ,
  inventory_movement_id UUID UNIQUE REFERENCES inventory_movements(id) ON DELETE RESTRICT,
  created_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (return_id, order_item_id),
  CHECK (restocked_at IS NULL OR restock_decision = 'restock')
);

CREATE TABLE refunds (
  id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id           TEXT NOT NULL REFERENCES orders(id) ON DELETE RESTRICT,
  payment_id         UUID NOT NULL REFERENCES payments(id) ON DELETE RESTRICT,
  return_id          UUID REFERENCES returns(id) ON DELETE RESTRICT,
  status             TEXT NOT NULL DEFAULT 'pending'
                     CHECK (status IN ('pending', 'processing', 'confirmed', 'failed', 'cancelled')),
  amount             NUMERIC(14,2) NOT NULL CHECK (amount > 0),
  currency           TEXT NOT NULL CHECK (currency ~ '^[A-Z]{3}$'),
  provider           TEXT NOT NULL,
  provider_refund_id TEXT,
  reason             TEXT,
  version            INTEGER NOT NULL DEFAULT 1 CHECK (version > 0),
  requested_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  confirmed_at       TIMESTAMPTZ,
  failed_at          TIMESTAMPTZ,
  updated_at         TIMESTAMPTZ
);

CREATE TABLE idempotency_keys (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  scope           TEXT NOT NULL,
  key_hash        CHAR(64) NOT NULL CHECK (key_hash ~ '^[0-9a-f]{64}$'),
  request_hash    CHAR(64) NOT NULL CHECK (request_hash ~ '^[0-9a-f]{64}$'),
  status          TEXT NOT NULL DEFAULT 'processing'
                  CHECK (status IN ('processing', 'completed', 'failed')),
  resource_type   TEXT,
  resource_id     TEXT,
  response_status INTEGER CHECK (response_status IS NULL OR response_status BETWEEN 100 AND 599),
  response_body   JSONB,
  expires_at      TIMESTAMPTZ NOT NULL,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  completed_at    TIMESTAMPTZ,
  UNIQUE (scope, key_hash),
  CHECK (expires_at > created_at)
);

CREATE TABLE risk_assessments (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id        TEXT NOT NULL REFERENCES orders(id) ON DELETE RESTRICT,
  risk_score      NUMERIC(7,2) NOT NULL CHECK (risk_score >= 0),
  risk_level      TEXT NOT NULL CHECK (risk_level IN ('low', 'medium', 'high')),
  reasons         JSONB NOT NULL DEFAULT '[]'::jsonb,
  rules_triggered JSONB NOT NULL DEFAULT '[]'::jsonb,
  decision        TEXT NOT NULL DEFAULT 'pending'
                  CHECK (decision IN ('pending', 'approved', 'rejected', 'card_required')),
  reviewed_by     UUID REFERENCES admin_users(id) ON DELETE RESTRICT,
  reviewed_at     TIMESTAMPTZ,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  CHECK ((reviewed_by IS NULL) = (reviewed_at IS NULL))
);

CREATE TABLE notification_outbox (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_key      TEXT NOT NULL UNIQUE,
  event_type     TEXT NOT NULL CHECK (event_type IN (
    'order_created', 'payment_confirmed', 'payment_failed', 'order_shipped',
    'tracking_added', 'order_cancelled', 'return_approved', 'refund_confirmed'
  )),
  aggregate_type TEXT NOT NULL,
  aggregate_id   TEXT NOT NULL,
  payload        JSONB NOT NULL,
  status         TEXT NOT NULL DEFAULT 'pending'
                 CHECK (status IN ('pending', 'processing', 'sent', 'failed')),
  attempts       INTEGER NOT NULL DEFAULT 0 CHECK (attempts >= 0),
  last_error     TEXT,
  next_retry_at  TIMESTAMPTZ,
  locked_at      TIMESTAMPTZ,
  locked_by      TEXT,
  sent_at        TIMESTAMPTZ,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at     TIMESTAMPTZ
);

CREATE TABLE fiscal_documents (
  id                   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id             TEXT NOT NULL REFERENCES orders(id) ON DELETE RESTRICT,
  refund_id            UUID REFERENCES refunds(id) ON DELETE RESTRICT,
  return_id            UUID REFERENCES returns(id) ON DELETE RESTRICT,
  document_type        TEXT NOT NULL CHECK (document_type IN (
    'retail_receipt', 'invoice', 'credit_note', 'document_cancellation'
  )),
  status               TEXT NOT NULL DEFAULT 'pending'
                       CHECK (status IN ('pending', 'issued', 'failed', 'cancelled')),
  provider             TEXT,
  provider_document_id TEXT,
  document_number      TEXT,
  payload              JSONB NOT NULL DEFAULT '{}'::jsonb,
  issued_at            TIMESTAMPTZ,
  created_at           TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at           TIMESTAMPTZ
);

CREATE OR REPLACE FUNCTION nostalgia_prevent_append_only_mutation()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = pg_catalog
AS $$
BEGIN
  IF current_setting('app.allow_append_only_mutation', true) = 'on' THEN
    IF TG_OP = 'DELETE' THEN RETURN OLD; END IF;
    RETURN NEW;
  END IF;
  RAISE EXCEPTION '% is append-only; % is not allowed', TG_TABLE_NAME, TG_OP
    USING ERRCODE = '55000';
END;
$$;

CREATE TRIGGER order_items_append_only
  BEFORE UPDATE OR DELETE ON order_items
  FOR EACH ROW EXECUTE FUNCTION nostalgia_prevent_append_only_mutation();
CREATE TRIGGER inventory_movements_append_only
  BEFORE UPDATE OR DELETE ON inventory_movements
  FOR EACH ROW EXECUTE FUNCTION nostalgia_prevent_append_only_mutation();
CREATE TRIGGER order_status_history_append_only
  BEFORE UPDATE OR DELETE ON order_status_history
  FOR EACH ROW EXECUTE FUNCTION nostalgia_prevent_append_only_mutation();
CREATE TRIGGER audit_logs_append_only
  BEFORE UPDATE OR DELETE ON audit_logs
  FOR EACH ROW EXECUTE FUNCTION nostalgia_prevent_append_only_mutation();

REVOKE EXECUTE ON FUNCTION nostalgia_prevent_append_only_mutation() FROM PUBLIC;

ALTER TABLE admin_users ENABLE ROW LEVEL SECURITY;
ALTER TABLE admin_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE admin_user_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE admin_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE order_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE payment_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE shipments ENABLE ROW LEVEL SECURITY;
ALTER TABLE inventory ENABLE ROW LEVEL SECURITY;
ALTER TABLE inventory_reservations ENABLE ROW LEVEL SECURITY;
ALTER TABLE inventory_movements ENABLE ROW LEVEL SECURITY;
ALTER TABLE order_status_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE returns ENABLE ROW LEVEL SECURITY;
ALTER TABLE return_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE refunds ENABLE ROW LEVEL SECURITY;
ALTER TABLE idempotency_keys ENABLE ROW LEVEL SECURITY;
ALTER TABLE risk_assessments ENABLE ROW LEVEL SECURITY;
ALTER TABLE notification_outbox ENABLE ROW LEVEL SECURITY;
ALTER TABLE fiscal_documents ENABLE ROW LEVEL SECURITY;

DO $$
DECLARE
  role_name TEXT;
  table_name TEXT;
  protected_tables TEXT[] := ARRAY[
    'admin_users', 'admin_roles', 'admin_user_roles', 'admin_sessions',
    'order_items', 'payments', 'payment_events', 'shipments', 'inventory',
    'inventory_reservations', 'inventory_movements', 'order_status_history',
    'audit_logs', 'returns', 'return_items', 'refunds', 'idempotency_keys',
    'risk_assessments', 'notification_outbox', 'fiscal_documents'
  ];
BEGIN
  FOREACH role_name IN ARRAY ARRAY['anon', 'authenticated'] LOOP
    IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = role_name) THEN
      FOREACH table_name IN ARRAY protected_tables LOOP
        EXECUTE format('REVOKE ALL PRIVILEGES ON TABLE %I FROM %I', table_name, role_name);
      END LOOP;
      EXECUTE format(
        'REVOKE EXECUTE ON FUNCTION nostalgia_prevent_append_only_mutation() FROM %I',
        role_name
      );
    END IF;
  END LOOP;
END;
$$;

COMMENT ON TABLE order_items IS 'Immutable product and pricing snapshots captured at purchase time.';
COMMENT ON TABLE inventory_movements IS 'Append-only inventory ledger. Stock changes must have a unique event key.';
COMMENT ON TABLE audit_logs IS 'Append-only security and business audit trail. Never store secrets or card data.';
COMMENT ON TABLE payment_events IS 'Verified provider events with sanitized raw payload and idempotent provider event ID.';
COMMENT ON COLUMN orders.guest_access_token_hash IS 'SHA-256 hash only; the plaintext guest token must never be stored here.';
