"use strict";

const assert = require("node:assert/strict");
const test = require("node:test");

const {
  MoneyError,
  allocateProportionally,
  applyPercentage,
  calculateExclusiveTax,
  extractIncludedTax,
  moneyToMinor,
  percentageToUnits,
} = require("../server/domain/money");
const { calculatePrice, PricingError } = require("../server/domain/pricing-engine");

function policy() {
  return {
    currency: "EUR",
    maxLineQuantity: 10,
    roundingMode: "half_up",
  };
}

function shipping(overrides = {}) {
  return {
    id: "home",
    active: true,
    currency: "EUR",
    baseFeeMinor: 350n,
    freeShippingThresholdMinor: 3000n,
    codFeeMinor: 350n,
    codAllowed: true,
    shippingVatRateUnits: 240000n,
    codVatRateUnits: 240000n,
    shippingPriceIncludesTax: true,
    codPriceIncludesTax: true,
    supportedCountryCodes: ["GR", "CY"],
    ...overrides,
  };
}

function lines() {
  return [
    {
      productId: "p-1",
      variantId: null,
      productName: "First",
      variantName: null,
      sku: "FIRST",
      quantity: 2,
      regularUnitPriceMinor: 1000n,
      effectiveUnitPriceMinor: 800n,
      vatRate: "24.0000",
      vatRateUnits: 240000n,
      pricesIncludeTax: true,
      stockAvailable: 3,
    },
    {
      productId: "p-2",
      variantId: "v-2",
      productName: "Second",
      variantName: "Gold",
      sku: "SECOND-GOLD",
      quantity: 1,
      regularUnitPriceMinor: 2000n,
      effectiveUnitPriceMinor: 2000n,
      vatRate: "24.0000",
      vatRateUnits: 240000n,
      pricesIncludeTax: true,
      stockAvailable: null,
    },
  ];
}

function percentCoupon(overrides = {}) {
  return {
    code: "SAVE10",
    type: "percent",
    active: true,
    currency: "EUR",
    percentageUnits: 100000n,
    startsAt: null,
    endsAt: null,
    minSubtotalMinor: 0n,
    maxDiscountMinor: null,
    allowedProductIds: [],
    allowedVariantIds: [],
    maxUses: null,
    currentUses: 0,
    perCustomerLimit: null,
    customerUses: 0,
    freeShipping: false,
    ...overrides,
  };
}

test("money helpers use exact cents and deterministic half-up rounding", () => {
  assert.equal(moneyToMinor("12.30"), 1230n);
  assert.equal(applyPercentage(999n, percentageToUnits("15")), 150n);
  assert.equal(calculateExclusiveTax(10000n, 240000n), 2400n);
  assert.equal(extractIncludedTax(12400n, 240000n), 2400n);
  assert.deepEqual(allocateProportionally(100n, [100n, 200n, 300n]), [17n, 33n, 50n]);
  assert.deepEqual(allocateProportionally(1n, [1n, 1n]), [1n, 0n]);
});

test("money parser rejects hidden precision instead of silently rounding", () => {
  assert.throws(
    () => moneyToMinor("12.345"),
    (error) => error instanceof MoneyError && error.code === "DECIMAL_PRECISION_EXCEEDED"
  );
});

test("pricing applies sale, coupon, free shipping, COD fee and VAT", () => {
  const result = calculatePrice({
    policy: policy(),
    lines: lines(),
    coupon: percentCoupon(),
    shippingMethod: shipping(),
    paymentMethod: "cod",
    destinationCountry: "GR",
    now: new Date("2026-01-15T12:00:00Z"),
  });
  assert.deepEqual(result.breakdown, {
    subtotal: "40.00",
    saleDiscountTotal: "4.00",
    couponDiscountTotal: "3.60",
    discountTotal: "7.60",
    merchandiseTotal: "32.40",
    shippingTotal: "0.00",
    codFee: "3.50",
    vatTotal: "6.95",
    otherChargesTotal: "0.00",
    grandTotal: "35.90",
  });
  assert.equal(result.items[0].discountAmount, "5.60");
  assert.equal(result.items[1].variantId, "v-2");
});

test("fixed coupons are allocated only over eligible product lines", () => {
  const result = calculatePrice({
    policy: policy(),
    lines: lines(),
    coupon: percentCoupon({
      type: "fixed",
      percentageUnits: undefined,
      fixedAmountMinor: 500n,
      allowedProductIds: ["p-1"],
    }),
    shippingMethod: shipping({ freeShippingThresholdMinor: 99999n }),
    paymentMethod: "card",
    destinationCountry: "GR",
  });
  assert.equal(result.items[0].discountAmount, "9.00");
  assert.equal(result.items[1].discountAmount, "0.00");
  assert.equal(result.breakdown.couponDiscountTotal, "5.00");
  assert.equal(result.breakdown.grandTotal, "34.50");
});

test("tax-exclusive catalog prices are converted to payable gross totals", () => {
  const line = {
    ...lines()[0],
    quantity: 1,
    regularUnitPriceMinor: 1000n,
    effectiveUnitPriceMinor: 1000n,
    pricesIncludeTax: false,
  };
  const result = calculatePrice({
    policy: policy(),
    lines: [line],
    coupon: null,
    shippingMethod: shipping({ baseFeeMinor: 0n, freeShippingThresholdMinor: null }),
    paymentMethod: "card",
    destinationCountry: "GR",
  });
  assert.equal(result.breakdown.subtotal, "12.40");
  assert.equal(result.breakdown.vatTotal, "2.40");
  assert.equal(result.breakdown.grandTotal, "12.40");
});

test("coupon validity, usage and customer limits are enforced", () => {
  const base = {
    policy: policy(),
    lines: lines(),
    shippingMethod: shipping(),
    paymentMethod: "card",
    destinationCountry: "GR",
    now: new Date("2026-01-15T12:00:00Z"),
  };
  assert.throws(
    () => calculatePrice({ ...base, coupon: percentCoupon({ endsAt: "2026-01-15T12:00:00Z" }) }),
    (error) => error instanceof PricingError && error.code === "COUPON_EXPIRED"
  );
  assert.throws(
    () => calculatePrice({ ...base, coupon: percentCoupon({ minSubtotalMinor: 99999n }) }),
    (error) => error.code === "COUPON_MINIMUM_NOT_MET"
  );
  assert.throws(
    () => calculatePrice({ ...base, coupon: percentCoupon({ maxUses: 2, currentUses: 2 }) }),
    (error) => error.code === "COUPON_USAGE_LIMIT_REACHED"
  );
  assert.throws(
    () => calculatePrice({ ...base, coupon: percentCoupon({ perCustomerLimit: 1 }) }),
    (error) => error.code === "COUPON_CUSTOMER_KEY_REQUIRED"
  );
});

test("stock, shipping country and COD restrictions are enforced", () => {
  const base = {
    policy: policy(),
    lines: lines(),
    coupon: null,
    paymentMethod: "card",
    destinationCountry: "GR",
  };
  const insufficient = lines();
  insufficient[0] = { ...insufficient[0], quantity: 4 };
  assert.throws(
    () => calculatePrice({ ...base, lines: insufficient, shippingMethod: shipping() }),
    (error) => error.code === "INSUFFICIENT_STOCK"
  );
  assert.throws(
    () => calculatePrice({ ...base, destinationCountry: "FR", shippingMethod: shipping() }),
    (error) => error.code === "SHIPPING_COUNTRY_UNSUPPORTED"
  );
  assert.throws(
    () => calculatePrice({
      ...base,
      paymentMethod: "cod",
      shippingMethod: shipping({ codAllowed: false }),
    }),
    (error) => error.code === "COD_NOT_ALLOWED"
  );
  const missingSku = lines();
  missingSku[0] = { ...missingSku[0], sku: null };
  assert.throws(
    () => calculatePrice({ ...base, lines: missingSku, shippingMethod: shipping() }),
    (error) => error.code === "PRODUCT_SKU_MISSING"
  );
});
