"use strict";

const { app, initialize } = require("../server/server");

module.exports = async function handler(req, res) {
  try {
    await initialize();
    return app(req, res);
  } catch (err) {
    console.error("[vercel] function error:", err && err.stack ? err.stack : err);
    if (!res.headersSent) {
      res.statusCode = 500;
      res.setHeader("content-type", "text/plain; charset=utf-8");
      res.end(
        "Server error: " +
          (err && err.message ? err.message : String(err)) +
          (err && /deadlock|EMAXCONN|timeout/i.test(String(err.message || ""))
            ? "\n\nTemporary database contention — refresh in a few seconds."
            : "\n\nCheck Vercel env vars (DATABASE_URL, SESSION_SECRET, SITE_URL).")
      );
    }
  }
};
