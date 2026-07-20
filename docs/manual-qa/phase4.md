# Phase 4 Manual QA

- [ ] Inventory bootstrap dry-run is reviewed before apply mode.
- [ ] Two buyers competing for one item produce one reservation and one rejection.
- [ ] Duplicate reservation keys do not increase reserved stock twice.
- [ ] Payment success consumes stock and reservation exactly once.
- [ ] Payment failure releases reserved stock exactly once.
- [ ] Expiry and payment success racing leave stock and reserved balances consistent.
- [ ] Expiry worker skips locked rows and processes only expired active groups.
- [ ] Every balance change has one movement and one audit event.
- [ ] Pricing uses `available_quantity` after an inventory row exists.
- [ ] Phase 4 down migrations remove only Phase 4 additions.
- [ ] Legacy checkout behavior remains unchanged.

