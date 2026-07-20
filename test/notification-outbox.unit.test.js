"use strict";

const assert = require("node:assert/strict");
const test = require("node:test");

const { assertSafePayload, NotificationOutboxError, retryDelayMs } =
  require("../server/services/notification-outbox-service");

test("notification payload rejects secrets and retry delay is bounded", () => {
  assert.doesNotThrow(() => assertSafePayload({ orderId: "1", customerEmail: "a@b.test" }));
  assert.throws(() => assertSafePayload({ nested: { guestAccessToken: "secret" } }),
    (error) => error instanceof NotificationOutboxError &&
      error.code === "UNSAFE_NOTIFICATION_PAYLOAD");
  assert.equal(retryDelayMs(1), 5000);
  assert.equal(retryDelayMs(99), 3600000);
});
