-- migration: no-transaction

DROP INDEX CONCURRENTLY IF EXISTS orders_failed_payment_retry_phase13_idx;
DROP INDEX CONCURRENTLY IF EXISTS fiscal_documents_business_key_phase13_uidx;
