"use strict";

/**
 * Telegram push notifications.
 *
 * Two independent channels so each person only sees what concerns them:
 *   "orders" → the shop owner: a new order came in.
 *   "tech"   → the developer: something is broken (see monitoring-service.js).
 * They are separate Telegram chats, so the owner never sees technical noise.
 *
 * Disabled unless TELEGRAM_BOT_TOKEN plus the matching TELEGRAM_CHAT_* id are
 * set — same opt-in pattern as ACS and Cloudinary. Every failure is swallowed:
 * a notification must never break the order that triggered it.
 */

const API = "https://api.telegram.org/bot";
const TIMEOUT_MS = 8000;

function token() {
  return (process.env.TELEGRAM_BOT_TOKEN || "").trim();
}

/** Channel name → configured chat id ("" when that channel is off). */
function chatId(channel) {
  const key = channel === "tech" ? "TELEGRAM_CHAT_TECH" : "TELEGRAM_CHAT_ORDERS";
  return (process.env[key] || "").trim();
}

function configured(channel) {
  return !!(token() && chatId(channel));
}

/**
 * Send one message. Resolves to true when delivered, false when skipped or
 * failed — never rejects, so callers can fire and forget.
 */
async function push(channel, text) {
  if (!configured(channel)) return false;
  const body = {
    chat_id: chatId(channel),
    text: String(text || "").slice(0, 4000), // Telegram hard-caps at 4096
    disable_web_page_preview: true,
  };
  /* Bound the wait: a hanging Telegram must not pin a request open. */
  const abort = new AbortController();
  const timer = setTimeout(() => abort.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(API + token() + "/sendMessage", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
      signal: abort.signal,
    });
    if (!res.ok) {
      console.error("[notify] telegram HTTP " + res.status);
      return false;
    }
    return true;
  } catch (e) {
    console.error("[notify] telegram failed:", (e && e.message) || e);
    return false;
  } finally {
    clearTimeout(timer);
  }
}

function money(n) {
  return (Math.round(Number(n || 0) * 100) / 100).toFixed(2).replace(".", ",") + " €";
}

const PAYMENT_LABEL = {
  cod: "Αντικαταβολή",
  stripe: "Κάρτα",
  offline: "Τραπεζική κατάθεση",
};

/** Human-readable "new order" message for the shop owner. */
function orderMessage(order) {
  const o = order || {};
  const c = o.customer || {};
  const name = [c.firstname, c.lastname].filter(Boolean).join(" ").trim();
  const items = Array.isArray(o.items) ? o.items : [];
  const units = items.reduce((sum, it) => sum + (parseInt(it && it.qty, 10) || 0), 0);

  const lines = [
    "🕯 Νέα παραγγελία #" + (o.number || "—"),
    money(o.total) + " · " + (PAYMENT_LABEL[o.payment] || o.payment || "—"),
  ];
  if (name || c.city) lines.push([name, c.city].filter(Boolean).join(" · "));
  if (units) {
    lines.push(units + (units === 1 ? " τεμάχιο" : " τεμάχια"));
    /* Keep the list short — the admin panel has the full detail. */
    items.slice(0, 5).forEach((it) => {
      lines.push("  • " + (it.qty || 1) + "× " + (it.title || it.id || "—"));
    });
    if (items.length > 5) lines.push("  • …και άλλα " + (items.length - 5));
  }
  return lines.join("\n");
}

const SEVERITY_ICON = { critical: "🔴", error: "🟠", warning: "🟡" };

/* An alert nobody understands is an alert nobody acts on. Each entry is
   [what it means, what to do] in plain Greek — read on a phone, at night,
   by someone who is not looking at the code. */
const ALERT_HELP = {
  credential_stuffing_distributed: [
    "Πολλές διαφορετικές IP δοκιμάζουν συνθηματικά ταυτόχρονα — μοτίβο αυτοματοποιημένης επίθεσης.",
    "Το per-IP rate limit ΔΕΝ το σταματά. Έλεγξε το audit log και σκέψου προσωρινό μπλοκάρισμα ή αυστηρότερο CAPTCHA.",
  ],
  account_enumeration: [
    "Δοκιμάζονται πολλοί διαφορετικοί λογαριασμοί — δείχνει λίστα emails, όχι πελάτη που ξέχασε κωδικό.",
    "Πιθανή χρήση διαρρεύσαντων στοιχείων από άλλη υπηρεσία.",
  ],
  failed_login_spike: [
    "Ασυνήθιστα πολλές αποτυχημένες συνδέσεις την τελευταία ώρα.",
    "Αν συνοδεύεται από τους παραπάνω συναγερμούς, είναι επίθεση.",
  ],
  negative_stock_invariant: [
    "Αρνητικό απόθεμα — πουλήθηκε προϊόν που δεν υπάρχει.",
    "Σταμάτα τις πωλήσεις του προϊόντος και έλεγξε τις τελευταίες παραγγελίες.",
  ],
  webhook_processing_delay: [
    "Ειδοποιήσεις πληρωμών δεν επεξεργάζονται.",
    "Παραγγελίες μπορεί να μένουν απλήρωτες ενώ ο πελάτης πλήρωσε.",
  ],
  checkout_error_rate: [
    "Πολλά σφάλματα στο checkout — πιθανώς οι πελάτες ΔΕΝ μπορούν να αγοράσουν.",
    "Έλεγξε άμεσα.",
  ],
};

/** Technical alert message for the developer. */
function alertMessage(alert) {
  const a = alert || {};
  const d = a.details || {};
  const lines = [
    (SEVERITY_ICON[a.severity] || "⚪") + " " +
      String(a.severity || "alert").toUpperCase() + " — " + (a.type || "unknown"),
  ];
  const help = ALERT_HELP[a.type];
  if (help) lines.push("", help[0], help[1]);
  if (d.value != null) {
    lines.push("", "Τιμή: " + d.value + (d.threshold != null ? " (όριο: " + d.threshold + ")" : ""));
  }
  if (d.metric) lines.push("Μετρική: " + d.metric);
  return lines.join("\n");
}

/** Fire-and-forget helpers — these never throw, so call sites stay one line. */
function notifyNewOrder(order) {
  push("orders", orderMessage(order)).catch(() => {});
}

function notifyAlert(alert) {
  push("tech", alertMessage(alert)).catch(() => {});
}

module.exports = {
  configured,
  push,
  orderMessage,
  alertMessage,
  notifyNewOrder,
  notifyAlert,
};
