# Commerce compliance matrix

Last technical review: 11 August 2026. This is an implementation register, not legal advice. Final wording and Greek-law retention/tax details require review by the business's legal adviser and accountant.

| Area | Application control | Status / evidence |
|---|---|---|
| Pre-contract information and payment obligation | Product/checkout totals, VAT and charges; explicit Terms acceptance; payment-order wording | Implemented; see `docs/checkout-compliance-phase13.md` |
| 14-day withdrawal | Dedicated policy, model notice, customer/admin return request and refund workflow | Implemented; Worldline provider refund remains a launch blocker |
| Goods conformity | Separate warranty page, two-year minimum statement, repair/replacement and secondary remedies | Implemented |
| Cookies and trackers | Default-denied analytics/marketing, equal accept/reject choices, granular settings and withdrawal | Implemented; production network verification remains open |
| Newsletter/direct marketing | Separate opt-in, double opt-in, consent evidence and unsubscribe | Implemented |
| Data-subject rights | Account export/deletion plus manual request procedure | Implemented; production end-to-end exercise remains open |
| Retention and breach response | Retention service, working ROPA, 72-hour risk-based breach procedure | Implemented; production cron and incident exercise remain open |
| Reviews | Verified-purchase badge, neutral moderation reasons, public calculation/moderation policy | Implemented |
| Price reductions | Lowest price applied during the preceding 30 days is retained and displayed as the reference price | Implemented by migration `043`, catalog/checkout reconciliation and admin price-history inspection; production migration and smoke test remain open |
| Processors/transfers | Processor register and transfer mechanism review | Open items listed in `docs/gdpr-production-checklist.md` |
| Card payment/refunds | Worldline-only fail-closed design; paid cancellation requires provider-confirmed refund | Adapter, signed callbacks, refunds and reconciliation remain launch blockers |

## Official source families

- GDPR: Regulation (EU) 2016/679; Greek implementation framework: Law 4624/2019.
- Cookies and direct marketing: Directive 2002/58/EC, Greek Law 3471/2006 and Hellenic DPA guidance.
- Consumer contracts: Directive 2011/83/EU and Directive 93/13/EEC.
- Goods conformity: Directive (EU) 2019/771.
- Commercial practices, reviews and price reductions: Directives 2005/29/EC and (EU) 2019/2161, including the amendments to Directive 98/6/EC.

The public legal pages link directly to the corresponding official EUR-Lex, European Commission, EDPB and Hellenic DPA pages.
