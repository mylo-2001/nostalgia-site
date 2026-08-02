"use strict";

/**
 * Merges several base64 PDFs into one, so a batch of ACS labels prints as a
 * single job instead of one browser tab per label.
 *
 * ACS returns a separate one-page PDF per voucher (verified 30/7/2026), which
 * is why this exists at all.
 */

const { PDFDocument } = require("pdf-lib");

/**
 * @param {string[]} base64Pdfs
 * @returns {Promise<string>} the merged document, base64-encoded
 */
async function mergeBase64Pdfs(base64Pdfs) {
  const list = (base64Pdfs || []).filter((b) => typeof b === "string" && b);
  if (!list.length) throw new Error("no_pdfs_to_merge");
  /* Nothing to do for a single document — skip the parse/serialise round trip
     so the common one-label case stays as fast as before. */
  if (list.length === 1) return list[0];

  const merged = await PDFDocument.create();
  for (const b64 of list) {
    const src = await PDFDocument.load(Buffer.from(b64, "base64"), {
      // ACS labels are not encrypted, but never let one bad file abort the batch.
      ignoreEncryption: true,
    });
    const pages = await merged.copyPages(src, src.getPageIndices());
    pages.forEach((p) => merged.addPage(p));
  }
  const bytes = await merged.save();
  return Buffer.from(bytes).toString("base64");
}

module.exports = { mergeBase64Pdfs };
