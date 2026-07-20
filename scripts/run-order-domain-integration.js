"use strict";

const path = require("node:path");
const { spawnSync } = require("node:child_process");
const { Client } = require("pg");

if (typeof process.loadEnvFile === "function") {
  process.loadEnvFile(path.join(__dirname, "..", ".env"));
}

const host = process.env.PGHOST || "127.0.0.1";
if (!/^(localhost|127\.0\.0\.1|::1)$/i.test(host)) {
  throw new Error("Local integration helper refuses non-local PGHOST values");
}

const config = {
  host,
  port: Number.parseInt(process.env.PGPORT, 10) || 5432,
  user: process.env.PGUSER || "postgres",
  password: process.env.PGPASSWORD || "",
  database: "postgres",
};

async function main() {
  const client = new Client(config);
  await client.connect();
  try {
    const exists = await client.query(
      "SELECT 1 FROM pg_database WHERE datname = $1",
      ["nostalgia_phase1_test"]
    );
    if (!exists.rowCount) {
      await client.query("CREATE DATABASE nostalgia_phase1_test");
    }
  } finally {
    await client.end();
  }

  const url = new URL("postgresql://127.0.0.1");
  url.username = config.user;
  url.password = config.password;
  url.port = String(config.port);
  url.pathname = "/nostalgia_phase1_test";
  const result = spawnSync(
    process.execPath,
    [
      "--test",
      "test/order-domain.integration.test.js",
      "test/order-state-service.integration.test.js",
      "test/pricing-service.integration.test.js",
      "test/inventory-service.integration.test.js",
      "test/order-creation-service.integration.test.js",
      "test/payment-service.integration.test.js",
      "test/cod-risk.integration.test.js",
      "test/admin-order-service.integration.test.js",
      "test/return-refund-service.integration.test.js",
      "test/notification-outbox.integration.test.js",
      "test/admin-session.integration.test.js",
      "test/monitoring.integration.test.js",
      "test/payment-retry.integration.test.js",
      "test/fiscal-document-service.integration.test.js",
    ],
    {
      cwd: path.join(__dirname, ".."),
      env: { ...process.env, TEST_DATABASE_URL: url.toString() },
      stdio: "inherit",
    }
  );
  process.exitCode = result.status ?? 1;
}

main().catch((error) => {
  console.error(`[integration] ${error.message}`);
  process.exitCode = 1;
});
