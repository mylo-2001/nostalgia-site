-- migration: no-transaction

CREATE INDEX CONCURRENTLY IF NOT EXISTS orders_failed_payment_retry_phase13_idx
  ON orders (id) WHERE order_status_v2='pending' AND payment_status_v2='failed';

CREATE UNIQUE INDEX CONCURRENTLY IF NOT EXISTS fiscal_documents_business_key_phase13_uidx
  ON fiscal_documents (provider,order_id,document_type,
    COALESCE(refund_id,'00000000-0000-0000-0000-000000000000'::uuid),
    COALESCE(return_id,'00000000-0000-0000-0000-000000000000'::uuid));
