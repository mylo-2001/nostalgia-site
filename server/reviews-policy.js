"use strict";

/**
 * Review moderation — pure logic, no DB access (mirrors fees.js/promotions.js).
 *
 * Two layers, by design:
 *   1. Automatic pre-screen at submission time (this module) — catches only
 *      OBJECTIVE, content-neutral problems (links, contact info, spam-shaped
 *      text) that apply equally to a 5-star and a 1-star review. It never
 *      looks at rating or sentiment.
 *   2. Human moderation (admin approve/reject/flag) — judgment calls that
 *      need a person: relevance, genuine offensiveness, duplicate intent.
 *      The admin UI only offers content-based reasons (see REJECTION_REASONS)
 *      — there is deliberately no "didn't like it" option.
 */

const URL_RE = /\bhttps?:\/\/|www\.[a-z0-9-]+\.[a-z]{2,}/i;
const EMAIL_RE = /[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}/i;
/* Phone-like: a run of digits (allowing spaces/dashes/dots/parens as
   separators) totalling 8+ actual digits — long enough to avoid flagging
   ordinary text like "lasted 30 days" or "size 12". */
const PHONE_CANDIDATE_RE = /(\+?\d[\d\s().-]{6,}\d)/g;

function digitCount(s) {
  return (s.match(/\d/g) || []).length;
}

function containsUrl(s) {
  return URL_RE.test(s);
}

function containsEmail(s) {
  return EMAIL_RE.test(s);
}

function containsPhoneLike(s) {
  const candidates = s.match(PHONE_CANDIDATE_RE) || [];
  return candidates.some((c) => digitCount(c) >= 8);
}

/** Automatic content pre-screen. Returns { ok: true } or
 *  { ok: false, reason: <machine code> } — never based on rating/sentiment. */
function screenReviewContent({ title, text }) {
  const combined = String(title || "") + " " + String(text || "");
  if (containsUrl(combined)) return { ok: false, reason: "contains_link" };
  if (containsEmail(combined) || containsPhoneLike(combined)) {
    return { ok: false, reason: "contains_personal_data" };
  }
  return { ok: true };
}

/** Enumerated, content-based reasons an admin can pick when moving a review
 *  out of 'approved' (reject / flag / remove). No open-ended "didn't like
 *  it" option — every reason must point at a rule, not an opinion. */
const REJECTION_REASONS = [
  { code: "spam", label: "Spam / διαφημιστικό περιεχόμενο" },
  { code: "offensive", label: "Προσβλητικό ή απειλητικό περιεχόμενο" },
  { code: "personal_data", label: "Προσωπικά δεδομένα (τηλέφωνο, διεύθυνση, email)" },
  { code: "irrelevant", label: "Άσχετο με το προϊόν (courier/εξυπηρέτηση)" },
  { code: "duplicate", label: "Διπλή κριτική από τον ίδιο χρήστη" },
  { code: "unverifiable", label: "Δεν επιβεβαιώνεται αγορά/παραλαβή του προϊόντος" },
  { code: "other", label: "Άλλος λόγος (παραβίαση κανόνων δημοσίευσης)" },
];

const REJECTION_REASON_CODES = new Set(REJECTION_REASONS.map((r) => r.code));

module.exports = {
  screenReviewContent,
  containsUrl,
  containsEmail,
  containsPhoneLike,
  REJECTION_REASONS,
  REJECTION_REASON_CODES,
};
