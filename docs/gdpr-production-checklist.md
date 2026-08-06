# GDPR production checklist — Nostalgia Collection

Last technical review: 6 August 2026. This is an operational checklist, not legal advice. The controller should validate tax-retention fields and legal bases with its accountant/legal adviser before launch.

## Launch blockers

- [ ] Run every database migration, including `038_newsletter_double_opt_in.up.sql`, on the production PostgreSQL database.
- [ ] Set unique production secrets (`SESSION_SECRET`, `CONSENT_HASH_SECRET`, admin credentials and database credentials) in the VPS secret store; never copy preview values.
- [ ] Keep card checkout disabled until the Worldline hosted-payment adapter, signed callback verification, refunds and reconciliation have been implemented and tested. Stripe is still legacy code and must not be presented as Worldline.
- [ ] Sign/record the Worldline data-processing and international-transfer terms, then replace the conditional wording “when enabled” in the privacy/payment pages.
- [ ] Enable HTTPS/HSTS on the final domain and verify that HTTP redirects to HTTPS.
- [ ] Set `RETENTION_ENABLED=true`, install `deploy/nostalgia.crontab`, run retention first in dry-run mode, review the counts, then run it with apply enabled.
- [ ] Perform a test export and account deletion against a dedicated test account containing an order, newsletter history, review and contact message.
- [ ] Verify that analytics, Meta and Klaviyo make no network requests before consent and stop after withdrawal/reload.

## Record of processing activities (working register)

| Activity | Data / subjects | Purpose and legal basis | Recipients | Retention |
|---|---|---|---|---|
| Account | Email, name, password hash, address | Account service / contract; security / legitimate interest | VPS/PostgreSQL, transactional email | Until deletion; security events per policy |
| Orders and invoicing | Contact, shipping, order and invoice fields | Contract; tax/accounting legal obligation | ACS, Worldline when enabled, accountant/fiscal provider | Up to 6 years, then anonymisation; confirm exact fiscal rule |
| Contact form | Email, message, optional name/phone/country/attachment | Reply to request / pre-contract steps or legitimate interest | VPS/PostgreSQL, Pointer/SMTP, Turnstile | Up to 24 months |
| Newsletter | Email, optional name, consent notice/version and confirmation timestamps | Consent | Pointer/SMTP; Klaviyo only if enabled and consented | Active until withdrawal; pending expiry + 7 days; withdrawn up to 24 months |
| Analytics | Pseudonymous browsing identifiers | Consent | Google Analytics | Provider cookies as listed in privacy policy |
| Marketing tracking | Advertising/email identifiers | Consent | Meta and Klaviyo | Provider cookies as listed in privacy policy |
| Security and consent evidence | Audit events; random consent ID and choices | Legitimate interest/legal accountability | VPS/PostgreSQL, Cloudflare | 6–60 months according to record type |
| COD risk review | Order value/frequency, failed-delivery history, hashed phone/address indicators | Fraud prevention / legitimate interest | Authorised staff only | With the linked order/security record; review necessity regularly |

For every processor retain: legal entity and contact, service, data categories, processing locations, DPA date, subprocessor list, transfer mechanism (adequacy/SCC where applicable), deletion/export procedure and review date.

### Article 28 contract register

Status only — the signed copies and screenshots are deliberately **not** kept in
this repository, which is public. Store them with the business's own records and
note the location here in a way that does not itself disclose anything.

| Processor | Service | How the DPA is put in place | Status |
|---|---|---|---|
| Google (Analytics) | Consent-based statistics | Admin → Account Settings → Account Details → Data Processing Terms | **Accepted 2026-08-06.** Legal entity and primary contact filed on the Manage DPA page |
| ACS Courier | Delivery | Request through the account contact | Pending |
| Cloudflare | Turnstile form protection | Incorporated by reference in the self-serve terms — archive a copy | Pending |
| Cloudinary | Product image hosting | `cloudinary.com/gdpr/dpa`. Their privacy policy ties the DPA to paid subscriptions with an executed order form, so free-plan coverage must be confirmed in writing via privacy@cloudinary.com | Pending — coverage unconfirmed. Currently processes nothing: no product images have been uploaded |
| Klaviyo | Consent-based marketing | Request/accept through the account | Pending |
| Pointer.gr | Business email | Request from the provider | Pending |

Review the register whenever a processor is added, removed or changes plan. A
processor that is configured but idle still needs a contract before the first
real processing, not after.

## Data-subject request procedure

1. Record the request date, identity-verification method, scope and one-month deadline. Collect only what is needed to verify identity.
2. Search the account export plus orders, messages, reviews, newsletter/marketing delivery history, audit history, risk assessments and notification history.
3. For rectification/restriction/objection requests, record which systems and processors were updated. Notify recipients where GDPR requires it.
4. For erasure, preserve invoice identity only where the accountant confirms a legal retention obligation; remove shipping/contact identity and pseudonymise linked operational records.
5. Respond free of charge unless a documented GDPR exception applies. If delayed or refused, explain the reason, complaint right and any lawful deadline extension.

## Personal-data breach procedure

1. Contain the incident, preserve evidence and open a breach record immediately.
2. Record discovery time, systems/data/people affected, likely consequences, containment and decision maker.
3. Assess risk to people. Notify the Hellenic DPA without undue delay and, where required, within 72 hours of awareness; document reasons for any delay.
4. If high risk remains, notify affected people in clear language unless a GDPR exception applies.
5. Complete root-cause remediation, processor follow-up and a post-incident review. Keep the breach record even when notification is not required.

## Recurring checks

- Monthly: retention job result, failed notification queue, admin access and security alerts.
- Quarterly: processor/subprocessor and international-transfer review; test consent withdrawal and data export/deletion.
- Annually or after a material change: refresh privacy/cookie text and consent version; review the processing register, retention periods, legitimate-interest assessment and whether a DPIA is required.
- Before enabling a new tracker/provider: document it first, update CSP/privacy/cookie controls, and test the default-denied state.

