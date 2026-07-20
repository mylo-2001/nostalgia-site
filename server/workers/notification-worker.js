"use strict";

const { processNotificationBatch } = require("../services/notification-outbox-service");

async function runNotificationWorker(options) {
  return processNotificationBatch({ batchSize: 25, workerId: options.workerId,
    pool: options.pool, sender: options.sender, now: options.now });
}

module.exports = { runNotificationWorker };
