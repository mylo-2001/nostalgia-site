"use strict";

const assert = require("node:assert/strict");
const crypto = require("node:crypto");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const { Pool } = require("pg");

const { splitSqlStatements } = require("../server/migrate");

const TEST_DATABASE_URL = process.env.TEST_DATABASE_URL || "";
const MIGRATIONS_DIR = path.join(__dirname, "..", "server", "migrations");

function safeTestDatabaseUrl(value) {
  if (!value) return false;
  return new URL(value).pathname.toLowerCase().includes("test");
}

function quoteIdentifier(value) {
  return `"${value.replace(/"/g, '""')}"`;
}

async function executeFile(client, file) {
  const sql = fs.readFileSync(path.join(MIGRATIONS_DIR, file), "utf8");
  for (const statement of splitSqlStatements(sql)) await client.query(statement);
}

const integrationOptions = {
  skip: !safeTestDatabaseUrl(TEST_DATABASE_URL)
    ? "Set TEST_DATABASE_URL to a dedicated database whose name contains 'test'"
    : false,
};

test("variant integrity migrations prevent duplicate colours and SKUs", integrationOptions, async () => {
  const pool = new Pool({ connectionString: TEST_DATABASE_URL });
  const schema = `variant_integrity_${process.pid}_${crypto.randomBytes(4).toString("hex")}`;
  const client = await pool.connect();
  try {
    await client.query(`CREATE SCHEMA ${quoteIdentifier(schema)}`);
    await client.query(`SET search_path TO ${quoteIdentifier(schema)}, public`);
    await client.query(`
      CREATE TABLE product_variants (
        id TEXT PRIMARY KEY,
        product_id TEXT NOT NULL,
        color TEXT NOT NULL DEFAULT '',
        color_en TEXT NOT NULL DEFAULT '',
        color_hex TEXT NOT NULL DEFAULT '',
        sku TEXT NOT NULL DEFAULT '',
        price NUMERIC(10,2),
        sale_price NUMERIC(10,2),
        stock INTEGER,
        available BOOLEAN NOT NULL DEFAULT TRUE
      )
    `);

    await executeFile(client, "026_product_variant_integrity.up.sql");
    await executeFile(client, "027_product_variant_unique_indexes.up.sql");

    await client.query(`
      INSERT INTO product_variants (id, product_id, color, color_hex, sku, price, stock)
      VALUES ('pv-1', 'product-1', 'Κόκκινο', '#b0342c', 'CANDLE-RED', 42.50, 4)
    `);
    await assert.rejects(
      client.query(`
        INSERT INTO product_variants (id, product_id, color, color_hex, sku, price, stock)
        VALUES ('pv-2', 'product-1', ' κόκκινο ', '#b0342c', 'OTHER-SKU', 40, 2)
      `),
      /product_variants_product_color_unique_idx/
    );
    await assert.rejects(
      client.query(`
        INSERT INTO product_variants (id, product_id, color, color_hex, sku, price, stock)
        VALUES ('pv-3', 'product-2', 'Πράσινο', '#4a7a4e', 'candle-red', 45, 2)
      `),
      /product_variants_sku_unique_idx/
    );
    await assert.rejects(
      client.query(`
        INSERT INTO product_variants (id, product_id, color, color_hex, sku, price, stock)
        VALUES ('pv-4', 'product-1', 'Μπλε', '#3a5a8c', '', NULL, NULL)
      `),
      /product_variants_sku_required_check|product_variants_price_required_check|product_variants_stock_required_check/
    );

    await executeFile(client, "027_product_variant_unique_indexes.down.sql");
    await executeFile(client, "026_product_variant_integrity.down.sql");
  } finally {
    await client.query(`DROP SCHEMA IF EXISTS ${quoteIdentifier(schema)} CASCADE`);
    client.release();
    await pool.end();
  }
});

