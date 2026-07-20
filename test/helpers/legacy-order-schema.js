"use strict";

function quoteIdentifier(value) {
  return `"${value.replace(/"/g, '""')}"`;
}

async function createLegacyOrderSchema(pool, schema) {
  await pool.query(`CREATE SCHEMA ${quoteIdentifier(schema)}`);
  const client = await pool.connect();
  try {
    await client.query(`SET search_path TO ${quoteIdentifier(schema)}, public`);
    await client.query(`
      CREATE TABLE orders (
        id TEXT PRIMARY KEY,
        number TEXT UNIQUE NOT NULL,
        status TEXT NOT NULL DEFAULT 'new',
        payment TEXT NOT NULL DEFAULT 'stripe',
        payment_status TEXT NOT NULL DEFAULT 'pending',
        shipping_status TEXT NOT NULL DEFAULT 'not_ready',
        coupon TEXT NOT NULL DEFAULT '',
        discount NUMERIC(10,2) NOT NULL DEFAULT 0,
        total NUMERIC(10,2) NOT NULL DEFAULT 0,
        lang TEXT NOT NULL DEFAULT 'el',
        user_email TEXT,
        customer JSONB NOT NULL DEFAULT '{}'::jsonb,
        gift JSONB,
        items JSONB NOT NULL DEFAULT '[]'::jsonb,
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

function scopedPool(pool, schema) {
  return {
    async connect() {
      const client = await pool.connect();
      await client.query(`SET search_path TO ${quoteIdentifier(schema)}, public`);
      return client;
    },
  };
}

module.exports = { createLegacyOrderSchema, quoteIdentifier, scopedPool };
