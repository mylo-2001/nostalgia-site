"use strict";

/**
 * Order confirmation email (electronic receipt).
 *
 * Email providers (first match wins):
 *   1. Resend — RESEND_API_KEY + EMAIL_FROM (or SMTP_FROM)
 *   2. SMTP   — SMTP_HOST (+ SMTP_PORT/SMTP_SECURE), one mailbox login per
 *      purpose (SMTP_USER_ORDERS/SMTP_PASS_ORDERS, _SUPPORT, _MARKETING).
 *      cPanel-style mail servers only let an authenticated mailbox send
 *      "From" itself, so orders@/support@/newsletter@ each need their own
 *      login — a single shared SMTP_USER/SMTP_PASS is used as a fallback
 *      for whichever purpose doesn't have its own pair set.
 *
 * Also used:
 *   SITE_URL   (public base URL, for absolute image links)
 *   COURIER_NAME (optional shipping carrier on receipt)
 *
 * If nothing is configured, the receipt is logged to the console so the
 * order flow never breaks while you set up email.
 */

const fees = require("./fees");
const security = require("./security");
const nodemailer = require("nodemailer");

const transporters = {}; // keyed by purpose — { key, transporter }

const SMTP_PURPOSE_ENV = {
  orders: ["SMTP_USER_ORDERS", "SMTP_PASS_ORDERS"],
  support: ["SMTP_USER_SUPPORT", "SMTP_PASS_SUPPORT"],
  marketing: ["SMTP_USER_MARKETING", "SMTP_PASS_MARKETING"],
};

function smtpCredentialsFor(purpose) {
  const [userKey, passKey] = SMTP_PURPOSE_ENV[purpose] || [];
  const user = (userKey && process.env[userKey]) || process.env.SMTP_USER;
  const pass = (passKey && process.env[passKey]) || process.env.SMTP_PASS;
  return { user, pass };
}

function resendConfigured() {
  return !!(
    process.env.RESEND_API_KEY &&
    (process.env.EMAIL_FROM || process.env.SMTP_FROM)
  );
}

function smtpConfigured() {
  if (!process.env.SMTP_HOST) return false;
  return ["orders", "support", "marketing"].some((p) => {
    const { user, pass } = smtpCredentialsFor(p);
    return !!(user && pass);
  });
}

function emailConfigured() {
  return resendConfigured() || smtpConfigured();
}

function getTransporter(purpose) {
  const { user, pass } = smtpCredentialsFor(purpose);
  const key = [process.env.SMTP_HOST, process.env.SMTP_PORT, user, pass, process.env.SMTP_SECURE].join("|");
  const cached = transporters[purpose];
  if (cached && cached.key === key) return cached.transporter;
  const transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: parseInt(process.env.SMTP_PORT, 10) || 587,
    secure: process.env.SMTP_SECURE === "true",
    auth: { user, pass },
  });
  transporters[purpose] = { key, transporter };
  return transporter;
}

function esc(str) {
  return String(str == null ? "" : str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function money(n) {
  return "€" + Number(n || 0).toFixed(2);
}

/* Light-on-dark logo for the dark email footer. */
/* logo-email-dark.png is the brand mark matted onto transparency, so it sits on
   the dark footer without a visible plate behind it. The previous file
   (logo light.png) has an OPAQUE cream background baked in — on this footer it
   rendered as a pale rectangle. It also carried the wrong aspect ratio here:
   the artwork is roughly square, not 140x41. */
function footerLogoHtml(base) {
  return (
    '<img src="' + esc(base + "/logo/logo-email-dark.png") + '" alt="Nostalgia Collection" ' +
    'width="104" height="100" style="display:block;margin:0 auto 10px;border:0" />'
  );
}

/* Social icons — hosted SVG files (logo/email-icon-*.svg), same glyphs as
   the site footer (js/site-chrome.js). Hosted, not data: URIs: Roundcube
   and several other webmail sanitizers strip data: image sources outright
   regardless of the "load remote content" setting, so they never rendered. */
function socialIconImg(base, name, label) {
  return (
    '<img src="' + esc(base + "/logo/email-icon-" + name + ".svg") + '" width="20" height="20" ' +
    'alt="' + esc(label) + '" style="vertical-align:middle" />'
  );
}

function socialLinksHtml(base) {
  const links = [
    ["https://www.instagram.com/", "instagram", "Instagram"],
    ["https://www.facebook.com/", "facebook", "Facebook"],
    ["https://www.tiktok.com/", "tiktok", "TikTok"],
  ];
  return links
    .map(([url, icon, label]) => '<a href="' + esc(url) + '" style="display:inline-block;margin:0 8px">' + socialIconImg(base, icon, label) + "</a>")
    .join("");
}

const T = {
  el: {
    subject: (n) => "Επιβεβαίωση παραγγελίας " + n + " — Nostalgia Collection",
    greeting: (name) => "Γεια σου " + name + ",",
    success: "Η παραγγελία σου καταχωρήθηκε με επιτυχία! Ευχαριστούμε για την εμπιστοσύνη σου.",
    orderCode: "Κωδικός παραγγελίας",
    products: "Τα προϊόντα σου",
    qty: "Ποσότητα",
    price: "Τιμή",
    subtotal: "Υποσύνολο",
    discount: "Έκπτωση",
    shipping: "Μεταφορικά",
    freeShipping: "Δωρεάν",
    freeShippingCoupon: "Δωρεάν με το κουπόνι",
    codFee: "Αντικαταβολή",
    total: "Σύνολο",
    courier: "Εταιρεία μεταφοράς",
    courierTbd: "Θα ενημερωθείς για την εταιρεία μεταφοράς και τον αριθμό αποστολής.",
    shipTo: "Διεύθυνση αποστολής",
    payment: "Τρόπος πληρωμής",
    payCard: "Κάρτα (Stripe)",
    payCod: "Αντικαταβολή",
    receipt: "Ηλεκτρονική απόδειξη",
    trackBtn: "Παρακολούθηση παραγγελίας",
    trackHint: "Δες την κατάσταση της παραγγελίας σου οποιαδήποτε στιγμή — χωρίς σύνδεση.",
    needHelp: "Χρειάζεσαι βοήθεια;",
    terms: "Όροι",
    privacy: "Απόρρητο",
    contact: "Επικοινωνία",
    footer: "Nostalgia Collection · Χειροποίητα κεριά",
  },
  en: {
    subject: (n) => "Order confirmation " + n + " — Nostalgia Collection",
    greeting: (name) => "Hi " + name + ",",
    success: "Your order has been placed successfully! Thank you for your trust.",
    orderCode: "Order code",
    products: "Your products",
    qty: "Quantity",
    price: "Price",
    subtotal: "Subtotal",
    discount: "Discount",
    shipping: "Shipping",
    freeShipping: "Free",
    freeShippingCoupon: "Free with your coupon",
    codFee: "Cash on delivery fee",
    total: "Total",
    courier: "Shipping carrier",
    courierTbd: "You will be notified of the shipping carrier and tracking number.",
    shipTo: "Shipping address",
    payment: "Payment method",
    payCard: "Card (Stripe)",
    payCod: "Cash on delivery",
    receipt: "Electronic receipt",
    trackBtn: "Track your order",
    trackHint: "Check your order status anytime — no login needed.",
    needHelp: "Need help?",
    terms: "Terms",
    privacy: "Privacy",
    contact: "Contact",
    footer: "Nostalgia Collection · Handmade candles",
  },
};

function buildHtml(order, lang) {
  const tr = T[lang] || T.el;
  const base = (process.env.SITE_URL || "http://localhost:" + (process.env.PORT || 8000)).replace(/\/$/, "");
  const c = order.customer || {};
  const courier = fees.courierLabel(order.customer && order.customer.courier) || process.env.COURIER_NAME || "";

  function productImageUrl(image) {
    if (!image) return "";
    if (/^https?:\/\//i.test(image)) return image;
    return base + "/" + image;
  }

  const itemsRows = (order.items || [])
    .map((it) => {
      const img = productImageUrl(it.image);
      const lineTotal = it.price != null ? money(it.price * it.qty) : "—";
      return (
        '<tr>' +
        '<td style="padding:10px;border-bottom:1px solid #eee;width:64px">' +
        (img ? '<img src="' + esc(img) + '" width="56" height="56" alt="" style="border-radius:6px;object-fit:cover;display:block" />' : "") +
        "</td>" +
        '<td style="padding:10px;border-bottom:1px solid #eee;font-size:14px;color:#2b2b2b">' + esc(it.title) + "</td>" +
        '<td style="padding:10px;border-bottom:1px solid #eee;text-align:center;font-size:14px;color:#666">×' + it.qty + "</td>" +
        '<td style="padding:10px;border-bottom:1px solid #eee;text-align:right;font-size:14px;color:#2b2b2b">' + lineTotal + "</td>" +
        "</tr>"
      );
    })
    .join("");

  const itemsSubtotal = (order.items || []).reduce(
    (s, it) => s + (it.price != null ? it.price * it.qty : 0),
    0
  );
  /* Prefer the figure recorded at charge time (migration 034). The fallback is
     only for rows written before that, and still has to honour a coupon's free
     shipping or it would invent a charge the customer never paid. */
  const shippingFee =
    order.shippingFee != null
      ? order.shippingFee
      : fees.orderExtraFees(order.payment, itemsSubtotal, {
          couponFreeShipping: !!order.couponFreeShipping,
        }).shipping;
  const codFee =
    order.codFee != null ? order.codFee : order.payment === "cod" ? fees.COD_FEE : 0;
  const subtotal = itemsSubtotal;
  const address =
    esc(c.firstname + " " + c.lastname) + "<br>" +
    esc((c.street || "") + " " + (c.streetNumber || "") + ", " + (c.postal || "") + " " + (c.city || "")) +
    (c.prefecture ? ", " + esc(c.prefecture) : "") + "<br>" +
    esc(c.country || c.countryCode || "");

  return (
    '<div style="font-family:Georgia,\'Times New Roman\',serif;max-width:560px;margin:0 auto;color:#2b2b2b;background:#faf6ef;padding:0">' +
    '<div style="background:#15110e;padding:26px;text-align:center">' +
    '<span style="color:#c5a060;font-size:24px;letter-spacing:4px;text-transform:uppercase">Nostalgia</span>' +
    "</div>" +
    '<div style="padding:28px 26px">' +
    '<p style="font-size:15px">' + esc(tr.greeting(c.firstname || "")) + "</p>" +
    '<p style="font-size:15px;line-height:1.6">' + esc(tr.success) + "</p>" +
    '<div style="background:#fff;border:1px solid #e8ddc8;border-radius:10px;padding:16px 18px;margin:18px 0;text-align:center">' +
    '<div style="font-size:12px;letter-spacing:2px;text-transform:uppercase;color:#8a7a5e">' + esc(tr.orderCode) + "</div>" +
    '<div style="font-size:26px;color:#c5a060;font-weight:bold;letter-spacing:1px;margin-top:4px">' + esc(order.number) + "</div>" +
    "</div>" +
    (order.accessToken
      ? '<div style="text-align:center;margin:18px 0">' +
        '<a href="' + esc(base + "/track?token=" + order.accessToken) + '" style="background:#15110e;color:#c5a060;text-decoration:none;display:inline-block;padding:12px 28px;border-radius:8px;font-size:14px;letter-spacing:1px">' + esc(tr.trackBtn) + "</a>" +
        '<p style="font-size:12px;color:#8a7a5e;margin:8px 0 0">' + esc(tr.trackHint) + "</p>" +
        "</div>"
      : "") +
    '<h3 style="font-size:14px;letter-spacing:1px;text-transform:uppercase;color:#8a7a5e;margin:24px 0 8px">' + esc(tr.products) + "</h3>" +
    '<table style="width:100%;border-collapse:collapse;background:#fff;border:1px solid #eee;border-radius:8px;overflow:hidden">' +
    itemsRows +
    "</table>" +
    '<table style="width:100%;border-collapse:collapse;margin-top:12px;font-size:14px">' +
    (order.discount
      ? '<tr><td style="padding:3px 0;color:#666">' + esc(tr.subtotal) + '</td><td style="padding:3px 0;text-align:right">' + money(subtotal) + "</td></tr>" +
        '<tr><td style="padding:3px 0;color:#666">' + esc(tr.discount) + (order.coupon ? " (" + esc(order.coupon) + ")" : "") + '</td><td style="padding:3px 0;text-align:right;color:#4f7048">−' + money(order.discount) + "</td></tr>"
      : subtotal
        ? '<tr><td style="padding:3px 0;color:#666">' + esc(tr.subtotal) + '</td><td style="padding:3px 0;text-align:right">' + money(subtotal) + "</td></tr>"
        : "") +
    /* Always shown. Hiding the row when shipping is free left the customer
       with a total they could not reconcile, and silently threw away the good
       news that they had earned free delivery. */
    '<tr><td style="padding:3px 0;color:#666">' + esc(tr.shipping) + '</td>' +
    '<td style="padding:3px 0;text-align:right' + (shippingFee ? '' : ';color:#4f7048') + '">' +
    (shippingFee
      ? money(shippingFee)
      : esc(order.couponFreeShipping ? tr.freeShippingCoupon : tr.freeShipping)) +
    "</td></tr>" +
    (codFee
      ? '<tr><td style="padding:3px 0;color:#666">' + esc(tr.codFee) + '</td><td style="padding:3px 0;text-align:right">' + money(codFee) + "</td></tr>"
      : "") +
    (order.total
      ? '<tr><td style="padding:6px 0;font-weight:bold;border-top:1px solid #e8ddc8">' + esc(tr.total) + '</td><td style="padding:6px 0;text-align:right;font-weight:bold;border-top:1px solid #e8ddc8">' + money(order.total) + "</td></tr>"
      : "") +
    "</table>" +
    '<h3 style="font-size:14px;letter-spacing:1px;text-transform:uppercase;color:#8a7a5e;margin:24px 0 6px">' + esc(tr.payment) + "</h3>" +
    '<p style="font-size:14px;margin:0">' + esc(order.payment === "cod" ? tr.payCod : tr.payCard) + "</p>" +
    '<h3 style="font-size:14px;letter-spacing:1px;text-transform:uppercase;color:#8a7a5e;margin:24px 0 6px">' + esc(tr.courier) + "</h3>" +
    '<p style="font-size:14px;margin:0">' + (courier ? esc(courier) : esc(tr.courierTbd)) + "</p>" +
    '<h3 style="font-size:14px;letter-spacing:1px;text-transform:uppercase;color:#8a7a5e;margin:24px 0 6px">' + esc(tr.shipTo) + "</h3>" +
    '<p style="font-size:14px;margin:0;line-height:1.6">' + address + "</p>" +
    '<div style="margin-top:26px;padding-top:16px;border-top:1px solid #e8ddc8;font-size:13px;color:#8a7a5e">' +
    esc(tr.needHelp) + ' <a href="mailto:support@nostalgiacandle.gr" style="color:#a87d34;text-decoration:none">support@nostalgiacandle.gr</a>' +
    "</div>" +
    "</div>" +
    '<div style="background:#15110e;padding:18px;text-align:center;color:#b3a186;font-size:12px;line-height:1.8">' +
    footerLogoHtml(base) + esc(tr.footer) + "<br>" +
    '<a href="' + esc(base) + '/terms" style="color:#c5a060;text-decoration:none">' + esc(tr.terms) + "</a> · " +
    '<a href="' + esc(base) + '/privacy" style="color:#c5a060;text-decoration:none">' + esc(tr.privacy) + "</a> · " +
    '<a href="' + esc(base) + '/contact" style="color:#c5a060;text-decoration:none">' + esc(tr.contact) + "</a>" +
    "</div>" +
    "</div>"
  );
}

/* Plain-text fallback for the order confirmation — mirrors buildHtml so
   clients that block/skip HTML still get something useful. */
function buildText(order, lang) {
  const tr = T[lang] || T.el;
  const c = order.customer || {};
  const base = (process.env.SITE_URL || "http://localhost:" + (process.env.PORT || 8000)).replace(/\/$/, "");
  const courier = fees.courierLabel(order.customer && order.customer.courier) || process.env.COURIER_NAME || "";
  const itemsSubtotal = (order.items || []).reduce(
    (s, it) => s + (it.price != null ? it.price * it.qty : 0),
    0
  );
  const shippingFee = order.shippingFee != null ? order.shippingFee : fees.orderExtraFees(order.payment, itemsSubtotal).shipping;
  const codFee = order.codFee != null ? order.codFee : order.payment === "cod" ? fees.COD_FEE : 0;

  const lines = ["NOSTALGIA COLLECTION", "", tr.greeting(c.firstname || ""), tr.success, "", tr.orderCode + ": #" + order.number];
  if (order.accessToken) lines.push("", tr.trackBtn + ": " + base + "/track?token=" + order.accessToken);
  lines.push("", tr.products.toUpperCase());
  (order.items || []).forEach((it) => {
    lines.push("- " + it.qty + " × " + it.title + (it.price != null ? " — " + money(it.price * it.qty) : ""));
  });
  lines.push("");
  if (itemsSubtotal) lines.push(tr.subtotal + ": " + money(itemsSubtotal));
  if (order.discount) lines.push(tr.discount + (order.coupon ? " (" + order.coupon + ")" : "") + ": -" + money(order.discount));
  lines.push(
    tr.shipping + ": " +
    (shippingFee ? money(shippingFee) : order.couponFreeShipping ? tr.freeShippingCoupon : tr.freeShipping)
  );
  if (codFee) lines.push(tr.codFee + ": " + money(codFee));
  if (order.total) lines.push(tr.total + ": " + money(order.total));
  lines.push("", tr.payment + ": " + (order.payment === "cod" ? tr.payCod : tr.payCard));
  lines.push(tr.courier + ": " + (courier || tr.courierTbd));
  lines.push("", tr.shipTo + ":", (c.firstname + " " + c.lastname).trim(),
    ((c.street || "") + " " + (c.streetNumber || "") + ", " + (c.postal || "") + " " + (c.city || "")).trim() + (c.prefecture ? ", " + c.prefecture : ""));
  lines.push("", tr.needHelp + " support@nostalgiacandle.gr");
  return lines.join("\n");
}

/* orders@ — order-only sender (confirmations, tracking links): anything to
   do with a specific order. newsletter@ — marketing sender (broadcasts,
   welcome coupons); falls back to orders@ if not set. support@ — password
   reset codes and account help, plus Reply-To on order/marketing emails so
   a reply lands in a monitored inbox instead of the sending address. */
function defaultFrom() {
  return process.env.EMAIL_FROM || process.env.SMTP_FROM;
}
function marketingFrom() {
  return process.env.EMAIL_FROM_MARKETING || defaultFrom();
}
function supportFrom() {
  return process.env.SUPPORT_EMAIL || defaultFrom();
}
function supportReplyTo() {
  return (process.env.SUPPORT_EMAIL || "").trim() || undefined;
}

/** Single delivery path — Resend or SMTP, whichever is configured.
 *  `text` is the plain-text fallback — every transactional email should pass
 *  one (mail clients that block/skip HTML still show something useful).
 *  `purpose` ("orders" | "support" | "marketing", default "orders") picks
 *  which mailbox login to authenticate as on the SMTP path — Resend ignores
 *  it, since it sends via API under a verified domain, not mailbox auth. */
async function deliverMail({ to, subject, html, text, from, replyTo, purpose }) {
  if (resendConfigured()) {
    const body = { from: from || defaultFrom(), to: [to], subject, html };
    if (text) body.text = text;
    if (replyTo) body.reply_to = replyTo;
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: "Bearer " + process.env.RESEND_API_KEY,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    });
    if (!res.ok) {
      const errBody = await res.text().catch(() => "");
      throw new Error("Resend " + res.status + (errBody ? ": " + errBody.slice(0, 200) : ""));
    }
    return;
  }
  const p = purpose || "orders";
  const { user } = smtpCredentialsFor(p);
  const mail = { from: from || process.env.SMTP_FROM || user, to, subject, html };
  if (text) mail.text = text;
  if (replyTo) mail.replyTo = replyTo;
  await getTransporter(p).sendMail(mail);
}

/**
 * Send the order confirmation. Never throws — failures are logged so the
 * checkout flow is never blocked by email problems.
 */
async function sendOrderConfirmation(order) {
  const lang = order.lang === "en" ? "en" : "el";
  const tr = T[lang];
  const to = order.customer && order.customer.email;
  if (!to) return;

  const html = buildHtml(order, lang);
  const text = buildText(order, lang);
  const subject = tr.subject(order.number);

  if (!emailConfigured()) {
    console.log(
      "[email] not configured — receipt for " + order.number +
        " would be sent to " + to + " (set RESEND_API_KEY or SMTP_* in .env)."
    );
    return;
  }

  try {
    await deliverMail({ to, subject, html, text, from: defaultFrom(), replyTo: supportReplyTo(), purpose: "orders" });
    console.log("[email] confirmation sent to " + to + " for " + order.number);
  } catch (e) {
    console.error("[email] failed to send confirmation for " + order.number + ":", e.message);
  }
}

/* ===================================================================
 * Order lifecycle emails (preparing · shipped · delivered · issue)
 * One status per email, from orders@, Reply-To support@ — no marketing
 * content, no unsubscribe (these are transactional, not newsletter).
 * =================================================================== */

function stripTags(html) {
  return String(html || "")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/g, " ").replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"');
}

function orderAddressHtml(c) {
  return (
    esc((c.firstname || "") + " " + (c.lastname || "")) + "<br>" +
    esc((c.street || "") + " " + (c.streetNumber || "") + ", " + (c.postal || "") + " " + (c.city || "")) +
    (c.prefecture ? ", " + esc(c.prefecture) : "")
  );
}

function orderItemsSummaryHtml(items) {
  return (items || []).map((it) => esc(it.qty + " × " + it.title)).join("<br>");
}

function orderTrackUrl(order) {
  return order.accessToken ? siteBase() + "/track?token=" + order.accessToken : "";
}

/* Shared shell for the 4 lifecycle emails below — logo, title, one status
   box (label/value rows), one CTA button, an optional extra content slot,
   then a "need help?" line and the legal footer (Terms/Privacy/Contact). */
function orderEmailShell(opts) {
  const base = siteBase();
  const en = opts.lang === "en";
  const rows = (opts.statusRows || [])
    .map((r) =>
      '<tr><td style="padding:4px 14px 4px 0;color:#8a7a5e;font-size:13px;white-space:nowrap;vertical-align:top">' + esc(r.label) + "</td>" +
      '<td style="padding:4px 0;font-size:14px;font-weight:bold;color:#15110e">' + r.value + "</td></tr>"
    )
    .join("");
  const statusBox = rows
    ? '<div style="background:#fff;border:1px solid #e8ddc8;border-radius:10px;padding:16px 18px;margin:18px 0">' +
      '<table style="width:100%;border-collapse:collapse">' + rows + "</table></div>"
    : "";
  const button = opts.ctaUrl
    ? '<div style="text-align:center;margin:22px 0 6px">' +
      '<a href="' + esc(opts.ctaUrl) + '" style="background:#15110e;color:#c5a060;text-decoration:none;' +
      'font-size:14px;letter-spacing:1px;padding:13px 30px;border-radius:8px;display:inline-block;font-weight:bold">' +
      esc(opts.ctaText || "") + "</a></div>"
    : "";

  return (
    '<div style="font-family:Georgia,\'Times New Roman\',serif;max-width:560px;margin:0 auto;color:#2b2b2b;background:#faf6ef">' +
    '<div style="background:#15110e;padding:26px;text-align:center">' +
    '<span style="color:#c5a060;font-size:24px;letter-spacing:4px;text-transform:uppercase">Nostalgia</span>' +
    "</div>" +
    '<div style="padding:28px 26px">' +
    '<h1 style="font-family:Georgia,serif;font-size:20px;color:#15110e;margin:0 0 10px">' + esc(opts.title) + "</h1>" +
    (opts.lead ? '<p style="font-size:15px;line-height:1.6;margin:0 0 4px">' + opts.lead + "</p>" : "") +
    statusBox +
    button +
    (opts.extraHtml || "") +
    '<div style="margin-top:26px;padding-top:16px;border-top:1px solid #e8ddc8;font-size:13px;color:#8a7a5e">' +
    (en ? "Need help?" : "Χρειάζεσαι βοήθεια;") +
    ' <a href="mailto:support@nostalgiacandle.gr" style="color:#a87d34;text-decoration:none">support@nostalgiacandle.gr</a>' +
    "</div>" +
    "</div>" +
    '<div style="background:#15110e;padding:18px;text-align:center;color:#b3a186;font-size:12px;line-height:1.8">' +
    footerLogoHtml(base) +
    "Nostalgia Collection · Χειροποίητα κεριά<br>" +
    '<a href="' + esc(base) + '/terms" style="color:#c5a060;text-decoration:none">' + (en ? "Terms" : "Όροι") + "</a> · " +
    '<a href="' + esc(base) + '/privacy" style="color:#c5a060;text-decoration:none">' + (en ? "Privacy" : "Απόρρητο") + "</a> · " +
    '<a href="' + esc(base) + '/contact" style="color:#c5a060;text-decoration:none">' + (en ? "Contact" : "Επικοινωνία") + "</a>" +
    "</div>" +
    "</div>"
  );
}

/* Plain-text mirror of orderEmailShell. */
function orderEmailText(opts) {
  const en = opts.lang === "en";
  const lines = ["NOSTALGIA COLLECTION", "", opts.title];
  if (opts.lead) lines.push("", stripTags(opts.lead));
  if (opts.statusRows && opts.statusRows.length) {
    lines.push("");
    opts.statusRows.forEach((r) => lines.push(r.label + ": " + stripTags(r.value)));
  }
  if (opts.ctaUrl) lines.push("", (opts.ctaText || "") + ": " + opts.ctaUrl);
  if (opts.extraText) lines.push("", opts.extraText);
  lines.push("", (en ? "Need help?" : "Χρειάζεσαι βοήθεια;") + " support@nostalgiacandle.gr");
  return lines.join("\n");
}

/* "Η παραγγελία ετοιμάζεται" — sent when order.status becomes "processing". */
async function sendOrderPreparing(order) {
  const to = order.customer && order.customer.email;
  if (!to) return;
  const en = order.lang === "en";
  const title = en
    ? "Your order #" + order.number + " is being prepared"
    : "Η παραγγελία σου #" + order.number + " ετοιμάζεται";
  const lead = en
    ? "Good news — we're preparing your order now."
    : "Καλά νέα — ετοιμάζουμε την παραγγελία σου.";
  const statusRows = [
    { label: en ? "Order number" : "Αριθμός παραγγελίας", value: "#" + esc(order.number) },
    { label: en ? "Status" : "Κατάσταση", value: en ? "Being prepared" : "Σε προετοιμασία" },
  ];
  const ctaUrl = orderTrackUrl(order);
  const ctaText = en ? "View order" : "Δες την παραγγελία";
  const html = orderEmailShell({ title, lead, statusRows, ctaUrl, ctaText, lang: order.lang });
  const text = orderEmailText({ title, lead, statusRows, ctaUrl, ctaText, lang: order.lang });
  try {
    await deliverMail({ to, subject: title, html, text, from: defaultFrom(), replyTo: supportReplyTo(), purpose: "orders" });
    console.log("[email] preparing notice sent to " + to + " for " + order.number);
  } catch (e) {
    console.error("[email] failed to send preparing notice:", e.message);
  }
}

/* "Η παραγγελία απεστάλη" — sent the first time shippingStatus reaches the
   courier (handed/transit). `extra.eta` is ACS's delivery_date_expected,
   passed in live from the tracking-sync call that triggered this (not
   persisted — see server.js). */
async function sendOrderShipped(order, extra) {
  const to = order.customer && order.customer.email;
  if (!to) return;
  const en = order.lang === "en";
  const c = order.customer || {};
  const courierName = fees.courierLabel(order.courier || c.courier) || "";
  const title = en
    ? "Your order #" + order.number + " is on its way"
    : "Η παραγγελία σου #" + order.number + " είναι καθ' οδόν";
  const lead = en
    ? "Your order has been handed to the courier and is now in transit."
    : "Η παραγγελία σου παραδόθηκε στον courier και βρίσκεται σε μεταφορά.";
  const statusRows = [];
  if (courierName) statusRows.push({ label: "Courier", value: esc(courierName) });
  if (order.tracking) statusRows.push({ label: en ? "Tracking number" : "Αριθμός αποστολής", value: esc(order.tracking) });
  const eta = extra && extra.eta ? new Date(extra.eta) : null;
  if (eta && !isNaN(eta.getTime())) {
    statusRows.push({
      label: en ? "Estimated delivery" : "Εκτιμώμενη παράδοση",
      value: eta.toLocaleDateString(en ? "en-GB" : "el-GR"),
    });
  }
  const ctaUrl = orderTrackUrl(order);
  const ctaText = en ? "Track shipment" : "Παρακολούθηση αποστολής";
  const addrHtml = orderAddressHtml(c);
  const itemsHtml = orderItemsSummaryHtml(order.items);
  const extraHtml =
    '<h3 style="font-size:13px;letter-spacing:1px;text-transform:uppercase;color:#8a7a5e;margin:22px 0 6px">' +
    (en ? "Delivering to" : "Παράδοση σε") + "</h3>" +
    '<p style="font-size:14px;margin:0 0 16px;line-height:1.6">' + addrHtml + "</p>" +
    '<h3 style="font-size:13px;letter-spacing:1px;text-transform:uppercase;color:#8a7a5e;margin:16px 0 6px">' +
    (en ? "Products" : "Προϊόντα") + "</h3>" +
    '<p style="font-size:14px;margin:0;line-height:1.6">' + itemsHtml + "</p>" +
    (order.total
      ? '<p style="font-size:14px;margin:10px 0 0;font-weight:bold">' + (en ? "Total" : "Σύνολο") + ": " + money(order.total) + "</p>"
      : "");
  const extraText =
    (en ? "Delivering to: " : "Παράδοση σε: ") + stripTags(addrHtml) + "\n" +
    (en ? "Products: " : "Προϊόντα: ") + stripTags(itemsHtml).replace(/\n/g, ", ");
  const html = orderEmailShell({ title, lead, statusRows, ctaUrl, ctaText, extraHtml, lang: order.lang });
  const text = orderEmailText({ title, lead, statusRows, ctaUrl, ctaText, extraText, lang: order.lang });
  try {
    await deliverMail({ to, subject: title, html, text, from: defaultFrom(), replyTo: supportReplyTo(), purpose: "orders" });
    console.log("[email] shipped notice sent to " + to + " for " + order.number);
  } catch (e) {
    console.error("[email] failed to send shipped notice:", e.message);
  }
}

/* "Η παραγγελία παραδόθηκε" — sent when shippingStatus becomes "delivered". */
async function sendOrderDelivered(order) {
  const to = order.customer && order.customer.email;
  if (!to) return;
  const en = order.lang === "en";
  const base = siteBase();
  const title = en
    ? "Your order #" + order.number + " was delivered"
    : "Η παραγγελία σου #" + order.number + " παραδόθηκε";
  const lead = en
    ? "Your order has been delivered. We hope you love it!"
    : "Η παραγγελία σου παραδόθηκε. Ελπίζουμε να σου αρέσει!";
  const statusRows = [{ label: en ? "Order number" : "Αριθμός παραγγελίας", value: "#" + esc(order.number) }];
  const ctaUrl = orderTrackUrl(order);
  const ctaText = en ? "View order" : "Δες την παραγγελία";
  const reviewable = (order.items || []).find((it) => it.id);
  const reviewUrl = reviewable && order.accessToken
    ? base + "/product/" + encodeURIComponent(reviewable.id) + "?reviewToken=" + encodeURIComponent(order.accessToken)
    : "";
  const extraHtml = reviewUrl
    ? '<div style="text-align:center;margin:14px 0 0">' +
      '<a href="' + esc(reviewUrl) + '" style="color:#a87d34;text-decoration:underline;font-size:13px">' +
      (en ? "Write a review" : "Γράψε μια κριτική") + "</a></div>"
    : "";
  const html = orderEmailShell({ title, lead, statusRows, ctaUrl, ctaText, extraHtml, lang: order.lang });
  const text = orderEmailText({
    title, lead, statusRows, ctaUrl, ctaText, lang: order.lang,
    extraText: reviewUrl ? (en ? "Write a review: " : "Γράψε μια κριτική: ") + reviewUrl : "",
  });
  try {
    await deliverMail({ to, subject: title, html, text, from: defaultFrom(), replyTo: supportReplyTo(), purpose: "orders" });
    console.log("[email] delivered notice sent to " + to + " for " + order.number);
  } catch (e) {
    console.error("[email] failed to send delivered notice:", e.message);
  }
}

const ORDER_ISSUE_TEXT = {
  delivery_failed: {
    el: "Ο courier δεν κατάφερε να παραδώσει την παραγγελία σου.",
    en: "The courier was unable to deliver your order.",
  },
  cod_not_delivered: {
    el: "Υπήρξε πρόβλημα με την αντικαταβολή της παραγγελίας σου.",
    en: "There was a problem with the cash-on-delivery payment for your order.",
  },
};

/* "Χρειάζεται ενέργεια" — failed delivery / COD problem. reason must be a
   key of ORDER_ISSUE_TEXT; defaults to delivery_failed. */
async function sendOrderIssue(order, opts) {
  const to = order.customer && order.customer.email;
  if (!to) return;
  const en = order.lang === "en";
  const reasonKey = (opts && opts.reason) in ORDER_ISSUE_TEXT ? opts.reason : "delivery_failed";
  const reasonText = ORDER_ISSUE_TEXT[reasonKey][en ? "en" : "el"];
  const title = en
    ? "Action needed for order #" + order.number
    : "Χρειάζεται ενέργεια για την παραγγελία #" + order.number;
  const lead = reasonText + " " + (en ? "Please get in touch so we can sort this out." : "Επικοινώνησε μαζί μας για να το διορθώσουμε.");
  const statusRows = [{ label: en ? "Order number" : "Αριθμός παραγγελίας", value: "#" + esc(order.number) }];
  const ctaUrl = "mailto:support@nostalgiacandle.gr?subject=" + encodeURIComponent("Order #" + order.number);
  const ctaText = en ? "Contact support" : "Επικοινωνία με υποστήριξη";
  const html = orderEmailShell({ title, lead, statusRows, ctaUrl, ctaText, lang: order.lang });
  const text = orderEmailText({ title, lead, statusRows, ctaUrl, ctaText, lang: order.lang });
  try {
    await deliverMail({ to, subject: title, html, text, from: defaultFrom(), replyTo: supportReplyTo(), purpose: "orders" });
    console.log("[email] issue notice sent to " + to + " for " + order.number);
  } catch (e) {
    console.error("[email] failed to send issue notice:", e.message);
  }
}

/* ===================================================================
 * Marketing broadcasts to account holders
 * (new product · new sale · new coupon) — Greek, branded, best-effort.
 * =================================================================== */

function siteBase() {
  return (process.env.SITE_URL || "http://localhost:" + (process.env.PORT || 8000)).replace(/\/$/, "");
}

function absImage(image) {
  if (!image) return "";
  if (/^https?:\/\//i.test(image)) return image;
  return siteBase() + "/" + image;
}

/* Static, universal — same 2-3 reassurance points on every marketing email. */
const BENEFITS_ROW =
  '<table role="presentation" width="100%" style="margin:22px 0 4px;border-top:1px solid #e8ddc8;border-bottom:1px solid #e8ddc8">' +
  '<tr><td style="padding:14px 0;text-align:center;font-size:12px;color:#8a7a5e;letter-spacing:.3px">' +
  "Φυσικά υλικά &nbsp;·&nbsp; Χειροποίητο &nbsp;·&nbsp; Δωρεάν μεταφορικά άνω των " + fees.FREE_SHIPPING_MIN + "€ &nbsp;·&nbsp; Ιδανικό για δώρο" +
  "</td></tr></table>";

/** One generic, on-brand campaign email (dark header, gold accent).
 *  Kept to ONE clear message per email: hero image/heading, short copy,
 *  one optional price/coupon block, one CTA button — not a catalog. */
function campaignHtml(opts) {
  const base = siteBase();
  const greeting = opts.firstname ? "Γεια σου " + esc(opts.firstname) + "," : "Γεια σου,";
  const img = absImage(opts.image);
  const paras = (opts.paragraphs || [])
    .map((p) => '<p style="font-size:15px;line-height:1.65;margin:0 0 12px">' + p + "</p>")
    .join("");
  const codeBlock = opts.code
    ? '<div style="background:#fff;border:1px dashed #c5a060;border-radius:10px;padding:16px 18px;margin:18px 0;text-align:center">' +
      '<div style="font-size:12px;letter-spacing:2px;text-transform:uppercase;color:#8a7a5e">Εκπτωτικός κωδικός</div>' +
      '<div style="font-size:28px;color:#c5a060;font-weight:bold;letter-spacing:3px;margin-top:6px">' + esc(opts.code) + "</div>" +
      (opts.codeNote ? '<div style="font-size:12px;color:#8a7a5e;margin-top:6px">' + esc(opts.codeNote) + "</div>" : "") +
      "</div>"
    : "";
  const priceBlock = opts.newPrice != null
    ? '<div style="text-align:center;margin:14px 0">' +
      (opts.oldPrice != null
        ? '<span style="font-size:15px;color:#999;text-decoration:line-through">' + money(opts.oldPrice) + "</span> "
        : "") +
      '<span style="font-size:22px;color:' + (opts.oldPrice != null ? "#c0392b" : "#15110e") + ';font-weight:bold">' + money(opts.newPrice) + "</span>" +
      (opts.pct ? ' <span style="font-size:13px;color:#c0392b;font-weight:bold">(−' + opts.pct + "%)</span>" : "") +
      "</div>"
    : "";
  const imageBlock = img
    ? '<div style="text-align:center;margin:18px 0"><img src="' + esc(img) +
      '" alt="" width="320" style="max-width:100%;border-radius:10px;display:inline-block" /></div>'
    : "";
  const button = opts.ctaUrl
    ? '<div style="text-align:center;margin:24px 0 6px">' +
      '<a href="' + esc(opts.ctaUrl) + '" style="background:#15110e;color:#c5a060;text-decoration:none;' +
      'font-size:13px;letter-spacing:2px;text-transform:uppercase;padding:13px 26px;border-radius:6px;display:inline-block">' +
      esc(opts.ctaText || "Δες περισσότερα") + "</a></div>"
    : "";
  const unsubUrl = opts.email
    ? base + "/api/newsletter/unsubscribe?email=" + encodeURIComponent(opts.email) +
      "&token=" + security.newsletterUnsubscribeToken(opts.email)
    : "";

  return (
    '<div style="font-family:Georgia,\'Times New Roman\',serif;max-width:560px;margin:0 auto;color:#2b2b2b;background:#faf6ef">' +
    '<div style="background:#15110e;padding:26px;text-align:center">' +
    '<span style="color:#c5a060;font-size:24px;letter-spacing:4px;text-transform:uppercase">Nostalgia</span>' +
    (opts.kicker
      ? '<div style="color:#b3a186;font-size:13px;letter-spacing:.5px;margin-top:6px">' + esc(opts.kicker) + "</div>"
      : "") +
    "</div>" +
    '<div style="padding:28px 26px">' +
    '<p style="font-size:15px;margin:0 0 14px">' + greeting + "</p>" +
    (opts.heading
      ? '<h2 style="font-family:Georgia,serif;font-size:20px;color:#15110e;margin:0 0 14px;text-align:center">' + esc(opts.heading) + "</h2>"
      : "") +
    imageBlock +
    /* Copy before price: "here is the thing, here is what it costs" reads the
       way a person thinks about it. The reverse order led with a number the
       reader had no context for yet. */
    paras +
    priceBlock +
    codeBlock +
    button +
    (opts.showBenefits === false ? "" : BENEFITS_ROW) +
    "</div>" +
    '<div style="background:#15110e;padding:18px;text-align:center;color:#b3a186;font-size:12px;line-height:1.8">' +
    footerLogoHtml(base) +
    "Nostalgia Collection · Χειροποίητα κεριά<br>" +
    '<a href="mailto:support@nostalgiacandle.gr" style="color:#c5a060;text-decoration:none">support@nostalgiacandle.gr</a>' +
    '<div style="margin:10px 0 2px">' + socialLinksHtml(base) + "</div>" +
    '<a href="' + esc(base) + '" style="color:#c5a060;text-decoration:none">' + esc(base.replace(/^https?:\/\//, "")) + "</a>" +
    (unsubUrl
      ? '<br><a href="' + esc(unsubUrl) + '" style="color:#8a7a68;text-decoration:underline;font-size:11px">Διαγραφή από τα emails μας</a>'
      : "") +
    "</div>" +
    "</div>"
  );
}

async function deliver(to, subject, html) {
  await deliverMail({ to, subject, html, from: marketingFrom(), replyTo: supportReplyTo(), purpose: "marketing" });
}

/* Service notices go out from support@, not newsletter@. A security warning
   arriving from the marketing sender is both odd and self-defeating: plenty of
   people filter marketing mail away unread, which is the last thing you want
   for "someone is impersonating us". */
async function deliverService(to, subject, html) {
  await deliverMail({ to, subject, html, from: supportFrom(), replyTo: supportReplyTo(), purpose: "support" });
}

/* Admin-typed copy is plain text: escape it, then treat blank lines as
   paragraph breaks and single newlines as <br>. No raw HTML is honoured —
   the admin is trusted, but an accidental stray "<" should not silently
   swallow the rest of the sentence. */
function announcementParagraphs(body) {
  return String(body || "")
    .replace(/\r\n/g, "\n")
    .split(/\n{2,}/)
    .map((block) => block.trim())
    .filter(Boolean)
    .map((block) => esc(block).replace(/\n/g, "<br>"));
}

/**
 * One admin-composed announcement to a prepared audience.
 * kind: "service"   → support@ sender, no unsubscribe, no promo blocks.
 *       "marketing" → newsletter@ sender, unsubscribe link per recipient.
 */
/* ---------- announcement template ----------
   A light, editorial layout distinct from the dark campaignHtml used for
   product/sale mail: an announcement should read as a letter from the shop,
   not as an advert.

   Built with tables and inline styles because that is what survives Outlook,
   and the accent marks are text glyphs (✉ ☎ ⌖) rather than SVG — Gmail strips
   SVG <img> outright, so an icon set would silently vanish for a big slice of
   the list. */

const GOLD = "#b8945a";
const INK = "#2b2318";
/* Matches the opaque background baked into logo/logo light.png, so the
   logo blends into the card instead of showing as a pale square. */
const CREAM = "#faf2e8";

function goldRule(margin) {
  return (
    '<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" ' +
    'style="margin:' + (margin || "22px") + ' 0"><tr><td style="border-top:1px solid ' + GOLD +
    ';opacity:.45;font-size:0;line-height:0">&nbsp;</td></tr></table>'
  );
}

/* Icons are PNG, not SVG or emoji: Gmail strips SVG <img> outright and emoji
   render as someone else's artwork (or tofu) depending on the client. Each is
   drawn at 2–3x its display size so it stays crisp on retina. */
function icon(name, size, extra) {
  return (
    '<img src="' + esc(siteBase() + "/logo/email-ic-" + name + ".png") + '" ' +
    'width="' + size + '" height="' + size + '" alt="" ' +
    'style="display:inline-block;vertical-align:middle;border:0;' + (extra || "") + '" />'
  );
}

function calloutBlock(title, items) {
  const list = (items || []).filter(Boolean);
  if (!title && !list.length) return "";
  return (
    '<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" ' +
    'style="background:#f6efe2;border:1px solid ' + GOLD + '33;border-radius:10px;margin:24px 0">' +
    '<tr>' +
    '<td width="72" valign="top" style="padding:20px 0 20px 18px">' +
    icon("shield", 44) +
    "</td>" +
    '<td valign="top" style="padding:18px 20px 18px 8px">' +
    (title
      ? '<div style="font-family:Georgia,serif;font-size:16px;color:' + GOLD +
        ';margin:0 0 10px">' + esc(title) + "</div>"
      : "") +
    (list.length
      ? '<ul style="margin:0;padding-left:20px;color:' + INK + ';font-size:14px;line-height:1.9">' +
        list.map((i) => "<li>" + esc(i) + "</li>").join("") +
        "</ul>"
      : "") +
    "</td></tr></table>"
  );
}

/* Vertical rule with a gold bead at its midpoint. Built from bgcolor table
   cells rather than a bordered div, because Outlook ignores height on an empty
   div but honours it on a <td>. The bead degrades to a small square there —
   border-radius is one of the things Outlook drops. */
function dividerColumn(height) {
  const half = Math.max(10, Math.round((height - 9) / 2));
  /* Each hairline sits in its OWN nested table. Sharing one single-column
     table with the bead made every row as wide as the widest cell, so the
     1px rule rendered as a 9px bar. Colour is a pale gold rather than the
     accent at low opacity — opacity is unreliable across mail clients. */
  const line =
    '<tr><td align="center" style="font-size:0;line-height:0">' +
    '<table role="presentation" cellpadding="0" cellspacing="0" border="0">' +
    '<tr><td width="1" height="' + half + '" bgcolor="#dcc9a5" ' +
    'style="width:1px;font-size:0;line-height:0">&nbsp;</td></tr></table>' +
    "</td></tr>";
  return (
    '<table role="presentation" align="center" cellpadding="0" cellspacing="0" border="0">' +
    line +
    '<tr><td align="center" style="font-size:0;line-height:0;padding:3px 0">' +
    '<table role="presentation" cellpadding="0" cellspacing="0" border="0">' +
    '<tr><td width="7" height="7" bgcolor="' + GOLD + '" ' +
    'style="width:7px;border-radius:50%;font-size:0;line-height:0">&nbsp;</td></tr></table>' +
    "</td></tr>" +
    line +
    "</table>"
  );
}

/* The official addresses, so a reader can verify any suspicious message
   against a list that came from us. Pulled from env, because a hardcoded
   address that later changes is exactly the kind of stale detail that makes a
   security notice look fake. */
function officialContactsBlock() {
  const support = process.env.SUPPORT_EMAIL || "support@nostalgiacandle.gr";
  const extra = String(process.env.OFFICIAL_EMAILS || "")
    .split(",").map((s) => s.trim()).filter(Boolean);
  const emails = [support].concat(extra.filter((e) => e !== support));
  const phone = process.env.SHOP_PHONE || "";
  const city = process.env.SHOP_CITY || "Θεσσαλονίκη";

  const row = (ic, inner) =>
    '<table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:0 0 9px">' +
    '<tr><td width="24" valign="middle">' + icon(ic, 15) + "</td>" +
    '<td valign="middle" style="font-size:13.5px;color:' + INK + ';padding-left:4px">' + inner + "</td>" +
    "</tr></table>";

  const mailRows = emails
    .map((e) =>
      row("mail", '<a href="mailto:' + esc(e) + '" style="color:' + INK + ';text-decoration:none">' + esc(e) + "</a>")
    )
    .join("");

  const right =
    row("pin", esc(city)) +
    (phone
      ? row("phone",
          '<a href="tel:' + esc(phone.replace(/\s+/g, "")) + '" style="color:' + INK + ';text-decoration:none">' +
          esc(phone) + "</a>")
      : "");

  /* Roughly one row per 26px — keeps the bead near the visual middle without
     measuring anything the email client will not tell us about. */
  const rows = Math.max(emails.length, phone ? 2 : 1);

  return (
    '<div style="font-family:Georgia,serif;font-size:15px;color:' + GOLD + ';margin:26px 0 14px">' +
    "Επίσημα στοιχεία επικοινωνίας</div>" +
    '<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"><tr>' +
    '<td width="52%" valign="top">' + mailRows + "</td>" +
    '<td width="34" valign="middle" align="center">' + dividerColumn(rows * 26) + "</td>" +
    '<td valign="top" style="padding-left:6px">' + right + "</td>" +
    "</tr></table>"
  );
}

function announcementHtmlFor(recipient, opts) {
  const isService = opts.kind === "service";
  const base = siteBase();
  const greeting = recipient.firstname
    ? "Αγαπητέ/ή " + esc(recipient.firstname) + ","
    : "Αγαπητέ πελάτη,";

  const paragraphs = announcementParagraphs(opts.body)
    .map((p) => '<p style="font-size:14.5px;line-height:1.75;margin:0 0 14px;color:' + INK + '">' + p + "</p>")
    .join("");

  const button = opts.ctaUrl
    ? '<div style="text-align:center;margin:26px 0 8px">' +
      '<a href="' + esc(opts.ctaUrl) + '" style="background:' + GOLD + ';color:#fff;text-decoration:none;' +
      'font-family:Georgia,serif;font-size:14px;padding:13px 30px;border-radius:6px;display:inline-block">' +
      esc(opts.ctaText || "Επικοινωνήστε μαζί μας") + "</a></div>"
    : "";

  const note = opts.note
    ? '<p style="text-align:center;font-size:12.5px;font-style:italic;color:#7a6a52;margin:14px 0 0">' +
      esc(opts.note) + "</p>"
    : "";

  const unsubUrl =
    !isService && recipient.email
      ? base + "/api/newsletter/unsubscribe?email=" + encodeURIComponent(recipient.email) +
        "&token=" + security.newsletterUnsubscribeToken(recipient.email)
      : "";

  return (
    '<div style="background:#f2ece1;padding:26px 12px;font-family:Georgia,\'Times New Roman\',serif">' +
    '<table role="presentation" align="center" width="600" cellpadding="0" cellspacing="0" border="0" ' +
    'style="max-width:600px;background:' + CREAM + ';border:1px solid ' + GOLD + '33;border-radius:4px">' +
    '<tr><td style="padding:30px 34px 34px">' +

    '<div style="text-align:center">' +
    '<img src="' + esc(base + "/logo/logo-email.png") + '" alt="Nostalgia Collection" ' +
    'width="110" style="display:inline-block;max-width:110px;height:auto" /></div>' +

    goldRule("22px") +

    (opts.heading
      ? '<h1 style="font-family:Georgia,serif;font-weight:normal;font-size:27px;color:' + INK +
        ';text-align:center;margin:0 0 12px">' + esc(opts.heading) + "</h1>"
      : "") +
    (opts.subheading
      ? '<p style="text-align:center;font-size:13.5px;font-weight:bold;color:' + GOLD +
        ';margin:0 0 24px;line-height:1.6">' + esc(opts.subheading) + "</p>"
      : "") +

    '<p style="font-size:14.5px;color:' + INK + ';margin:0 0 14px">' + greeting + "</p>" +
    paragraphs +
    calloutBlock(opts.calloutTitle, opts.calloutItems) +
    (opts.showContacts ? officialContactsBlock() : "") +
    button +
    note +

    goldRule("24px") +

    '<p style="text-align:center;font-size:11.5px;font-style:italic;color:#8a7a62;line-height:1.7;margin:0">' +
    (isService
      ? "Το παρόν μήνυμα στάλθηκε από τη Nostalgia Collection ως ενημέρωση ασφαλείας<br>" +
        "προς τους πελάτες και τους εγγεγραμμένους παραλήπτες newsletter."
      : "Λαμβάνεις αυτό το μήνυμα επειδή έχεις εγγραφεί στο newsletter μας.") +
    (unsubUrl
      ? '<br><a href="' + esc(unsubUrl) + '" style="color:#8a7a62;text-decoration:underline">Διαγραφή από τα emails μας</a>'
      : "") +
    "</p>" +

    "</td></tr></table></div>"
  );
}

/** Exactly what a recipient would receive, for the admin's preview pane. */
function announcementPreviewHtml(opts) {
  return announcementHtmlFor(
    { firstname: "Μαρία", email: "preview@example.com" },
    opts
  );
}

async function sendAnnouncement(recipients, opts) {
  const isService = opts.kind === "service";
  return broadcast(
    recipients,
    opts.subject,
    (u) => announcementHtmlFor(u, opts),
    "announcement:" + (opts.kind || "marketing"),
    isService ? deliverService : deliver
  );
}

/* Providers rate-limit bulk sending (Resend allows a couple of requests a
   second on the lower tiers), and a rejected request is a silently lost email.
   Send in small batches with a pause between them, and retry a failure once
   before giving up — a blast that trips the limit halfway through is worse
   than one that takes a minute longer. Tunable without a redeploy. */
const BROADCAST_BATCH = Math.max(1, parseInt(process.env.EMAIL_BATCH_SIZE, 10) || 10);
const BROADCAST_PAUSE_MS = Math.max(0, parseInt(process.env.EMAIL_BATCH_PAUSE_MS, 10) || 1100);

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/**
 * Send one campaign to many recipients. Never throws.
 * recipients: [{ email, firstname }].
 * deliverFn lets a caller pick the sender identity (marketing vs support)
 * without duplicating the batching/retry logic below.
 * Returns { sent, failed, total, failures: [{ email, error }] }.
 */
async function broadcast(recipients, subject, htmlForRecipient, label, deliverFn) {
  const send = deliverFn || deliver;
  const seen = new Set();
  /* De-duplicate: the same address can sit in more than one audience, and
     nothing looks more amateur than the same warning arriving twice. */
  const list = (recipients || []).filter((u) => {
    if (!u || !u.email) return false;
    const key = String(u.email).trim().toLowerCase();
    if (!key || seen.has(key)) return false;
    seen.add(key);
    return true;
  });
  if (!list.length) return { sent: 0, failed: 0, total: 0, failures: [] };

  if (!emailConfigured()) {
    console.log(
      "[email] not configured — '" + label + "' would reach " + list.length +
        " recipient(s) (set RESEND_API_KEY or SMTP_* in .env)."
    );
    return { sent: 0, failed: 0, total: list.length, failures: [], skipped: "not_configured" };
  }

  let sent = 0;
  const failures = [];

  for (let i = 0; i < list.length; i += BROADCAST_BATCH) {
    const batch = list.slice(i, i + BROADCAST_BATCH);
    for (const u of batch) {
      try {
        await send(u.email, subject, htmlForRecipient(u));
        sent++;
      } catch (e) {
        try {
          await sleep(500);
          await send(u.email, subject, htmlForRecipient(u));
          sent++;
        } catch (e2) {
          failures.push({ email: u.email, error: e2.message });
          console.error("[email] '" + label + "' failed for " + u.email + ":", e2.message);
        }
      }
    }
    if (i + BROADCAST_BATCH < list.length) await sleep(BROADCAST_PAUSE_MS);
  }

  console.log("[email] '" + label + "' sent to " + sent + "/" + list.length + " recipient(s).");
  return { sent, failed: failures.length, total: list.length, failures };
}

/* Short single-line excerpt for the hero description — the template is
   meant to carry one clear message, not a full product description. */
function excerpt(text, max) {
  const s = String(text || "").trim();
  if (!s) return "";
  if (s.length <= max) return s;
  return s.slice(0, max).replace(/\s+\S*$/, "") + "…";
}

function productUrl(product) {
  return siteBase() + "/product/" + encodeURIComponent(product.id);
}

function sendNewProductBroadcast(recipients, product) {
  const desc = excerpt(product.description, 140);
  return broadcast(
    recipients,
    "Νέο προϊόν στη Nostalgia Collection",
    (u) =>
      campaignHtml({
        firstname: u.firstname,
        email: u.email,
        kicker: "Νέο προϊόν μόλις έφτασε",
        heading: product.title,
        image: product.image,
        paragraphs: desc ? [esc(desc)] : [],
        newPrice: product.salePrice != null ? product.salePrice : product.price,
        oldPrice: product.salePrice != null ? product.price : null,
        ctaText: "Δείτε το προϊόν",
        ctaUrl: productUrl(product),
      }),
    "new-product"
  );
}

function sendSaleBroadcast(recipients, product) {
  const pct =
    product.salePrice != null && product.price
      ? Math.round((1 - product.salePrice / product.price) * 100)
      : 0;
  const paragraphs = product.saleUntil
    ? ["Η προσφορά ισχύει έως " + new Date(product.saleUntil).toLocaleDateString("el-GR") + "."]
    : [];
  return broadcast(
    recipients,
    "Νέα έκπτωση στη Nostalgia Collection",
    (u) =>
      campaignHtml({
        firstname: u.firstname,
        email: u.email,
        kicker: "Σε προσφορά τώρα",
        heading: product.title,
        image: product.image,
        oldPrice: product.price,
        newPrice: product.salePrice,
        pct,
        paragraphs,
        ctaText: "Δείτε την προσφορά",
        ctaUrl: productUrl(product),
      }),
    "sale"
  );
}

/* Welcome offer — sends one of the two fixed first-order codes.
   kind: "newsletter" (10%) or "account" (5%). Both are single-use per
   customer and valid on the first order only; the server enforces that. */
function sendWelcomeCoupon(to, kind, opts) {
  const o = opts || {};
  const en = o.lang === "en";
  const isAccount = kind === "account";
  const code = isAccount ? "NOSTALGIACANDLE5" : "NOSTALGIACANDLE10";
  const pct = isAccount ? "5%" : "10%";

  const heading = isAccount
    ? en ? "Your extra 5% is here" : "Το επιπλέον 5% σου"
    : en ? "Your 10% welcome gift" : "Το δώρο καλωσορίσματος 10%";

  const paragraphs = isAccount
    ? en
      ? [
          "Thank you for creating an account with Nostalgia Collection.",
          "Here is an <strong>extra 5% off</strong> your first order. Combine it with your newsletter code <strong>NOSTALGIACANDLE10</strong> for <strong>15% in total</strong> — both codes can be used together in the cart.",
        ]
      : [
          "Ευχαριστούμε που δημιούργησες λογαριασμό στη Nostalgia Collection.",
          "Ορίστε <strong>επιπλέον 5% έκπτωση</strong> για την πρώτη σου παραγγελία. Συνδύασέ το με τον κωδικό του newsletter <strong>NOSTALGIACANDLE10</strong> για <strong>15% συνολικά</strong> — και οι δύο κωδικοί μπαίνουν μαζί στο καλάθι.",
        ]
    : en
      ? [
          "Welcome to Nostalgia Collection — thank you for subscribing.",
          "Here is <strong>10% off</strong> your first order. Create an account and you'll get another <strong>5%</strong>, for <strong>15% in total</strong>.",
        ]
      : [
          "Καλώς ήρθες στη Nostalgia Collection — ευχαριστούμε για την εγγραφή σου.",
          "Ορίστε <strong>10% έκπτωση</strong> για την πρώτη σου παραγγελία. Κάνε και λογαριασμό και κερδίζεις άλλο <strong>5%</strong>, δηλαδή <strong>15% συνολικά</strong>.",
        ];

  const codeNote = en
    ? "One use per customer · first order only"
    : "Μία χρήση ανά πελάτη · μόνο στην πρώτη παραγγελία";

  return sendTransactionalEmail(
    to,
    en
      ? "Your " + pct + " code — Nostalgia Collection"
      : "Ο κωδικός σου " + pct + " — Nostalgia Collection",
    campaignHtml({
      firstname: o.firstname,
      email: to,
      kicker: en ? "A little something for you" : "Ένα δώρο για εσένα",
      heading,
      paragraphs,
      code,
      codeNote,
      ctaUrl: siteBase() + "/collection",
      ctaText: en ? "Shop the collection" : "Δες τη συλλογή",
    })
  );
}

function sendCouponBroadcast(recipients, coupon) {
  const perks = [];
  if (Number(coupon.value) > 0) {
    perks.push(coupon.type === "percent" ? coupon.value + "% έκπτωση" : money(coupon.value) + " έκπτωση");
  }
  if (coupon.freeShipping) perks.push("δωρεάν μεταφορικά");
  const perkText = perks.length ? perks.join(" και ") : "προνόμιο";
  const paragraphs = ["Σου χαρίζουμε έναν αποκλειστικό κωδικό με <strong>" + perkText + "</strong>."];
  const notes = [];
  if (coupon.expiresAt) {
    notes.push("Ισχύει έως " + new Date(coupon.expiresAt).toLocaleDateString("el-GR"));
  }
  if (coupon.maxUses != null) {
    notes.push("Έως " + coupon.maxUses + " χρήσεις");
  }
  const codeNote = notes.join(" · ");
  return broadcast(
    recipients,
    "Ο εκπτωτικός σου κωδικός — Nostalgia Collection",
    (u) =>
      campaignHtml({
        firstname: u.firstname,
        email: u.email,
        kicker: "Ένα δώρο για εσένα",
        heading: perks.length ? perks.join(" & ") : "Δώρο για εσένα",
        paragraphs,
        code: coupon.code,
        codeNote: codeNote,
        ctaText: "Χρησιμοποίησέ το",
        ctaUrl: siteBase() + "/collection",
      }),
    "coupon"
  );
}

/* One-time code for password reset / change. In dev (no email configured)
   the code is logged to the server console so the flow stays testable. */
async function sendPasswordCode(to, code, lang) {
  const isEn = lang === "en";
  const subject = isEn
    ? "Your Nostalgia verification code"
    : "Ο κωδικός επαλήθευσης Nostalgia";
  const intro = isEn
    ? "Use this code to set a new password. It expires in 15 minutes."
    : "Χρησιμοποίησε αυτόν τον κωδικό για να ορίσεις νέο κωδικό πρόσβασης. Λήγει σε 15 λεπτά.";
  const ignore = isEn
    ? "If you didn't request this, you can safely ignore this email."
    : "Αν δεν το ζήτησες εσύ, αγνόησε με ασφάλεια αυτό το email.";
  const html =
    '<div style="font-family:Georgia,serif;max-width:480px;margin:0 auto;padding:32px;color:#2a2118;">' +
    '<h1 style="font-size:20px;letter-spacing:.04em;">Nostalgia Collection</h1>' +
    '<p style="font-size:15px;line-height:1.6;">' + intro + "</p>" +
    '<p style="font-size:34px;letter-spacing:.3em;font-weight:bold;text-align:center;margin:28px 0;color:#a87d34;">' +
    esc(code) +
    "</p>" +
    '<p style="font-size:13px;color:#8a7d6a;">' + ignore + "</p>" +
    "</div>";

  if (!emailConfigured()) {
    console.log(
      "[email] not configured — password code for " + to + " is: " + code +
        " (set RESEND_API_KEY or SMTP_* in .env to deliver it)."
    );
    return;
  }
  try {
    await deliverMail({ to, subject, html, from: supportFrom(), purpose: "support" });
    console.log("[email] password code sent to " + to);
  } catch (e) {
    console.error("[email] failed to send password code to " + to + ":", e.message);
  }
}

/* Used by sendWelcomeCoupon — a promotional code, so it goes out as
   marketing (newsletter@), same as the broadcasts above. */
async function sendTransactionalEmail(to, subject, html) {
  if (!emailConfigured()) {
    throw new Error("email_not_configured");
  }
  return deliverMail({ to, subject, html, from: marketingFrom(), replyTo: supportReplyTo(), purpose: "marketing" });
}

/* Notifies support@ when a visitor submits the /contact form, with the
   visitor's own address as Reply-To so a reply reaches them directly. */
async function sendContactNotification(msg) {
  const to = (process.env.SUPPORT_EMAIL || "").trim();
  if (!to) return;
  const subject = "[Επικοινωνία] " + (msg.subject || "Νέο μήνυμα") + " — " + (msg.firstName || "") + " " + (msg.lastName || "");
  const html =
    '<div style="font-family:Georgia,serif;max-width:560px;margin:0 auto;padding:24px;color:#2a2118;">' +
    "<h2 style=\"font-size:18px;\">Νέο μήνυμα επικοινωνίας</h2>" +
    '<table style="font-size:14px;border-collapse:collapse;">' +
    "<tr><td style=\"padding:3px 8px 3px 0;color:#8a7d6a;\">Όνομα</td><td>" + esc(msg.firstName) + " " + esc(msg.lastName) + "</td></tr>" +
    "<tr><td style=\"padding:3px 8px 3px 0;color:#8a7d6a;\">Email</td><td>" + esc(msg.email) + "</td></tr>" +
    (msg.phone ? "<tr><td style=\"padding:3px 8px 3px 0;color:#8a7d6a;\">Τηλέφωνο</td><td>" + esc(msg.phone) + "</td></tr>" : "") +
    (msg.subject ? "<tr><td style=\"padding:3px 8px 3px 0;color:#8a7d6a;\">Θέμα</td><td>" + esc(msg.subject) + "</td></tr>" : "") +
    "</table>" +
    '<p style="font-size:14px;white-space:pre-wrap;margin-top:16px;border-top:1px solid #eee;padding-top:16px;">' + esc(msg.message) + "</p>" +
    "</div>";
  try {
    await deliverMail({ to, subject, html, from: supportFrom(), replyTo: msg.email, purpose: "support" });
    console.log("[email] contact notification sent to " + to);
  } catch (e) {
    console.error("[email] failed to send contact notification:", e.message);
  }
}

/* Immediate "we got it" reply to the visitor themselves, sent alongside
   sendContactNotification — reassures them while a human hasn't replied yet. */
async function sendContactAutoReply(msg) {
  if (!msg || !msg.email) return;
  const en = msg.lang === "en";
  const subject = en
    ? "We received your message — Nostalgia Collection"
    : "Λάβαμε το μήνυμά σου — Nostalgia Collection";
  const paragraphs = en
    ? [
        "Thank you for reaching out to Nostalgia Collection.",
        "We will get back to you as soon as possible — usually within 24–72 hours.",
      ]
    : [
        "Σε ευχαριστούμε που επικοινώνησες με τη Nostalgia Collection.",
        "Θα σου απαντήσουμε το συντομότερο δυνατό — συνήθως εντός 24–72 ωρών.",
      ];
  const html = campaignHtml({ firstname: msg.firstName, heading: en ? "Message received" : "Λάβαμε το μήνυμά σου", paragraphs });
  try {
    await deliverMail({ to: msg.email, subject, html, from: supportFrom(), purpose: "support" });
    console.log("[email] contact auto-reply sent to " + msg.email);
  } catch (e) {
    console.error("[email] failed to send contact auto-reply:", e.message);
  }
}

module.exports = {
  sendOrderConfirmation,
  sendOrderPreparing,
  sendOrderShipped,
  sendOrderDelivered,
  sendOrderIssue,
  emailConfigured,
  smtpConfigured,
  resendConfigured,
  sendNewProductBroadcast,
  sendSaleBroadcast,
  sendCouponBroadcast,
  sendAnnouncement,
  announcementPreviewHtml,
  /* Exported for preview/review tooling — render a body without sending it,
     the same way announcementPreviewHtml does for announcements. */
  campaignHtml,
  buildHtml,
  orderEmailShell,
  sendWelcomeCoupon,
  sendPasswordCode,
  sendTransactionalEmail,
  sendContactNotification,
  sendContactAutoReply,
};
