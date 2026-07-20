"use strict";

const mailer = require("../email");

const COPY = {
  order_created: ["We received your order", "Your order has been safely received."],
  payment_confirmed: ["Payment confirmed", "Your payment has been confirmed."],
  payment_failed: ["Payment update", "Your payment was not completed."],
  order_shipped: ["Your order is on its way", "Your order has been handed to the courier."],
  tracking_added: ["Tracking added", "Tracking information is now available for your order."],
  order_cancelled: ["Order cancelled", "Your order has been cancelled."],
  return_approved: ["Return approved", "Your return request has been approved."],
  refund_confirmed: ["Refund confirmed", "Your refund has been confirmed."],
};

function escapeHtml(value) {
  return String(value || "").replace(/[&<>"']/g, (char) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
  })[char]);
}

class EmailNotificationSender {
  constructor(pool) { this.pool = pool; }

  async send(message) {
    const client = await this.pool.connect();
    let order;
    try {
      const orderId = message.payload.orderId;
      const result = await client.query(`SELECT number,customer_email_normalized
        FROM orders WHERE id=$1`, [orderId]);
      if (!result.rowCount || !result.rows[0].customer_email_normalized) {
        throw new Error("notification_recipient_missing");
      }
      order = result.rows[0];
    } finally { client.release(); }
    const [subject, body] = COPY[message.eventType] || ["Order update", "Your order was updated."];
    const html = `<div style="font-family:Georgia,serif;max-width:560px;margin:auto;padding:32px">` +
      `<h1 style="font-size:22px">Nostalgia Collection</h1>` +
      `<p>${escapeHtml(body)}</p><p>Order: <strong>${escapeHtml(order.number)}</strong></p></div>`;
    await mailer.sendTransactionalEmail(order.customer_email_normalized,
      `${subject} - Nostalgia Collection`, html);
  }
}

module.exports = { EmailNotificationSender, escapeHtml };
