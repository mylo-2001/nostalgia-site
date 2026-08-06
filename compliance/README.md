# Article 28 processor contracts (DPAs)

Signed DPAs, acceptance screenshots and written confirmations from every
processor that touches personal data.

> **Everything in this folder is gitignored except this file.** The repository is
> public. Documents here carry the ΑΦΜ, the registered address and account
> identifiers — none of that may be published. See `.gitignore`.

These are the business's legal records, not build artefacts. Keep a second copy
wherever Maria keeps her paperwork, so the contracts survive independently of
this repository and of whoever is maintaining the site.

## Naming

    <provider>-dpa-<date>.<ext>

Date is the acceptance/issue date, `YYYY-MM-DD` where known. Example:
`google-analytics-dpa-2026-08-06.pdf`.

## What counts as proof

Not the blank template — evidence that *this* business accepted it.

| Provider | Acceptable evidence |
|---|---|
| Self-serve, click-to-accept | Screenshot or print-to-PDF of the page showing acceptance **and the date** |
| Incorporated by reference | The terms document, plus a note of the plan and date it applied from |
| Request-based | The signed copy, or the provider's written confirmation email |

A blank PDF proves the provider has a DPA. It does not prove you are covered by
it. Where coverage is unclear — a free plan whose terms only mention paid
subscriptions, for instance — keep the written answer, not the assumption.

## Status

Tracked in [`../docs/gdpr-production-checklist.md`](../docs/gdpr-production-checklist.md).
Update it when a document lands here.

| Provider | Service | File | Status |
|---|---|---|---|
| Google (Analytics) | Consent-based statistics | `google-analytics-dpa-2026-08-06.pdf` | **Accepted 2026-08-06.** Legal entity and primary contact filed on the Manage DPA page |
| Klaviyo | Consent-based marketing | `klaviyo-dpa-2025-12-17.md` | **Covered.** The DPA is "incorporated into and forms part of the Agreement" and takes effect with the account — no signature exists to chase |
| Cloudflare | Turnstile form protection | `cloudflare-dpa-2026-04-03.md` | Terms archived (v6.4). Incorporated through the self-serve agreement; note the account email against it |
| Cloudinary | Product image hosting | `cloudinary-dpa-2026-06.pdf` | Terms archived. **Free-plan coverage unconfirmed** — their privacy policy ties the DPA to paid subscriptions with an executed order form |
| ACS Courier | Delivery | `acs-privacy-statement-2026-08-06.md` | **No public DPA exists.** The archived file is their privacy statement, kept for context only — it contains no Article 28 terms. Must be requested through the account contact |
| Pointer.gr | Business email | — | Pending — **highest exposure**: `SMTP_HOST=mail.nostalgiacandle.gr`, so every order confirmation, contact reply and newsletter passes through it |

The `.md` files are provenance-stamped archives of pages the provider publishes as
HTML only — each carries its source URL, retrieval date and a SHA-256 of the
served bytes, so a later copy can be proved identical.

## Assessed as not requiring an Article 28 contract

Recorded so the question does not get reopened every few months.

| Provider | Why not |
|---|---|
| Papaki | Domain registration and DNS only. The personal data involved is the registrant's own (name, address, contact) which Papaki processes for ICANN/registry purposes as a controller in its own right — not visitor or customer data processed on our instructions. Revisit if a mailbox or site is ever hosted there. |
| cPanel | Software licensed to the hosting provider, not a counterparty we contract with. Confirmed 2026-08-06: the panel is Pointer's (Pointer Professional Spam Filter, home `/home/no673614`, primary domain nostalgiacandle.gr), and cpanel.net publishes no DPA — its legal notices offer only an EULA, NOC and support agreements, all aimed at licensees rather than a host's customers. Its own telemetry ("User Analytics") is disabled on the account. If cPanel/WebPros touches any data on Pointer's behalf it belongs on **Pointer's** sub-processor list, which is why that list is item 2 of the request below. |

## Still outstanding

**Cloudinary** — the terms are archived here, but their privacy policy ties the
DPA to paid subscriptions with an executed order form. Ask privacy@cloudinary.com
to confirm in writing that it covers cloud `dqvefwxum` on its current plan, and
save the reply next to the PDF.

**Pointer and ACS** — neither publishes a DPA. Pointer's client area has no such
document either; the "Λήψη των δεδομένων μου" tab there is the account holder's
own access/portability export under Articles 15 and 20, which is a different
thing entirely. Both must be requested. Use the template below.

### Request template

Send as a support ticket. Swap "υπηρεσίες email" for the service in question —
for ACS, "υπηρεσίες διανομής δεμάτων".

> **Θέμα:** Σύμβαση εκτελούντος την επεξεργασία (άρθρο 28 ΓΚΠΔ)
>
> Λειτουργούμε το ηλεκτρονικό κατάστημα nostalgiacandle.gr ως υπεύθυνη
> επεξεργασίας. Οι υπηρεσίες email που μας παρέχετε επεξεργάζονται προσωπικά
> δεδομένα πελατών μας για λογαριασμό μας, οπότε απαιτείται σύμβαση κατά το
> άρθρο 28 ΓΚΠΔ.
>
> Παρακαλούμε να μας αποστείλετε:
>
> 1. Τη σύμβαση εκτελούντος την επεξεργασία
> 2. Τη λίστα των υπεργολάβων σας
> 3. Τη χώρα στην οποία βρίσκονται φυσικά οι servers
> 4. Τη διαδικασία ειδοποίησης σε περιστατικό παραβίασης δεδομένων
> 5. Τη διαδικασία διαγραφής/επιστροφής δεδομένων στη λήξη της σύμβασης
>
> Εφόσον δεν διαθέτετε δικό σας κείμενο, μπορούμε να σας αποστείλουμε προς
> υπογραφή τις πρότυπες συμβατικές ρήτρες της Ευρωπαϊκής Επιτροπής.

The closing sentence matters. Smaller providers often answer "we don't have such
a document" and the thread dies there; offering the Commission's standard clauses
(published by the Hellenic DPA) hands them the solution along with the problem.

## Done, for reference

**Google** — Admin → Account Settings → Account Details → Data Processing Terms →
"Έλεγχος τροποποίησης" opens the amendment text. Print to PDF from there; that is
a document rather than a screenshot. The acceptance date shows on the same page.
