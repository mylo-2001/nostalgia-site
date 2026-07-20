# Phase 6 Manual QA

- [ ] Session line amounts sum exactly to the database grand total.
- [ ] Repeating a session idempotency key returns the same hosted checkout URL.
- [ ] Invalid webhook signatures create no payment event or state change.
- [ ] Duplicate simultaneous webhooks apply stock and status effects once.
- [ ] Paid events verify amount and currency before confirmation.
- [ ] Amount mismatch creates an alertable audit event and no paid state.
- [ ] Failed/expired events release reservation and cancel the order.
- [ ] Late success never deducts unavailable stock and enters review where possible.
- [ ] Guest status requires the valid non-expired capability token.
- [ ] Status query parameters cannot mutate payment state.
- [ ] Sanitized events contain no card or credential fields.
- [ ] Phase 6 rollback preserves orders, payments and earlier schema data.

