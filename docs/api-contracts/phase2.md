# Phase 2 API Contract

Phase 2 introduces no public HTTP API changes.

The internal transition service accepts an order ID, one or more V2 status changes,
actor context, source, request ID, optional metadata, and optional expected version.
It returns the final state, new version, and changed axes. It never accepts totals,
payment confirmation, stock values, or shipping proof from a browser.

Legacy routes must not call this service until their dedicated migration phase has
initialized V2 state and defined the matching side effects.
