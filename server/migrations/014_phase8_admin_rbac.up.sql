CREATE TABLE admin_permissions (
  code        TEXT PRIMARY KEY,
  description TEXT NOT NULL DEFAULT '',
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

INSERT INTO admin_permissions (code, description) VALUES
  ('order.read', 'Read orders'),
  ('order.update_status', 'Change order lifecycle status'),
  ('order.update_address', 'Correct address before handoff'),
  ('order.cancel', 'Cancel orders'),
  ('risk.review', 'Review COD risk assessments'),
  ('shipment.update', 'Update shipment and tracking'),
  ('payment.read', 'Read payment records'),
  ('refund.manage', 'Request and reconcile refunds'),
  ('return.manage', 'Manage returns'),
  ('inventory.read', 'Read inventory balances'),
  ('audit.read', 'Read audit records'),
  ('admin.manage', 'Manage administrators and roles');

CREATE TABLE admin_role_permissions (
  role_code      TEXT NOT NULL REFERENCES admin_roles(code) ON DELETE RESTRICT,
  permission_code TEXT NOT NULL REFERENCES admin_permissions(code) ON DELETE RESTRICT,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (role_code, permission_code)
);

INSERT INTO admin_role_permissions (role_code, permission_code)
SELECT 'administrator', code FROM admin_permissions;

INSERT INTO admin_role_permissions (role_code, permission_code) VALUES
  ('order_manager', 'order.read'), ('order_manager', 'order.update_status'),
  ('order_manager', 'order.update_address'), ('order_manager', 'order.cancel'),
  ('order_manager', 'risk.review'), ('order_manager', 'shipment.update'),
  ('order_manager', 'payment.read'), ('order_manager', 'return.manage'),
  ('warehouse', 'order.read'), ('warehouse', 'shipment.update'),
  ('warehouse', 'inventory.read'),
  ('customer_support', 'order.read'), ('customer_support', 'order.update_address'),
  ('customer_support', 'return.manage'),
  ('accounting', 'order.read'), ('accounting', 'payment.read'),
  ('accounting', 'refund.manage'), ('accounting', 'audit.read'),
  ('read_only', 'order.read');

ALTER TABLE admin_permissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE admin_role_permissions ENABLE ROW LEVEL SECURITY;

DO $$
DECLARE role_name TEXT;
BEGIN
  FOREACH role_name IN ARRAY ARRAY['anon', 'authenticated'] LOOP
    IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = role_name) THEN
      EXECUTE format('REVOKE ALL PRIVILEGES ON TABLE admin_permissions FROM %I', role_name);
      EXECUTE format('REVOKE ALL PRIVILEGES ON TABLE admin_role_permissions FROM %I', role_name);
    END IF;
  END LOOP;
END;
$$;

COMMENT ON TABLE admin_role_permissions IS
  'Server-enforced least-privilege mapping. UI visibility is not authorization.';
