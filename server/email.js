"use strict";

/**
 * Order confirmation email (electronic receipt).
 *
 * Email providers (first match wins):
 *   1. Resend — RESEND_API_KEY + EMAIL_FROM (or SMTP_FROM)
 *   2. SMTP   — SMTP_HOST, SMTP_USER, SMTP_PASS (+ SMTP_FROM)
 *
 * Also used:
 *   SITE_URL   (public base URL, for absolute image links)
 *   COURIER_NAME (optional shipping carrier on receipt)
 *
 * If nothing is configured, the receipt is logged to the console so the
 * order flow never breaks while you set up email.
 */

const fees = require("./fees");
const nodemailer = require("nodemailer");

let transporter = null;
let transporterKey = null;

function resendConfigured() {
  return !!(
    process.env.RESEND_API_KEY &&
    (process.env.EMAIL_FROM || process.env.SMTP_FROM)
  );
}

function smtpConfigured() {
  return !!(process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS);
}

function emailConfigured() {
  return resendConfigured() || smtpConfigured();
}

function getTransporter() {
  const key = [
    process.env.SMTP_HOST,
    process.env.SMTP_PORT,
    process.env.SMTP_USER,
    process.env.SMTP_PASS,
    process.env.SMTP_SECURE,
  ].join("|");
  if (transporter && transporterKey === key) return transporter;
  transporterKey = key;
  transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: parseInt(process.env.SMTP_PORT, 10) || 587,
    secure: process.env.SMTP_SECURE === "true",
    auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
  });
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
    codFee: "Αντικαταβολή",
    total: "Σύνολο",
    courier: "Εταιρεία μεταφοράς",
    courierTbd: "Θα ενημερωθείς για την εταιρεία μεταφοράς και τον αριθμό αποστολής.",
    shipTo: "Διεύθυνση αποστολής",
    payment: "Τρόπος πληρωμής",
    payCard: "Κάρτα (Stripe)",
    payCod: "Αντικαταβολή",
    receipt: "Ηλεκτρονική απόδειξη",
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
    codFee: "Cash on delivery fee",
    total: "Total",
    courier: "Shipping carrier",
    courierTbd: "You will be notified of the shipping carrier and tracking number.",
    shipTo: "Shipping address",
    payment: "Payment method",
    payCard: "Card (Stripe)",
    payCod: "Cash on delivery",
    receipt: "Electronic receipt",
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
  const shippingFee =
    order.shippingFee != null
      ? order.shippingFee
      : fees.orderExtraFees(order.payment, subtotal).shipping;
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
    (shippingFee
      ? '<tr><td style="padding:3px 0;color:#666">' + esc(tr.shipping) + '</td><td style="padding:3px 0;text-align:right">' + money(shippingFee) + "</td></tr>"
      : "") +
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
    "</div>" +
    '<div style="background:#15110e;padding:18px;text-align:center;color:#b3a186;font-size:12px">' + esc(tr.footer) + "</div>" +
    "</div>"
  );
}

async function sendViaResend(to, subject, html) {
  const from = process.env.EMAIL_FROM || process.env.SMTP_FROM;
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: "Bearer " + process.env.RESEND_API_KEY,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ from, to: [to], subject, html }),
  });
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error("Resend " + res.status + (body ? ": " + body.slice(0, 200) : ""));
  }
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
  const subject = tr.subject(order.number);

  if (!emailConfigured()) {
    console.log(
      "[email] not configured — receipt for " + order.number +
        " would be sent to " + to + " (set RESEND_API_KEY or SMTP_* in .env)."
    );
    return;
  }

  try {
    if (resendConfigured()) {
      await sendViaResend(to, subject, html);
      console.log("[email] Resend confirmation sent to " + to + " for " + order.number);
      return;
    }
    await getTransporter().sendMail({
      from: process.env.SMTP_FROM || process.env.SMTP_USER,
      to,
      subject,
      html,
    });
    console.log("[email] SMTP confirmation sent to " + to + " for " + order.number);
  } catch (e) {
    console.error("[email] failed to send confirmation for " + order.number + ":", e.message);
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

/** One generic, on-brand campaign email (dark header, gold accent). */
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
  const imageBlock = img
    ? '<div style="text-align:center;margin:18px 0"><img src="' + esc(img) +
      '" alt="" width="240" style="max-width:100%;border-radius:10px;display:inline-block" /></div>'
    : "";
  const button = opts.ctaUrl
    ? '<div style="text-align:center;margin:24px 0 6px">' +
      '<a href="' + esc(opts.ctaUrl) + '" style="background:#15110e;color:#c5a060;text-decoration:none;' +
      'font-size:13px;letter-spacing:2px;text-transform:uppercase;padding:13px 26px;border-radius:6px;display:inline-block">' +
      esc(opts.ctaText || "Δες περισσότερα") + "</a></div>"
    : "";

  return (
    '<div style="font-family:Georgia,\'Times New Roman\',serif;max-width:560px;margin:0 auto;color:#2b2b2b;background:#faf6ef">' +
    '<div style="background:#15110e;padding:26px;text-align:center">' +
    '<span style="color:#c5a060;font-size:24px;letter-spacing:4px;text-transform:uppercase">Nostalgia</span>' +
    "</div>" +
    '<div style="padding:28px 26px">' +
    '<p style="font-size:15px;margin:0 0 14px">' + greeting + "</p>" +
    (opts.heading
      ? '<h2 style="font-family:Georgia,serif;font-size:20px;color:#15110e;margin:0 0 14px">' + esc(opts.heading) + "</h2>"
      : "") +
    imageBlock +
    paras +
    codeBlock +
    button +
    "</div>" +
    '<div style="background:#15110e;padding:18px;text-align:center;color:#b3a186;font-size:12px">' +
    "Nostalgia Collection · Χειροποίητα κεριά<br>" +
    '<a href="' + esc(base) + '" style="color:#c5a060;text-decoration:none">' + esc(base.replace(/^https?:\/\//, "")) + "</a>" +
    "</div>" +
    "</div>"
  );
}

async function deliver(to, subject, html) {
  if (resendConfigured()) {
    await sendViaResend(to, subject, html);
    return;
  }
  await getTransporter().sendMail({
    from: process.env.SMTP_FROM || process.env.SMTP_USER,
    to,
    subject,
    html,
  });
}

/**
 * Send one campaign to many recipients. Never throws.
 * recipients: [{ email, firstname }]. Returns { sent, total }.
 */
async function broadcast(recipients, subject, htmlForRecipient, label) {
  const list = (recipients || []).filter((u) => u && u.email);
  if (!list.length) return { sent: 0, total: 0 };

  if (!emailConfigured()) {
    console.log(
      "[email] not configured — '" + label + "' would reach " + list.length +
        " account holder(s) (set RESEND_API_KEY or SMTP_* in .env)."
    );
    return { sent: 0, total: list.length };
  }

  let sent = 0;
  for (const u of list) {
    try {
      await deliver(u.email, subject, htmlForRecipient(u));
      sent++;
    } catch (e) {
      console.error("[email] '" + label + "' failed for " + u.email + ":", e.message);
    }
  }
  console.log("[email] '" + label + "' sent to " + sent + "/" + list.length + " account holder(s).");
  return { sent, total: list.length };
}

function priceLine(product) {
  if (product.salePrice != null && product.price != null) {
    return 'Τιμή: <span style="text-decoration:line-through;color:#999">' + money(product.price) +
      '</span> <strong style="color:#c0392b">' + money(product.salePrice) + "</strong>";
  }
  if (product.price != null) return "Τιμή: <strong>" + money(product.price) + "</strong>";
  return "";
}

function sendNewProductBroadcast(recipients, product) {
  const lines = ["Μόλις προσθέσαμε μια νέα δημιουργία στη συλλογή μας: <strong>" + esc(product.title) + "</strong>."];
  const pl = priceLine(product);
  if (pl) lines.push(pl);
  lines.push("Δες το πρώτος/πρώτη πριν εξαντληθεί.");
  return broadcast(
    recipients,
    "Νέο προϊόν στη Nostalgia Collection",
    (u) =>
      campaignHtml({
        firstname: u.firstname,
        heading: "Νέο προϊόν",
        image: product.image,
        paragraphs: lines,
        ctaText: "Δες τα Νέα Προϊόντα",
        ctaUrl: siteBase() + "/new-arrivals",
      }),
    "new-product"
  );
}

function sendSaleBroadcast(recipients, product) {
  const pct =
    product.salePrice != null && product.price
      ? Math.round((1 - product.salePrice / product.price) * 100)
      : 0;
  const lines = [
    "Το <strong>" + esc(product.title) + "</strong> είναι τώρα σε έκπτωση" +
      (pct > 0 ? " <strong style=\"color:#c0392b\">−" + pct + "%</strong>" : "") + ".",
  ];
  const pl = priceLine(product);
  if (pl) lines.push(pl);
  if (product.saleUntil) {
    lines.push("Η προσφορά ισχύει έως " + new Date(product.saleUntil).toLocaleDateString("el-GR") + ".");
  }
  return broadcast(
    recipients,
    "Νέα έκπτωση στη Nostalgia Collection",
    (u) =>
      campaignHtml({
        firstname: u.firstname,
        heading: "Έκπτωση" + (pct > 0 ? " −" + pct + "%" : ""),
        image: product.image,
        paragraphs: lines,
        ctaText: "Δες τις Εκπτώσεις",
        ctaUrl: siteBase() + "/sale",
      }),
    "sale"
  );
}

function sendCouponBroadcast(recipients, coupon) {
  const perks = [];
  if (Number(coupon.value) > 0) {
    perks.push(coupon.type === "percent" ? coupon.value + "% έκπτωση" : money(coupon.value) + " έκπτωση");
  }
  if (coupon.freeShipping) perks.push("δωρεάν μεταφορικά");
  const perkText = perks.length ? perks.join(" και ") : "προνόμιο";
  const lines = [
    "Σου χαρίζουμε έναν αποκλειστικό κωδικό με <strong>" + perkText + "</strong> για τις αγορές σου.",
    "Χρησιμοποίησέ τον κατά την ολοκλήρωση της παραγγελίας σου.",
  ];
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
        heading: "Δώρο για εσένα",
        paragraphs: lines,
        code: coupon.code,
        codeNote: codeNote,
        ctaText: "Αγόρασε τώρα",
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
    if (resendConfigured()) {
      await sendViaResend(to, subject, html);
      console.log("[email] Resend password code sent to " + to);
      return;
    }
    await getTransporter().sendMail({
      from: process.env.SMTP_FROM || process.env.SMTP_USER,
      to,
      subject,
      html,
    });
    console.log("[email] SMTP password code sent to " + to);
  } catch (e) {
    console.error("[email] failed to send password code to " + to + ":", e.message);
  }
}

module.exports = {
  sendOrderConfirmation,
  emailConfigured,
  smtpConfigured,
  resendConfigured,
  sendNewProductBroadcast,
  sendSaleBroadcast,
  sendCouponBroadcast,
  sendPasswordCode,
};
