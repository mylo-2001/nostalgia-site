"use strict";

const { InventoryServiceError } = require("./inventory-service");

async function loadCandidates(client) {
  const result = await client.query(`
    SELECT product_id, variant_id, sku, stock_on_hand
      FROM (
        SELECT product_id, id AS variant_id, NULLIF(btrim(sku), '') AS sku,
               stock AS stock_on_hand
          FROM product_variants
         WHERE stock IS NOT NULL
        UNION ALL
        SELECT id AS product_id, NULL::text AS variant_id, NULLIF(btrim(sku), '') AS sku,
               stock AS stock_on_hand
          FROM catalog_overrides
         WHERE stock IS NOT NULL
      ) candidates
     WHERE stock_on_hand >= 0
     ORDER BY product_id, COALESCE(variant_id, '')
  `);
  return result.rows;
}

async function bootstrapInventory(options) {
  if (!options.client || typeof options.client.query !== "function") {
    throw new TypeError("bootstrapInventory requires a PostgreSQL transaction client");
  }
  const candidates = await loadCandidates(options.client);
  if (!options.apply) {
    return { dryRun: true, candidates, inserted: 0 };
  }
  if (options.confirm !== "APPLY_INVENTORY_BOOTSTRAP") {
    throw new InventoryServiceError(
      "BOOTSTRAP_CONFIRMATION_REQUIRED",
      "Inventory bootstrap requires explicit confirmation"
    );
  }

  let inserted = 0;
  for (const candidate of candidates) {
    const result = await options.client.query(`
      INSERT INTO inventory (
        product_id, variant_id, sku, tracks_stock, stock_on_hand, reserved_quantity
      ) VALUES ($1, $2, $3, TRUE, $4, 0)
      ON CONFLICT DO NOTHING
      RETURNING id
    `, [candidate.product_id, candidate.variant_id, candidate.sku, candidate.stock_on_hand]);
    inserted += result.rowCount;
  }
  await options.client.query(`
    INSERT INTO audit_logs (
      actor_type, actor_id, action, entity_type, entity_id,
      new_values, source, request_id
    ) VALUES ('system', $1, 'inventory.bootstrap', 'inventory', 'bulk', $2, $3, $4)
  `, [
    options.actorId || "inventory-bootstrap",
    { candidates: candidates.length, inserted },
    options.source || "inventory.bootstrap",
    options.requestId || null,
  ]);
  return { dryRun: false, candidates: candidates.length, inserted };
}

module.exports = { bootstrapInventory, loadCandidates };

