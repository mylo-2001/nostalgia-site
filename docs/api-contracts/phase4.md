# Phase 4 Inventory Contract

Internal services accept either a pool, which creates their transaction, or a client
already inside the caller's transaction.

- `reserveInventory({ orderId, reservationKey, lines, ttlSeconds })`
- `consumeInventoryReservation({ reservationKey, operationKey })`
- `releaseInventoryReservation({ reservationKey, operationKey, reason })`
- `expireInventoryReservations({ pool, now, batchSize })`
- `restockInventory({ inventoryId, quantity, operationKey })`

Reservation lines contain only `productId`, optional `variantId`, optional
`orderItemId`, and `quantity`. Browser stock values are never accepted.

