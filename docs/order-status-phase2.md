# Order Status Phase 2

## Scope

Phase 2 implements the V2 order, payment, and shipping state machines. It adds a
pure transition planner, a transactional PostgreSQL service, and a database trigger
as defense in depth. It does not switch legacy checkout, Stripe, cancellation, or
admin routes to V2.

## Application contract

`planStateTransition(current, changes, context)` validates every requested axis
against the allowed transition graph, then validates the final combined state.
Multiple axes can change atomically when each individual transition is legal.

Cross-axis invariants include:

- Fulfilment requires authorized, paid, partially refunded, or COD-ready payment.
- Shipping cannot progress while the order is draft, pending, or under review.
- Completion requires delivered/return shipping and a settled payment state.
- COD cannot be collected before delivery.
- Card payments cannot use COD statuses and COD cannot use card-only statuses.

Same-state requests are idempotent no-ops. Terminal states cannot be reopened.

## Transactional service

`transitionOrderState()`:

1. Opens a transaction and locks the order with `SELECT ... FOR UPDATE`.
2. Rejects missing or uninitialized V2 orders.
3. Optionally checks `expectedVersion` for optimistic concurrency.
4. Plans and validates all requested axis changes.
5. Updates statuses, version, request ID, and lifecycle timestamps once.
6. Inserts one `order_status_history` row per changed axis.
7. Inserts one append-only `audit_logs` record for the atomic operation.
8. Commits everything together or rolls everything back.

Structured logs contain order ID, version, changed axes, and request ID only. A
logger failure after commit cannot make a successful transition appear failed.

## Database guard

Migration 003 adds insert/update triggers to `orders`. Direct SQL cannot perform an
illegal V2 transition or violate the cross-axis invariants. The trigger function is
`SECURITY INVOKER`, uses a fixed `search_path`, and is not public RPC surface.

## Backward compatibility

- Legacy status columns and routes are unchanged.
- Existing orders with null V2 statuses are unaffected.
- Backfill may initialize null V2 statuses, but later changes must follow the graph.
- The current admin still uses the legacy flow until the admin management phase.

## Known limitations

- No HTTP route uses the V2 transition service yet.
- Payment, inventory, shipment, return, and refund side effects are not implemented.
- Cross-axis policy may need business approval before production activation.
- Admin version conflicts are supported by the service but not yet shown in the UI.
