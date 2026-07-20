"use strict";

const assert = require("node:assert/strict");
const test = require("node:test");

const { FiscalProviderAdapter } = require("../server/fiscal/fiscal-provider");
const { DOCUMENT_TYPES } = require("../server/services/fiscal-document-service");

test("fiscal integration boundary is provider-neutral and exposes legal document types", async () => {
  const provider = new FiscalProviderAdapter("accounting_test");
  assert.equal(provider.name, "accounting_test");
  assert.deepEqual([...DOCUMENT_TYPES].sort(), ["credit_note", "document_cancellation",
    "invoice", "retail_receipt"]);
  await assert.rejects(provider.issueDocument(), /not implemented/);
  assert.throws(() => new FiscalProviderAdapter(""), /stable provider name/);
});
