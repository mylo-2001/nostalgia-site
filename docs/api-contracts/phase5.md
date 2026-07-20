# Phase 5 Order Creation Contract

`createCheckoutOrder()` requires a PostgreSQL pool, canonical checkout request,
trusted identity context, guest token secret, and idempotency key. It returns order
ID/number, independent statuses, exact decimal-string total, reservation expiry, and
a guest token only for guest orders.

The idempotency key must be sent separately from request JSON. It is not a price,
authentication credential, or sequential order identifier.

