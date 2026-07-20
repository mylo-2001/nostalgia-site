"use strict";

const { calculatePrice, PricingError } = require("../domain/pricing-engine");
const { MoneyError } = require("../domain/money");
const {
  loadPricingContext,
  PricingRepositoryError,
} = require("../repositories/pricing-repository");

const FORBIDDEN_PRICING_FIELDS = new Set([
  "price", "unitPrice", "subtotal", "discount", "discountTotal", "shippingTotal",
  "codFee", "vat", "vatTotal", "total", "grandTotal",
]);
const REQUEST_FIELDS = new Set([
  "items", "couponCode", "shippingMethodId", "paymentMethod",
  "destinationCountry", "customerKeyHash",
]);
const ITEM_FIELDS = new Set(["productId", "variantId", "quantity"]);

class PricingServiceError extends Error {
  constructor(code, message, details = {}) {
    super(message);
    this.name = "PricingServiceError";
    this.code = code;
    this.details = details;
  }
}

function rejectClientPricingFields(value, path) {
  if (!value || typeof value !== "object") return;
  for (const key of Object.keys(value)) {
    if (FORBIDDEN_PRICING_FIELDS.has(key)) {
      throw new PricingServiceError(
        "CLIENT_PRICING_FIELD_FORBIDDEN",
        `Client pricing field is not accepted: ${path}.${key}`,
        { field: `${path}.${key}` }
      );
    }
  }
}

function rejectUnknownFields(value, allowed, path) {
  for (const key of Object.keys(value)) {
    if (!allowed.has(key)) {
      throw new PricingServiceError(
        "UNSUPPORTED_PRICING_FIELD",
        `Unsupported pricing field: ${path}.${key}`,
        { field: `${path}.${key}` }
      );
    }
  }
}

function normalizeRequest(request) {
  if (!request || typeof request !== "object" || Array.isArray(request)) {
    throw new PricingServiceError("INVALID_PRICING_REQUEST", "Pricing request must be an object");
  }
  rejectClientPricingFields(request, "request");
  rejectUnknownFields(request, REQUEST_FIELDS, "request");
  if (!Array.isArray(request.items) || request.items.length < 1 || request.items.length > 100) {
    throw new PricingServiceError("INVALID_ORDER_ITEMS", "Order must contain between 1 and 100 lines");
  }

  const merged = new Map();
  request.items.forEach((item, index) => {
    if (!item || typeof item !== "object" || Array.isArray(item)) {
      throw new PricingServiceError("INVALID_ORDER_ITEM", `items[${index}] must be an object`);
    }
    rejectClientPricingFields(item, `items[${index}]`);
    rejectUnknownFields(item, ITEM_FIELDS, `items[${index}]`);
    const productId = typeof item.productId === "string" ? item.productId.trim() : "";
    const variantId = typeof item.variantId === "string" && item.variantId.trim()
      ? item.variantId.trim()
      : null;
    if (!productId || productId.length > 200 || (variantId && variantId.length > 200)) {
      throw new PricingServiceError("INVALID_PRODUCT_IDENTIFIER", "Product identifiers are invalid");
    }
    if (!Number.isSafeInteger(item.quantity) || item.quantity < 1) {
      throw new PricingServiceError("INVALID_QUANTITY", "Quantity must be a positive integer", { index });
    }
    const key = `${productId}\u0000${variantId || ""}`;
    const previous = merged.get(key);
    if (previous) {
      previous.quantity += item.quantity;
      if (!Number.isSafeInteger(previous.quantity)) {
        throw new PricingServiceError("INVALID_QUANTITY", "Merged quantity is too large", { index });
      }
    }
    else merged.set(key, { productId, variantId, quantity: item.quantity });
  });

  const shippingMethodId = typeof request.shippingMethodId === "string"
    ? request.shippingMethodId.trim()
    : "";
  if (!shippingMethodId || shippingMethodId.length > 100) {
    throw new PricingServiceError("INVALID_SHIPPING_METHOD", "Shipping method identifier is required");
  }
  const paymentMethod = String(request.paymentMethod || "").toLowerCase();
  if (!['card', 'cod'].includes(paymentMethod)) {
    throw new PricingServiceError("INVALID_PAYMENT_METHOD", "Payment method must be card or cod");
  }
  const destinationCountry = String(request.destinationCountry || "").trim().toUpperCase();
  if (!/^[A-Z]{2}$/.test(destinationCountry)) {
    throw new PricingServiceError(
      "INVALID_DESTINATION_COUNTRY",
      "Destination country must be an ISO alpha-2 code"
    );
  }
  const couponCode = typeof request.couponCode === "string" && request.couponCode.trim()
    ? request.couponCode.trim().toUpperCase()
    : null;
  if (couponCode && couponCode.length > 100) {
    throw new PricingServiceError("INVALID_COUPON_CODE", "Coupon code is invalid");
  }
  const customerKeyHash = request.customerKeyHash || null;
  if (customerKeyHash && !/^[0-9a-f]{64}$/.test(customerKeyHash)) {
    throw new PricingServiceError("INVALID_CUSTOMER_KEY", "Customer key hash is invalid");
  }
  return {
    items: [...merged.values()],
    shippingMethodId,
    paymentMethod,
    destinationCountry,
    couponCode,
    customerKeyHash,
  };
}

function safeLog(logger, payload) {
  if (!logger || typeof logger.info !== "function") return;
  try {
    logger.info(payload);
  } catch (_) {
    // Pricing must not fail because an optional logger is unavailable.
  }
}

async function priceOrder(options) {
  const {
    client,
    request,
    requestId = null,
    now = new Date(),
    lockRows = false,
    logger = console,
  } = options || {};
  if (!client || typeof client.query !== "function") {
    throw new PricingServiceError("DATABASE_CLIENT_REQUIRED", "A PostgreSQL client is required");
  }
  const normalized = normalizeRequest(request);
  try {
    const context = await loadPricingContext({
      client,
      ...normalized,
      now,
      lockRows,
    });
    const quote = calculatePrice({
      ...context,
      now,
      paymentMethod: normalized.paymentMethod,
      destinationCountry: normalized.destinationCountry,
      customerKeyHash: normalized.customerKeyHash,
    });
    safeLog(logger, {
      event: "server_price_calculated",
      requestId,
      currency: quote.currency,
      lineCount: quote.items.length,
      shippingMethodId: quote.shippingMethodId,
      paymentMethod: quote.paymentMethod,
      grandTotal: quote.breakdown.grandTotal,
    });
    return quote;
  } catch (error) {
    if (error instanceof PricingServiceError) throw error;
    if (error instanceof PricingError || error instanceof PricingRepositoryError) {
      throw new PricingServiceError(error.code, error.message, error.details);
    }
    if (error instanceof MoneyError) {
      throw new PricingServiceError("PRICING_CONFIGURATION_INVALID", error.message, {
        field: error.field,
      });
    }
    throw error;
  }
}

module.exports = {
  PricingServiceError,
  normalizeRequest,
  priceOrder,
};
