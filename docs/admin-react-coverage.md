# React admin coverage audit

## Exposed in the React UI

The legacy admin capabilities are covered: overview, order list/detail, customers,
newsletter, messages, product creation/editing, product variants, coupons, reviews,
analytics, Stripe configuration, password change and MFA management.

Backend capabilities added after the React migration are also exposed where the
API contract is complete:

- Operational metrics at `/api/admin/operations/metrics`.
- Legacy security/action audit at `/api/admin/audit`.
- MFA status and guarded MFA disable.
- Revocation of every admin session through `/api/v2/admin/logout-all`.
- CSRF token persistence and `X-CSRF-Token` on admin mutations.

## Known contract gaps

The V2 commerce backend contains order transitions, address correction, shipment
updates, COD review, return inspection and refunds. These are not yet wired into
the React Orders page because the V2 API currently has no paginated order-list
endpoint and its detail endpoint does not return the related payment, shipment,
risk and return identifiers needed by those actions. Guessing identifiers or
mixing the legacy list with V2 writes would be unsafe.

Before that UI is added, expose permission-filtered V2 read contracts for:

- Paginated order summaries with independent order/payment/shipping statuses.
- Order payments and provider transaction state.
- Shipments with IDs and optimistic-lock versions.
- Risk assessment and COD review state.
- Returns, return items and refunds with IDs and versions.
- The current admin's roles and permission codes.

The database RBAC model is ready for multiple administrators, but the current
legacy admin routes still use one global admin identity and the React navigation
cannot be permission-filtered until the identity endpoint returns roles and
permissions. Server authorization must remain authoritative; hiding a menu item
is only a usability aid.
