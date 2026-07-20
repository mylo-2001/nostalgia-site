"use strict";

const { expireInventoryReservations } = require("../services/inventory-service");

async function runInventoryReservationExpiry(options) {
  const result = await expireInventoryReservations(options);
  const logger = options.logger || console;
  try {
    logger.info({
      event: "inventory_reservation_expiry_completed",
      processed: result.processed,
    });
  } catch (_) {
    // A logger failure must not alter committed inventory results.
  }
  return result;
}

module.exports = { runInventoryReservationExpiry };
