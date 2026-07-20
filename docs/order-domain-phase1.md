# Order Domain Phase 1

## Scope

Phase 1 adds the database and domain foundation for production order processing.
It does not change checkout, payment, stock, email, admin, or storefront runtime
behaviour. Existing order columns and JSON data remain available.

## Current compatibility boundary

- `orders.status`, `orders.payment_status`, `orders.shipping_status`, `items`,
  `customer`, `gift`, `access_token`, and `total` remain unchanged.
- New V2 status and monetary columns are nullable until an approved backfill.
- The existing single administrator remains active. The new RBAC tables are not
  wired into login or the admin UI in this phase.
- Product and variant IDs remain text snapshots without catalog foreign keys.
  The current catalog is split between code and PostgreSQL.
- No production data is changed by adding these files. A migration changes a
  database only when the migration CLI is explicitly run against that database.

## Domain tables

| Area | Tables |
| --- | --- |
| Orders | `orders` V2 columns, `order_items`, `order_status_history` |
| Payments | `payments`, `payment_events`, `refunds` |
| Fulfilment | `shipments`, `returns`, `return_items` |
| Stock | `inventory`, `inventory_reservations`, `inventory_movements` |
| Reliability | `idempotency_keys`, `notification_outbox` |
| Operations | `risk_assessments`, `audit_logs`, `fiscal_documents` |
| Administration | `admin_users`, `admin_roles`, `admin_user_roles`, `admin_sessions` |

`order_items` stores immutable purchase snapshots. A complete snapshot requires
product name, SKU, quantity, prices, discount, VAT, line totals, and currency.
Historical rows that cannot provide all fields must use `legacy_partial`; missing
historical VAT or SKU values must not be invented.

`inventory_movements`, `order_status_history`, `audit_logs`, and `order_items`
are append-only at the database level. Controlled maintenance can set the local
session setting `app.allow_append_only_mutation=on`, and must itself be audited.

## Status state machines

Order lifecycle:

```text
draft -> pending -> confirmed -> processing -> ready_to_ship -> completed
             |          |             |
             +----------+-------------+-> requires_review
draft/pending/confirmed/processing/ready_to_ship/requires_review -> cancelled
```

Payment lifecycle:

```text
pending -> authorized -> paid -> partially_refunded -> refunded
pending -> failed | cancelled
pending -> cod_pending -> cod_collected -> partially_refunded | refunded
```

Shipping lifecycle:

```text
not_ready -> ready -> label_created -> handed_to_courier -> in_transit -> delivered
in_transit -> delivery_failed -> in_transit | returning | returned
handed_to_courier/in_transit/delivered -> returning -> returned
```

The JavaScript transition definitions are the canonical application contract.
Database checks restrict valid values. Transactional service methods will enforce
cross-axis rules in later phases.

## Security model

- New domain tables have RLS enabled and no public policies.
- `anon` and `authenticated` privileges are revoked when those Supabase roles exist.
- The append-only trigger is `SECURITY INVOKER`, has a fixed `search_path`, and is
  not executable by `PUBLIC`.
- Guest access stores a SHA-256 token hash. Legacy plaintext tokens remain only
  for compatibility until the approved token migration.
- Raw payment payloads must be sanitized before insert. Card numbers, CVV, PIN,
  credentials, and secrets are forbidden in payload, metadata, audit, and logs.

## Known limitations

- The current application does not write to the new schema yet.
- Legacy order snapshots do not contain reliable VAT and SKU data.
- The old stock decrement flow remains until the inventory phase.
- Authentication remains stateless and single-admin until security hardening.
- RLS behaviour for the future application role needs a production role preflight.
- VAT, retention, fiscal document, and myDATA rules need accountant/legal approval.
