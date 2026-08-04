"use strict";

const {
  allocateProportionally,
  applyPercentage,
  extractIncludedTax,
  grossFromCatalogAmount,
  minorToMoney,
} = require("./money");

class PricingError extends Error {
  constructor(code, message, details = {}) {
    super(message);
    this.name = "PricingError";
    this.code = code;
    this.details = details;
  }
}

function fail(code, message, details) {
  throw new PricingError(code, message, details);
}

function asDate(value, field) {
  if (!value) return null;
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) fail("INVALID_PRICING_DATE", `${field} is invalid`, { field });
  return date;
}

function assertCurrency(value, field = "currency") {
  if (!/^[A-Z]{3}$/.test(value || "")) {
    fail("INVALID_CURRENCY", `${field} must be an uppercase ISO currency code`, { field });
  }
}

function assertLine(line, maxLineQuantity, seen) {
  const key = `${line.productId}\u0000${line.variantId || ""}`;
  if (seen.has(key)) fail("DUPLICATE_ORDER_LINE", "Duplicate product and variant line", { key });
  seen.add(key);

  if (!line.productId || typeof line.productId !== "string") {
    fail("INVALID_PRODUCT_ID", "Every line requires a product identifier");
  }
  if (!line.productName || typeof line.productName !== "string" || !line.productName.trim()) {
    fail("PRODUCT_NAME_MISSING", "Every line requires a product snapshot name", {
      productId: line.productId,
    });
  }
  if (!line.sku || typeof line.sku !== "string" || !line.sku.trim()) {
    fail("PRODUCT_SKU_MISSING", "Every line requires a product snapshot SKU", {
      productId: line.productId,
      variantId: line.variantId || null,
    });
  }
  if (!Number.isSafeInteger(line.quantity) || line.quantity < 1 || line.quantity > maxLineQuantity) {
    fail("INVALID_QUANTITY", `Quantity must be between 1 and ${maxLineQuantity}`, {
      productId: line.productId,
    });
  }
  if (typeof line.regularUnitPriceMinor !== "bigint" || line.regularUnitPriceMinor < 0n) {
    fail("PRODUCT_PRICE_MISSING", "Product regular price is missing", { productId: line.productId });
  }
  if (typeof line.effectiveUnitPriceMinor !== "bigint" || line.effectiveUnitPriceMinor < 0n) {
    fail("PRODUCT_PRICE_MISSING", "Product effective price is missing", { productId: line.productId });
  }
  if (line.effectiveUnitPriceMinor > line.regularUnitPriceMinor) {
    fail("INVALID_SALE_PRICE", "Effective price cannot exceed the regular price", {
      productId: line.productId,
    });
  }
  if (typeof line.vatRateUnits !== "bigint" || line.vatRateUnits < 0n || line.vatRateUnits > 1000000n) {
    fail("VAT_RATE_MISSING", "A valid VAT rate is required", { productId: line.productId });
  }
  if (typeof line.pricesIncludeTax !== "boolean") {
    fail("VAT_CONFIGURATION_MISSING", "Tax inclusion configuration is required", {
      productId: line.productId,
    });
  }
  if (line.stockAvailable !== null && line.stockAvailable !== undefined) {
    if (!Number.isInteger(line.stockAvailable) || line.stockAvailable < 0) {
      fail("INVALID_STOCK", "Available stock must be a non-negative integer", {
        productId: line.productId,
      });
    }
    if (line.stockAvailable < line.quantity) {
      fail("INSUFFICIENT_STOCK", "Requested quantity exceeds available stock", {
        productId: line.productId,
        variantId: line.variantId || null,
        requested: line.quantity,
        available: line.stockAvailable,
      });
    }
  }
}

function couponMatchesLine(coupon, line) {
  const productIds = coupon.allowedProductIds || [];
  const variantIds = coupon.allowedVariantIds || [];
  if (!productIds.length && !variantIds.length) return true;
  return productIds.includes(line.productId)
    || (!!line.variantId && variantIds.includes(line.variantId));
}

function validateCoupon(coupon, context) {
  if (!coupon) return;
  const { currency, now, preCouponSubtotalMinor, customerKeyHash } = context;
  if (!coupon.active) fail("COUPON_INACTIVE", "Coupon is inactive");
  if (coupon.currency !== currency) fail("COUPON_CURRENCY_MISMATCH", "Coupon currency does not match quote");
  if (coupon.startsAt && now < asDate(coupon.startsAt, "coupon.startsAt")) {
    fail("COUPON_NOT_STARTED", "Coupon is not active yet");
  }
  if (coupon.endsAt && now >= asDate(coupon.endsAt, "coupon.endsAt")) {
    fail("COUPON_EXPIRED", "Coupon has expired");
  }
  if (coupon.maxUses !== null && coupon.maxUses !== undefined
      && coupon.currentUses >= coupon.maxUses) {
    fail("COUPON_USAGE_LIMIT_REACHED", "Coupon usage limit has been reached");
  }
  if (coupon.perCustomerLimit !== null && coupon.perCustomerLimit !== undefined) {
    if (!customerKeyHash) {
      fail("COUPON_CUSTOMER_KEY_REQUIRED", "Coupon requires a stable customer key");
    }
    if (coupon.customerUses >= coupon.perCustomerLimit) {
      fail("COUPON_CUSTOMER_LIMIT_REACHED", "Customer coupon usage limit has been reached");
    }
  }
  if (preCouponSubtotalMinor < coupon.minSubtotalMinor) {
    fail("COUPON_MINIMUM_NOT_MET", "Coupon minimum subtotal has not been reached", {
      minimum: minorToMoney(coupon.minSubtotalMinor),
    });
  }
  if (!['percent', 'fixed'].includes(coupon.type)) {
    fail("INVALID_COUPON_TYPE", "Coupon type is not supported");
  }
}

function couponAllocations(coupon, preparedLines) {
  const allocations = preparedLines.map(() => 0n);
  if (!coupon) return allocations;

  const eligible = preparedLines
    .map((line, index) => ({ line, index }))
    .filter(({ line }) => couponMatchesLine(coupon, line.source) && line.saleGrossMinor > 0n);
  if (!eligible.length) fail("COUPON_NOT_APPLICABLE", "Coupon does not apply to these products");

  const weights = eligible.map(({ line }) => line.saleGrossMinor);
  const eligibleTotal = weights.reduce((sum, amount) => sum + amount, 0n);
  let eligibleAllocations;
  if (coupon.type === "percent") {
    eligibleAllocations = weights.map((amount) => applyPercentage(amount, coupon.percentageUnits));
    const calculated = eligibleAllocations.reduce((sum, amount) => sum + amount, 0n);
    const capped = coupon.maxDiscountMinor === null || coupon.maxDiscountMinor === undefined
      ? calculated
      : (calculated < coupon.maxDiscountMinor ? calculated : coupon.maxDiscountMinor);
    if (capped < calculated) eligibleAllocations = allocateProportionally(capped, weights);
  } else {
    let total = coupon.fixedAmountMinor < eligibleTotal ? coupon.fixedAmountMinor : eligibleTotal;
    if (coupon.maxDiscountMinor !== null && coupon.maxDiscountMinor !== undefined
        && total > coupon.maxDiscountMinor) {
      total = coupon.maxDiscountMinor;
    }
    eligibleAllocations = allocateProportionally(total, weights);
  }

  eligible.forEach(({ index }, eligibleIndex) => {
    allocations[index] = eligibleAllocations[eligibleIndex];
  });
  return allocations;
}

function feeBreakdown(amountMinor, vatRateUnits, includesTax) {
  const grossMinor = grossFromCatalogAmount(amountMinor, vatRateUnits, includesTax);
  return {
    grossMinor,
    vatMinor: extractIncludedTax(grossMinor, vatRateUnits),
  };
}

function calculatePrice(input) {
  const now = asDate(input.now || new Date(), "now");
  const policy = input.policy || {};
  const currency = policy.currency;
  assertCurrency(currency);
  if (policy.roundingMode !== "half_up") {
    fail("UNSUPPORTED_ROUNDING_MODE", "Only half_up rounding is supported");
  }
  const maxLineQuantity = policy.maxLineQuantity;
  if (!Number.isInteger(maxLineQuantity) || maxLineQuantity < 1) {
    fail("INVALID_PRICING_POLICY", "Pricing policy max line quantity is invalid");
  }
  if (!Array.isArray(input.lines) || !input.lines.length) {
    fail("EMPTY_ORDER", "At least one order line is required");
  }

  const seen = new Set();
  input.lines.forEach((line) => assertLine(line, maxLineQuantity, seen));
  const preparedLines = input.lines.map((line) => {
    const quantity = BigInt(line.quantity);
    const regularCatalogMinor = line.regularUnitPriceMinor * quantity;
    const saleCatalogMinor = line.effectiveUnitPriceMinor * quantity;
    const regularGrossMinor = grossFromCatalogAmount(
      regularCatalogMinor,
      line.vatRateUnits,
      line.pricesIncludeTax
    );
    const saleGrossMinor = grossFromCatalogAmount(
      saleCatalogMinor,
      line.vatRateUnits,
      line.pricesIncludeTax
    );
    return { source: line, regularGrossMinor, saleGrossMinor };
  });

  const preCouponSubtotalMinor = preparedLines.reduce(
    (sum, line) => sum + line.saleGrossMinor,
    0n
  );
  validateCoupon(input.coupon, {
    currency,
    now,
    preCouponSubtotalMinor,
    customerKeyHash: input.customerKeyHash || null,
  });
  const couponDiscounts = couponAllocations(input.coupon, preparedLines);

  let subtotalMinor = 0n;
  let saleDiscountTotalMinor = 0n;
  let couponDiscountTotalMinor = 0n;
  let merchandiseTotalMinor = 0n;
  let productVatTotalMinor = 0n;
  const items = preparedLines.map((prepared, index) => {
    const line = prepared.source;
    const couponDiscountMinor = couponDiscounts[index];
    const lineTotalMinor = prepared.saleGrossMinor - couponDiscountMinor;
    const saleDiscountMinor = prepared.regularGrossMinor - prepared.saleGrossMinor;
    const vatMinor = extractIncludedTax(lineTotalMinor, line.vatRateUnits);
    subtotalMinor += prepared.regularGrossMinor;
    saleDiscountTotalMinor += saleDiscountMinor;
    couponDiscountTotalMinor += couponDiscountMinor;
    merchandiseTotalMinor += lineTotalMinor;
    productVatTotalMinor += vatMinor;
    return {
      productId: line.productId,
      variantId: line.variantId || null,
      productName: line.productName,
      variantName: line.variantName || null,
      sku: line.sku || null,
      quantity: line.quantity,
      unitPrice: minorToMoney(line.effectiveUnitPriceMinor),
      originalUnitPrice: minorToMoney(line.regularUnitPriceMinor),
      discountAmount: minorToMoney(saleDiscountMinor + couponDiscountMinor),
      vatRate: line.vatRate,
      vatAmount: minorToMoney(vatMinor),
      lineSubtotal: minorToMoney(prepared.regularGrossMinor),
      lineTotal: minorToMoney(lineTotalMinor),
      currency,
      pricesIncludeTax: line.pricesIncludeTax,
    };
  });

  const shipping = input.shippingMethod;
  if (!shipping || !shipping.id) fail("SHIPPING_METHOD_REQUIRED", "Shipping method is required");
  if (!shipping.active) fail("SHIPPING_METHOD_INACTIVE", "Shipping method is inactive");
  if (shipping.currency !== currency) {
    fail("SHIPPING_CURRENCY_MISMATCH", "Shipping currency does not match quote");
  }
  const destinationCountry = String(input.destinationCountry || "").toUpperCase();
  if (!/^[A-Z]{2}$/.test(destinationCountry)) {
    fail("INVALID_DESTINATION_COUNTRY", "Destination country must be an ISO alpha-2 code");
  }
  if (shipping.supportedCountryCodes.length
      && !shipping.supportedCountryCodes.includes(destinationCountry)) {
    fail("SHIPPING_COUNTRY_UNSUPPORTED", "Shipping method is unavailable for destination country");
  }

  const paymentMethod = input.paymentMethod;
  if (paymentMethod !== "card") {
    fail("INVALID_PAYMENT_METHOD", "Only card payment is available");
  }

  const thresholdReached = shipping.freeShippingThresholdMinor !== null
    && shipping.freeShippingThresholdMinor !== undefined
    && merchandiseTotalMinor >= shipping.freeShippingThresholdMinor;
  const freeShipping = thresholdReached || !!input.coupon?.freeShipping;
  const shippingFee = feeBreakdown(
    freeShipping ? 0n : shipping.baseFeeMinor,
    shipping.shippingVatRateUnits,
    shipping.shippingPriceIncludesTax
  );
  const codFee = feeBreakdown(0n, shipping.codVatRateUnits, shipping.codPriceIncludesTax);

  const discountTotalMinor = saleDiscountTotalMinor + couponDiscountTotalMinor;
  const vatTotalMinor = productVatTotalMinor + shippingFee.vatMinor + codFee.vatMinor;
  const grandTotalMinor = subtotalMinor - discountTotalMinor
    + shippingFee.grossMinor + codFee.grossMinor;

  return {
    currency,
    items,
    coupon: input.coupon ? {
      code: input.coupon.code,
      freeShipping,
    } : null,
    shippingMethodId: shipping.id,
    paymentMethod,
    breakdown: {
      subtotal: minorToMoney(subtotalMinor),
      saleDiscountTotal: minorToMoney(saleDiscountTotalMinor),
      couponDiscountTotal: minorToMoney(couponDiscountTotalMinor),
      discountTotal: minorToMoney(discountTotalMinor),
      merchandiseTotal: minorToMoney(merchandiseTotalMinor),
      shippingTotal: minorToMoney(shippingFee.grossMinor),
      codFee: minorToMoney(codFee.grossMinor),
      vatTotal: minorToMoney(vatTotalMinor),
      otherChargesTotal: "0.00",
      grandTotal: minorToMoney(grandTotalMinor),
    },
  };
}

module.exports = { PricingError, calculatePrice };
