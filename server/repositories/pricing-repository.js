"use strict";

const catalog = require("../catalog");
const {
  moneyToMinor,
  percentageToUnits,
  vatRateToUnits,
} = require("../domain/money");

const STATIC_PRODUCTS = new Map(catalog.PRODUCTS.map((product) => [product.id, product]));

class PricingRepositoryError extends Error {
  constructor(code, message, details = {}) {
    super(message);
    this.name = "PricingRepositoryError";
    this.code = code;
    this.details = details;
  }
}

function fail(code, message, details) {
  throw new PricingRepositoryError(code, message, details);
}

function lockClause(lockRows) {
  return lockRows ? " FOR SHARE" : "";
}

function byId(rows) {
  return new Map(rows.map((row) => [row.id, row]));
}

function inventoryKey(productId, variantId) {
  return `${productId}\u0000${variantId || ""}`;
}

function activeSalePrice(regularPrice, salePrice, saleUntil, now, field) {
  if (salePrice === null || salePrice === undefined) return regularPrice;
  if (saleUntil && new Date(saleUntil).getTime() <= now.getTime()) return regularPrice;
  const candidate = moneyToMinor(salePrice, field);
  return candidate < regularPrice ? candidate : regularPrice;
}

function legacyExpiryExclusive(value) {
  if (!value) return null;
  const day = String(value).slice(0, 10);
  const date = new Date(`${day}T00:00:00.000Z`);
  if (Number.isNaN(date.getTime())) return null;
  date.setUTCDate(date.getUTCDate() + 1);
  return date;
}

function normalizeCountryCodes(value) {
  if (!Array.isArray(value)) {
    fail("SHIPPING_COUNTRY_CONFIGURATION_INVALID", "Shipping country configuration must be an array");
  }
  const normalized = value.map((item) => typeof item === "string"
    ? item.trim().toUpperCase()
    : "");
  if (normalized.some((item) => !/^[A-Z]{2}$/.test(item))) {
    fail("SHIPPING_COUNTRY_CONFIGURATION_INVALID", "Shipping country codes must use ISO alpha-2");
  }
  return [...new Set(normalized)];
}

function normalizeIdentifierList(value, field) {
  if (!Array.isArray(value)) {
    fail("COUPON_CONFIGURATION_INVALID", `${field} must be an array`);
  }
  const normalized = value.map((item) => typeof item === "string" ? item.trim() : "");
  if (normalized.some((item) => !item || item.length > 200)) {
    fail("COUPON_CONFIGURATION_INVALID", `${field} contains an invalid identifier`);
  }
  return [...new Set(normalized)];
}

async function loadPolicy(client, lockRows) {
  const result = await client.query(`
    SELECT id, currency, max_line_quantity, rounding_mode,
           default_tax_category, catalog_prices_include_tax
      FROM pricing_policies
     WHERE id = 'default'${lockClause(lockRows)}
  `);
  if (!result.rowCount) fail("PRICING_POLICY_MISSING", "Default pricing policy is not configured");
  const row = result.rows[0];
  return {
    id: row.id,
    currency: row.currency,
    maxLineQuantity: row.max_line_quantity,
    roundingMode: row.rounding_mode,
    defaultTaxCategory: row.default_tax_category,
    catalogPricesIncludeTax: row.catalog_prices_include_tax,
  };
}

async function loadShippingMethod(client, id, lockRows) {
  const result = await client.query(`
    SELECT id, name, active, currency, base_fee, free_shipping_threshold,
           cod_fee, cod_allowed, shipping_vat_rate, cod_vat_rate,
           shipping_price_includes_tax, cod_price_includes_tax,
           supported_country_codes
      FROM shipping_methods
     WHERE id = $1${lockClause(lockRows)}
  `, [id]);
  if (!result.rowCount) fail("SHIPPING_METHOD_NOT_FOUND", "Shipping method does not exist", { id });
  const row = result.rows[0];
  return {
    id: row.id,
    name: row.name,
    active: row.active,
    currency: row.currency,
    baseFeeMinor: moneyToMinor(row.base_fee, "shipping.baseFee"),
    freeShippingThresholdMinor: row.free_shipping_threshold === null
      ? null
      : moneyToMinor(row.free_shipping_threshold, "shipping.freeShippingThreshold"),
    codFeeMinor: moneyToMinor(row.cod_fee, "shipping.codFee"),
    codAllowed: row.cod_allowed,
    shippingVatRateUnits: vatRateToUnits(row.shipping_vat_rate, "shipping.vatRate"),
    codVatRateUnits: vatRateToUnits(row.cod_vat_rate, "shipping.codVatRate"),
    shippingPriceIncludesTax: row.shipping_price_includes_tax,
    codPriceIncludesTax: row.cod_price_includes_tax,
    supportedCountryCodes: normalizeCountryCodes(row.supported_country_codes),
  };
}

async function loadCoupon(client, code, customerKeyHash, lockRows) {
  if (!code) return null;
  const result = await client.query(`
    SELECT code, type, value, active, expires_at, uses, name, max_uses,
           free_shipping, starts_at, ends_at, min_subtotal, max_discount,
           allowed_product_ids, allowed_variant_ids, per_customer_limit,
           currency
      FROM coupons
     WHERE code = $1${lockClause(lockRows)}
  `, [code]);
  if (!result.rowCount) fail("COUPON_NOT_FOUND", "Coupon does not exist");
  const row = result.rows[0];
  const usage = await client.query(`
    SELECT
      COUNT(*) FILTER (WHERE status IN ('reserved', 'consumed'))::int AS total_uses,
      COUNT(*) FILTER (
        WHERE customer_key_hash = $2 AND status IN ('reserved', 'consumed')
      )::int AS customer_uses
      FROM coupon_redemptions
     WHERE coupon_code = $1
  `, [row.code, customerKeyHash]);
  const currentUses = Number(row.uses || 0) + Number(usage.rows[0].total_uses || 0);
  const coupon = {
    code: row.code,
    type: row.type,
    active: row.active,
    startsAt: row.starts_at,
    endsAt: row.ends_at || legacyExpiryExclusive(row.expires_at),
    minSubtotalMinor: moneyToMinor(row.min_subtotal, "coupon.minSubtotal"),
    maxDiscountMinor: row.max_discount === null
      ? null
      : moneyToMinor(row.max_discount, "coupon.maxDiscount"),
    allowedProductIds: normalizeIdentifierList(row.allowed_product_ids, "allowedProductIds"),
    allowedVariantIds: normalizeIdentifierList(row.allowed_variant_ids, "allowedVariantIds"),
    perCustomerLimit: row.per_customer_limit,
    customerUses: Number(usage.rows[0].customer_uses || 0),
    maxUses: row.max_uses,
    currentUses,
    freeShipping: row.free_shipping,
    currency: row.currency,
  };
  if (row.type === "percent") {
    coupon.percentageUnits = percentageToUnits(row.value, "coupon.value");
  } else {
    coupon.fixedAmountMinor = moneyToMinor(row.value, "coupon.value");
  }
  return coupon;
}

async function loadProductRows(client, items, lockRows) {
  const variantIds = items.map((item) => item.variantId).filter(Boolean);
  const variantResult = variantIds.length ? await client.query(`
    SELECT id, product_id, color, color_en, sku, price, sale_price, sale_until,
           stock, available, vat_rate, tax_category
      FROM product_variants
     WHERE id = ANY($1::text[])${lockClause(lockRows)}
  `, [variantIds]) : { rows: [] };
  const variants = byId(variantResult.rows);

  for (const item of items) {
    if (!item.variantId) continue;
    const variant = variants.get(item.variantId);
    if (!variant) fail("PRODUCT_VARIANT_NOT_FOUND", "Product variant does not exist", item);
    if (variant.product_id !== item.productId) {
      fail("PRODUCT_VARIANT_MISMATCH", "Variant does not belong to the requested product", item);
    }
  }

  const productIds = [...new Set(items.map((item) => item.productId))];
  const productResult = await client.query(`
    SELECT id, title, active, price, sale_price, sale_until, sku, vat_rate, tax_category
      FROM products
     WHERE id = ANY($1::text[])${lockClause(lockRows)}
  `, [productIds]);
  const overrideResult = await client.query(`
    SELECT id, stock, price, sale_price, sale_until, active, sku, vat_rate, tax_category
      FROM catalog_overrides
     WHERE id = ANY($1::text[])${lockClause(lockRows)}
  `, [productIds]);
  const inventoryResult = await client.query(`
    SELECT id, product_id, variant_id, sku, tracks_stock,
           stock_on_hand, reserved_quantity, available_quantity
      FROM inventory
     WHERE product_id = ANY($1::text[])${lockClause(lockRows)}
  `, [productIds]);
  return {
    variants,
    products: byId(productResult.rows),
    overrides: byId(overrideResult.rows),
    inventory: new Map(inventoryResult.rows.map((row) => [
      inventoryKey(row.product_id, row.variant_id),
      row,
    ])),
  };
}

async function loadTaxRates(client, countryCode, categories, now) {
  const result = await client.query(`
    SELECT DISTINCT ON (tax_category)
           tax_category, rate, prices_include_tax
      FROM tax_rates
     WHERE country_code = $1
       AND tax_category = ANY($2::text[])
       AND active = TRUE
       AND valid_from <= $3
       AND (valid_to IS NULL OR valid_to > $3)
     ORDER BY tax_category, valid_from DESC
  `, [countryCode, categories, now]);
  return new Map(result.rows.map((row) => [row.tax_category, row]));
}

function baseProduct(item, rows, policy) {
  const staticProduct = STATIC_PRODUCTS.get(item.productId);
  const customProduct = rows.products.get(item.productId);
  const override = rows.overrides.get(item.productId);
  if (staticProduct) {
    return {
      title: staticProduct.title,
      active: override ? override.active : true,
      regularPrice: override?.price,
      salePrice: override?.sale_price,
      saleUntil: override?.sale_until,
      stock: override?.stock ?? null,
      sku: override?.sku || null,
      vatRate: override?.vat_rate ?? null,
      taxCategory: override?.tax_category || policy.defaultTaxCategory,
    };
  }
  if (!customProduct) fail("PRODUCT_NOT_FOUND", "Product does not exist", item);
  return {
    title: customProduct.title,
    active: customProduct.active,
    regularPrice: customProduct.price,
    salePrice: customProduct.sale_price,
    saleUntil: customProduct.sale_until,
    stock: override?.stock ?? null,
    sku: customProduct.sku || override?.sku || null,
    vatRate: customProduct.vat_rate ?? override?.vat_rate ?? null,
    taxCategory: customProduct.tax_category || override?.tax_category || policy.defaultTaxCategory,
  };
}

function resolveLine(item, rows, taxRates, policy, now) {
  const base = baseProduct(item, rows, policy);
  const variant = item.variantId ? rows.variants.get(item.variantId) : null;
  const inventory = rows.inventory.get(inventoryKey(item.productId, item.variantId));
  if (!base.active || (variant && !variant.available)) {
    fail("PRODUCT_INACTIVE", "Product or variant is inactive", item);
  }

  if (base.regularPrice === null || base.regularPrice === undefined) {
    fail("PRODUCT_PRICE_MISSING", "Product price is not configured", item);
  }
  const baseRegular = moneyToMinor(base.regularPrice, `product.${item.productId}.price`);
  const baseEffective = activeSalePrice(
    baseRegular,
    base.salePrice,
    base.saleUntil,
    now,
    `product.${item.productId}.salePrice`
  );

  let regularUnitPriceMinor = baseRegular;
  let effectiveUnitPriceMinor = baseEffective;
  if (variant && variant.price !== null && variant.price !== undefined) {
    regularUnitPriceMinor = moneyToMinor(variant.price, `variant.${variant.id}.price`);
    effectiveUnitPriceMinor = activeSalePrice(
      regularUnitPriceMinor,
      variant.sale_price,
      variant.sale_until,
      now,
      `variant.${variant.id}.salePrice`
    );
  }

  const taxCategory = variant?.tax_category || base.taxCategory || policy.defaultTaxCategory;
  const taxRate = taxRates.get(taxCategory);
  const explicitVatRate = variant?.vat_rate ?? base.vatRate;
  if (explicitVatRate === null || explicitVatRate === undefined) {
    if (!taxRate) fail("VAT_RATE_MISSING", "No active VAT rule exists for product", {
      ...item,
      taxCategory,
    });
  }
  const vatRate = String(explicitVatRate ?? taxRate.rate);

  return {
    productId: item.productId,
    variantId: item.variantId || null,
    productName: base.title,
    variantName: variant ? (variant.color || variant.color_en || null) : null,
    sku: inventory?.sku || variant?.sku || base.sku || null,
    quantity: item.quantity,
    regularUnitPriceMinor,
    effectiveUnitPriceMinor,
    vatRate,
    vatRateUnits: vatRateToUnits(vatRate, `product.${item.productId}.vatRate`),
    pricesIncludeTax: taxRate ? taxRate.prices_include_tax : policy.catalogPricesIncludeTax,
    stockAvailable: inventory
      ? (inventory.tracks_stock ? inventory.available_quantity : null)
      : (variant ? variant.stock : base.stock),
  };
}

async function loadPricingContext(options) {
  const {
    client,
    items,
    shippingMethodId,
    couponCode,
    customerKeyHash,
    destinationCountry,
    now,
    lockRows = false,
  } = options;
  if (!client || typeof client.query !== "function") {
    throw new TypeError("loadPricingContext requires a PostgreSQL client");
  }

  const policy = await loadPolicy(client, lockRows);
  const shippingMethod = await loadShippingMethod(client, shippingMethodId, lockRows);
  const rows = await loadProductRows(client, items, lockRows);
  const categories = [...new Set(items.map((item) => {
    const base = baseProduct(item, rows, policy);
    const variant = item.variantId ? rows.variants.get(item.variantId) : null;
    return variant?.tax_category || base.taxCategory || policy.defaultTaxCategory;
  }))];
  const taxRates = await loadTaxRates(client, destinationCountry, categories, now);
  const lines = items.map((item) => resolveLine(item, rows, taxRates, policy, now));
  const coupon = await loadCoupon(client, couponCode, customerKeyHash, lockRows);
  return { policy, shippingMethod, lines, coupon };
}

module.exports = {
  PricingRepositoryError,
  loadPricingContext,
};
