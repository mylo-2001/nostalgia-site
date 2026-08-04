"use strict";

const crypto = require("node:crypto");

const { priceOrder } = require("./pricing-service");
const {
  consumeInventoryReservationGroup,
  reserveInventory,
  sha256,
} = require("./inventory-service");
const { enqueueNotification } = require("./notification-outbox-service");

class OrderCreationError extends Error {
  constructor(code, message, details = {}) {
    super(message);
    this.name = "OrderCreationError";
    this.code = code;
    this.details = details;
  }
}

function fail(code, message, details) {
  throw new OrderCreationError(code, message, details);
}

function text(value, maxLength, required = false) {
  const normalized = String(value || "").trim();
  if (required && !normalized) fail("CHECKOUT_FIELD_REQUIRED", "Required checkout field is missing");
  if (normalized.length > maxLength) fail("CHECKOUT_FIELD_TOO_LONG", "Checkout field is too long");
  return normalized;
}

function email(value) {
  const normalized = text(value, 254, true).toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalized)) {
    fail("INVALID_CUSTOMER_EMAIL", "Customer email is invalid");
  }
  return normalized;
}

function address(value, fallbackCountry) {
  const source = value && typeof value === "object" && !Array.isArray(value) ? value : {};
  const countryCode = text(source.countryCode || fallbackCountry, 2, true).toUpperCase();
  if (!/^[A-Z]{2}$/.test(countryCode)) fail("INVALID_ADDRESS_COUNTRY", "Address country is invalid");
  return {
    firstName: text(source.firstName, 80, true),
    lastName: text(source.lastName, 80, true),
    company: text(source.company, 160),
    line1: text(source.line1, 180, true),
    line2: text(source.line2, 180),
    city: text(source.city, 100, true),
    region: text(source.region, 100),
    postalCode: text(source.postalCode, 24, true),
    countryCode,
    phone: text(source.phone, 40, true),
  };
}

function normalizeCheckout(request, identity = {}) {
  if (!request || typeof request !== "object" || Array.isArray(request)) {
    fail("INVALID_CHECKOUT_REQUEST", "Checkout request must be an object");
  }
  for (const field of [
    "price", "subtotal", "discount", "discountTotal", "shippingTotal",
    "codFee", "vatTotal", "total", "grandTotal",
  ]) {
    if (Object.prototype.hasOwnProperty.call(request, field)) {
      fail("CLIENT_PRICING_FIELD_FORBIDDEN", `Checkout cannot accept browser field: ${field}`);
    }
  }
  const customerSource = request.customer && typeof request.customer === "object"
    ? request.customer
    : {};
  const customerEmail = email(customerSource.email);
  const destinationCountry = text(request.destinationCountry, 2, true).toUpperCase();
  const shippingAddress = address(request.shippingAddress, destinationCountry);
  const billingAddress = request.billingSameAsShipping !== false
    ? shippingAddress
    : address(request.billingAddress, destinationCountry);
  if (shippingAddress.countryCode !== destinationCountry) {
    fail("DESTINATION_ADDRESS_MISMATCH", "Shipping country does not match pricing destination");
  }
  const paymentMethod = String(request.paymentMethod || "").toLowerCase();
  if (paymentMethod !== "card") fail("INVALID_PAYMENT_METHOD", "Only card payment is available");

  const userEmail = identity.type === "user" ? email(identity.email) : null;
  return {
    items: request.items,
    couponCode: request.couponCode ? text(request.couponCode, 100).toUpperCase() : null,
    shippingMethodId: text(request.shippingMethodId, 100, true),
    paymentMethod,
    destinationCountry,
    customer: {
      firstName: text(customerSource.firstName, 80, true),
      lastName: text(customerSource.lastName, 80, true),
      email: customerEmail,
      phone: text(customerSource.phone, 40, true),
      notes: text(customerSource.notes, 1000),
      documentType: customerSource.documentType === "invoice" ? "invoice" : "receipt",
      company: text(customerSource.company, 160),
      taxId: text(customerSource.taxId, 30),
      taxOffice: text(customerSource.taxOffice, 100),
      activity: text(customerSource.activity, 160),
    },
    shippingAddress,
    billingAddress,
    lang: request.lang === "en" ? "en" : "el",
    userEmail,
  };
}

function canonicalCheckout(normalized) {
  return JSON.stringify({
    items: normalized.items,
    couponCode: normalized.couponCode,
    shippingMethodId: normalized.shippingMethodId,
    paymentMethod: normalized.paymentMethod,
    destinationCountry: normalized.destinationCountry,
    customer: normalized.customer,
    shippingAddress: normalized.shippingAddress,
    billingAddress: normalized.billingAddress,
    lang: normalized.lang,
    userEmail: normalized.userEmail,
  });
}

function guestToken(secret, keyHash, orderId) {
  if (!secret || Buffer.byteLength(secret, "utf8") < 32) {
    fail("GUEST_TOKEN_SECRET_MISSING", "Guest token secret must contain at least 32 bytes");
  }
  return crypto.createHmac("sha256", secret)
    .update(`${keyHash}:${orderId}`, "utf8")
    .digest("base64url");
}

function publicResponse(response, options) {
  const result = { ...response };
  if (response.guestAccess) {
    result.guestAccessToken = guestToken(
      options.guestTokenSecret,
      options.keyHash,
      response.orderId
    );
  }
  delete result.guestAccess;
  return result;
}

async function nextOrderNumber(client) {
  const result = await client.query("SELECT nextval('order_number_seq') AS number");
  return `NC-${String(result.rows[0].number).padStart(4, "0")}`;
}

async function insertOrderItems(client, orderId, quote) {
  const rows = [];
  for (let index = 0; index < quote.items.length; index += 1) {
    const item = quote.items[index];
    const result = await client.query(`
      INSERT INTO order_items (
        order_id, line_number, product_id, variant_id, product_name,
        variant_name, sku, quantity, unit_price, original_unit_price,
        discount_amount, vat_rate, vat_amount, line_subtotal, line_total, currency
      ) VALUES (
        $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16
      ) RETURNING id
    `, [
      orderId,
      index + 1,
      item.productId,
      item.variantId,
      item.productName,
      item.variantName,
      item.sku,
      item.quantity,
      item.unitPrice,
      item.originalUnitPrice,
      item.discountAmount,
      item.vatRate,
      item.vatAmount,
      item.lineSubtotal,
      item.lineTotal,
      quote.currency,
    ]);
    rows.push({
      orderItemId: result.rows[0].id,
      productId: item.productId,
      variantId: item.variantId,
      quantity: item.quantity,
    });
  }
  return rows;
}

async function createOrderTransaction(options, normalized, idempotency, now) {
  const { client } = options;
  if (normalized.couponCode) {
    await client.query("SELECT code FROM coupons WHERE code = $1 FOR UPDATE", [normalized.couponCode]);
  }
  const customerKeyHash = sha256(`coupon-customer:${normalized.customer.email}`);
  const quote = await priceOrder({
    client,
    request: {
      items: normalized.items,
      couponCode: normalized.couponCode,
      shippingMethodId: normalized.shippingMethodId,
      paymentMethod: normalized.paymentMethod,
      destinationCountry: normalized.destinationCountry,
      customerKeyHash,
    },
    requestId: options.requestId,
    now,
    lockRows: true,
    logger: options.logger,
  });

  const orderId = crypto.randomUUID();
  const number = await nextOrderNumber(client);
  const isGuest = !normalized.userEmail;
  const accessToken = isGuest
    ? guestToken(options.guestTokenSecret, idempotency.keyHash, orderId)
    : null;
  const accessExpiry = isGuest ? new Date(now.getTime() + (30 * 86400000)) : null;
  const orderStatus = "pending";
  const paymentStatus = "pending";
  const legacyItems = quote.items.map((item) => ({
    id: item.variantId || item.productId,
    productId: item.productId,
    variantId: item.variantId,
    qty: item.quantity,
    title: item.productName,
    price: item.unitPrice,
    sku: item.sku,
  }));
  const legacyCustomer = {
    firstname: normalized.customer.firstName,
    lastname: normalized.customer.lastName,
    email: normalized.customer.email,
    phone: normalized.customer.phone,
    street: normalized.shippingAddress.line1,
    city: normalized.shippingAddress.city,
    postal: normalized.shippingAddress.postalCode,
    prefecture: normalized.shippingAddress.region,
    countryCode: normalized.shippingAddress.countryCode,
    notes: normalized.customer.notes,
    docType: normalized.customer.documentType === "invoice" ? "invoice" : "receipt",
    company: normalized.customer.company,
    afm: normalized.customer.taxId,
    doy: normalized.customer.taxOffice,
    activity: normalized.customer.activity,
    courier: normalized.shippingMethodId,
  };

  await client.query(`
    INSERT INTO orders (
      id, number, status, payment, payment_status, shipping_status,
      coupon, discount, total, lang, user_email, customer, items,
      order_status_v2, payment_status_v2, shipping_status_v2,
      payment_method_v2, currency, subtotal, discount_total,
      shipping_total, cod_fee, vat_total, other_charges_total, grand_total,
      tax_included, shipping_method_id, billing_address_snapshot,
      shipping_address_snapshot, guest_access_token_hash, guest_access_expires_at,
      request_id, checkout_idempotency_id, checkout_request_hash,
      customer_email_normalized, pricing_snapshot
    ) VALUES (
      $1, $2, $3, $4, $5, 'not_ready', $6, $7, $8, $9, $10, $11, $12,
      $13, $14, 'not_ready', $15, $16, $17, $18, $19, $20, $21, $22, $23,
      TRUE, $24, $25, $26, $27, $28, $29, $30, $31, $32, $33
    )
  `, [
    orderId,
    number,
    "new",
    "stripe",
    paymentStatus,
    normalized.couponCode || "",
    quote.breakdown.discountTotal,
    quote.breakdown.grandTotal,
    normalized.lang,
    normalized.userEmail,
    legacyCustomer,
    JSON.stringify(legacyItems),
    orderStatus,
    paymentStatus,
    normalized.paymentMethod,
    quote.currency,
    quote.breakdown.subtotal,
    quote.breakdown.discountTotal,
    quote.breakdown.shippingTotal,
    quote.breakdown.codFee,
    quote.breakdown.vatTotal,
    quote.breakdown.otherChargesTotal,
    quote.breakdown.grandTotal,
    normalized.shippingMethodId,
    normalized.billingAddress,
    normalized.shippingAddress,
    accessToken ? sha256(accessToken) : null,
    accessExpiry,
    options.requestId || null,
    idempotency.id,
    idempotency.requestHash,
    normalized.customer.email,
    quote,
  ]);

  const reservationLines = await insertOrderItems(client, orderId, quote);
  const reservation = await reserveInventory({
    client,
    orderId,
    reservationKey: options.idempotencyKey,
    lines: reservationLines,
    now,
    actor: { type: isGuest ? "guest" : "customer", id: normalized.userEmail },
    source: "checkout.order_creation",
    requestId: options.requestId,
  });
  await client.query(`
    UPDATE orders SET reservation_group_key = $2 WHERE id = $1
  `, [orderId, reservation.groupKey]);

  await client.query(`
    INSERT INTO shipments (
      order_id, status, shipping_method_id, shipping_address_snapshot
    ) VALUES ($1, 'not_ready', $2, $3)
  `, [orderId, normalized.shippingMethodId, normalized.shippingAddress]);

  if (quote.coupon) {
    await client.query(`
      INSERT INTO coupon_redemptions (
        coupon_code, order_id, customer_key_hash, status,
        discount_amount, currency, event_key, expires_at
      ) VALUES ($1, $2, $3, 'reserved', $4, $5, $6, $7)
    `, [
      quote.coupon.code,
      orderId,
      customerKeyHash,
      quote.breakdown.couponDiscountTotal,
      quote.currency,
      sha256(`coupon:${idempotency.keyHash}:${quote.coupon.code}`),
      reservation.expiresAt,
    ]);
  }

  for (const [axis, status] of [
    ["order", orderStatus],
    ["payment", paymentStatus],
    ["shipping", "not_ready"],
  ]) {
    await client.query(`
      INSERT INTO order_status_history (
        order_id, axis, from_status, to_status, actor_type, actor_id, source, request_id
      ) VALUES ($1, $2, NULL, $3, $4, $5, 'checkout.order_creation', $6)
    `, [
      orderId,
      axis,
      status,
      isGuest ? "guest" : "customer",
      normalized.userEmail,
      options.requestId || null,
    ]);
  }
  await client.query(`
    INSERT INTO audit_logs (
      actor_type, actor_id, action, entity_type, entity_id,
      new_values, source, request_id
    ) VALUES ($1, $2, 'order.created', 'order', $3, $4, 'checkout.order_creation', $5)
  `, [
    isGuest ? "guest" : "customer",
    normalized.userEmail,
    orderId,
    {
      number,
      orderStatus,
      paymentStatus,
      shippingStatus: "not_ready",
      grandTotal: quote.breakdown.grandTotal,
      currency: quote.currency,
    },
    options.requestId || null,
  ]);

  await enqueueNotification({
    client,
    eventKey: `order_created:${orderId}`,
    eventType: "order_created",
    aggregateType: "order",
    aggregateId: orderId,
    correlationId: options.requestId,
    payload: {
      orderId,
      orderNumber: number,
      customerEmail: normalized.customer.email,
      language: normalized.lang,
    },
  });

  return {
    orderId,
    orderNumber: number,
    orderStatus,
    paymentStatus,
    shippingStatus: "not_ready",
    currency: quote.currency,
    grandTotal: quote.breakdown.grandTotal,
    reservationExpiresAt: reservation.expiresAt,
    riskLevel: null,
    riskDecision: null,
    guestAccess: isGuest,
  };
}

async function createCheckoutOrder(options) {
  if (!options || !options.pool || typeof options.pool.connect !== "function") {
    throw new TypeError("createCheckoutOrder requires a PostgreSQL pool");
  }
  const idempotencyKey = String(options.idempotencyKey || "");
  if (idempotencyKey.length < 16 || idempotencyKey.length > 500) {
    fail("IDEMPOTENCY_KEY_REQUIRED", "Checkout requires a valid idempotency key");
  }
  const normalized = normalizeCheckout(options.request, options.identity);
  const keyHash = sha256(`checkout:${idempotencyKey}`);
  const requestHash = sha256(canonicalCheckout(normalized));
  const now = options.now instanceof Date ? options.now : new Date(options.now || Date.now());
  const client = await options.pool.connect();
  try {
    await client.query("BEGIN");
    const inserted = await client.query(`
      INSERT INTO idempotency_keys (
        scope, key_hash, request_hash, status, expires_at, locked_at
      ) VALUES ('checkout_v2', $1, $2, 'processing', $3, $4)
      ON CONFLICT (scope, key_hash) DO NOTHING
      RETURNING id
    `, [keyHash, requestHash, new Date(now.getTime() + 86400000), now]);
    const record = await client.query(`
      SELECT id, request_hash, status, response_body, resource_id, locked_at
        FROM idempotency_keys
       WHERE scope = 'checkout_v2' AND key_hash = $1
       FOR UPDATE
    `, [keyHash]);
    if (!record.rowCount) fail("IDEMPOTENCY_RECORD_MISSING", "Checkout idempotency record is missing");
    const row = record.rows[0];
    if (row.request_hash.trim() !== requestHash) {
      fail("IDEMPOTENCY_KEY_REUSED", "Idempotency key was reused for a different checkout");
    }
    if (!inserted.rowCount && row.status === "completed") {
      await client.query("COMMIT");
      return publicResponse(row.response_body, {
        guestTokenSecret: options.guestTokenSecret || process.env.GUEST_TOKEN_SECRET,
        keyHash,
      });
    }
    if (!inserted.rowCount && row.status === "processing") {
      const staleBefore = new Date(now.getTime() - 300000);
      if (row.locked_at && new Date(row.locked_at) > staleBefore) {
        fail("CHECKOUT_IN_PROGRESS", "Checkout with this key is still processing");
      }
      await client.query(`
        UPDATE idempotency_keys
           SET attempts = attempts + 1, locked_at = $2, updated_at = $2,
               last_error_code = NULL
         WHERE id = $1
      `, [row.id, now]);
    }

    const response = await createOrderTransaction({
      ...options,
      client,
      idempotencyKey,
      guestTokenSecret: options.guestTokenSecret || process.env.GUEST_TOKEN_SECRET,
    }, {
      ...normalized,
      identity: options.identity,
    }, {
      id: row.id,
      keyHash,
      requestHash,
    }, now);

    await client.query(`
      UPDATE idempotency_keys
         SET status = 'completed', resource_type = $2, resource_id = $3,
             response_status = $4, response_body = $5,
             completed_at = $6, updated_at = $6, locked_at = NULL
       WHERE id = $1
    `, [
      row.id,
      response.orderId ? "order" : "risk_assessment",
      response.orderId || response.assessmentId,
      response.orderId ? 201 : 200,
      response,
      now,
    ]);
    await client.query("COMMIT");
    return publicResponse(response, {
      guestTokenSecret: options.guestTokenSecret || process.env.GUEST_TOKEN_SECRET,
      keyHash,
    });
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

module.exports = {
  OrderCreationError,
  createCheckoutOrder,
  guestToken,
  normalizeCheckout,
};
