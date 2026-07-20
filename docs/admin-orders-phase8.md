# Phase 8: Admin order management

## Delivered

- Roles: `administrator`, `order_manager`, `warehouse`, `customer_support`,
  `accounting`, and `read_only`.
- Permission checks happen in services/routes, not by hiding UI controls.
- Sensitive order reads and all critical mutations append audit records.
- Order and shipment updates use version numbers. Stale writes return
  `ORDER_VERSION_CONFLICT` instead of silently overwriting another administrator.
- Address changes stop after courier handoff.

## V2 endpoints

- `GET /api/v2/admin/orders/:id`
- `PATCH /api/v2/admin/orders/:id/state`
- `PATCH /api/v2/admin/orders/:id/address`
- `PATCH /api/v2/admin/orders/:id/shipments/:shipmentId`

Every write requires the CSRF token issued at admin login. COD review, returns and refunds
also have explicit `risk.review`, `return.manage` and `refund.manage` checks.

## Migration, rollback and tests

Migrations `014` and `015` create RBAC data and indexes. Existing legacy admin remains the
single `administrator` during the transition. Tests are
`test/admin-rbac.unit.test.js` and `test/admin-order-service.integration.test.js`, including
two concurrent admins updating the same order.
