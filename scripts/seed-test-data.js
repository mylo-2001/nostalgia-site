"use strict";

/**
 * TEST seed for the V2 order system so you can click through real quotes and
 * orders. Inserts SAMPLE data only:
 *   - one pricing policy (EUR, half-up, catalog prices include tax)
 *   - two shipping methods (store pickup, home delivery)
 *   - sample VAT rates (GR 24%, CY 19%)  ← replace with accountant-approved values before production
 *   - sample prices + stock on a handful of catalog products
 *   - inventory rows (via the tested bootstrap service)
 *
 * These are SAMPLE values for testing. Prices set here also show on the legacy
 * storefront (the site currently has no prices). Use --clear to remove them.
 *
 * Usage:
 *   node scripts/seed-test-data.js            # dry run (prints plan)
 *   node scripts/seed-test-data.js --apply    # apply the sample data
 *   node scripts/seed-test-data.js --clear    # remove the sample data
 */

const fs = require("fs");
const path = require("path");

// Load .env so it works from the CLI.
try {
  const env = fs.readFileSync(path.join(__dirname, "..", ".env"), "utf8");
  env.split(/\r?\n/).forEach((line) => {
    const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^"|"$/g, "");
  });
} catch (_) {}

const db = require("../server/db");
const { bootstrapInventory } = require("../server/services/inventory-bootstrap-service");

const APPLY = process.argv.includes("--apply");
const CLEAR = process.argv.includes("--clear");

const SHIPPING = [
  { id: "pickup", name: "Παραλαβή από το κατάστημα", baseFee: 0, free: null, codFee: 0, position: 0 },
  { id: "home", name: "Παράδοση στο σπίτι", baseFee: 3.5, free: 80, codFee: 3.5, position: 1 },
];
const TAX = [
  { country: "GR", category: "standard", rate: 24 },
  { country: "CY", category: "standard", rate: 19 },
];
const PRODUCTS = [
  { id: "cat1-1", price: 26.0, stock: 12 },
  { id: "cat1-6", price: 30.0, stock: 8 },
  { id: "cat2-1", price: 24.0, stock: 10 },
  { id: "cat3-1", price: 22.0, stock: 15 },
  { id: "cat4-1", price: 48.0, stock: 5 },
  { id: "cat9-1", price: 35.0, stock: 9 },
  { id: "cat9-2", price: 35.0, stock: 3 }, // deliberately low stock for concurrency testing
];
const COUNTRIES = JSON.stringify(["GR", "CY"]);

async function clear(pool) {
  const ids = PRODUCTS.map((p) => p.id);
  await pool.query("DELETE FROM inventory WHERE product_id = ANY($1)", [ids]);
  await pool.query("DELETE FROM catalog_overrides WHERE id = ANY($1)", [ids]);
  await pool.query("DELETE FROM shipping_methods WHERE id = ANY($1)", [SHIPPING.map((s) => s.id)]);
  await pool.query("DELETE FROM tax_rates WHERE (country_code, tax_category) IN (('GR','standard'),('CY','standard'))");
  await pool.query("DELETE FROM pricing_policies WHERE id = 'default'");
  console.log("✓ sample test data removed");
}

async function apply(pool) {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    await client.query(
      `INSERT INTO pricing_policies (id, currency, catalog_prices_include_tax)
       VALUES ('default', 'EUR', TRUE) ON CONFLICT (id) DO NOTHING`
    );
    for (const s of SHIPPING) {
      await client.query(
        `INSERT INTO shipping_methods
           (id, name, active, currency, base_fee, free_shipping_threshold, cod_fee, cod_allowed,
            shipping_vat_rate, cod_vat_rate, supported_country_codes, position)
         VALUES ($1,$2,TRUE,'EUR',$3,$4,$5,TRUE,24,24,$6::jsonb,$7)
         ON CONFLICT (id) DO UPDATE SET
           name = EXCLUDED.name, active = TRUE, base_fee = EXCLUDED.base_fee,
           free_shipping_threshold = EXCLUDED.free_shipping_threshold, cod_fee = EXCLUDED.cod_fee,
           supported_country_codes = EXCLUDED.supported_country_codes, position = EXCLUDED.position,
           updated_at = now()`,
        [s.id, s.name, s.baseFee, s.free, s.codFee, COUNTRIES, s.position]
      );
    }
    for (const t of TAX) {
      await client.query(
        `INSERT INTO tax_rates (country_code, tax_category, rate, prices_include_tax, active, valid_from)
         VALUES ($1,$2,$3,TRUE,TRUE,'2000-01-01T00:00:00Z')
         ON CONFLICT (country_code, tax_category, valid_from)
         DO UPDATE SET rate = EXCLUDED.rate, active = TRUE, updated_at = now()`,
        [t.country, t.category, t.rate]
      );
    }
    for (const p of PRODUCTS) {
      const sku = "NC-" + p.id.toUpperCase();
      await client.query(
        `INSERT INTO catalog_overrides (id, stock, price, active, vat_rate, tax_category, sku)
         VALUES ($1,$2,$3,TRUE,24,'standard',$4)
         ON CONFLICT (id) DO UPDATE SET
           stock = EXCLUDED.stock, price = EXCLUDED.price, active = TRUE,
           vat_rate = 24, tax_category = 'standard', sku = EXCLUDED.sku`,
        [p.id, p.stock, p.price, sku]
      );
    }
    await client.query("COMMIT");
  } catch (e) {
    await client.query("ROLLBACK");
    throw e;
  } finally {
    client.release();
  }

  // inventory rows via the tested bootstrap service (own transaction)
  const c2 = await pool.connect();
  try {
    await c2.query("BEGIN");
    const res = await bootstrapInventory({
      client: c2,
      apply: true,
      confirm: "APPLY_INVENTORY_BOOTSTRAP",
      actorId: "seed-test",
      source: "seed.test",
    });
    await c2.query("COMMIT");
    console.log("✓ inventory bootstrap inserted rows:", res.inserted);
  } catch (e) {
    await c2.query("ROLLBACK");
    throw e;
  } finally {
    c2.release();
  }
  console.log("✓ sample test data applied (" + PRODUCTS.length + " products, " + SHIPPING.length + " shipping methods, " + TAX.length + " VAT rates)");
  console.log("  NOTE: VAT/shipping/prices are SAMPLE values for testing — replace before real production.");
}

async function main() {
  await db.init();
  const pool = db.getPool();
  if (CLEAR) return clear(pool);
  if (!APPLY) {
    console.log("DRY RUN — would seed:");
    console.log("  pricing_policies: default (EUR, half-up, prices incl. tax)");
    console.log("  shipping_methods: " + SHIPPING.map((s) => s.id).join(", "));
    console.log("  tax_rates: " + TAX.map((t) => t.country + "/" + t.category + " " + t.rate + "%").join(", "));
    console.log("  products: " + PRODUCTS.map((p) => p.id + " €" + p.price + " x" + p.stock).join(", "));
    console.log("\nRun with --apply to write, or --clear to remove.");
    return;
  }
  return apply(pool);
}

main().then(() => process.exit(0)).catch((e) => { console.error("seed failed:", e.message); process.exit(1); });
