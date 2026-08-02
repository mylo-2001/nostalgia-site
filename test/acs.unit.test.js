"use strict";

const assert = require("node:assert/strict");
const test = require("node:test");

/* Every mocked response body below is copied verbatim from the "ACS Rest API
   Web Services" PDF's demo request/response examples, so this validates our
   parsing against ACS's own documented contract — without needing a real
   API key. Re-run against the live endpoint once ACS_API_KEY is issued. */

function withEnv(vars, fn) {
  const prev = {};
  for (const k of Object.keys(vars)) prev[k] = process.env[k];
  Object.assign(process.env, vars);
  return fn().finally(() => {
    for (const k of Object.keys(vars)) {
      if (prev[k] === undefined) delete process.env[k];
      else process.env[k] = prev[k];
    }
  });
}

function mockFetchOnce(status, body) {
  const prevFetch = global.fetch;
  const calls = [];
  global.fetch = async (url, opts) => {
    calls.push({ url, opts });
    return {
      ok: status >= 200 && status < 300,
      status,
      json: async () => body,
    };
  };
  return { calls, restore: () => { global.fetch = prevFetch; } };
}

const ENV = {
  ACS_API_KEY: "test-key",
  ACS_COMPANY_ID: "demo",
  ACS_COMPANY_PASSWORD: "demo",
  ACS_USER_ID: "demo",
  ACS_USER_PASSWORD: "demo",
  ACS_BILLING_CODE: "2ΑΘ999999",
};

test("acs.configured() is false without an API key", () => {
  delete require.cache[require.resolve("../server/acs")];
  const prev = process.env.ACS_API_KEY;
  delete process.env.ACS_API_KEY;
  const acs = require("../server/acs");
  assert.equal(acs.configured(), false);
  if (prev !== undefined) process.env.ACS_API_KEY = prev;
});

test("callAcs throws acs_not_configured with no API key set", async () => {
  delete require.cache[require.resolve("../server/acs")];
  const prev = process.env.ACS_API_KEY;
  delete process.env.ACS_API_KEY;
  const acs = require("../server/acs");
  await assert.rejects(() => acs.createVoucher({}), (e) => e.code === "acs_not_configured");
  if (prev !== undefined) process.env.ACS_API_KEY = prev;
});

test("createVoucher parses the PDF's demo response and sends the right envelope", () =>
  withEnv(ENV, async () => {
    delete require.cache[require.resolve("../server/acs")];
    const acs = require("../server/acs");
    const { calls, restore } = mockFetchOnce(200, {
      ACSExecution_HasError: false,
      ACSExecutionErrorMessage: "",
      ACSOutputResponce: {
        ACSValueOutput: [{ Voucher_No: " 7227889174", Voucher_No_Return: null, Error_Message: "" }],
        ACSTableOutput: {},
      },
    });
    try {
      const result = await acs.createVoucher({
        Pickup_Date: "2019-01-10",
        Sender: "ESHOP",
        Recipient_Name: "TEST RECIPIENT",
        Recipient_Address: "P. RALLI",
        Recipient_Address_Number: 45,
        Recipient_Zipcode: 17778,
        Recipient_Region: "TAVROS",
        Recipient_Cell_Phone: 699999999,
        Recipient_Country: "GR",
        Billing_Code: ENV.ACS_BILLING_CODE,
        Charge_Type: 2,
        Item_Quantity: 1,
        Weight: 0.5,
        Cod_Ammount: 50.5,
        Cod_Payment_Way: 0,
        Acs_Delivery_Products: "COD",
      });

      assert.equal(result.Voucher_No.trim(), "7227889174");

      assert.equal(calls.length, 1);
      assert.equal(calls[0].url, "https://webservices.acscourier.net/ACSRestServices/api/ACSAutoRest");
      assert.equal(calls[0].opts.headers.AcsApiKey, "test-key");
      const sentBody = JSON.parse(calls[0].opts.body);
      assert.equal(sentBody.ACSAlias, "ACS_Create_Voucher");
      assert.equal(sentBody.ACSInputParameters.Company_ID, "demo");
      assert.equal(sentBody.ACSInputParameters.Billing_Code, "2ΑΘ999999");
      assert.equal(sentBody.ACSInputParameters.Cod_Ammount, 50.5);
    } finally {
      restore();
    }
  })
);

test("createVoucher surfaces ACS execution errors (e.g. bad recipient name)", () =>
  withEnv(ENV, async () => {
    delete require.cache[require.resolve("../server/acs")];
    const acs = require("../server/acs");
    const { restore } = mockFetchOnce(200, {
      ACSExecution_HasError: true,
      ACSExecutionErrorMessage: "Το όνομα παραλήπτη δεν μπορεί να είναι κενό",
      ACSOutputResponce: {},
    });
    try {
      await assert.rejects(
        () => acs.createVoucher({ Recipient_Name: "" }),
        (e) => e.code === "acs_execution_error" && /όνομα παραλήπτη/.test(e.message)
      );
    } finally {
      restore();
    }
  })
);

test("a 403 response maps to acs_forbidden", () =>
  withEnv(ENV, async () => {
    delete require.cache[require.resolve("../server/acs")];
    const acs = require("../server/acs");
    const { restore } = mockFetchOnce(403, {});
    try {
      await assert.rejects(() => acs.createVoucher({}), (e) => e.code === "acs_forbidden");
    } finally {
      restore();
    }
  })
);

test("a 406 response maps to acs_rate_limited", () =>
  withEnv(ENV, async () => {
    delete require.cache[require.resolve("../server/acs")];
    const acs = require("../server/acs");
    const { restore } = mockFetchOnce(406, {});
    try {
      await assert.rejects(() => acs.createVoucher({}), (e) => e.code === "acs_rate_limited");
    } finally {
      restore();
    }
  })
);

test("deleteVoucher resolves true on the PDF's demo success response", () =>
  withEnv(ENV, async () => {
    delete require.cache[require.resolve("../server/acs")];
    const acs = require("../server/acs");
    const { restore } = mockFetchOnce(200, {
      ACSExecution_HasError: false,
      ACSExecutionErrorMessage: "",
      ACSOutputResponce: { ACSValueOutput: [{ Error_Message: null }], ACSTableOutput: {} },
    });
    try {
      assert.equal(await acs.deleteVoucher(7227889480), true);
    } finally {
      restore();
    }
  })
);

test("issuePickupList parses the mass PickupList_No from the PDF's demo response", () =>
  withEnv(ENV, async () => {
    delete require.cache[require.resolve("../server/acs")];
    const acs = require("../server/acs");
    const { restore } = mockFetchOnce(200, {
      ACSExecution_HasError: false,
      ACSExecutionErrorMessage: "",
      ACSOutputResponce: {
        ACSValueOutput: [{ PickupList_No: "7227889830", Unprinted_Found: 0, Error_Message: "" }],
        ACSTableOutput: { Table_Data: [] },
      },
    });
    try {
      const result = await acs.issuePickupList("2019-01-11", null);
      assert.equal(result.PickupList_No, "7227889830");
      assert.equal(result.Unprinted_Found, 0);
    } finally {
      restore();
    }
  })
);

test("issuePickupList reports unprinted vouchers when finalization is blocked", () =>
  withEnv(ENV, async () => {
    delete require.cache[require.resolve("../server/acs")];
    const acs = require("../server/acs");
    const { restore } = mockFetchOnce(200, {
      ACSExecution_HasError: false,
      ACSExecutionErrorMessage: "",
      ACSOutputResponce: {
        ACSValueOutput: [{
          PickupList_No: null,
          Unprinted_Found: 2,
          Error_Message: "Αδύνατη η έκδοση λίστας παραλαβής. Βρέθηκαν 2 ατύπωτες αποστολές.",
        }],
        ACSTableOutput: {
          Table_Data: [{ Unprinted_Vouchers: "7227889841" }, { Unprinted_Vouchers: "7227889874" }],
        },
      },
    });
    try {
      const result = await acs.issuePickupList("2019-01-11", null);
      assert.equal(result.PickupList_No, null);
      assert.equal(result.Unprinted_Found, 2);
    } finally {
      restore();
    }
  })
);

test("trackingSummary parses a delivered shipment from the PDF's demo response", () =>
  withEnv(ENV, async () => {
    delete require.cache[require.resolve("../server/acs")];
    const acs = require("../server/acs");
    const { restore } = mockFetchOnce(200, {
      ACSExecution_HasError: false,
      ACSExecutionErrorMessage: "",
      ACSOutputResponce: {
        ACSValueOutput: [{ Error_Message: null }],
        ACSTableOutput: {
          Table_Data: [{
            voucher_no: 7227889174,
            delivery_flag: 1,
            returned_flag: 0,
            shipment_status: 4,
            delivery_date: "2018-12-21T00:00:00",
          }],
        },
      },
    });
    try {
      const summary = await acs.trackingSummary(7227889174);
      assert.equal(summary.delivery_flag, 1);
      assert.equal(acs.mapShipmentStatus(summary), "delivered");
    } finally {
      restore();
    }
  })
);

test("mapShipmentStatus covers the non-delivered / returned / in-progress branches", () => {
  delete require.cache[require.resolve("../server/acs")];
  const acs = require("../server/acs");
  assert.equal(acs.mapShipmentStatus(null), null);
  assert.equal(acs.mapShipmentStatus({ delivery_flag: 1, returned_flag: 1, shipment_status: 7 }), "returned");
  assert.equal(acs.mapShipmentStatus({ delivery_flag: 0, returned_flag: 0, shipment_status: 6 }), "returning");
  assert.equal(acs.mapShipmentStatus({ delivery_flag: 0, returned_flag: 0, shipment_status: 1 }), "failed");
  assert.equal(acs.mapShipmentStatus({ delivery_flag: 0, returned_flag: 0, shipment_status: 2 }), "failed");
  assert.equal(acs.mapShipmentStatus({ delivery_flag: 0, returned_flag: 0, shipment_status: 3 }), "transit");
  assert.equal(acs.mapShipmentStatus({ delivery_flag: 0, returned_flag: 0, shipment_status: 5 }), "transit");
});
