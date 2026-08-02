"use strict";

/** Flat order fees (EUR) — keep in sync with js/order-fees.js */
const SHIPPING_FEE = 3.5;
const COD_FEE = 3.5;
const FREE_SHIPPING_MIN = 120;

const COURIERS = {
  elta: "ELTA",
  acs: "ACS",
};

function orderExtraFees(payment, subtotal, opts) {
  opts = opts || {};
  const base = Number(subtotal) || 0;
  const freeShipping = base >= FREE_SHIPPING_MIN || !!opts.couponFreeShipping;
  const shipping = freeShipping ? 0 : SHIPPING_FEE;
  const cod = payment === "cod" ? COD_FEE : 0;
  return { shipping, cod, feesTotal: shipping + cod, freeShipping };
}

function normalizeCourier(raw) {
  const key = String(raw || "").trim().toLowerCase();
  return key === "acs" || key === "elta" ? key : "";
}

function courierLabel(key) {
  return COURIERS[normalizeCourier(key)] || "";
}

module.exports = {
  SHIPPING_FEE,
  COD_FEE,
  FREE_SHIPPING_MIN,
  COURIERS,
  orderExtraFees,
  normalizeCourier,
  courierLabel,
};
