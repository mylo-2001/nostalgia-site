# Phase 10: Notification outbox

Order, payment, shipment, tracking, cancellation, return and refund events enqueue a
transactional outbox row. Email is never sent inside the order transaction.

Workers claim rows with `FOR UPDATE SKIP LOCKED`, use leases, bounded exponential retry
and a dead-letter state. `event_key` is unique, so a duplicate webhook cannot produce a
second email. Payload validation rejects fields containing secrets, tokens, CVV or card
numbers.

The maintenance endpoint processes a bounded batch when email is configured:

`GET /api/cron/maintenance` with `Authorization: Bearer $CRON_SECRET`.

Migrations `018` and `019` add retry/dead-letter fields and indexes. Before rollback,
drain or export pending notifications. Tests:

- `test/notification-outbox.unit.test.js`
- `test/notification-outbox.integration.test.js`

Provider delivery still depends on valid Resend or SMTP configuration.
