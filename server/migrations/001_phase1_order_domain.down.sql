DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM orders WHERE order_status_v2 IS NOT NULL
             OR payment_status_v2 IS NOT NULL OR shipping_status_v2 IS NOT NULL)
     OR EXISTS (SELECT 1 FROM order_items)
     OR EXISTS (SELECT 1 FROM payments)
     OR EXISTS (SELECT 1 FROM payment_events)
     OR EXISTS (SELECT 1 FROM shipments)
     OR EXISTS (SELECT 1 FROM inventory)
     OR EXISTS (SELECT 1 FROM inventory_reservations)
     OR EXISTS (SELECT 1 FROM inventory_movements)
     OR EXISTS (SELECT 1 FROM order_status_history)
     OR EXISTS (SELECT 1 FROM audit_logs)
     OR EXISTS (SELECT 1 FROM returns)
     OR EXISTS (SELECT 1 FROM refunds)
     OR EXISTS (SELECT 1 FROM idempotency_keys)
     OR EXISTS (SELECT 1 FROM risk_assessments)
     OR EXISTS (SELECT 1 FROM notification_outbox)
     OR EXISTS (SELECT 1 FROM fiscal_documents)
     OR EXISTS (SELECT 1 FROM admin_users)
  THEN
    RAISE EXCEPTION 'Phase 1 schema contains V2 data; destructive rollback is blocked';
  END IF;
END;
$$;

DROP TABLE fiscal_documents;
DROP TABLE notification_outbox;
DROP TABLE risk_assessments;
DROP TABLE idempotency_keys;
DROP TABLE refunds;
DROP TABLE return_items;
DROP TABLE returns;
DROP TABLE audit_logs;
DROP TABLE order_status_history;
DROP TABLE inventory_movements;
DROP TABLE inventory_reservations;
DROP TABLE inventory;
DROP TABLE shipments;
DROP TABLE payment_events;
DROP TABLE payments;
DROP TABLE order_items;
DROP TABLE admin_sessions;
DROP TABLE admin_user_roles;
DROP TABLE admin_roles;
DROP TABLE admin_users;
DROP FUNCTION nostalgia_prevent_append_only_mutation();

ALTER TABLE orders
  DROP COLUMN guest_access_token_hash,
  DROP COLUMN completed_at,
  DROP COLUMN cancelled_at,
  DROP COLUMN confirmed_at,
  DROP COLUMN request_id,
  DROP COLUMN version,
  DROP COLUMN shipping_address_snapshot,
  DROP COLUMN billing_address_snapshot,
  DROP COLUMN shipping_method_id,
  DROP COLUMN tax_included,
  DROP COLUMN grand_total,
  DROP COLUMN other_charges_total,
  DROP COLUMN vat_total,
  DROP COLUMN cod_fee,
  DROP COLUMN shipping_total,
  DROP COLUMN discount_total,
  DROP COLUMN subtotal,
  DROP COLUMN currency,
  DROP COLUMN payment_method_v2,
  DROP COLUMN shipping_status_v2,
  DROP COLUMN payment_status_v2,
  DROP COLUMN order_status_v2;
