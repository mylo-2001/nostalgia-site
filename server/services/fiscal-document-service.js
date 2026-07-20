"use strict";

const DOCUMENT_TYPES = new Set([
  "retail_receipt", "invoice", "credit_note", "document_cancellation",
]);
const { sanitizeMetadata } = require("./monitoring-service");

class FiscalDocumentServiceError extends Error {
  constructor(code, message) {
    super(message);
    this.name = "FiscalDocumentServiceError";
    this.code = code;
  }
}

function fail(code, message) {
  throw new FiscalDocumentServiceError(code, message);
}

async function loadFiscalSnapshot(client, orderId) {
  const order = await client.query(`SELECT id,number,currency,subtotal,discount_total,
    shipping_total,cod_fee,vat_total,grand_total,payment_status_v2,payment_method_v2,
    customer_email_normalized,customer,shipping_address_snapshot,billing_address_snapshot,
    created_at FROM orders WHERE id=$1`, [orderId]);
  if (!order.rowCount) fail("ORDER_NOT_FOUND", "Fiscal order was not found");
  const items = await client.query(`SELECT product_id,variant_id,product_name,variant_name,
    sku,quantity,unit_price,original_unit_price,discount_amount,vat_rate,vat_amount,
    line_subtotal,line_total,currency FROM order_items WHERE order_id=$1 ORDER BY line_number`,
  [orderId]);
  return { order: order.rows[0], items: items.rows };
}

async function assertFiscalEligibility(client, options, snapshot) {
  if (["retail_receipt", "invoice"].includes(options.documentType) &&
      !["paid", "cod_collected", "partially_refunded"].includes(
        snapshot.order.payment_status_v2)) {
    fail("FISCAL_PAYMENT_NOT_SETTLED", "A sale document requires settled payment");
  }
  if (options.documentType === "credit_note") {
    if (!options.refundId) fail("FISCAL_REFUND_REQUIRED", "Credit note requires a refund");
    const refund = await client.query(`SELECT status,order_id FROM refunds WHERE id=$1`,
      [options.refundId]);
    if (!refund.rowCount || refund.rows[0].order_id !== options.orderId ||
        refund.rows[0].status !== "confirmed") {
      fail("FISCAL_REFUND_NOT_CONFIRMED", "Credit note requires a confirmed order refund");
    }
  }
  if (options.documentType === "document_cancellation" && !options.cancelledDocumentId) {
    fail("FISCAL_ORIGINAL_DOCUMENT_REQUIRED", "Document cancellation requires the original document");
  }
}

async function issueFiscalDocument(options) {
  if (!options.pool || typeof options.pool.connect !== "function") {
    throw new TypeError("issueFiscalDocument requires a PostgreSQL pool");
  }
  if (!options.provider || typeof options.provider.issueDocument !== "function" ||
      !options.provider.name) {
    throw new TypeError("issueFiscalDocument requires a fiscal provider adapter");
  }
  if (!DOCUMENT_TYPES.has(options.documentType)) {
    fail("FISCAL_DOCUMENT_TYPE_INVALID", "Fiscal document type is invalid");
  }
  const client = await options.pool.connect();
  let document;
  let snapshot;
  try {
    await client.query("BEGIN");
    snapshot = await loadFiscalSnapshot(client, options.orderId);
    await assertFiscalEligibility(client, options, snapshot);
    await client.query(`INSERT INTO fiscal_documents
      (order_id,refund_id,return_id,document_type,status,provider,payload)
      VALUES ($1,$2,$3,$4,'pending',$5,$6) ON CONFLICT DO NOTHING`,
    [options.orderId, options.refundId || null, options.returnId || null,
      options.documentType, options.provider.name,
      options.cancelledDocumentId ? { cancelledDocumentId: options.cancelledDocumentId } : {}]);
    const selected = await client.query(`SELECT * FROM fiscal_documents
      WHERE provider=$1 AND order_id=$2 AND document_type=$3
        AND refund_id IS NOT DISTINCT FROM $4::uuid
        AND return_id IS NOT DISTINCT FROM $5::uuid FOR UPDATE`,
    [options.provider.name, options.orderId, options.documentType,
      options.refundId || null, options.returnId || null]);
    if (!selected.rowCount) fail("FISCAL_DOCUMENT_NOT_CREATED", "Fiscal document was not created");
    document = selected.rows[0];
    if (document.status === "issued") {
      await client.query("COMMIT");
      return { documentId: document.id, documentNumber: document.document_number,
        providerDocumentId: document.provider_document_id, idempotent: true };
    }
    await client.query(`UPDATE fiscal_documents SET status='pending',updated_at=now()
      WHERE id=$1`, [document.id]);
    await client.query("COMMIT");
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally { client.release(); }

  let issued;
  try {
    issued = await options.provider.issueDocument({
      documentId: document.id,
      documentType: options.documentType,
      refundId: options.refundId || null,
      returnId: options.returnId || null,
      cancelledDocumentId: options.cancelledDocumentId || null,
      snapshot,
    }, { idempotencyKey: `nostalgia-fiscal-${document.id}` });
    if (!issued?.id || !issued?.number) fail("FISCAL_PROVIDER_RESPONSE_INVALID",
      "Fiscal provider response is invalid");
  } catch (error) {
    const failed = await options.pool.connect();
    try {
      await failed.query(`UPDATE fiscal_documents SET status='failed',updated_at=now(),
        payload=payload||$2::jsonb WHERE id=$1 AND status<>'issued'`,
      [document.id, { errorCode: error.code || "provider_error" }]);
      await failed.query(`INSERT INTO audit_logs (actor_type,actor_id,action,entity_type,
        entity_id,new_values,source,request_id) VALUES ('system',$1,'fiscal.issue_failed',
        'fiscal_document',$2,$3,'fiscal.provider',$4)`,
      [options.provider.name, document.id, { code: error.code || "provider_error" },
        options.requestId || null]);
    } finally { failed.release(); }
    if (error instanceof FiscalDocumentServiceError) throw error;
    fail("FISCAL_PROVIDER_UNAVAILABLE", "Fiscal provider could not issue the document");
  }

  const saved = await options.pool.connect();
  try {
    await saved.query("BEGIN");
    const result = await saved.query(`UPDATE fiscal_documents SET status='issued',
      provider_document_id=$2,document_number=$3,issued_at=COALESCE($4,now()),updated_at=now(),
      payload=payload||$5::jsonb WHERE id=$1 AND status<>'issued' RETURNING id`,
    [document.id, String(issued.id), String(issued.number), issued.issuedAt || null,
      issued.metadata && typeof issued.metadata === "object"
        ? sanitizeMetadata(issued.metadata) : {}]);
    if (!result.rowCount) {
      const existing = await saved.query(`SELECT document_number,provider_document_id
        FROM fiscal_documents WHERE id=$1`, [document.id]);
      await saved.query("COMMIT");
      return { documentId: document.id,
        documentNumber: existing.rows[0].document_number,
        providerDocumentId: existing.rows[0].provider_document_id, idempotent: true };
    }
    await saved.query(`INSERT INTO audit_logs (actor_type,actor_id,action,entity_type,
      entity_id,new_values,source,request_id) VALUES ('system',$1,'fiscal.issued',
      'fiscal_document',$2,$3,'fiscal.provider',$4)`,
    [options.provider.name, document.id, { providerDocumentId: String(issued.id),
      documentNumber: String(issued.number) }, options.requestId || null]);
    await saved.query("COMMIT");
    return { documentId: result.rows[0].id, documentNumber: String(issued.number),
      providerDocumentId: String(issued.id), idempotent: false };
  } catch (error) {
    await saved.query("ROLLBACK");
    throw error;
  } finally { saved.release(); }
}

module.exports = { DOCUMENT_TYPES, FiscalDocumentServiceError, issueFiscalDocument };
