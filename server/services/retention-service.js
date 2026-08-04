"use strict";

/**
 * Data retention — GDPR art. 5(1)(e), storage limitation.
 *
 * Personal data may only be kept "for no longer than is necessary for the
 * purposes for which it is processed". Until now nothing here ever expired:
 * a contact enquiry from 2019 still held a name, email and phone number.
 *
 * Two different operations, because the data is not all the same:
 *
 *   DELETE      — records with no reason to survive their purpose at all
 *                 (contact messages, audit trails, admin login events).
 *   ANONYMISE   — orders. Greek tax law requires invoices to be retained, so
 *                 the order itself must stay; what goes is the identity
 *                 attached to it. Amounts, dates and order numbers survive
 *                 intact so the books still balance.
 *
 * Everything is DRY RUN unless explicitly told otherwise. Deleting customer
 * data is irreversible and a mis-set number would be discovered far too late,
 * so the default has to be the safe one.
 */

const DEFAULTS = {
  /* Contact-form enquiries. Answered and closed; nothing requires keeping the
     sender's details for years. */
  messagesMonths: 24,
  /* Security/audit trails. Long enough to investigate an incident, not
     indefinite. */
  auditMonths: 12,
  /* Admin session and login-attempt history. */
  adminEventsMonths: 6,
  /* Per-recipient delivery log for announcements/campaigns. */
  campaignRecipientsMonths: 12,
  /* Orders: identity is stripped, the order stays. Six years clears the Greek
     five-year retention requirement with a margin, counted from the order
     date rather than the fiscal year end. */
  orderAnonymiseYears: 6,
};

function months(name, fallback) {
  const v = parseInt(process.env[name], 10);
  return Number.isFinite(v) && v > 0 ? v : fallback;
}

function config() {
  return {
    messagesMonths: months("RETENTION_MESSAGES_MONTHS", DEFAULTS.messagesMonths),
    auditMonths: months("RETENTION_AUDIT_MONTHS", DEFAULTS.auditMonths),
    adminEventsMonths: months("RETENTION_ADMIN_EVENTS_MONTHS", DEFAULTS.adminEventsMonths),
    campaignRecipientsMonths: months("RETENTION_CAMPAIGN_MONTHS", DEFAULTS.campaignRecipientsMonths),
    orderAnonymiseYears: months("RETENTION_ORDER_ANONYMISE_YEARS", DEFAULTS.orderAnonymiseYears),
    /* Off unless switched on deliberately. */
    enabled: String(process.env.RETENTION_ENABLED || "").toLowerCase() === "true",
  };
}

/** Does this table exist? The schema differs between environments (the v2
 *  tables are only present where those migrations ran), and a missing table
 *  must skip the step rather than abort the whole sweep. */
async function tableExists(client, name) {
  const r = await client.query(
    "SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name=$1",
    [name]
  );
  return r.rowCount > 0;
}

async function countOlderThan(client, table, column, interval) {
  const r = await client.query(
    `SELECT COUNT(*)::int AS n FROM ${table} WHERE ${column} < now() - $1::interval`,
    [interval]
  );
  return r.rows[0].n;
}

async function deleteOlderThan(client, table, column, interval, apply) {
  if (!(await tableExists(client, table))) return { table, skipped: "no_such_table" };
  const n = await countOlderThan(client, table, column, interval);
  if (apply && n > 0) {
    await client.query(
      `DELETE FROM ${table} WHERE ${column} < now() - $1::interval`,
      [interval]
    );
  }
  return { table, matched: n, deleted: apply ? n : 0 };
}

/* The customer blob is replaced rather than nulled: downstream code (admin
   lists, the receipt builder) reads fields off it and would throw on null.
   Keeping the shape with emptied values means an anonymised order still
   renders, just without a person attached. Country is kept because it is a
   tax-relevant fact about the sale, not an identifier. */
const ANONYMISED_CUSTOMER = {
  firstname: "—",
  lastname: "",
  email: "",
  phone: "",
  mobile: "",
  street: "",
  streetNumber: "",
  city: "",
  postal: "",
  prefecture: "",
  floor: "",
  notes: "",
  company: "",
  afm: "",
  doy: "",
  anonymisedAt: null, // filled in per row below
};

async function anonymiseOldOrders(client, years, apply) {
  const interval = years + " years";
  const r = await client.query(
    `SELECT COUNT(*)::int AS n FROM orders
      WHERE created_at < now() - $1::interval
        AND COALESCE(customer->>'email', '') <> ''`,
    [interval]
  );
  const matched = r.rows[0].n;
  if (apply && matched > 0) {
    const blob = Object.assign({}, ANONYMISED_CUSTOMER, {
      anonymisedAt: new Date().toISOString(),
    });
    await client.query(
      `UPDATE orders
          SET customer = $2::jsonb,
              user_email = NULL
        WHERE created_at < now() - $1::interval
          AND COALESCE(customer->>'email', '') <> ''`,
      [interval, JSON.stringify(blob)]
    );
  }
  return { table: "orders", matched, anonymised: apply ? matched : 0 };
}

/**
 * Runs the sweep. Returns what it did (or would do) per table.
 * `apply` defaults to false — call it with { apply: true } only from a place
 * that means it.
 */
async function runRetention({ pool, apply = false } = {}) {
  const cfg = config();
  const effectiveApply = apply && cfg.enabled;
  const client = await pool.connect();
  const steps = [];

  try {
    steps.push(await deleteOlderThan(client, "messages", "created_at",
      cfg.messagesMonths + " months", effectiveApply));
    steps.push(await deleteOlderThan(client, "audit_log", "created_at",
      cfg.auditMonths + " months", effectiveApply));
    steps.push(await deleteOlderThan(client, "audit_logs", "created_at",
      cfg.auditMonths + " months", effectiveApply));
    steps.push(await deleteOlderThan(client, "admin_login_events", "created_at",
      cfg.adminEventsMonths + " months", effectiveApply));
    steps.push(await deleteOlderThan(client, "marketing_campaign_recipients", "created_at",
      cfg.campaignRecipientsMonths + " months", effectiveApply));
    steps.push(await anonymiseOldOrders(client, cfg.orderAnonymiseYears, effectiveApply));
  } finally {
    client.release();
  }

  const totalMatched = steps.reduce((s, x) => s + (x.matched || 0), 0);
  return {
    applied: effectiveApply,
    /* Explains an "applied: false" that the caller did not expect. */
    reason: effectiveApply ? null : !cfg.enabled ? "RETENTION_ENABLED is not true" : "dry run",
    config: cfg,
    totalMatched,
    steps,
  };
}

module.exports = { runRetention, config, DEFAULTS };
