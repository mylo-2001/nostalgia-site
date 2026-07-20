"use strict";

const assert = require("node:assert/strict");
const crypto = require("node:crypto");
const path = require("node:path");
const test = require("node:test");
const { Pool } = require("pg");

const { runMigrations } = require("../server/migrate");
const {
  PricingServiceError,
  priceOrder,
} = require("../server/services/pricing-service");

const TEST_DATABASE_URL = process.env.TEST_DATABASE_URL || "";
const MIGRATIONS_DIR = path.join(__dirname, "..", "server", "migrations");

function safeTestDatabaseUrl(value) {
  if (!value) return false;
  return new URL(value).pathname.toLowerCase().includes("test");
}

function quoteIdentifier(value) {
  return `"${value.replace(/"/g, '""')}"`;
}

async function createLegacySchema(pool, schema) {
  await pool.query(`CREATE SCHEMA ${quoteIdentifier(schema)}`);
  const client = await pool.connect();
  try {
    await client.query(`SET search_path TO ${quoteIdentifier(schema)}, public`);
    await client.query(`
      CREATE TABLE orders (
        id TEXT PRIMARY KEY,
        number TEXT UNIQUE NOT NULL,
        status TEXT NOT NULL DEFAULT 'new',
        payment_status TEXT NOT NULL DEFAULT 'pending',
        shipping_status TEXT NOT NULL DEFAULT 'not_ready',
        user_email TEXT,
        created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
        updated_at TIMESTAMPTZ
      );

      CREATE TABLE products (
        id TEXT PRIMARY KEY,
        cat_id TEXT NOT NULL,
        title TEXT NOT NULL,
        price NUMERIC(10,2),
        sale_price NUMERIC(10,2),
        sale_until TIMESTAMPTZ,
        active BOOLEAN NOT NULL DEFAULT TRUE,
        created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
        updated_at TIMESTAMPTZ
      );

      CREATE TABLE catalog_overrides (
        id TEXT PRIMARY KEY,
        stock INTEGER,
        price NUMERIC(10,2),
        sale_price NUMERIC(10,2),
        sale_until TIMESTAMPTZ
      );

      CREATE TABLE coupons (
        code TEXT PRIMARY KEY,
        type TEXT NOT NULL CHECK (type IN ('percent', 'fixed')),
        value NUMERIC(10,2) NOT NULL,
        active BOOLEAN NOT NULL DEFAULT TRUE,
        expires_at DATE,
        uses INTEGER NOT NULL DEFAULT 0,
        name TEXT NOT NULL DEFAULT '',
        max_uses INTEGER,
        free_shipping BOOLEAN NOT NULL DEFAULT FALSE,
        created_at TIMESTAMPTZ NOT NULL DEFAULT now()
      );

      CREATE TABLE product_variants (
        id TEXT PRIMARY KEY,
        product_id TEXT NOT NULL,
        color TEXT NOT NULL DEFAULT '',
        color_en TEXT NOT NULL DEFAULT '',
        sku TEXT NOT NULL DEFAULT '',
        price NUMERIC(10,2),
        sale_price NUMERIC(10,2),
        sale_until TIMESTAMPTZ,
        stock INTEGER,
        available BOOLEAN NOT NULL DEFAULT TRUE,
        position INTEGER NOT NULL DEFAULT 0,
        created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
        updated_at TIMESTAMPTZ
      );
    `);
  } finally {
    client.release();
  }
}

const integrationOptions = {
  skip: !safeTestDatabaseUrl(TEST_DATABASE_URL)
    ? "Set TEST_DATABASE_URL to a dedicated database whose name contains 'test'"
    : false,
};

test("Phase 3 prices from PostgreSQL, enforces rules and rolls back cleanly", integrationOptions, async () => {
  const pool = new Pool({ connectionString: TEST_DATABASE_URL, max: 4 });
  const schema = `phase3_pricing_${process.pid}_${crypto.randomBytes(4).toString("hex")}`;
  try {
    await createLegacySchema(pool, schema);
    await runMigrations({
      pool,
      schema,
      directory: MIGRATIONS_DIR,
      direction: "up",
      targetVersion: 5,
    });
    const client = await pool.connect();
    try {
      await client.query(`SET search_path TO ${quoteIdentifier(schema)}, public`);
      await client.query(`
        INSERT INTO shipping_methods (
          id, name, base_fee, free_shipping_threshold, cod_fee,
          shipping_vat_rate, cod_vat_rate, supported_country_codes
        ) VALUES ('home', 'Home delivery', 3.50, 80.00, 3.50, 24.0000, 24.0000, '["GR"]');

        INSERT INTO tax_rates (
          country_code, tax_category, rate, prices_include_tax, valid_from
        ) VALUES
          ('GR', 'standard', 24.0000, TRUE, '2020-01-01T00:00:00Z'),
          ('CY', 'standard', 19.0000, TRUE, '2020-01-01T00:00:00Z');

        INSERT INTO catalog_overrides (
          id, stock, price, sale_price, sale_until, sku
        ) VALUES ('cat1-1', 5, 10.00, 8.00, '2030-01-01T00:00:00Z', 'STATIC-1');

        INSERT INTO products (id, cat_id, title, price, active, sku)
        VALUES ('cu-1', 'cat1', 'Custom candle', 20.00, TRUE, 'CUSTOM-1');
        INSERT INTO catalog_overrides (id, stock) VALUES ('cu-1', 10);
        INSERT INTO product_variants (
          id, product_id, color, sku, price, stock, available
        ) VALUES ('pv-1', 'cu-1', 'Gold', 'CUSTOM-GOLD', 15.00, 2, TRUE);

        INSERT INTO coupons (
          code, type, value, max_uses, min_subtotal, currency
        ) VALUES ('SAVE10', 'percent', 10.00, 5, 20.00, 'EUR');
      `);

      await client.query("BEGIN");
      const logs = [];
      const quote = await priceOrder({
        client,
        request: {
          items: [
            { productId: "cat1-1", quantity: 2 },
            { productId: "cu-1", variantId: "pv-1", quantity: 1 },
          ],
          couponCode: "save10",
          shippingMethodId: "home",
          paymentMethod: "card",
          destinationCountry: "GR",
        },
        now: new Date("2026-01-15T12:00:00Z"),
        lockRows: true,
        requestId: "pricing-test-1",
        logger: { info(event) { logs.push(event); } },
      });
      await client.query("COMMIT");

      assert.equal(quote.breakdown.subtotal, "35.00");
      assert.equal(quote.breakdown.saleDiscountTotal, "4.00");
      assert.equal(quote.breakdown.couponDiscountTotal, "3.10");
      assert.equal(quote.breakdown.shippingTotal, "3.50");
      assert.equal(quote.breakdown.grandTotal, "31.40");
      assert.equal(quote.items[0].sku, "STATIC-1");
      assert.equal(quote.items[1].sku, "CUSTOM-GOLD");
      assert.equal(quote.items[1].variantName, "Gold");
      assert.deepEqual(logs[0], {
        event: "server_price_calculated",
        requestId: "pricing-test-1",
        currency: "EUR",
        lineCount: 2,
        shippingMethodId: "home",
        paymentMethod: "card",
        grandTotal: "31.40",
      });

      await assert.rejects(
        priceOrder({
          client,
          request: {
            items: [{ productId: "cu-1", variantId: "pv-1", quantity: 3 }],
            shippingMethodId: "home",
            paymentMethod: "card",
            destinationCountry: "GR",
          },
          logger: null,
        }),
        (error) => error instanceof PricingServiceError && error.code === "INSUFFICIENT_STOCK"
      );

      await assert.rejects(
        priceOrder({
          client,
          request: {
            items: [{ productId: "cat1-1", quantity: 1 }],
            shippingMethodId: "home",
            paymentMethod: "card",
            destinationCountry: "CY",
          },
          logger: null,
        }),
        (error) => error.code === "SHIPPING_COUNTRY_UNSUPPORTED"
      );

      await client.query("UPDATE coupons SET max_uses = 1, uses = 1 WHERE code = 'SAVE10'");
      await assert.rejects(
        priceOrder({
          client,
          request: {
            items: [{ productId: "cat1-1", quantity: 2 }],
            couponCode: "SAVE10",
            shippingMethodId: "home",
            paymentMethod: "card",
            destinationCountry: "GR",
          },
          logger: null,
        }),
        (error) => error.code === "COUPON_USAGE_LIMIT_REACHED"
      );
    } finally {
      if (!client.released) {
        try { await client.query("ROLLBACK"); } catch (_) { /* transaction may already be closed */ }
        client.release();
      }
    }

    await runMigrations({
      pool,
      schema,
      directory: MIGRATIONS_DIR,
      direction: "down",
      count: 2,
      targetVersion: 5,
    });
    const rollback = await pool.connect();
    try {
      await rollback.query(`SET search_path TO ${quoteIdentifier(schema)}, public`);
      const result = await rollback.query(`
        SELECT
          to_regclass('shipping_methods') IS NULL AS shipping_removed,
          NOT EXISTS (
            SELECT 1 FROM information_schema.columns
             WHERE table_schema = $1 AND table_name = 'coupons' AND column_name = 'min_subtotal'
          ) AS coupon_columns_removed
      `, [schema]);
      assert.deepEqual(result.rows[0], {
        shipping_removed: true,
        coupon_columns_removed: true,
      });
    } finally {
      rollback.release();
    }
  } finally {
    await pool.query(`DROP SCHEMA IF EXISTS ${quoteIdentifier(schema)} CASCADE`);
    await pool.end();
  }
});
