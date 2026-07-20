-- Read-only Phase 1 preflight. Run manually and review every result before migration.
BEGIN TRANSACTION READ ONLY;

SELECT current_database() AS database_name,
       current_user AS database_user,
       version() AS postgres_version;

SELECT COUNT(*) AS order_count,
       MIN(created_at) AS first_order_at,
       MAX(created_at) AS last_order_at
FROM orders;

SELECT status, payment_status, shipping_status, COUNT(*) AS orders
FROM orders
GROUP BY status, payment_status, shipping_status
ORDER BY orders DESC;

SELECT stripe_session_id, COUNT(*) AS duplicates
FROM orders
WHERE stripe_session_id IS NOT NULL AND btrim(stripe_session_id) <> ''
GROUP BY stripe_session_id
HAVING COUNT(*) > 1;

SELECT id, stock
FROM catalog_overrides
WHERE stock < 0;

SELECT id, product_id, stock
FROM product_variants
WHERE stock < 0;

SELECT rolname, rolsuper, rolcreaterole, rolcreatedb, rolbypassrls
FROM pg_roles
WHERE rolname IN (current_user, 'anon', 'authenticated', 'service_role')
ORDER BY rolname;

SELECT schemaname, tablename, tableowner, rowsecurity
FROM pg_tables
WHERE schemaname = current_schema()
  AND tablename IN ('orders', 'audit_log', 'catalog_overrides', 'product_variants')
ORDER BY tablename;

ROLLBACK;
