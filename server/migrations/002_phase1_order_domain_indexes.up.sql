-- migration: no-transaction

CREATE UNIQUE INDEX CONCURRENTLY IF NOT EXISTS admin_users_username_lower_uidx
  ON admin_users (lower(username));
CREATE UNIQUE INDEX CONCURRENTLY IF NOT EXISTS admin_users_email_lower_uidx
  ON admin_users (lower(email)) WHERE email IS NOT NULL;
CREATE INDEX CONCURRENTLY IF NOT EXISTS admin_sessions_active_expiry_idx
  ON admin_sessions (admin_user_id, expires_at) WHERE revoked_at IS NULL;

CREATE INDEX CONCURRENTLY IF NOT EXISTS orders_v2_order_status_created_idx
  ON orders (order_status_v2, created_at DESC) WHERE order_status_v2 IS NOT NULL;
CREATE INDEX CONCURRENTLY IF NOT EXISTS orders_v2_payment_status_created_idx
  ON orders (payment_status_v2, created_at DESC) WHERE payment_status_v2 IS NOT NULL;
CREATE INDEX CONCURRENTLY IF NOT EXISTS orders_v2_shipping_status_created_idx
  ON orders (shipping_status_v2, created_at DESC) WHERE shipping_status_v2 IS NOT NULL;
CREATE UNIQUE INDEX CONCURRENTLY IF NOT EXISTS orders_guest_access_token_hash_uidx
  ON orders (guest_access_token_hash) WHERE guest_access_token_hash IS NOT NULL;
CREATE INDEX CONCURRENTLY IF NOT EXISTS orders_request_id_idx
  ON orders (request_id) WHERE request_id IS NOT NULL;

CREATE INDEX CONCURRENTLY IF NOT EXISTS order_items_product_variant_idx
  ON order_items (product_id, variant_id);
CREATE INDEX CONCURRENTLY IF NOT EXISTS payments_order_status_idx
  ON payments (order_id, status, created_at DESC);
CREATE UNIQUE INDEX CONCURRENTLY IF NOT EXISTS payments_provider_transaction_uidx
  ON payments (provider, provider_transaction_id)
  WHERE provider_transaction_id IS NOT NULL;
CREATE UNIQUE INDEX CONCURRENTLY IF NOT EXISTS payments_provider_session_uidx
  ON payments (provider, provider_session_id)
  WHERE provider_session_id IS NOT NULL;
CREATE INDEX CONCURRENTLY IF NOT EXISTS payment_events_processing_idx
  ON payment_events (processing_status, received_at)
  WHERE processing_status IN ('received', 'failed');

CREATE INDEX CONCURRENTLY IF NOT EXISTS shipments_order_status_idx
  ON shipments (order_id, status, created_at DESC);
CREATE UNIQUE INDEX CONCURRENTLY IF NOT EXISTS shipments_tracking_uidx
  ON shipments (carrier, tracking_number)
  WHERE carrier IS NOT NULL AND tracking_number IS NOT NULL;

CREATE UNIQUE INDEX CONCURRENTLY IF NOT EXISTS inventory_product_variant_uidx
  ON inventory (product_id, COALESCE(variant_id, ''));
CREATE UNIQUE INDEX CONCURRENTLY IF NOT EXISTS inventory_sku_uidx
  ON inventory (sku) WHERE sku IS NOT NULL AND btrim(sku) <> '';
CREATE INDEX CONCURRENTLY IF NOT EXISTS inventory_low_stock_idx
  ON inventory (available_quantity, low_stock_threshold)
  WHERE tracks_stock AND available_quantity <= low_stock_threshold;
CREATE UNIQUE INDEX CONCURRENTLY IF NOT EXISTS inventory_reservations_active_uidx
  ON inventory_reservations (order_id, inventory_id)
  WHERE status = 'active';
CREATE INDEX CONCURRENTLY IF NOT EXISTS inventory_reservations_expiry_idx
  ON inventory_reservations (expires_at)
  WHERE status = 'active';
CREATE INDEX CONCURRENTLY IF NOT EXISTS inventory_movements_inventory_created_idx
  ON inventory_movements (inventory_id, created_at DESC);
CREATE INDEX CONCURRENTLY IF NOT EXISTS inventory_movements_order_created_idx
  ON inventory_movements (order_id, created_at DESC) WHERE order_id IS NOT NULL;

CREATE INDEX CONCURRENTLY IF NOT EXISTS order_status_history_order_created_idx
  ON order_status_history (order_id, created_at DESC);
CREATE INDEX CONCURRENTLY IF NOT EXISTS audit_logs_entity_created_idx
  ON audit_logs (entity_type, entity_id, created_at DESC);
CREATE INDEX CONCURRENTLY IF NOT EXISTS audit_logs_actor_created_idx
  ON audit_logs (actor_type, actor_id, created_at DESC);
CREATE INDEX CONCURRENTLY IF NOT EXISTS audit_logs_request_id_idx
  ON audit_logs (request_id) WHERE request_id IS NOT NULL;

CREATE INDEX CONCURRENTLY IF NOT EXISTS returns_order_status_idx
  ON returns (order_id, status, created_at DESC);
CREATE INDEX CONCURRENTLY IF NOT EXISTS refunds_order_status_idx
  ON refunds (order_id, status, requested_at DESC);
CREATE INDEX CONCURRENTLY IF NOT EXISTS refunds_payment_status_idx
  ON refunds (payment_id, status, requested_at DESC);
CREATE UNIQUE INDEX CONCURRENTLY IF NOT EXISTS refunds_provider_refund_uidx
  ON refunds (provider, provider_refund_id)
  WHERE provider_refund_id IS NOT NULL;

CREATE INDEX CONCURRENTLY IF NOT EXISTS idempotency_keys_expiry_idx
  ON idempotency_keys (expires_at);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idempotency_keys_processing_idx
  ON idempotency_keys (created_at)
  WHERE status = 'processing';
CREATE INDEX CONCURRENTLY IF NOT EXISTS risk_assessments_review_idx
  ON risk_assessments (risk_level, created_at)
  WHERE decision = 'pending';
CREATE INDEX CONCURRENTLY IF NOT EXISTS risk_assessments_order_idx
  ON risk_assessments (order_id, created_at DESC);
CREATE INDEX CONCURRENTLY IF NOT EXISTS notification_outbox_ready_idx
  ON notification_outbox (COALESCE(next_retry_at, created_at), created_at)
  WHERE status IN ('pending', 'failed');
CREATE INDEX CONCURRENTLY IF NOT EXISTS notification_outbox_aggregate_idx
  ON notification_outbox (aggregate_type, aggregate_id, created_at DESC);
CREATE INDEX CONCURRENTLY IF NOT EXISTS fiscal_documents_order_idx
  ON fiscal_documents (order_id, created_at DESC);
CREATE UNIQUE INDEX CONCURRENTLY IF NOT EXISTS fiscal_documents_provider_id_uidx
  ON fiscal_documents (provider, provider_document_id)
  WHERE provider IS NOT NULL AND provider_document_id IS NOT NULL;
