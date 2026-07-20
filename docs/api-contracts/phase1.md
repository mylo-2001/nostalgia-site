# Phase 1 API Contract

Phase 1 introduces no HTTP API request or response changes.

The existing checkout, order confirmation, tracking, account, Stripe webhook, and
admin routes continue using the legacy data path. No client is allowed to depend
on the new V2 columns until a later phase explicitly versions or updates that API.

Future checkout contracts will accept identifiers and choices only. Prices,
discounts, VAT, shipping, COD fees, stock, totals, and lifecycle statuses will be
authoritative server outputs.
