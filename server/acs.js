"use strict";

/**
 * ACS Courier REST API (ACSAutoRest) wrapper.
 * Docs: "ACS Rest API Web Services" PDF supplied by ACS — every ACSAlias below
 * and its ACSInputParameters mirror that document exactly.
 *
 * Auth model: an ACSApiKey header (issued directly by ACS, per-customer) PLUS
 * Company_ID/Company_Password/User_ID/User_Password in every request body
 * (issued when the courier account itself was opened). Both are required —
 * having one without the other still fails.
 *
 * All responses share one envelope:
 *   { ACSExecution_HasError, ACSExecutionErrorMessage, ACSOutputResponce }
 * (note: "ACSOutputResponce" — that spelling is ACS's actual field name in
 * every documented example, not a typo to fix here).
 */

const ROOT_URL = "https://webservices.acscourier.net/ACSRestServices/api/ACSAutoRest";

class AcsError extends Error {
  constructor(code, message) {
    super(message);
    this.name = "AcsError";
    this.code = code;
  }
}

function configured() {
  return !!(
    (process.env.ACS_API_KEY || "").trim() &&
    (process.env.ACS_COMPANY_ID || "").trim() &&
    (process.env.ACS_USER_ID || "").trim()
  );
}

function credentials() {
  return {
    Company_ID: (process.env.ACS_COMPANY_ID || "").trim(),
    Company_Password: (process.env.ACS_COMPANY_PASSWORD || "").trim(),
    User_ID: (process.env.ACS_USER_ID || "").trim(),
    User_Password: (process.env.ACS_USER_PASSWORD || "").trim(),
  };
}

function billingCode() {
  return (process.env.ACS_BILLING_CODE || "").trim();
}

/** Generic caller — every ACS method goes through this. */
async function callAcs(alias, params) {
  const apiKey = (process.env.ACS_API_KEY || "").trim();
  if (!apiKey) {
    throw new AcsError("acs_not_configured", "ACS_API_KEY is not set — ACS integration is disabled.");
  }

  let res;
  try {
    res = await fetch(ROOT_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json", AcsApiKey: apiKey },
      body: JSON.stringify({
        ACSAlias: alias,
        ACSInputParameters: { ...credentials(), ...params },
      }),
    });
  } catch (e) {
    throw new AcsError("acs_network_error", "Could not reach ACS: " + e.message);
  }

  if (res.status === 403) throw new AcsError("acs_forbidden", "ACS rejected the API key (403 Forbidden).");
  if (res.status === 406) throw new AcsError("acs_rate_limited", "Too many ACS requests per second (406 Not Acceptable).");
  if (!res.ok) throw new AcsError("acs_http_error", "ACS returned HTTP " + res.status);

  let data;
  try {
    data = await res.json();
  } catch (e) {
    throw new AcsError("acs_bad_response", "ACS response was not valid JSON.");
  }

  if (data.ACSExecution_HasError) {
    throw new AcsError("acs_execution_error", data.ACSExecutionErrorMessage || "ACS reported an execution error.");
  }
  return data.ACSOutputResponce || {};
}

/* ---------- Create / print / delete a shipment ---------- */

/** `input` maps 1:1 to the documented ACS_Create_Voucher fields (Recipient_*,
 *  Weight, Cod_Ammount, Acs_Delivery_Products, etc.) minus the credentials,
 *  which callAcs merges in automatically. Returns [{ Voucher_No, Voucher_No_Return, Error_Message }]. */
async function createVoucher(input) {
  const out = await callAcs("ACS_Create_Voucher", input);
  return (out.ACSValueOutput && out.ACSValueOutput[0]) || {};
}

async function getMultipartVouchers(mainVoucherNo) {
  const out = await callAcs("ACS_Get_Multipart_Vouchers", { Language: null, Main_Voucher_No: mainVoucherNo });
  return (out.ACSTableOutput && out.ACSTableOutput.Table_Data) || [];
}

/* The PDF comes back base64-encoded, but NOT where the docs' generic envelope
   suggests: it sits at ACSValueOutput[0].ACSObjectOutput, not at the top level.
   Verified against the live test account on 30/7/2026 — the payload decodes to
   a "%PDF-1.4" header. Falls back to the top-level field in case ACS ever
   normalises this. */
function extractPdfBase64(out) {
  const row = (out && out.ACSValueOutput && out.ACSValueOutput[0]) || {};
  const obj = row.ACSObjectOutput || (out && out.ACSObjectOutput);
  /* Two shapes in the wild: ACS_Print_Voucher puts the base64 straight into
     ACSObjectOutput, while ACS_Print_Pickup_List wraps it in an object as
     { Mass_Voucher_No, PDFData }. Both verified live on 30/7/2026. */
  const b64 = typeof obj === "string" ? obj : obj && (obj.PDFData || obj.PdfData);
  return typeof b64 === "string" && b64 ? b64 : null;
}

/** ACS caps a single print call at 10 vouchers (and a delete call at 20). */
const MAX_PRINT_BATCH = 10;
const MAX_DELETE_BATCH = 20;

/**
 * Prints one or more labels in a SINGLE ACS call (up to 10).
 *
 * Response shape differs by count — verified live on 30/7/2026:
 *   1 voucher  → ACSValueOutput[0].ACSObjectOutput is the base64 string
 *   2+         → ACSValueOutput[0].ACSObjectOutput is an array of
 *                { Voucber_No, PDFData, ACSExecution_HasError }
 * `Voucber_No` is ACS's own typo — do not "fix" it, it is the wire format.
 *
 * Returns [{ voucherNo, pdf }] in the order ACS sent them.
 *
 * NOTE: labels can only be printed BEFORE the day's pickup list is issued;
 * ACS refuses afterwards ("Δεν επιτρέπεται εκτύπωση voucher μετά την έκδοση
 * λίστας παραλαβής").
 */
async function printVouchers({ voucherNos, printType, startPosition, language }) {
  const list = (Array.isArray(voucherNos) ? voucherNos : [voucherNos])
    .map((v) => String(v || "").trim())
    .filter(Boolean);
  if (!list.length) throw new AcsError("acs_no_vouchers", "No voucher numbers given.");
  if (list.length > MAX_PRINT_BATCH) {
    throw new AcsError("acs_batch_too_large",
      "ACS prints at most " + MAX_PRINT_BATCH + " vouchers per call.");
  }

  const out = await callAcs("ACS_Print_Voucher", {
    Language: language || "GR",
    Voucher_No: list.join(","),
    Print_Type: printType || 2,
    /* Which of the 3 label slots on an A4 sheet to start at — lets a partly
       used sheet be fed back in instead of wasted. Laser only. */
    Start_Position: startPosition || 1,
  });

  const row = (out.ACSValueOutput && out.ACSValueOutput[0]) || {};
  const obj = row.ACSObjectOutput;

  if (typeof obj === "string" && obj) return [{ voucherNo: list[0], pdf: obj }];

  const entries = obj && typeof obj === "object" ? Object.values(obj) : [];
  const results = [];
  for (const e of entries) {
    if (!e || typeof e !== "object") continue;
    if (e.ACSExecution_HasError) {
      throw new AcsError("acs_print_failed",
        e.ACSExecutionErrorMessage || "ACS could not print a voucher.");
    }
    if (e.PDFData) results.push({ voucherNo: String(e.Voucber_No || ""), pdf: e.PDFData });
  }
  if (!results.length) {
    throw new AcsError("acs_no_pdf", "ACS returned no PDF for " + list.join(", "));
  }
  return results;
}

/** Single-label convenience wrapper — returns just the base64 string. */
async function printVoucher({ voucherNo, printType, startPosition, language }) {
  const [first] = await printVouchers({
    voucherNos: [voucherNo], printType, startPosition, language,
  });
  return first.pdf;
}

/**
 * Deletes one or more vouchers in a SINGLE call (ACS allows up to 20).
 *
 * Only possible while the voucher is NOT yet in a pickup list — afterwards it
 * is final and only an ACS branch can remove it. For a multipart shipment,
 * deleting the main voucher removes its companions too.
 */
async function deleteVouchers(voucherNos) {
  const list = (Array.isArray(voucherNos) ? voucherNos : [voucherNos])
    .map((v) => String(v || "").trim())
    .filter(Boolean);
  if (!list.length) throw new AcsError("acs_no_vouchers", "No voucher numbers given.");
  if (list.length > MAX_DELETE_BATCH) {
    throw new AcsError("acs_batch_too_large",
      "ACS deletes at most " + MAX_DELETE_BATCH + " vouchers per call.");
  }
  const out = await callAcs("ACS_Delete_Voucher", {
    Language: null,
    Voucher_No: list.join(","),
  });
  const row = (out.ACSValueOutput && out.ACSValueOutput[0]) || {};
  if (row.Error_Message) throw new AcsError("acs_delete_failed", row.Error_Message);
  return list.length;
}

async function deleteVoucher(voucherNo) {
  await deleteVouchers([voucherNo]);
  return true;
}

/* ---------- Pickup list (mandatory to finalize vouchers) ---------- */

/** MUST be called at the end of each day's production, or the printed
 *  vouchers stay unrecognized by ACS (their barcodes won't scan). */
/* When vouchers are still unprinted ACS refuses to issue the list and returns
   BOTH a count (Unprinted_Found) and the actual voucher numbers in
   ACSTableOutput. Surfacing only the count would leave the operator hunting
   through every order to find them, so pass the numbers along as
   `unprintedVouchers`. */
async function issuePickupList(pickupDate, myData) {
  const out = await callAcs("ACS_Issue_Pickup_List", {
    Language: "GR",
    Pickup_Date: pickupDate,
    MyData: myData == null ? null : myData,
  });
  const row = (out.ACSValueOutput && out.ACSValueOutput[0]) || {};
  const rows = (out.ACSTableOutput && out.ACSTableOutput.Table_Data) || [];
  return {
    ...row,
    unprintedVouchers: rows
      .map((r) => r && r.Unprinted_Vouchers)
      .filter(Boolean)
      .map(String),
  };
}

/** Returns the pickup list as a base64 PDF string (same envelope quirk as
 *  printVoucher — see extractPdfBase64). */
async function printPickupList(massNumber, pickupDate) {
  const out = await callAcs("ACS_Print_Pickup_List", {
    Language: "GR",
    Mass_Number: massNumber,
    Pickup_Date: pickupDate,
  });
  const pdf = extractPdfBase64(out);
  if (!pdf) throw new AcsError("acs_no_pdf", "ACS returned no PDF for pickup list " + massNumber);
  return pdf;
}

async function getPickupLists(pickupDate) {
  const out = await callAcs("ACS_Get_Pickup_Lists", { Language: null, Pickup_Date: pickupDate });
  return (out.ACSTableOutput && out.ACSTableOutput.Table_Data) || [];
}

async function pickupListDisplayVoucher(pickupListNo, pickupDate) {
  const out = await callAcs("ACS_Pickup_List_Display_Voucher", {
    Language: null,
    PickupList_No: pickupListNo,
    Pickup_Date: pickupDate,
  });
  return (out.ACSTableOutput && out.ACSTableOutput.Table_Data) || [];
}

/* ---------- COD reconciliation ---------- */

async function codBeneficiaryInfo(codPaymentDate) {
  const out = await callAcs("ACS_COD_Beneficiary_Info", { User_locals: "GR", COD_Payment_Date: codPaymentDate });
  return (out.ACSTableOutput && out.ACSTableOutput.Table_Data) || [];
}

/* ---------- Tracking ---------- */

async function trackingSummary(voucherNo) {
  const out = await callAcs("ACS_Trackingsummary", { Language: null, Voucher_No: voucherNo });
  const rows = (out.ACSTableOutput && out.ACSTableOutput.Table_Data) || [];
  return rows[0] || null;
}

async function trackingDetails(voucherNo) {
  const out = await callAcs("ACS_TrackingDetails", { Language: null, Voucher_No: voucherNo });
  return (out.ACSTableOutput && out.ACSTableOutput.Table_Data) || [];
}

async function podFromReferenceNo(referenceNo) {
  const out = await callAcs("ACS_POD_FROM_REFERENCE_NO", { User_locals: "GR", reference_no: referenceNo });
  return (out.ACSTableOutput && out.ACSTableOutput.Table_Data) || [];
}

/* ---------- Cost / address helpers ---------- */

/**
 * Shipping cost from the customer's own ACS price list.
 *
 * Takes STATION codes, not postal codes — `acsStationOrigin` is the two Greek
 * capitals inside our own Billing_Code, and `acsStationDestination` comes from
 * addressValidation()/findStationByZipCode(). Passing zip codes silently
 * returns "Άγνωστο κατάστημα παραλαβής".
 *
 * Billing_Category is documented as always 2. Greece only — Cyprus/abroad
 * cannot be priced through this call.
 */
async function priceCalculation({
  acsStationOrigin,
  acsStationDestination,
  weight,
  pickupDate,
  deliveryProducts,
  chargeType,
  insuranceAmount,
  dimensions,
} = {}) {
  const d = dimensions || {};
  const out = await callAcs("ACS_Price_Calculation", {
    Billing_Code: billingCode(),
    Billing_Category: 2,
    Acs_Station_Origin: acsStationOrigin || billingCode().replace(/[^Α-Ω]/g, "").slice(0, 2),
    Acs_Station_Destination: acsStationDestination,
    Weight: weight > 0 ? weight : 0.5,
    Pickup_Date: pickupDate,
    Acs_Delivery_Products: deliveryProducts || null,
    Charge_Type: chargeType || 2,
    Delivery_Zone: null, // documented as having no practical effect
    Insurance_Ammount: insuranceAmount == null ? null : insuranceAmount,
    Dimension_X_In_Cm: d.x == null ? null : d.x,
    Dimension_Y_In_Cm: d.y == null ? null : d.y,
    Dimension_Z_In_Cm: d.z == null ? null : d.z,
    Language: null,
  });
  return (out.ACSValueOutput && out.ACSValueOutput[0]) || {};
}

async function addressValidation(address, addressId) {
  const out = await callAcs("ACS_Address_Validation", { Language: null, Address: address, AddressID: addressId ?? null });
  const wrap = (out.ACSValueOutput && out.ACSValueOutput[0]) || {};
  return wrap.ACSObjectOutput || [];
}

async function areaFindByZipCode({ zipCode, showOnlyInaccessible, language, country }) {
  const out = await callAcs("ACS_Area_Find_By_Zip_Code", {
    Zip_Code: zipCode ?? null,
    Show_Only_Inaccessible_Areas: showOnlyInaccessible ? 1 : 0,
    Language: language || "GR",
    Country: country || "GR",
  });
  return (out.ACSTableOutput && out.ACSTableOutput.Table_Data) || [];
}

async function findStationByZipCode({ zipCode, language, country }) {
  const out = await callAcs("ACS_Find_Station_By_Zip_Code", { Zip_Code: zipCode, language: language || "GR", Country: country || "GR" });
  return (out.ACSTableOutput && out.ACSTableOutput.Table_Data) || [];
}

async function stations({ language, countryId, shopKind }) {
  const out = await callAcs("Acs_Stations", {
    language: language || "GR",
    ACS_SHOP_COUNTRY_ID: countryId || "GR",
    ACS_SHOP_KIND: shopKind || 1,
  });
  return (out.ACSTableOutput && out.ACSTableOutput.Table_Data) || [];
}

/* ---------- Status mapping: ACS tracking → our own shipping_status ---------- */

/** ACS's tracking summary gives delivery_flag / returned_flag / shipment_status
 *  rather than a single clean enum. This reduces that to our own
 *  not_ready|ready_courier|handed|transit|delivered|failed|returning|returned.
 *  Approximate by design — refine once real production data is seen. */
function mapShipmentStatus(summary) {
  if (!summary) return null;
  if (summary.returned_flag === 1 && summary.delivery_flag === 1) return "returned";
  if (summary.delivery_flag === 1) return "delivered";
  const status = Number(summary.shipment_status);
  if (status === 6) return "returning";
  if (status === 1 || status === 2) return "failed"; // refused charge/payment/parcel, deceased, wrong/unknown recipient
  return "transit"; // in progress, retryable non-delivery (absent, inaccessible area, rescheduled, etc.)
}

module.exports = {
  AcsError,
  configured,
  billingCode,
  callAcs,
  createVoucher,
  getMultipartVouchers,
  printVoucher,
  printVouchers,
  deleteVoucher,
  deleteVouchers,
  MAX_PRINT_BATCH,
  MAX_DELETE_BATCH,
  issuePickupList,
  printPickupList,
  getPickupLists,
  pickupListDisplayVoucher,
  codBeneficiaryInfo,
  trackingSummary,
  trackingDetails,
  podFromReferenceNo,
  priceCalculation,
  addressValidation,
  areaFindByZipCode,
  findStationByZipCode,
  stations,
  mapShipmentStatus,
};
