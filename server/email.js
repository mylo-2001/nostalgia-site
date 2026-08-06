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

/* Greek convention puts the symbol after the amount and uses a comma for the
   decimal: "32,00 €". English keeps "€32.00". Used by the redesigned order
   confirmation; the older templates still call money(). */
function euro(n, en) {
  const v = Number(n || 0).toFixed(2);
  return en ? "€" + v : v.replace(".", ",") + " €";
}

/* Light-on-dark logo for the dark email footer. */
/* logo-email-dark.png is the brand mark matted onto transparency, so it sits on
   the dark footer without a visible plate behind it. The previous file
   (logo light.png) has an OPAQUE cream background baked in — on this footer it
   rendered as a pale rectangle. It also carried the wrong aspect ratio here:
   the artwork is roughly square, not 140x41. */
function footerLogoHtml(base) {
  return (
    '<img src="' + esc(base + "/images/logo/logo-email-dark.png") + '" alt="Nostalgia Collection" ' +
    'width="104" height="100" style="display:block;margin:0 auto 10px;border:0" />'
  );
}

/* Social icons — hosted SVG files (images/logo/email-icon-*.svg), same glyphs as
   the site footer (js/site-chrome.js). Hosted, not data: URIs: Roundcube
   and several other webmail sanitizers strip data: image sources outright
   regardless of the "load remote content" setting, so they never rendered. */
function socialIconImg(base, name, label) {
  return (
    '<img src="' + esc(base + "/images/logo/email-icon-" + name + ".svg") + '" width="20" height="20" ' +
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

/* Delivery estimate shown on the confirmation. Business days, because a
   Friday order does not arrive on Sunday and a range that ignores the weekend
   is a promise the courier cannot keep. Tunable without a redeploy. */
const DELIVERY_MIN_DAYS = Math.max(1, parseInt(process.env.DELIVERY_MIN_DAYS, 10) || 2);
const DELIVERY_MAX_DAYS = Math.max(
  DELIVERY_MIN_DAYS,
  parseInt(process.env.DELIVERY_MAX_DAYS, 10) || 5
);

function addBusinessDays(from, days) {
  const d = new Date(from.getTime());
  let left = days;
  while (left > 0) {
    d.setDate(d.getDate() + 1);
    const wd = d.getDay();
    if (wd !== 0 && wd !== 6) left -= 1;
  }
  return d;
}

const MONTHS_EL = ["Ιαν", "Φεβ", "Μαρ", "Απρ", "Μαΐ", "Ιουν", "Ιουλ", "Αυγ", "Σεπ", "Οκτ", "Νοε", "Δεκ"];
const MONTHS_EN = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

function shortDate(d, en) {
  return d.getDate() + " " + (en ? MONTHS_EN : MONTHS_EL)[d.getMonth()] + " " + d.getFullYear();
}

function deliveryWindow(orderDate, en) {
  const base = orderDate instanceof Date && !Number.isNaN(orderDate.getTime()) ? orderDate : new Date();
  return {
    from: shortDate(addBusinessDays(base, DELIVERY_MIN_DAYS), en),
    to: shortDate(addBusinessDays(base, DELIVERY_MAX_DAYS), en),
  };
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
    payCard: "Κάρτα",
    payCod: "Αντικαταβολή",
    receipt: "Ηλεκτρονική απόδειξη",
    trackBtn: "Παρακολούθηση παραγγελίας",
    trackHint: "Δες την κατάσταση της παραγγελίας σου οποιαδήποτε στιγμή — χωρίς σύνδεση.",
    needHelp: "Χρειάζεσαι βοήθεια;",
    terms: "Όροι",
    privacy: "Απόρρητο",
    contact: "Επικοινωνία",
    footer: "Nostalgia Collection · Χειροποίητα κεριά",
    confirmTitle: "Επιβεβαίωση παραγγελίας",
    confirmSubtitle: "Η παραγγελία σας καταχωρήθηκε επιτυχώς και ετοιμάζεται για επεξεργασία.",
    dearCustomer: "Αγαπητέ πελάτη,",
    thanksLine: "σας ευχαριστούμε θερμά για την εμπιστοσύνη σας στο Nostalgia Candle.",
    receivedLine: "Παραλάβαμε την παραγγελία σας και θα σας ενημερώσουμε ξανά μόλις αποσταλεί.",
    dateLabel: "Ημερομηνία",
    statusLabel: "Κατάσταση",
    statusConfirmed: "Επιβεβαιώθηκε",
    statusPending: "Σε αναμονή πληρωμής",
    productsSummary: "Σύνοψη προϊόντων",
    qtyLabel: "Ποσότητα",
    priceLabel: "Τιμή",
    shipDetails: "Στοιχεία αποστολής",
    estDelivery: "Εκτιμώμενη παράδοση",
    estFromTo: "Από %1 έως %2",
    shipNotice: "Θα λάβετε ενημέρωση με τον αριθμό αποστολής μόλις η παραγγελία σας αποσταλεί.",
    viewOrder: "Δείτε την παραγγελία",
    autoMessage: "Αυτό είναι ένα αυτόματο μήνυμα. Παρακαλούμε μην απαντάτε σε αυτό το email.",
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
    payCard: "Card",
    payCod: "Cash on delivery",
    receipt: "Electronic receipt",
    trackBtn: "Track your order",
    trackHint: "Check your order status anytime — no login needed.",
    needHelp: "Need help?",
    terms: "Terms",
    privacy: "Privacy",
    contact: "Contact",
    footer: "Nostalgia Collection · Handmade candles",
    confirmTitle: "Order confirmation",
    confirmSubtitle: "Your order has been placed successfully and is being prepared for processing.",
    dearCustomer: "Dear customer,",
    thanksLine: "thank you warmly for your trust in Nostalgia Candle.",
    receivedLine: "We have received your order and will let you know as soon as it ships.",
    dateLabel: "Date",
    statusLabel: "Status",
    statusConfirmed: "Confirmed",
    statusPending: "Awaiting payment",
    productsSummary: "Order summary",
    qtyLabel: "Quantity",
    priceLabel: "Price",
    shipDetails: "Shipping details",
    estDelivery: "Estimated delivery",
    estFromTo: "From %1 to %2",
    shipNotice: "You will receive an update with the tracking number as soon as your order ships.",
    viewOrder: "View your order",
    autoMessage: "This is an automated message. Please do not reply to this email.",
  },
};

function buildHtml(order, lang) {
  const tr = T[lang] || T.el;
  const en = lang === "en";
  const base = siteBase();
  const c = order.customer || {};

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
  const codFee = 0;
  const total =
    order.total != null ? order.total : itemsSubtotal - (order.discount || 0) + shippingFee + codFee;

  const orderDate = order.createdAt ? new Date(order.createdAt) : new Date();
  const win = deliveryWindow(orderDate, en);
  /* COD is confirmed on placement; a card order is only confirmed once the
     payment actually settles, so it must not claim otherwise. */
  const confirmed = order.paymentStatus === "paid";

  function productImageUrl(image) {
    if (!image) return "";
    if (/^https?:\/\//i.test(image)) return image;
    return base + "/" + image;
  }

  /* Four labelled facts across the top, each with its own icon. */
  const facts = [
    ["doc", tr.orderCode, "#" + esc(order.number)],
    ["calendar", tr.dateLabel, esc(shortDate(orderDate, en))],
    ["card", tr.payment, esc(tr.payCard)],
    ["check", tr.statusLabel, esc(confirmed ? tr.statusConfirmed : tr.statusPending)],
  ];
  const factCells = facts
    .map(function (f) {
      return (
        '<td width="25%" align="center" valign="top" style="padding:14px 6px">' +
        '<div style="margin-bottom:6px">' + icon(f[0], 22) + "</div>" +
        '<div style="font-size:11.5px;color:#8a7a62;line-height:1.4;margin-bottom:3px">' + esc(f[1]) + "</div>" +
        '<div style="font-size:13px;color:' + INK + ';font-weight:bold">' + f[2] + "</div>" +
        "</td>"
      );
    })
    .join("");

  const itemRows = (order.items || [])
    .map(function (it) {
      const img = productImageUrl(it.image);
      const line = it.price != null ? euro(it.price * it.qty, en) : "—";
      return (
        "<tr>" +
        '<td width="62" valign="middle" style="padding:12px 0 12px 14px">' +
        (img
          ? '<img src="' + esc(img) + '" width="46" height="46" alt="" ' +
            'style="border-radius:6px;object-fit:cover;display:block;border:0" />'
          : "") +
        "</td>" +
        '<td valign="middle" style="padding:12px 10px;font-size:13px;color:' + INK + ';line-height:1.45">' +
        esc(it.title) +
        (it.size ? '<br><span style="color:#8a7a62;font-size:12px">' + esc(it.size) + "</span>" : "") +
        "</td>" +
        '<td valign="middle" align="right" style="padding:12px 8px;font-size:12.5px;color:#8a7a62;white-space:nowrap">' +
        esc(tr.qtyLabel) + ": " + it.qty +
        "</td>" +
        '<td valign="middle" align="right" style="padding:12px 14px 12px 8px;font-size:12.5px;color:#8a7a62;white-space:nowrap">' +
        esc(tr.priceLabel) + ": " + line +
        "</td>" +
        "</tr>"
      );
    })
    .join("");

  /* The reference layout shows a single total. Breakdown rows are added only
     when they carry information — an order with a discount or a COD fee needs
     the arithmetic spelled out, or the total cannot be reconciled. */
  function sumRow(label, value, color) {
    return (
      "<tr>" +
      '<td colspan="3" style="padding:5px 8px 5px 14px;font-size:12.5px;color:#8a7a62">' + esc(label) + "</td>" +
      '<td align="right" style="padding:5px 14px 5px 8px;font-size:12.5px;color:' +
      (color || "#8a7a62") + '">' + value + "</td>" +
      "</tr>"
    );
  }

  const breakdown =
    (order.discount
      ? sumRow(tr.subtotal, euro(itemsSubtotal, en)) +
        sumRow(
          tr.discount + (order.coupon ? " (" + order.coupon + ")" : ""),
          "&minus;" + euro(order.discount, en),
          "#4f7048"
        )
      : "") +
    sumRow(
      tr.shipping,
      shippingFee
        ? euro(shippingFee, en)
        : esc(order.couponFreeShipping ? tr.freeShippingCoupon : tr.freeShipping),
      shippingFee ? null : "#4f7048"
    ) +
    "";

  const addressLines =
    esc(((c.firstname || "") + " " + (c.lastname || "")).trim()) + "<br>" +
    esc(((c.street || "") + " " + (c.streetNumber || "")).trim()) + "<br>" +
    esc(((c.postal || "") + " " + (c.city || "")).trim()) +
    (c.prefecture ? "<br>" + esc(c.prefecture) : "") +
    (c.country || c.countryCode ? "<br>" + esc(c.country || c.countryCode) : "");

  function panelHeading(ic, text) {
    return (
      '<table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:0 0 8px">' +
      '<tr><td width="26" valign="middle">' + icon(ic, 17) + "</td>" +
      '<td valign="middle" style="font-family:Georgia,serif;font-size:14px;color:' + GOLD + '">' +
      esc(text) + "</td></tr></table>"
    );
  }

  const trackUrl = order.accessToken
    ? base + "/track?token=" + encodeURIComponent(order.accessToken)
    : "";

  return (
    '<div style="background:#f2ece1;padding:26px 12px;font-family:Georgia,\'Times New Roman\',serif">' +
    '<table role="presentation" align="center" width="600" cellpadding="0" cellspacing="0" border="0" ' +
    'style="max-width:600px;background:' + CREAM + ';border:1px solid ' + GOLD + '33;border-radius:4px">' +
    '<tr><td style="padding:30px 30px 32px">' +

    '<div style="text-align:center">' +
    '<img src="' + esc(base + "/images/logo/logo-email.png") + '" alt="Nostalgia Collection" ' +
    'width="104" style="display:inline-block;max-width:104px;height:auto;border:0" /></div>' +

    goldRule("20px") +

    '<h1 style="font-family:Georgia,serif;font-weight:normal;font-size:26px;color:' + INK +
    ';text-align:center;margin:0 0 10px">' + esc(tr.confirmTitle) + "</h1>" +
    '<p style="text-align:center;font-size:13px;font-weight:bold;color:' + GOLD +
    ';margin:0 0 22px;line-height:1.6">' + esc(tr.confirmSubtitle) + "</p>" +

    '<p style="font-size:14px;color:' + INK + ';margin:0 0 6px">' +
    (c.firstname
      ? esc((en ? "Dear " : "Αγαπητέ/ή ") + c.firstname) + ","
      : esc(tr.dearCustomer)) +
    "</p>" +
    '<p style="font-size:14px;color:' + INK + ';line-height:1.7;margin:0 0 4px">' + esc(tr.thanksLine) + "</p>" +
    '<p style="font-size:14px;color:' + INK + ';line-height:1.7;margin:0 0 20px">' + esc(tr.receivedLine) + "</p>" +

    '<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" ' +
    'style="background:#f8f2e6;border:1px solid ' + GOLD + '2e;border-radius:8px;margin:0 0 18px">' +
    "<tr>" + factCells + "</tr></table>" +

    '<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" ' +
    'style="border:1px solid ' + GOLD + '2e;border-radius:8px;margin:0 0 18px">' +
    '<tr><td colspan="4" style="padding:11px 14px;font-size:12.5px;color:#8a7a62;border-bottom:1px solid ' +
    GOLD + '2e">' + esc(tr.productsSummary) + "</td></tr>" +
    itemRows +
    '<tr><td colspan="4" style="border-top:1px solid ' + GOLD + '2e;font-size:0;line-height:0">&nbsp;</td></tr>' +
    breakdown +
    '<tr>' +
    '<td colspan="3" bgcolor="#f8f2e6" style="padding:11px 8px 11px 14px;font-size:14px;font-weight:bold;color:' + INK + '">' +
    esc(tr.total) + "</td>" +
    '<td align="right" bgcolor="#f8f2e6" style="padding:11px 14px 11px 8px;font-size:15px;font-weight:bold;color:' + INK + '">' +
    euro(total, en) + "</td></tr>" +
    "</table>" +

    '<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" ' +
    'style="background:#f8f2e6;border:1px solid ' + GOLD + '2e;border-radius:8px;margin:0 0 20px">' +
    '<tr><td width="50%" valign="top" style="padding:16px 12px 16px 16px">' +
    panelHeading("pin", tr.shipDetails) +
    '<div style="font-size:12.5px;color:' + INK + ';line-height:1.75">' + addressLines + "</div>" +
    "</td>" +
    '<td width="50%" valign="top" style="padding:16px 16px 16px 12px">' +
    panelHeading("truck", tr.estDelivery) +
    '<div style="font-size:12.5px;color:' + INK + ';line-height:1.75">' +
    esc(tr.estFromTo.replace("%1", win.from).replace("%2", win.to)) + "</div>" +
    '<div style="font-size:11.5px;color:#8a7a62;line-height:1.6;margin-top:6px">' + esc(tr.shipNotice) + "</div>" +
    "</td></tr></table>" +

    (trackUrl
      ? '<div style="text-align:center;margin:0 0 20px">' +
        '<a href="' + esc(trackUrl) + '" style="background:' + GOLD + ';color:#fff;text-decoration:none;' +
        'font-family:Georgia,serif;font-size:14px;padding:13px 30px;border-radius:6px;display:inline-block">' +
        esc(tr.viewOrder) + "</a></div>"
      : "") +

    officialContactsBlock(en) +

    goldRule("18px") +
    '<p style="text-align:center;font-size:11.5px;font-style:italic;color:#8a7a62;line-height:1.7;margin:0">' +
    esc(tr.autoMessage) + "</p>" +

    "</td></tr></table></div>"
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
  const codFee = 0;

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
  lines.push("", tr.payment + ": " + tr.payCard);
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
/* Ornamental divider: a hairline with a small gold lozenge at its centre.
   Built from table cells rather than a bordered div because Outlook drops
   height on an empty div but honours it on a <td>. */
function ornamentDivider() {
  const bar = (w) =>
    '<td width="' + w + '" height="1" bgcolor="#e3d4b6" style="font-size:0;line-height:0">&nbsp;</td>';
  return (
    '<table role="presentation" align="center" cellpadding="0" cellspacing="0" border="0" ' +
    'style="margin:14px auto 22px"><tr>' +
    bar(70) +
    '<td width="18" align="center" style="font-size:0;line-height:0;padding:0 6px">' +
    '<table role="presentation" cellpadding="0" cellspacing="0" border="0"><tr>' +
    '<td width="7" height="7" bgcolor="' + GOLD + '" ' +
    'style="width:7px;border-radius:50%;font-size:0;line-height:0">&nbsp;</td>' +
    "</tr></table></td>" +
    bar(70) +
    "</tr></table>"
  );
}

/* The four stages an order passes through. `active` is the zero-based index of
   the stage the customer is at right now: earlier stages read as done, later
   ones are greyed. One helper serves every status email, so the sequence can
   never drift between them. */
const ORDER_STAGES = [
  { icon: "check", el: "Επιβεβαίωση", en: "Confirmed" },
  { icon: "gift", el: "Προετοιμασία", en: "Preparing" },
  { icon: "truck", el: "Αποστολή", en: "Shipped" },
  { icon: "package", el: "Παράδοση", en: "Delivered" },
];

/**
 * The four stages an order passes through.
 *   active   zero-based index of where the order is right now
 *   subs     optional caption under each label (a date, or "1–3 working days")
 *   allDone  every stage complete — the delivered mail, where the whole row
 *            reads as finished rather than pointing at a current step
 *
 * A completed stage shows a tick rather than its own glyph: once it has
 * happened, "done" is the only information left in it.
 */
function progressStepper(active, en, subs, allDone) {
  const cells = [];

  ORDER_STAGES.forEach((stage, i) => {
    const done = allDone || i < active;
    const isActive = !allDone && i === active;

    if (i > 0) {
      const lit = allDone || i <= active;
      cells.push(
        '<td valign="top" style="padding:21px 2px 0">' +
        '<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">' +
        '<tr><td height="1" bgcolor="' + (lit ? "#c9ab77" : "#e6dac4") +
        '" style="font-size:0;line-height:0">&nbsp;</td></tr></table></td>'
      );
    }

    /* Filled disc for anything achieved, hollow for anything ahead. */
    const filled = done || isActive;
    const glyph = done ? "check-w" : isActive ? stage.icon + "-w" : stage.icon + "-m";
    const disc = filled
      ? "background:" + GOLD + ";"
      : "background:#faf2e8;border:1px solid #e0d3ba;";

    cells.push(
      '<td width="84" align="center" valign="top" style="padding:0 2px">' +
      '<table role="presentation" align="center" cellpadding="0" cellspacing="0" border="0" ' +
      'style="' + disc + 'border-radius:50%;width:44px;height:44px">' +
      '<tr><td align="center" valign="middle" width="44" height="44" style="line-height:0">' +
      icon(glyph, 21) +
      "</td></tr></table>" +
      '<div style="font-size:11.5px;line-height:1.4;margin-top:8px;color:' +
      (filled ? INK : "#a89980") + '">' + esc(en ? stage.en : stage.el) + "</div>" +
      (subs && subs[i]
        ? '<div style="font-size:10.5px;line-height:1.4;margin-top:2px;color:#a89980">' +
          esc(subs[i]) + "</div>"
        : "") +
      "</td>"
    );
  });

  return (
    '<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" ' +
    'style="margin:6px 0 22px"><tr>' + cells.join("") + "</tr></table>"
  );
}

/* Bordered panel with a centred heading over evenly-split columns — the
   "shipping details" block on the dispatch mail. */
function centeredPanel(title, cells) {
  const width = Math.floor(100 / Math.max(1, cells.length));
  const tds = cells
    .map((c) =>
      '<td width="' + width + '%" align="center" valign="top" style="padding:4px 8px 16px">' +
      '<div style="margin-bottom:6px">' + icon(c.icon, 22) + "</div>" +
      '<div style="font-size:11.5px;color:#8a7a62;line-height:1.4;margin-bottom:3px">' + esc(c.label) + "</div>" +
      '<div style="font-size:13px;color:' + (c.accent ? GOLD : INK) + ';font-weight:bold">' + c.value + "</div>" +
      "</td>"
    )
    .join("");
  return (
    '<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" ' +
    'style="background:#f8f2e6;border:1px solid ' + GOLD + '2e;border-radius:8px;margin:0 0 18px">' +
    (title
      ? '<tr><td colspan="' + cells.length + '" align="center" ' +
        'style="padding:14px 12px 10px;font-family:Georgia,serif;font-size:15px;color:' + INK + '">' +
        esc(title) + "</td></tr>"
      : "") +
    "<tr>" + tds + "</tr></table>"
  );
}

/* Fact strip with the icon beside the text rather than above it — reads
   better when there are only two facts to show. */
function factStripInline(cells) {
  const width = Math.floor(100 / Math.max(1, cells.length));
  const tds = cells
    .map((c) =>
      '<td width="' + width + '%" valign="middle" style="padding:14px 12px">' +
      '<table role="presentation" cellpadding="0" cellspacing="0" border="0"><tr>' +
      '<td width="34" valign="middle">' + icon(c.icon, 24) + "</td>" +
      '<td valign="middle" style="padding-left:6px">' +
      '<div style="font-size:11.5px;color:#8a7a62;line-height:1.4">' + esc(c.label) + "</div>" +
      '<div style="font-size:13.5px;color:' + INK + ';font-weight:bold;margin-top:2px">' + c.value + "</div>" +
      "</td></tr></table></td>"
    )
    .join("");
  return (
    '<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" ' +
    'style="background:#f8f2e6;border:1px solid ' + GOLD + '2e;border-radius:8px;margin:0 0 18px">' +
    "<tr>" + tds + "</tr></table>"
  );
}

/* Shell shared by every order-status email (preparing / shipped / delivered /
   problem). Same cream card as the confirmation, so the two read as one
   family. */
function orderEmailShell(opts) {
  const base = siteBase();
  const en = opts.lang === "en";
  const tr = T[en ? "en" : "el"];

  const facts = (opts.facts || [])
    .map((f) => {
      const width = Math.floor(100 / Math.max(1, opts.facts.length));
      return (
        '<td width="' + width + '%" align="center" valign="top" style="padding:14px 6px">' +
        '<div style="margin-bottom:6px">' + icon(f.icon, 22) + "</div>" +
        '<div style="font-size:11.5px;color:#8a7a62;line-height:1.4;margin-bottom:3px">' + esc(f.label) + "</div>" +
        '<div style="font-size:13px;color:' + (f.accent ? GOLD : INK) + ';font-weight:bold">' + f.value + "</div>" +
        "</td>"
      );
    })
    .join("");

  const factsTable = opts.facts && opts.facts.length
    ? '<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" ' +
      'style="background:#f8f2e6;border:1px solid ' + GOLD + '2e;border-radius:8px;margin:0 0 18px">' +
      /* Optional heading over the strip — the dispatch mail groups its three
         facts under "Shipping details" rather than leaving them unlabelled. */
      (opts.factsTitle
        ? '<tr><td colspan="' + opts.facts.length + '" align="center" ' +
          'style="padding:14px 12px 2px;font-family:Georgia,serif;font-size:15px;color:' + INK + '">' +
          esc(opts.factsTitle) + "</td></tr>"
        : "") +
      "<tr>" + facts + "</tr></table>"
    : "";

  const nextBox = opts.nextTitle
    ? '<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" ' +
      'style="background:#f8f2e6;border:1px solid ' + GOLD + '2e;border-radius:8px;margin:0 0 20px">' +
      '<tr><td width="80" align="center" valign="middle" style="padding:18px 0 18px 16px">' +
      icon(opts.nextIcon || "truck", 40) + "</td>" +
      '<td valign="middle" style="padding:18px 18px 18px 10px">' +
      '<div style="font-family:Georgia,serif;font-size:15px;color:' + INK + ';margin:0 0 6px">' +
      esc(opts.nextTitle) + "</div>" +
      '<div style="font-size:12.5px;color:#6b5d49;line-height:1.65">' + opts.nextBody + "</div>" +
      (opts.nextCtaUrl
        ? '<div style="margin-top:12px">' +
          '<a href="' + esc(opts.nextCtaUrl) + '" style="background:' + GOLD + ';color:#fff;' +
          'text-decoration:none;font-family:Georgia,serif;font-size:13px;padding:10px 22px;' +
          'border-radius:6px;display:inline-block">' + esc(opts.nextCtaText || "") + "</a></div>"
        : "") +
      "</td></tr></table>"
    : "";

  return (
    '<div style="background:#f2ece1;padding:26px 12px;font-family:Georgia,\'Times New Roman\',serif">' +
    '<table role="presentation" align="center" width="600" cellpadding="0" cellspacing="0" border="0" ' +
    'style="max-width:600px;background:' + CREAM + ';border:1px solid ' + GOLD + '33;border-radius:4px">' +
    '<tr><td style="padding:30px 30px 32px">' +

    '<div style="text-align:center">' +
    '<img src="' + esc(base + "/images/logo/logo-email.png") + '" alt="Nostalgia Collection" ' +
    'width="104" style="display:inline-block;max-width:104px;height:auto;border:0" /></div>' +

    goldRule("20px") +

    '<h1 style="font-family:Georgia,serif;font-weight:normal;font-size:25px;color:' + INK +
    ';text-align:center;margin:0 0 10px">' + esc(opts.title) + "</h1>" +
    (opts.subtitle
      ? '<p style="text-align:center;font-size:13px;font-weight:bold;color:' + GOLD +
        ';margin:0 0 2px;line-height:1.6">' + esc(opts.subtitle) + "</p>"
      : "") +
    ornamentDivider() +

    (opts.hideIntro ? "" :
      '<p style="font-size:14px;color:' + INK + ';margin:0 0 6px">' +
      (opts.firstname
        ? esc((en ? "Dear " : "Αγαπητέ/ή ") + opts.firstname) + ","
        : esc(tr.dearCustomer)) +
      "</p>" +
      (opts.skipThanks ? "" : '<p style="font-size:14px;color:' + INK + ';line-height:1.7;margin:0 0 4px">' + esc(tr.thanksLine) + "</p>") +
      (opts.lead
        ? '<p style="font-size:14px;color:' + INK + ';line-height:1.7;margin:0 0 18px">' + esc(opts.lead) + "</p>"
        : "")) +

    (typeof opts.stage === "number"
      ? progressStepper(opts.stage, en, opts.stageSubs, !!opts.stageAllDone)
      : "") +
    factsTable +
    (opts.postFactsHtml || "") +
    nextBox +

    (opts.ctaUrl
      ? '<div style="text-align:center;margin:0 0 20px">' +
        '<a href="' + esc(opts.ctaUrl) + '" style="background:' + GOLD + ';color:#fff;text-decoration:none;' +
        'font-family:Georgia,serif;font-size:14px;padding:13px 30px;border-radius:6px;display:inline-block">' +
        esc(opts.ctaText || tr.viewOrder) + "</a></div>"
      : "") +

    officialContactsBlock(en) +

    goldRule("18px") +
    '<p style="text-align:center;font-size:11.5px;font-style:italic;color:#8a7a62;line-height:1.7;margin:0">' +
    esc(tr.autoMessage) + "</p>" +

    "</td></tr></table></div>"
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
    /* Formal "σας" and no order number, matching the other status mails — the
       number is right below in the facts strip, and repeating it in the subject
       line only crowds the inbox preview. */
    ? "Your order is being prepared"
    : "Η παραγγελία σας ετοιμάζεται";
  const subtitle = en
    ? "We have started preparing your order."
    : "Ξεκινήσαμε την προετοιμασία της παραγγελίας σας.";
  const lead = en
    ? "Our team is carefully putting your products together, with care and love."
    : "Η ομάδα μας ετοιμάζει προσεκτικά τα προϊόντα σας, με φροντίδα και αγάπη.";
  const statusRows = [
    { label: en ? "Order number" : "Αριθμός παραγγελίας", value: "#" + esc(order.number) },
    { label: en ? "Status" : "Κατάσταση", value: en ? "Being prepared" : "Σε προετοιμασία" },
  ];
  const facts = [
    { icon: "doc", label: en ? "Order code" : "Αριθμός παραγγελίας", value: "#" + esc(order.number) },
    { icon: "calendar", label: en ? "Date" : "Ημερομηνία",
      value: esc(shortDate(order.createdAt ? new Date(order.createdAt) : new Date(), en)) },
    { icon: "check", label: en ? "Status" : "Κατάσταση",
      value: esc(en ? "Being prepared" : "Σε προετοιμασία"), accent: true },
  ];
  const ctaUrl = orderTrackUrl(order);
  const ctaText = en ? "View your order" : "Δείτε την παραγγελία";
  const html = orderEmailShell({
    title, subtitle, lead, facts, ctaUrl, ctaText, lang: order.lang, stage: 1,
    firstname: (order.customer || {}).firstname,
    nextIcon: "truck",
    nextTitle: en ? "What happens next" : "Τι ακολουθεί",
    nextBody: en
      ? "We will send you another email as soon as your order is handed to the courier."
      : "Θα σας ενημερώσουμε με ένα νέο email όταν η παραγγελία σας παραδοθεί στον μεταφορέα.",
  });
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
    ? "Your order has shipped"
    : "Η παραγγελία σας απεστάλη";
  const lead = en
    ? "Your order has been handed to the courier and is now in transit."
    : "Το δέμα σας παραδόθηκε στον courier και είναι καθ' οδόν.";
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
  /* ACS only returns a delivery date once the parcel is actually moving, so
     without a fallback this column vanished on the very mail that most needs
     to answer "when will it arrive?". A working-day span is honest either way. */
  const etaText =
    eta && !isNaN(eta.getTime())
      ? shortDate(eta, en)
      : en ? "1–3 working days" : "1–3 εργάσιμες";
  const facts = [
    { icon: "truck", label: en ? "Courier" : "Courier", value: esc(courierName || "ACS") },
  ];
  if (order.tracking) {
    facts.push({ icon: "doc", label: en ? "Tracking number" : "Αριθμός αποστολής", value: esc(order.tracking) });
  }
  facts.push({ icon: "calendar", label: en ? "Estimated delivery" : "Εκτιμώμενη παράδοση",
    value: esc(etaText), accent: true });

  /* The first three stages have all happened by the time this mail goes out;
     the fourth is still an estimate, so it carries the span rather than a date
     we cannot promise. */
  const stamp = shortDate(order.createdAt ? new Date(order.createdAt) : new Date(), en);
  const stageSubs = [stamp, stamp, stamp, etaText];
  const postFactsHtml =
    '<p style="font-size:14px;color:' + INK + ';line-height:1.7;text-align:center;margin:0 0 20px">' +
    (en ? "Your parcel is on its way and should be with you soon." : "Το δέμα σας βρίσκεται καθ\' οδόν και σύντομα θα είναι στα χέρια σας.") +
    "</p>";
  const html = orderEmailShell({
    title,
    subtitle: en ? "Your order has started its journey." : "Το δέμα σας παραδόθηκε στον courier και είναι καθ' οδόν.",
    facts, postFactsHtml, ctaUrl, ctaText, lang: order.lang, stage: 2, hideIntro: true,
    stageSubs,
    factsTitle: en ? "Shipping details" : "Στοιχεία αποστολής",
  });
  const text = orderEmailText({ title, lead, statusRows, ctaUrl, ctaText, lang: order.lang });
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
    ? "Your order was delivered"
    : "Η παραγγελία σας παραδόθηκε";
  const lead = en
    ? "Your order has been delivered. We hope you love it!"
    : "Ελπίζουμε να απολαύσετε την παραγγελία σας.";
  const statusRows = [{ label: en ? "Order number" : "Αριθμός παραγγελίας", value: "#" + esc(order.number) }];
  const ctaUrl = orderTrackUrl(order);
  const ctaText = en ? "View order" : "Δες την παραγγελία";
  const reviewable = (order.items || []).find((it) => it.id);
  const reviewUrl = reviewable && order.accessToken
    ? base + "/product/" + encodeURIComponent(reviewable.id) + "?reviewToken=" + encodeURIComponent(order.accessToken)
    : "";
  const deliveryDateCandidate = new Date(order.deliveredAt || order.updatedAt || new Date());
  const deliveryDate = Number.isNaN(deliveryDateCandidate.getTime()) ? new Date() : deliveryDateCandidate;
  const reviewButton = reviewUrl
    ? '<a href="' + esc(reviewUrl) + '" style="display:inline-block;background:' + GOLD + ';color:#fff;text-decoration:none;font-family:Georgia,serif;font-size:13px;padding:9px 20px;border-radius:6px;margin-top:10px">' + (en ? "Leave a review" : "Αφήστε αξιολόγηση") + '</a>'
    : "";
  const postFactsHtml =
    '<p style="font-size:14px;color:' + INK + ';line-height:1.7;margin:0 0 5px">' + (en ? "Dear customer," : "Αγαπητέ πελάτη,") + "</p>" +
    '<p style="font-size:14px;color:' + INK + ';line-height:1.7;margin:0 0 5px">' + (en ? "Your order has been delivered successfully." : "Η παραγγελία σας παραδόθηκε με επιτυχία.") + "</p>" +
    '<p style="font-size:14px;color:' + INK + ';line-height:1.7;margin:0 0 18px">' + (en ? "Thank you for choosing Nostalgia Candle." : "Σας ευχαριστούμε θερμά που επιλέξατε τη Nostalgia Candle.") + "</p>" +
    '<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#f8f2e6;border:1px solid ' + GOLD + '2e;border-radius:8px;margin:0 0 18px"><tr><td align="center" valign="middle" width="80" style="padding:16px 8px">' + icon("review", 34) + '</td><td style="padding:14px 10px"><div style="font-family:Georgia,serif;font-size:15px;color:' + INK + ';margin:0 0 4px">' + (en ? "Your opinion matters" : "Η γνώμη σας είναι πολύτιμη") + '</div><div style="font-size:12px;color:#6b5d49;line-height:1.5">' + (en ? "We would love to hear about your experience." : "Θα χαρούμε πολύ να μοιραστείτε την εμπειρία σας από την παραγγελία και τα προϊόντα μας.") + '</div>' + reviewButton + '</td></tr></table>';
  const html = orderEmailShell({
    title,
    /* Not a restatement of the heading — the subtitle is the one line of warmth
       the customer reads before the details. */
    subtitle: en ? "We hope you enjoy your order." : "Ελπίζουμε να απολαύσετε την παραγγελία σας.",
    lead, lang: order.lang, stage: 3, hideIntro: true, postFactsHtml,
    /* Every stage complete — nothing is "current" any more, so the whole row
       reads as finished rather than pointing at a step. */
    stageAllDone: true,
    /* No footer button here: the only action worth offering at this point is
       the review, and that button already sits inside the callout above. Two
       buttons would just compete with each other. */
    facts: [
      { icon: "doc", label: en ? "Order code" : "Αριθμός παραγγελίας", value: "#" + esc(order.number) },
      { icon: "calendar", label: en ? "Delivery date" : "Ημερομηνία παράδοσης", value: esc(shortDate(deliveryDate, en)) },
    ],
  });
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
  const title = en ? "Delivery problem" : "Πρόβλημα παράδοσης";
  const lead = en
    ? "We encountered difficulty delivering your order. To complete the delivery successfully, we need your help."
    : "Εντοπίσαμε δυσκολία στην παράδοση της παραγγελίας σας. Για να ολοκληρωθεί επιτυχώς, χρειαζόμαστε τη βοήθειά σας.";
  const statusRows = [{ label: en ? "Order number" : "Αριθμός παραγγελίας", value: "#" + esc(order.number) }];
  const ctaUrl = "mailto:support@nostalgiacandle.gr?subject=" + encodeURIComponent("Order #" + order.number);
  const ctaText = en ? "Contact support" : "Επικοινωνία με υποστήριξη";
  /* Deliberately no progress tracker: this order has left the happy path, and
     a row of tidy stages would misrepresent what has happened. */
  const reasonBoxHtml =
    '<div style="background:#f8f2e6;border:1px solid ' + GOLD + '2e;border-radius:8px;padding:14px;margin:0 0 12px">' +
    '<div style="font-family:Georgia,serif;font-size:15px;color:' + GOLD + ';margin:0 0 12px">' + (en ? "Possible reasons" : "Πιθανοί λόγοι") + "</div>" +
    '<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"><tr>' +
    '<td width="50%" valign="top" style="padding:0 5px 0 0"><table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="border:1px solid ' + GOLD + '33;border-radius:6px"><tr><td width="46" valign="top" style="padding:12px 4px 12px 10px">' + icon("shield", 30) + '</td><td valign="top" style="padding:12px 8px 12px 0"><div style="font-family:Georgia,serif;font-size:14px;color:' + GOLD + ';font-weight:bold;margin-bottom:4px">' + (en ? "Delivery failed" : "Αποτυχία παράδοσης") + '</div><div style="font-size:11.5px;color:#6b5d49;line-height:1.5">' + (en ? "The courier was unable to deliver your order." : "Ο courier δεν κατάφερε να παραδώσει την παραγγελία σας.") + '</div></td></tr></table></td>' +
    '<td width="50%" valign="top" style="padding:0 0 0 5px"><table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="border:1px solid ' + GOLD + '33;border-radius:6px"><tr><td width="46" valign="top" style="padding:12px 4px 12px 10px">' + icon("gift", 30) + '</td><td valign="top" style="padding:12px 8px 12px 0"><div style="font-family:Georgia,serif;font-size:14px;color:' + GOLD + ';font-weight:bold;margin-bottom:4px">' + (en ? "Cash on delivery not collected" : "Αντικαταβολή που δεν παραλήφθηκε") + '</div><div style="font-size:11.5px;color:#6b5d49;line-height:1.5">' + (en ? "The cash-on-delivery payment was not collected." : "Η αντικαταβολή δεν παραλήφθηκε από τον παραλήπτη.") + '</div></td></tr></table></td></tr></table>' +
    '<p style="font-size:11.5px;color:#6b5d49;line-height:1.5;margin:12px 0 0">' + (en ? "The exact reason appears at the bottom of this email." : "Ο ακριβής λόγος αναφέρεται στο κάτω μέρος αυτού του email.") + '</p></div>' +
    '<div style="background:#f8f2e6;border:1px solid ' + GOLD + '2e;border-radius:8px;padding:15px 16px;margin:0 0 18px"><table role="presentation" cellpadding="0" cellspacing="0" border="0"><tr><td width="44" valign="middle">' + icon("phone", 30) + '</td><td valign="middle"><div style="font-family:Georgia,serif;font-size:15px;color:' + GOLD + ';margin:0 0 4px">' + (en ? "What you can do" : "Τι μπορείτε να κάνετε") + '</div><div style="font-size:12px;color:#6b5d49;line-height:1.55">' + (en ? "Contact us as soon as possible or request a new delivery so we can arrange the shipment." : "Επικοινωνήστε μαζί μας το συντομότερο δυνατό ή ζητήστε νέα παράδοση, ώστε να προγραμματίσουμε τη νέα αποστολή της παραγγελίας σας.") + '</div></td></tr></table></div>' +
    '<div style="font-size:13px;color:#6b5d49;line-height:1.6;margin:0 0 18px"><strong>' + (en ? "Reason:" : "Λόγος:") + '</strong> ' + esc(reasonText) + '</div>';
  const html = orderEmailShell({
    title,
    subtitle: en ? "Your order delivery requires action from you." : "Η παράδοση της παραγγελίας σας χρειάζεται ενέργεια από εσάς.",
    lead, postFactsHtml: reasonBoxHtml, ctaUrl, ctaText, lang: order.lang,
    skipThanks: true,
  });
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
/* Matches the opaque background baked into images/logo/logo light.png, so the
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
    '<img src="' + esc(siteBase() + "/images/logo/email-ic-" + name + ".png") + '" ' +
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
function officialContactsBlock(en) {
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
    (en ? "Official contact details" : "Επίσημα στοιχεία επικοινωνίας") + "</div>" +
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
    '<img src="' + esc(base + "/images/logo/logo-email.png") + '" alt="Nostalgia Collection" ' +
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
    (opts.showContacts ? officialContactsBlock(opts.lang === "en") : "") +
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
      lightEmailShell({
        lang: "el",
        title: "Νέο προϊόν",
        subtitle: "Μόλις κυκλοφόρησε μια νέα δημιουργία στη συλλογή μας.",
        ctaText: "Δείτε το νέο προϊόν",
        ctaUrl: productUrl(product),
        contentHtml:
          '<img src="' + esc(absImage(product.image)) + '" width="560" alt="" style="display:block;width:100%;height:auto;border:0;border-radius:7px;margin:0 0 12px" />' +
          '<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"><tr><td width="30%" valign="top" style="padding:0 14px 0 0"><img src="' + esc(absImage(product.image)) + '" width="170" alt="" style="display:block;width:100%;height:auto;border:0;border-radius:6px" /></td><td valign="top"><div style="font-family:Georgia,serif;font-size:18px;color:' + INK + ';margin:2px 0 10px">' + esc(product.title) + '</div><div style="font-size:13px;color:#6b5d49;line-height:1.8">✓ Απαλό, γλυκό άρωμα για στιγμές χαλάρωσης<br>✓ Χειροποίητο με φυσικό κερί σόγιας<br>✓ Καθαρή καύση &amp; μεγάλης διάρκειας</div><div style="font-family:Georgia,serif;font-size:16px;color:' + GOLD + ';font-weight:bold;margin-top:10px">' + money(product.salePrice != null ? product.salePrice : product.price) + '</div></td></tr></table>' +
          (desc ? '<p style="font-size:13px;color:#6b5d49;line-height:1.6;margin:14px 0 0">' + esc(desc) + '</p>' : ""),
      }),
    "new-product"
  );
}

function sendSaleBroadcast(recipients, product) {
  const pct =
    product.salePrice != null && product.price
      ? Math.round((1 - product.salePrice / product.price) * 100)
      : 0;
  const until = product.saleUntil ? new Date(product.saleUntil) : null;
  const untilText = until && !Number.isNaN(until.getTime()) ? shortDate(until, false) : "";
  const related = [product].concat(product.relatedProducts || []).filter(Boolean).slice(0, 3);
  return broadcast(
    recipients,
    "Η νέα προσφορά είναι ενεργή — Nostalgia Candle",
    (u) =>
      lightEmailShell({
        lang: "el",
        title: "Νέα προσφορά",
        subtitle: "Απολαύστε ειδική προσφορά για περιορισμένο χρονικό διάστημα.",
        ctaText: "Δείτε την προσφορά",
        ctaUrl: productUrl(product),
        contentHtml:
          '<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#f8f2e6;border:1px solid ' + GOLD + '2e;border-radius:8px;margin:0 0 14px"><tr><td width="42%" valign="middle"><img src="' + esc(absImage(product.image)) + '" width="210" alt="" style="display:block;width:100%;max-width:210px;height:auto;border:0;border-radius:7px 0 0 7px" /></td><td valign="middle" style="padding:14px 16px"><div style="font-size:12px;letter-spacing:1px;color:' + GOLD + ';font-weight:bold">ΕΚΠΤΩΣΗ</div><div style="font-family:Georgia,serif;font-size:42px;color:' + INK + ';line-height:1.1;margin:4px 0">-' + pct + '%</div><div style="font-size:12px;color:#6b5d49">σε επιλεγμένα αρωματικά προϊόντα</div></td></tr></table>' +
          '<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:0 0 14px"><tr><td valign="top" style="padding:0 8px 0 0;font-size:12px;color:#6b5d49;line-height:1.8">✓ Ανανεώστε τον χώρο σας με μοναδικά αρώματα<br>✓ Ιδανικά για κάθε στιγμή<br>✓ Ποιότητα που θα νιώσετε</td></tr></table>' +
          (untilText ? '<p style="text-align:center;font-size:12px;color:#6b5d49;margin:0 0 16px">Η προσφορά ισχύει έως ' + esc(untilText) + '.</p>' : "") +
          '<div style="text-align:center;font-family:Georgia,serif;font-size:15px;color:' + GOLD + ';margin:0 0 10px">Επιλεγμένα για εσάς</div>' +
          '<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"><tr>' +
          related.map((item) => '<td width="' + Math.floor(100 / related.length) + '%" valign="top" style="padding:0 4px"><table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#f8f2e6;border:1px solid ' + GOLD + '2e;border-radius:7px"><tr><td style="padding:6px"><img src="' + esc(absImage(item.image)) + '" width="140" alt="" style="display:block;width:100%;height:auto;border:0;border-radius:5px" /></td></tr><tr><td style="padding:0 8px 10px;font-size:11.5px;color:' + INK + ';line-height:1.4">' + esc(item.title || "Επιλεγμένο προϊόν") + '<br><strong style="color:' + GOLD + ';font-size:13px">' + money(item.salePrice != null ? item.salePrice : item.price) + '</strong>' + (item.salePrice != null && item.price ? ' <span style="color:#999;text-decoration:line-through;font-size:10px">' + money(item.price) + '</span>' : '') + '</td></tr></table></td>').join("") +
          '</tr></table>',
      }),
    "sale"
  );
}

function sendNewsletterConfirmation(to, token, opts) {
  const o = opts || {};
  const en = o.lang === "en";
  const url = siteBase() + "/api/newsletter/confirm?token=" + encodeURIComponent(token) +
    "&lang=" + (en ? "en" : "el");
  const html = lightEmailShell({
    lang: en ? "en" : "el",
    title: en ? "Confirm your subscription" : "Επιβεβαίωσε την εγγραφή σου",
    subtitle: en
      ? "One final step before we send you news and offers."
      : "Ένα τελευταίο βήμα πριν σου στέλνουμε νέα και προσφορές.",
    ctaUrl: url,
    ctaText: en ? "Confirm subscription" : "Επιβεβαίωση εγγραφής",
    contentHtml: '<p style="text-align:center;font-size:14px;color:' + INK +
      ';line-height:1.7;margin:0">' + (en
        ? "If you did not request this subscription, simply ignore this email. The link expires in 24 hours."
        : "Αν δεν ζήτησες εσύ την εγγραφή, αγνόησε αυτό το email. Ο σύνδεσμος λήγει σε 24 ώρες.") +
      "</p>",
  });
  return deliverMail({
    to,
    subject: en ? "Confirm your Nostalgia newsletter subscription" : "Επιβεβαίωσε την εγγραφή σου στο newsletter της Nostalgia",
    html,
    from: marketingFrom(),
    replyTo: supportReplyTo(),
    purpose: "marketing",
  });
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

  const welcomeHtml = lightEmailShell({
    lang: en ? "en" : "el",
    title: en ? "Welcome gift" : "Δώρο καλωσορίσματος",
    subtitle: en ? "A little offer to welcome you." : "Μια μικρή προσφορά για να σας καλωσορίσουμε.",
    ctaUrl: siteBase() + "/collection",
    ctaText: en ? "Use your gift" : "Χρησιμοποιήστε το δώρο σας",
    contentHtml:
      '<p style="text-align:center;font-size:14px;color:' + INK + ';line-height:1.7;margin:0 0 18px">' + (en ? "We are delighted to have you with us!<br>As a small thank you, we have an exclusive gift for you." : "Είμαστε χαρούμενοι που σας έχουμε μαζί μας!<br>Ως ένα μικρό ευχαριστώ, σας προσφέρουμε ένα αποκλειστικό δώρο ανάλογα με την ενέργεια που κάνατε στο κατάστημά μας.") + '</p>' +
      '<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"><tr>' +
      '<td width="50%" valign="top" style="padding:0 7px 0 0"><table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#f8f2e6;border:1px solid ' + GOLD + '33;border-radius:8px"><tr><td align="center" style="padding:14px 8px 6px">' + icon("mail", 34) + '</td></tr><tr><td align="center" style="padding:0 8px 14px"><div style="font-family:Georgia,serif;font-size:17px;color:' + INK + ';margin:4px 0">Newsletter</div><div style="font-size:12px;color:#6b5d49;margin-bottom:10px">-10% στην πρώτη σας παραγγελία</div><div style="border:1px dashed ' + GOLD + ';border-radius:6px;padding:8px 4px;color:' + GOLD + ';font-family:Georgia,serif;font-weight:bold;font-size:14px;word-break:break-word">NOSTALGIACANDLE10</div></td></tr></table></td>' +
      '<td width="50%" valign="top" style="padding:0 0 0 7px"><table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#f8f2e6;border:1px solid ' + GOLD + '33;border-radius:8px"><tr><td align="center" style="padding:14px 8px 6px">' + icon("gift", 34) + '</td></tr><tr><td align="center" style="padding:0 8px 14px"><div style="font-family:Georgia,serif;font-size:17px;color:' + INK + ';margin:4px 0">' + (en ? "New account" : "Νέος λογαριασμός") + '</div><div style="font-size:12px;color:#6b5d49;margin-bottom:10px">' + (en ? "-5% on your first purchase" : "-5% στην πρώτη σας αγορά") + '</div><div style="border:1px dashed ' + GOLD + ';border-radius:6px;padding:8px 4px;color:' + GOLD + ';font-family:Georgia,serif;font-weight:bold;font-size:14px;word-break:break-word">NOSTALGIACANDLE5</div></td></tr></table></td></tr></table>' +
      '<p style="text-align:center;font-size:13px;color:#6b5d49;line-height:1.6;margin:18px 0 0">' + (en ? "Depending on the action you took in our store, you will receive the corresponding coupon for your first order." : "Ανάλογα με την ενέργειά σας στο κατάστημά μας, θα λάβετε το αντίστοιχο κουπόνι για να το χρησιμοποιήσετε στην πρώτη σας παραγγελία.") + '</p>',
  });
  return sendTransactionalEmail(
    to,
    en ? "Your welcome gift is waiting — Nostalgia Candle" : "Το δώρο καλωσορίσματος σας περιμένει — Nostalgia Candle",
    welcomeHtml
  );

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
      lightEmailShell({
        lang: "el",
        title: "Νέο κουπόνι",
        subtitle: "Χρησιμοποιήστε τον παρακάτω κωδικό στην επόμενη παραγγελία σας.",
        ctaText: "Χρήση κουπονιού",
        ctaUrl: siteBase() + "/collection",
        contentHtml:
          '<div style="background:#f8f2e6;border:1px dashed ' + GOLD + ';border-radius:10px;padding:20px 12px;text-align:center;margin:0 0 16px"><div style="font-size:12px;letter-spacing:1.5px;color:#6b5d49;margin-bottom:10px">◆ Ο ΚΩΔΙΚΟΣ ΣΑΣ ◆</div><div style="font-family:Georgia,serif;font-size:34px;letter-spacing:3px;color:' + INK + ';word-break:break-word">' + esc(coupon.code) + '</div><div style="display:inline-block;border:1px solid ' + GOLD + ';border-radius:20px;padding:7px 22px;margin-top:12px;color:' + GOLD + ';font-family:Georgia,serif;font-size:15px">' + esc(coupon.type === "percent" ? "Έκπτωση " + coupon.value + "%" : "Έκπτωση " + money(coupon.value)) + '</div></div>' +
          '<div style="font-family:Georgia,serif;font-size:15px;color:' + INK + ';margin:0 0 8px">Όροι χρήσης</div>' +
          '<div style="font-size:13px;color:#6b5d49;line-height:1.85">✓ ' + (coupon.minOrder ? "Ελάχιστη αξία παραγγελίας: " + money(coupon.minOrder) : "Ισχύει για αγορές στη συλλογή μας") + '<br>✓ ' + (coupon.expiresAt ? "Ισχύει έως " + shortDate(new Date(coupon.expiresAt), false) : "Ισχύει για περιορισμένο χρονικό διάστημα") + '<br>✓ ' + (coupon.stackable === true ? "Μπορεί να συνδυαστεί με άλλες προσφορές" : "Δεν συνδυάζεται με άλλες προσφορές ή εκπτώσεις") + '</div>',
      }),
    "coupon"
  );
}

/* One-time code for password reset / change. In dev (no email configured)
   the code is logged to the server console so the flow stays testable. */
function lightEmailShell(opts) {
  const base = siteBase();
  const button = opts.ctaUrl
    ? '<div style="text-align:center;margin:22px 0 24px"><a href="' + esc(opts.ctaUrl) + '" style="display:inline-block;background:' + GOLD + ';color:#fff;text-decoration:none;font-family:Georgia,serif;font-size:14px;padding:13px 32px;border-radius:6px">' + esc(opts.ctaText) + '</a></div>'
    : "";
  return '<div style="background:#f2ece1;padding:26px 12px;font-family:Georgia,\'Times New Roman\',serif"><table role="presentation" align="center" width="600" cellpadding="0" cellspacing="0" border="0" style="max-width:600px;background:' + CREAM + ';border:1px solid ' + GOLD + '33;border-radius:4px"><tr><td style="padding:30px 34px 32px">' +
    '<div style="text-align:center"><img src="' + esc(base + "/images/logo/logo-email.png") + '" alt="Nostalgia Collection" width="104" style="display:inline-block;max-width:104px;height:auto;border:0" /></div>' +
    goldRule("20px") +
    '<h1 style="font-family:Georgia,serif;font-weight:normal;font-size:26px;color:' + INK + ';text-align:center;margin:0 0 10px">' + esc(opts.title) + '</h1>' +
    '<p style="text-align:center;font-size:13px;font-weight:bold;color:' + GOLD + ';margin:0 0 2px;line-height:1.6">' + esc(opts.subtitle) + '</p>' +
    ornamentDivider() + (opts.contentHtml || "") + button + officialContactsBlock(opts.lang === "en") + goldRule("18px") +
    '<p style="text-align:center;font-size:11.5px;font-style:italic;color:#8a7a62;line-height:1.7;margin:0">' + (opts.lang === "en" ? "This is an automated message. Please do not reply to this email." : "Αυτό είναι ένα αυτόματο μήνυμα. Παρακαλούμε μην απαντήσετε σε αυτό το email.") + '</p></td></tr></table></div>';
}

async function sendMarketingCampaignRecipient(kind, snapshot, recipient) {
  const result = kind === "new_product"
    ? await sendNewProductBroadcast([recipient], snapshot)
    : kind === "sale"
      ? await sendSaleBroadcast([recipient], snapshot)
      : await sendCouponBroadcast([recipient], snapshot);
  if (!result || result.sent !== 1) throw new Error((result && result.failures && result.failures[0] && result.failures[0].error) || "marketing_delivery_failed");
  return result;
}

async function sendPasswordCode(to, code, lang) {
  const isEn = lang === "en";
  const subject = isEn
    ? "Your Nostalgia verification code"
    : "Ο κωδικός επαλήθευσης Nostalgia";
  const html = lightEmailShell({
    lang: isEn ? "en" : "el",
    title: isEn ? "Verification code" : "Κωδικός επαλήθευσης",
    subtitle: isEn ? "Use the code below to reset or change your password." : "Χρησιμοποιήστε τον παρακάτω κωδικό για επαναφορά ή αλλαγή κωδικού πρόσβασης.",
    ctaUrl: siteBase() + "/account",
    ctaText: isEn ? "Go to account" : "Μετάβαση στον λογαριασμό",
    contentHtml:
      '<div style="background:#f8f2e6;border:1px solid ' + GOLD + '2e;border-radius:8px;text-align:center;padding:14px 12px;margin:0 0 16px"><div style="font-size:52px;letter-spacing:9px;color:' + GOLD + ';line-height:1.15">' + esc(code) + '</div></div>' +
      '<p style="text-align:center;font-size:13px;color:' + INK + ';margin:0 0 20px">' + icon("calendar", 16) + ' &nbsp;' + (isEn ? "This code is valid for 10 minutes" : "Ο κωδικός ισχύει για 10 λεπτά") + '</p>' +
      '<p style="text-align:center;font-size:13px;color:#6b5d49;line-height:1.6;margin:0 0 18px">' + (isEn ? "If you did not request a password reset or change, you can safely ignore this email." : "Αν δεν ζητήσατε την επαναφορά ή αλλαγή του κωδικού σας, μπορείτε να αγνοήσετε αυτό το email.") + '</p>' +
      '<div style="background:#f8f2e6;border:1px solid ' + GOLD + '2e;border-radius:8px;padding:13px 16px;text-align:left"><table role="presentation" cellpadding="0" cellspacing="0" border="0"><tr><td width="42" valign="top">' + icon("shield", 32) + '</td><td><div style="font-family:Georgia,serif;font-size:14px;color:' + GOLD + ';font-weight:bold;margin-bottom:5px">' + (isEn ? "For your security" : "Για την ασφάλειά σας") + '</div><div style="font-size:12px;color:#6b5d49;line-height:1.65">• ' + (isEn ? "Never share this code with anyone." : "Μην κοινοποιείτε τον κωδικό σας σε κανέναν.") + '<br>• ' + (isEn ? "Nostalgia Candle will never ask for your code." : "Η Nostalgia Candle δεν θα σας ζητήσει ποτέ τον κωδικό σας.") + '</div></td></tr></table></div>',
  });

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
  {
    const to = (process.env.SUPPORT_EMAIL || "").trim();
    if (!to) return;
    const customerName = [msg.firstName, msg.lastName].filter(Boolean).join(" ") || "Πελάτης";
    const subjectLine = String(msg.subject || "Νέο μήνυμα").trim();
    const mailto = "mailto:" + encodeURIComponent(msg.email) + "?subject=" + encodeURIComponent("Re: " + subjectLine);
    const attachment = msg.attachmentName
      ? '<p style="font-size:12.5px;color:#6b5d49;line-height:1.6;margin:12px 0 0"><strong>Συνημμένο:</strong> ' + esc(msg.attachmentName) + (msg.attachmentSize ? ' (' + Math.ceil(Number(msg.attachmentSize) / 1024) + ' KB)' : '') + '</p>'
      : '';
    const details = '<div style="background:#f8f2e6;border:1px solid ' + GOLD + '2e;border-radius:8px;padding:15px 16px;vertical-align:top">' +
      '<div style="font-family:Georgia,serif;font-size:15px;color:' + GOLD + ';font-weight:bold;margin:0 0 9px">Στοιχεία πελάτη</div>' +
      '<div style="font-size:12.5px;color:#6b5d49;line-height:1.85">' + icon("gift", 16) + ' &nbsp;Όνομα: ' + esc(customerName) + '<br>' + icon("mail", 16) + ' &nbsp;Email: ' + esc(msg.email) + '<br>' +
      (msg.phone ? icon("phone", 16) + ' &nbsp;Τηλέφωνο: ' + esc(msg.phone) + '<br>' : '') +
      (msg.country ? 'Χώρα: ' + esc(msg.country) + '<br>' : '') +
      icon("doc", 16) + ' &nbsp;Θέμα: ' + esc(subjectLine) + '</div></div>';
    const messageBox = '<div style="background:#f8f2e6;border:1px solid ' + GOLD + '2e;border-radius:8px;padding:15px 16px;vertical-align:top">' +
      '<div style="font-family:Georgia,serif;font-size:15px;color:' + GOLD + ';font-weight:bold;margin:0 0 9px">Το μήνυμα του πελάτη</div>' +
      '<div style="font-size:13px;color:' + INK + ';line-height:1.75;white-space:pre-wrap;word-break:break-word">' + esc(msg.message) + '</div>' + attachment + '</div>';
    const html = lightEmailShell({
      lang: "el",
      title: "Νέο μήνυμα επικοινωνίας",
      subtitle: "Ένα νέο αίτημα πελάτη χρειάζεται την προσοχή σας.",
      ctaUrl: mailto,
      ctaText: "Απάντηση στον πελάτη",
      contentHtml: '<p style="font-size:14px;color:' + INK + ';line-height:1.8;margin:0 0 18px">Ο πελάτης <strong>' + esc(customerName) + '</strong> έστειλε νέο μήνυμα από τη φόρμα επικοινωνίας.</p>' +
        '<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"><tr><td width="48%" valign="top">' + details + '</td><td width="4%">&nbsp;</td><td width="48%" valign="top">' + messageBox + '</td></tr></table>',
    });
    await deliverMail({ to, subject: "[Επικοινωνία] " + subjectLine + " — " + customerName, html, from: supportFrom(), replyTo: msg.email, purpose: "support" });
    console.log("[email] branded contact notification sent to " + to);
    return;
  }
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
  const receivedAt = new Date();
  const summary =
    '<div style="background:#f8f2e6;border:1px solid ' + GOLD + '2e;border-radius:8px;padding:13px 16px;margin:0 0 12px"><div style="font-family:Georgia,serif;font-size:15px;color:' + GOLD + ';margin:0 0 10px">' + (en ? "Your message summary" : "Σύνοψη μηνύματός σας") + '</div>' +
    '<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="font-size:12.5px;color:' + INK + '">' +
    '<tr><td width="28" style="padding:5px 0">' + icon("gift", 16) + '</td><td width="28%" style="padding:5px 0;color:#8a7a62">' + (en ? "Name" : "Όνομα") + '</td><td style="padding:5px 0">' + esc((msg.firstName || "") + " " + (msg.lastName || "")) + '</td></tr>' +
    '<tr><td style="padding:5px 0">' + icon("mail", 16) + '</td><td style="padding:5px 0;color:#8a7a62">Email</td><td style="padding:5px 0">' + esc(msg.email) + '</td></tr>' +
    '<tr><td style="padding:5px 0">' + icon("doc", 16) + '</td><td style="padding:5px 0;color:#8a7a62">' + (en ? "Subject" : "Θέμα") + '</td><td style="padding:5px 0">' + esc(msg.subject || "—") + '</td></tr>' +
    '<tr><td style="padding:5px 0">' + icon("calendar", 16) + '</td><td style="padding:5px 0;color:#8a7a62">' + (en ? "Date" : "Ημερομηνία") + '</td><td style="padding:5px 0">' + esc(shortDate(receivedAt, en)) + '</td></tr></table></div>' +
    '<div style="background:#f8f2e6;border:1px solid ' + GOLD + '2e;border-radius:8px;padding:13px 16px;margin:0 0 18px"><table role="presentation" cellpadding="0" cellspacing="0" border="0"><tr><td width="42" valign="top">' + icon("calendar", 24) + '</td><td><div style="font-family:Georgia,serif;font-size:14px;color:' + GOLD + ';font-weight:bold;margin-bottom:5px">' + (en ? "When will you hear from us?" : "Πότε θα λάβετε απάντηση") + '</div><div style="font-size:12px;color:#6b5d49;line-height:1.65">' + (en ? "Our team is available Monday–Friday, 09:00–17:00.<br>We will contact you as soon as possible." : "Η ομάδα μας είναι διαθέσιμη Δευτέρα – Παρασκευή, 09:00 – 17:00.<br>Θα επικοινωνήσουμε μαζί σας το συντομότερο δυνατό.") + '</div></td></tr></table></div>';
  const html = lightEmailShell({
    lang: en ? "en" : "el",
    title: en ? "Thank you for contacting us" : "Σας ευχαριστούμε για την επικοινωνία",
    subtitle: en ? "Your message was received successfully." : "Το μήνυμά σας παραλήφθηκε με επιτυχία.",
    ctaUrl: siteBase() + "/contact",
    ctaText: en ? "View your details" : "Δείτε τα στοιχεία σας",
    contentHtml: '<p style="font-size:14px;color:' + INK + ';line-height:1.7;margin:0 0 6px">' + (en ? "Dear customer," : "Αγαπητέ πελάτη,") + '</p><p style="font-size:14px;color:' + INK + ';line-height:1.7;margin:0 0 4px">' + (en ? "Thank you for contacting us." : "Ευχαριστούμε θερμά που επικοινωνήσατε μαζί μας.") + '</p><p style="font-size:14px;color:' + INK + ';line-height:1.7;margin:0 0 18px">' + (en ? "Our team will review your message and reply as soon as possible, usually within one business day." : "Η ομάδα της Nostalgia Candle θα εξετάσει το μήνυμά σας και θα σας απαντήσει το συντομότερο δυνατό, συνήθως εντός 1 εργάσιμης ημέρας.") + '</p>' + summary,
  });
  try {
    await deliverMail({ to: msg.email, subject, html, from: supportFrom(), purpose: "support" });
    console.log("[email] contact auto-reply sent to " + msg.email);
  } catch (e) {
    console.error("[email] failed to send contact auto-reply:", e.message);
  }
}

/* Admin reply to a contact message. This is intentionally a support email,
   never a marketing message, and replies go from the configured support
   identity so the customer can answer the thread naturally. */
async function sendContactReply(message, body) {
  {
    const isEn = message && message.lang === "en";
    const to = String((message && message.email) || "").trim();
    const safeSubject = String((message && message.subject) || (isEn ? "Contact with Nostalgia" : "Επικοινωνία με Nostalgia")).trim().slice(0, 180);
    const safeBody = String(body || "").trim().slice(0, 20000);
    if (!to || !safeBody) throw new Error("recipient_and_body_required");
    const firstName = String((message && message.firstName) || (isEn ? "customer" : "πελάτη")).trim();
    const fullName = [message && message.firstName, message && message.lastName].filter(Boolean).join(" ") || firstName;
    const messageDate = message && message.at ? new Date(message.at) : new Date();
    const dateText = Number.isNaN(messageDate.getTime()) ? "" : shortDate(messageDate, isEn);
    const replyHtml = esc(safeBody).replace(/\r?\n/g, "<br>");
    const mailto = "mailto:" + encodeURIComponent(to) + "?subject=" + encodeURIComponent("Re: " + safeSubject);
    const label = (el, en) => (isEn ? en : el);
    const requestPanel = '<div style="background:#f8f2e6;border:1px solid ' + GOLD + '2e;border-radius:8px;padding:15px 16px;vertical-align:top">' +
      '<div style="font-family:Georgia,serif;font-size:15px;color:' + GOLD + ';font-weight:bold;margin:0 0 8px">' + label("Στοιχεία αιτήματος", "Request details") + '</div>' +
      '<div style="font-size:12.5px;color:#6b5d49;line-height:1.8">' + icon("gift", 16) + ' &nbsp;' + esc(label("Όνομα", "Name")) + ': ' + esc(fullName) + '<br>' +
      icon("mail", 16) + ' &nbsp;Email: ' + esc(to) + '<br>' + icon("doc", 16) + ' &nbsp;' + esc(label("Θέμα", "Subject")) + ': ' + esc(safeSubject) + '<br>' +
      icon("calendar", 16) + ' &nbsp;' + esc(label("Ημερομηνία", "Date")) + ': ' + esc(dateText) + '</div></div>';
    const replyPanel = '<div style="background:#f8f2e6;border:1px solid ' + GOLD + '2e;border-radius:8px;padding:15px 16px;vertical-align:top">' +
      '<div style="font-family:Georgia,serif;font-size:15px;color:' + GOLD + ';font-weight:bold;margin:0 0 8px">' + label("Η απάντησή μας", "Our reply") + '</div>' +
      '<div style="font-size:13px;color:' + INK + ';line-height:1.75;word-break:break-word">' + replyHtml + '</div></div>';
    const html = lightEmailShell({
      lang: isEn ? "en" : "el",
      title: label("Απάντηση στην απορία σας", "Reply to your message"),
      subtitle: label("Η ομάδα μας απάντησε στο μήνυμά σας.", "Our team replied to your message."),
      ctaUrl: mailto,
      ctaText: label("Απάντηση στο email", "Reply by email"),
      contentHtml: '<p style="font-size:14px;color:' + INK + ';line-height:1.8;margin:0 0 8px">' + esc((isEn ? "Dear " : "Αγαπητή/έ ") + firstName) + ',</p>' +
        '<p style="font-size:14px;color:' + INK + ';line-height:1.8;margin:0 0 18px">' + esc(label("Σας ευχαριστούμε που επικοινωνήσατε μαζί μας.", "Thank you for contacting us.")) + '</p>' +
        '<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"><tr><td width="48%" valign="top">' + requestPanel + '</td><td width="4%">&nbsp;</td><td width="48%" valign="top">' + replyPanel + '</td></tr></table>',
    });
    const text = [label("Απάντηση στην απορία σας", "Reply to your message"), "", (isEn ? "Dear " : "Αγαπητή/έ ") + firstName + ",", label("Σας ευχαριστούμε που επικοινωνήσατε μαζί μας.", "Thank you for contacting us."), "", label("Στοιχεία αιτήματος", "Request details"), label("Όνομα", "Name") + ": " + fullName, "Email: " + to, label("Θέμα", "Subject") + ": " + safeSubject, label("Ημερομηνία", "Date") + ": " + dateText, "", label("Η απάντησή μας", "Our reply"), safeBody].join("\n");
    await deliverMail({ to, subject: "Re: " + safeSubject, html, text, from: supportFrom(), replyTo: supportReplyTo(), purpose: "support" });
    return;
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
  sendMarketingCampaignRecipient,
  sendAnnouncement,
  announcementPreviewHtml,
  /* Exported for preview/review tooling — render a body without sending it,
     the same way announcementPreviewHtml does for announcements. */
  campaignHtml,
  buildHtml,
  orderEmailShell,
  sendWelcomeCoupon,
  sendNewsletterConfirmation,
  sendPasswordCode,
  sendTransactionalEmail,
  sendContactNotification,
  sendContactAutoReply,
  sendContactReply,
};
