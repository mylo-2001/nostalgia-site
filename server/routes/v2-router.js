"use strict";

const express = require("express");

const auth = require("../auth");
const security = require("../security");
const { createCheckoutOrder } = require("../services/order-creation-service");
const { createCardPaymentSession, getOrderPaymentStatus } = require("../services/payment-service");
const { priceOrder } = require("../services/pricing-service");
const { reviewCodOrder } = require("../services/cod-service");
const { expireInventoryReservations } = require("../services/inventory-service");
const { getAdminOrder, transitionAdminOrder, updateAdminAddress,
  updateAdminShipment, authorizeAdmin } = require("../services/admin-order-service");
const { approveReturn, cancelReturn, createReturn, getReturnOptions, getReturnShipment,
  handReturnToCourier, inspectReturn, listAdminReturns, receiveReturn, rejectReturn } =
  require("../services/return-refund-service");
const { consumeDatabaseRateLimit, revokeAdminSessions, secureEqualHash,
  validateAdminDatabaseSession } = require("../services/admin-session-service");
const { StripePaymentProvider } = require("../payments/stripe-provider");

function asyncRoute(handler) {
  return (req, res, next) => Promise.resolve(handler(req, res, next)).catch(next);
}

function statusForError(error) {
  if (/NOT_FOUND$/.test(error.code || "")) return 404;
  if (/VERSION_CONFLICT|IDEMPOTENCY_KEY_REUSED|IN_PROGRESS|PROVIDER_REFUND_REQUIRED/.test(error.code || "")) return 409;
  if (/PERMISSION|FORBIDDEN/.test(error.code || "")) return 403;
  if (/DENIED|UNAUTHORIZED|SESSION_INVALID/.test(error.code || "")) return 401;
  if (/INSUFFICIENT_STOCK|QUANTITY_EXCEEDED/.test(error.code || "")) return 409;
  if (error.code) return 400;
  return 500;
}

function sameOriginReturnUrl(req, value) {
  let parsed;
  try { parsed = new URL(String(value || "")); }
  catch (_) {
    const error = new Error("Payment return URL is invalid");
    error.code = "INVALID_RETURN_URL";
    throw error;
  }
  const configured = String(process.env.SITE_URL || "").replace(/\/$/, "");
  const expectedOrigin = configured
    ? new URL(configured).origin
    : `${req.protocol}://${req.get("host")}`;
  if (parsed.origin !== expectedOrigin) {
    const error = new Error("Payment return URL must use the storefront origin");
    error.code = "RETURN_URL_ORIGIN_FORBIDDEN";
    throw error;
  }
  return parsed.toString();
}

function createV2Router(options) {
  const router = express.Router();
  const pool = () => options.getPool();

  function limit(scope, maximum, windowMs = 60000) {
    return asyncRoute(async (req, res, next) => {
      const result = await consumeDatabaseRateLimit({ pool: pool(), scope,
        key: `${req.ip || "unknown"}:${req.adminSession?.sub || "public"}`,
        limit: maximum, windowMs });
      res.set("X-RateLimit-Remaining", String(result.remaining));
      if (!result.allowed) {
        res.set("Retry-After", String(result.retryAfterSeconds));
        return res.status(429).json({ ok: false, error: "RATE_LIMITED",
          requestId: req.requestId });
      }
      next();
    });
  }

  const requireAdmin = asyncRoute(async (req, res, next) => {
    const session = auth.getAdminSession(req);
    if (!session) return res.status(401).json({ ok: false, error: "ADMIN_SESSION_INVALID" });
    const databaseSession = await validateAdminDatabaseSession({
      pool: pool(),
      session,
      requireMfa: security.admin2faRequired(),
    });
    if (["POST", "PUT", "PATCH", "DELETE"].includes(req.method)) {
      const supplied = req.get("x-csrf-token") || "";
      if (!secureEqualHash(supplied, session.csrfHash) ||
          !secureEqualHash(supplied, databaseSession.csrfHash)) {
        return res.status(403).json({ ok: false, error: "CSRF_VALIDATION_FAILED" });
      }
    }
    req.adminSession = session;
    req.v2Admin = databaseSession;
    next();
  });

  function requirePermission(permission) {
    return asyncRoute(async (req, res, next) => {
      const client = await pool().connect();
      try {
        await authorizeAdmin(client, req.v2Admin.adminUserId, permission);
      } finally {
        client.release();
      }
      next();
    });
  }

  router.post("/checkout", limit("checkout", 20), asyncRoute(async (req, res) => {
    if (req.body?.termsAccepted !== true || req.body?.termsVersion !== "2026-08-11") {
      return res.status(400).json({ ok: false, error: "TERMS_NOT_ACCEPTED" });
    }
    if (typeof options.worldlinePaymentsEnabled !== "function" || !options.worldlinePaymentsEnabled()) {
      return res.status(503).json({ ok: false, error: "PAYMENT_NOT_CONFIGURED" });
    }
    await expireInventoryReservations({ pool: pool(), batchSize: 25,
      workerId: "checkout-opportunistic-expiry", requestId: req.requestId });
    const user = auth.getUserSession(req);
    const result = await createCheckoutOrder({ pool: pool(), request: req.body,
      idempotencyKey: req.get("idempotency-key"), requestId: req.requestId,
      identity: user ? { type: "user", email: user.sub } : { type: "guest" },
      guestTokenSecret: process.env.GUEST_TOKEN_SECRET,
      // Phone verification is server-owned. The public checkout cannot attest it.
      riskContext: { phoneVerified: false },
      logger: req.log });
    res.status(result.orderId ? 201 : 200).json({ ok: true, ...result });
  }));

  router.post("/quote", limit("quote", 60), asyncRoute(async (req, res) => {
    const client = await pool().connect();
    try {
      const customerEmail = String(req.body?.customerEmail || "").toLowerCase().trim();
      const request = {
        items: req.body?.items,
        couponCode: req.body?.couponCode,
        shippingMethodId: req.body?.shippingMethodId,
        paymentMethod: req.body?.paymentMethod,
        destinationCountry: req.body?.destinationCountry,
        customerKeyHash: customerEmail ? require("node:crypto").createHash("sha256")
          .update(`coupon-customer:${customerEmail}`).digest("hex") : null,
      };
      const quote = await priceOrder({ client, request, requestId: req.requestId,
        logger: req.log });
      res.json({ ok: true, quote });
    } finally { client.release(); }
  }));

  router.post("/orders/:id/card-session", limit("card-session", 20),
    asyncRoute(async (req, res) => {
      if (typeof options.worldlinePaymentsEnabled !== "function" || !options.worldlinePaymentsEnabled()) {
        return res.status(503).json({ ok: false, error: "PAYMENT_NOT_CONFIGURED" });
      }
      const user = auth.getUserSession(req);
      await getOrderPaymentStatus({ pool: pool(), orderId: req.params.id,
        userEmail: user?.sub || null,
        guestAccessToken: req.get("x-order-access-token") || null });
      const stripe = await options.getStripe();
      if (!stripe) return res.status(503).json({ ok: false, error: "PAYMENT_NOT_CONFIGURED" });
      const result = await createCardPaymentSession({ pool: pool(), orderId: req.params.id,
        idempotencyKey: req.get("idempotency-key"), provider: new StripePaymentProvider(stripe),
        successUrl: sameOriginReturnUrl(req, req.body.successUrl),
        cancelUrl: sameOriginReturnUrl(req, req.body.cancelUrl),
        requestId: req.requestId });
      res.status(201).json({ ok: true, ...result });
    }));

  router.get("/orders/:id/payment-status", limit("order-status", 60),
    asyncRoute(async (req, res) => {
      const user = auth.getUserSession(req);
      const result = await getOrderPaymentStatus({ pool: pool(), orderId: req.params.id,
        userEmail: user?.sub || null, guestAccessToken: req.get("x-order-access-token") || null });
      res.json({ ok: true, ...result });
    }));

  router.post("/orders/:id/returns", limit("return-request", 10),
    asyncRoute(async (req, res) => {
      const user = auth.getUserSession(req);
      await getOrderPaymentStatus({ pool: pool(), orderId: req.params.id,
        userEmail: user?.sub || null, guestAccessToken: req.get("x-order-access-token") || null });
      const result = await createReturn({ pool: pool(), orderId: req.params.id,
        items: req.body.items, reason: req.body.reason,
        idempotencyKey: req.get("idempotency-key"), requestId: req.requestId,
        actor: user ? { type: "customer", id: user.sub } : { type: "guest" } });
      res.status(201).json({ ok: true, ...result });
    }));

  router.get("/orders/:id/return-options", limit("return-options", 30),
    asyncRoute(async (req, res) => {
      const user = auth.getUserSession(req);
      await getOrderPaymentStatus({ pool: pool(), orderId: req.params.id,
        userEmail: user?.sub || null, guestAccessToken: req.get("x-order-access-token") || null });
      const result = await getReturnOptions({ pool: pool(), orderId: req.params.id });
      res.json({ ok: true, ...result });
    }));

  router.use("/admin", requireAdmin, limit("admin-v2", 120));

  router.get("/admin/orders/:id", asyncRoute(async (req, res) => {
    const order = await getAdminOrder({ pool: pool(), orderId: req.params.id,
      adminUserId: req.v2Admin.adminUserId, requestId: req.requestId,
      ipAddress: req.ip, userAgent: req.get("user-agent") });
    res.json({ ok: true, order });
  }));
  router.patch("/admin/orders/:id/state", asyncRoute(async (req, res) => {
    const result = await transitionAdminOrder({ pool: pool(), orderId: req.params.id,
      adminUserId: req.v2Admin.adminUserId, expectedVersion: req.body.expectedVersion,
      changes: req.body.changes, reason: req.body.reason, requestId: req.requestId,
      ipAddress: req.ip, userAgent: req.get("user-agent") });
    res.json({ ok: true, ...result });
  }));
  router.patch("/admin/orders/:id/address", asyncRoute(async (req, res) => {
    const result = await updateAdminAddress({ pool: pool(), orderId: req.params.id,
      adminUserId: req.v2Admin.adminUserId, expectedVersion: req.body.expectedVersion,
      shippingAddress: req.body.shippingAddress, billingAddress: req.body.billingAddress,
      requestId: req.requestId, ipAddress: req.ip, userAgent: req.get("user-agent") });
    res.json({ ok: true, ...result });
  }));
  router.patch("/admin/orders/:id/shipments/:shipmentId", asyncRoute(async (req, res) => {
    const result = await updateAdminShipment({ pool: pool(), orderId: req.params.id,
      shipmentId: req.params.shipmentId, adminUserId: req.v2Admin.adminUserId,
      expectedOrderVersion: req.body.expectedOrderVersion,
      expectedShipmentVersion: req.body.expectedShipmentVersion, status: req.body.status,
      carrier: req.body.carrier, trackingNumber: req.body.trackingNumber,
      reason: req.body.reason, requestId: req.requestId });
    res.json({ ok: true, ...result });
  }));
  router.post("/admin/orders/:id/cod-review", requirePermission("risk.review"),
    asyncRoute(async (req, res) => {
    const result = await reviewCodOrder({ pool: pool(), orderId: req.params.id,
      reviewerId: req.v2Admin.adminUserId, decision: req.body.decision,
      reason: req.body.reason, requestId: req.requestId });
    res.json({ ok: true, ...result });
  }));
  router.post("/admin/returns/:id/approve", requirePermission("return.manage"),
    asyncRoute(async (req, res) => {
    const result = await approveReturn({ pool: pool(), returnId: req.params.id,
      adminUserId: req.v2Admin.adminUserId, requestId: req.requestId });
    res.json({ ok: true, ...result });
  }));
  router.get("/admin/returns", requirePermission("return.manage"),
    asyncRoute(async (req, res) => {
    const result = await listAdminReturns({ pool: pool(), status: req.query.status,
      limit: req.query.limit });
    res.json({ ok: true, ...result });
  }));
  router.get("/admin/orders/:id/return-options", requirePermission("return.manage"),
    asyncRoute(async (req, res) => {
      const result = await getReturnOptions({ pool: pool(), orderId: req.params.id,
        allowOrderNumber: true });
      res.json({ ok: true, ...result });
    }));
  router.post("/admin/orders/:id/returns", requirePermission("return.manage"),
    asyncRoute(async (req, res) => {
      const order = await getReturnOptions({ pool: pool(), orderId: req.params.id,
        allowOrderNumber: true });
      const result = await createReturn({ pool: pool(), orderId: order.orderId,
        items: req.body.items, reason: req.body.reason,
        idempotencyKey: req.get("idempotency-key"), requestId: req.requestId,
        actor: { type: "admin", id: req.v2Admin.adminUserId } });
      res.status(result.idempotent ? 200 : 201).json({ ok: true, ...result });
    }));
  router.post("/admin/returns/:id/reject", requirePermission("return.manage"),
    asyncRoute(async (req, res) => {
    const result = await rejectReturn({ pool: pool(), returnId: req.params.id,
      adminUserId: req.v2Admin.adminUserId, reason: req.body.reason, requestId: req.requestId });
    res.json({ ok: true, ...result });
  }));
  router.post("/admin/returns/:id/cancel", requirePermission("return.manage"),
    asyncRoute(async (req, res) => {
    const result = await cancelReturn({ pool: pool(), returnId: req.params.id,
      adminUserId: req.v2Admin.adminUserId, reason: req.body.reason, requestId: req.requestId });
    res.json({ ok: true, ...result });
  }));
  router.post("/admin/returns/:id/receive", requirePermission("return.manage"),
    asyncRoute(async (req, res) => {
    const result = await receiveReturn({ pool: pool(), returnId: req.params.id,
      adminUserId: req.v2Admin.adminUserId, requestId: req.requestId });
    res.json({ ok: true, ...result });
  }));
  router.post("/admin/returns/:id/handoff", requirePermission("return.manage"),
    asyncRoute(async (req, res) => {
      const result = await handReturnToCourier({ pool: pool(), returnId: req.params.id,
        adminUserId: req.v2Admin.adminUserId, carrier: req.body.carrier,
        trackingNumber: req.body.trackingNumber, requestId: req.requestId });
      res.json({ ok: true, ...result });
    }));
  router.post("/admin/returns/:id/inspect", requirePermission("return.manage"),
    asyncRoute(async (req, res) => {
    const result = await inspectReturn({ pool: pool(), returnId: req.params.id,
      adminUserId: req.v2Admin.adminUserId, decisions: req.body.decisions,
      requestId: req.requestId });
    res.json({ ok: true, ...result });
  }));
  router.get("/admin/returns/:id/tracking", requirePermission("return.manage"),
    asyncRoute(async (req, res) => {
      const shipment = await getReturnShipment({ pool: pool(), returnId: req.params.id });
      if (shipment.carrier !== "acs") {
        return res.status(400).json({ ok: false, error: "RETURN_CARRIER_NOT_SUPPORTED" });
      }
      if (!options.acs?.configured()) {
        return res.status(503).json({ ok: false, error: "ACS_NOT_CONFIGURED" });
      }
      const [summary, details] = await Promise.all([
        options.acs.trackingSummary(shipment.trackingNumber),
        options.acs.trackingDetails(shipment.trackingNumber),
      ]);
      res.json({ ok: true, shipment, summary, checkpoints: details.map((point) => ({
        at: point.checkpoint_date_time || null,
        action: point.checkpoint_action || "",
        location: point.checkpoint_location || "",
      })) });
    }));
  router.post("/admin/refunds", requirePermission("refund.manage"),
    asyncRoute(async (req, res) => {
    res.status(503).json({ ok: false, error: "WORLDLINE_REFUNDS_NOT_CONFIGURED",
      requestId: req.requestId });
  }));
  router.post("/admin/logout-all", asyncRoute(async (req, res) => {
    const result = await revokeAdminSessions({ pool: pool(),
      adminUserId: req.v2Admin.adminUserId, requestId: req.requestId });
    auth.endAdminSession(res);
    res.json({ ok: true, ...result });
  }));

  router.use((error, req, res, next) => {
    if (res.headersSent) return next(error);
    const status = statusForError(error);
    if (status >= 500) req.log?.error?.({ event: "v2_unhandled_error",
      requestId: req.requestId, message: error.message });
    res.status(status).json({ ok: false, error: error.code || "INTERNAL_ERROR",
      requestId: req.requestId });
  });
  return router;
}

module.exports = { createV2Router, sameOriginReturnUrl, statusForError };
