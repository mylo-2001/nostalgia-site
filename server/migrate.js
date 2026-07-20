"use strict";

const crypto = require("crypto");
const fs = require("fs");
const path = require("path");
const { Pool } = require("pg");

const DEFAULT_MIGRATIONS_DIR = path.join(__dirname, "migrations");
const MIGRATION_FILE = /^(\d+)_([a-z0-9_]+)\.(up|down)\.sql$/;

function loadLocalEnv() {
  const envPath = path.join(__dirname, "..", ".env");
  if (fs.existsSync(envPath) && typeof process.loadEnvFile === "function") {
    process.loadEnvFile(envPath);
  }
}

function quoteIdentifier(value) {
  if (!/^[a-z_][a-z0-9_]*$/i.test(value)) {
    throw new Error(`Invalid PostgreSQL identifier: ${value}`);
  }
  return `"${value.replace(/"/g, '""')}"`;
}

function checksum(sql) {
  return crypto.createHash("sha256").update(sql, "utf8").digest("hex");
}

function splitSqlStatements(sql) {
  const statements = [];
  let buffer = "";
  let quote = null;
  let dollarTag = null;
  let lineComment = false;
  let blockComment = false;

  for (let index = 0; index < sql.length; index += 1) {
    const char = sql[index];
    const next = sql[index + 1];
    buffer += char;

    if (lineComment) {
      if (char === "\n") lineComment = false;
      continue;
    }
    if (blockComment) {
      if (char === "*" && next === "/") {
        buffer += next;
        index += 1;
        blockComment = false;
      }
      continue;
    }
    if (dollarTag) {
      if (sql.startsWith(dollarTag, index)) {
        buffer += dollarTag.slice(1);
        index += dollarTag.length - 1;
        dollarTag = null;
      }
      continue;
    }
    if (quote) {
      if (char === quote && next === quote) {
        buffer += next;
        index += 1;
      } else if (char === quote) {
        quote = null;
      }
      continue;
    }
    if (char === "-" && next === "-") {
      buffer += next;
      index += 1;
      lineComment = true;
      continue;
    }
    if (char === "/" && next === "*") {
      buffer += next;
      index += 1;
      blockComment = true;
      continue;
    }
    if (char === "'" || char === '"') {
      quote = char;
      continue;
    }
    if (char === "$") {
      const match = sql.slice(index).match(/^\$[a-z_][a-z0-9_]*\$|^\$\$/i);
      if (match) {
        dollarTag = match[0];
        buffer += dollarTag.slice(1);
        index += dollarTag.length - 1;
        continue;
      }
    }
    if (char === ";") {
      if (buffer.replace(/--[^\n]*/g, "").trim()) statements.push(buffer.trim());
      buffer = "";
    }
  }
  if (buffer.replace(/--[^\n]*/g, "").trim()) statements.push(buffer.trim());
  return statements;
}

function loadMigrations(directory = DEFAULT_MIGRATIONS_DIR) {
  const migrations = new Map();
  for (const file of fs.readdirSync(directory).sort()) {
    const match = MIGRATION_FILE.exec(file);
    if (!match) continue;
    const version = Number(match[1]);
    const name = match[2];
    const direction = match[3];
    const entry = migrations.get(version) || { version, name };
    if (entry.name !== name) {
      throw new Error(`Migration version ${version} has conflicting names`);
    }
    if (entry[direction]) {
      throw new Error(`Duplicate ${direction} migration for version ${version}`);
    }
    const sql = fs.readFileSync(path.join(directory, file), "utf8");
    entry[direction] = {
      file,
      sql,
      transactional: !/^\s*--\s*migration:\s*no-transaction/im.test(sql),
    };
    migrations.set(version, entry);
  }

  const ordered = [...migrations.values()].sort((a, b) => a.version - b.version);
  for (const migration of ordered) {
    if (!migration.up || !migration.down) {
      throw new Error(`Migration ${migration.version}_${migration.name} needs up and down files`);
    }
    migration.checksum = checksum(migration.up.sql);
  }
  return ordered;
}

function connectionOptions(env = process.env) {
  const connectionString = env.MIGRATION_DATABASE_URL || env.DATABASE_URL || "";
  if (!connectionString) {
    return {
      host: env.PGHOST || "localhost",
      port: Number.parseInt(env.PGPORT, 10) || 5432,
      user: env.PGUSER || "postgres",
      password: env.PGPASSWORD || "",
      database: env.PGDATABASE || "nostalgia",
    };
  }

  const options = { connectionString };
  if (!/localhost|127\.0\.0\.1/i.test(connectionString)) {
    const sslFlag = String(env.PG_SSL_REJECT_UNAUTHORIZED || "").toLowerCase();
    options.connectionString = connectionString
      .replace(/([?&])sslmode=[^&]*&?/, "$1")
      .replace(/[?&]$/, "");
    options.ssl = {
      rejectUnauthorized: sslFlag === "false" ? false : true,
    };
  }
  return options;
}

function targetInfo(options) {
  if (options.connectionString) {
    const parsed = new URL(options.connectionString);
    return { host: parsed.hostname, database: parsed.pathname.replace(/^\//, "") };
  }
  return { host: options.host, database: options.database };
}

function isRemote(options) {
  const { host } = targetInfo(options);
  return !/^(localhost|127\.0\.0\.1|::1)$/i.test(host);
}

function requireWriteApproval(command, options, env, args) {
  if (command === "status") return;
  if (isRemote(options) && env.ALLOW_REMOTE_MIGRATIONS !== "true") {
    throw new Error("Remote migrations are blocked. Set ALLOW_REMOTE_MIGRATIONS=true explicitly.");
  }
  if (env.NODE_ENV === "production" && env.ALLOW_PRODUCTION_MIGRATIONS !== "true") {
    throw new Error("Production migrations are blocked. Set ALLOW_PRODUCTION_MIGRATIONS=true explicitly.");
  }
  if (command === "down") {
    if (!args.includes("--confirm-down")) {
      throw new Error("Down migration requires --confirm-down.");
    }
    if (env.ALLOW_DESTRUCTIVE_MIGRATIONS !== "true") {
      throw new Error("Down migration requires ALLOW_DESTRUCTIVE_MIGRATIONS=true.");
    }
  }
}

async function setSearchPath(client, schema) {
  const quoted = quoteIdentifier(schema);
  const exists = await client.query(
    "SELECT 1 FROM pg_namespace WHERE nspname = $1",
    [schema]
  );
  if (!exists.rowCount) throw new Error(`Migration schema does not exist: ${schema}`);
  await client.query(schema === "public"
    ? `SET search_path TO ${quoted}`
    : `SET search_path TO ${quoted}, public`);
}

async function ensureMigrationTable(client) {
  await client.query(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      version      BIGINT PRIMARY KEY,
      name         TEXT NOT NULL,
      checksum     CHAR(64) NOT NULL,
      execution_ms INTEGER NOT NULL CHECK (execution_ms >= 0),
      applied_at   TIMESTAMPTZ NOT NULL DEFAULT now()
    )
  `);
}

async function acquireMigrationLock(client, lockName, options = {}) {
  const attempts = options.attempts || 600;
  const delayMs = options.delayMs || 100;
  for (let attempt = 0; attempt < attempts; attempt += 1) {
    const result = await client.query(
      "SELECT pg_try_advisory_lock(hashtext($1)) AS acquired",
      [lockName]
    );
    if (result.rows[0].acquired) return;
    await new Promise((resolve) => setTimeout(resolve, delayMs));
  }
  throw new Error(`Timed out waiting for migration lock: ${lockName}`);
}

async function executeTrackedMigration(client, migration, direction) {
  const part = migration[direction];
  const startedAt = Date.now();
  const trackSql = direction === "up"
    ? `INSERT INTO schema_migrations (version, name, checksum, execution_ms)
       VALUES ($1, $2, $3, $4)`
    : "DELETE FROM schema_migrations WHERE version = $1";

  const execute = async () => {
    await client.query(part.sql);
    const elapsed = Date.now() - startedAt;
    if (direction === "up") {
      await client.query(trackSql, [migration.version, migration.name, migration.checksum, elapsed]);
    } else {
      await client.query(trackSql, [migration.version]);
    }
  };

  if (!part.transactional) {
    for (const statement of splitSqlStatements(part.sql)) {
      await client.query(statement);
    }
    const elapsed = Date.now() - startedAt;
    if (direction === "up") {
      await client.query(trackSql, [migration.version, migration.name, migration.checksum, elapsed]);
    } else {
      await client.query(trackSql, [migration.version]);
    }
    return;
  }

  await client.query("BEGIN");
  try {
    await execute();
    await client.query("COMMIT");
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  }
}

async function runMigrations(options = {}) {
  const {
    pool,
    directory = DEFAULT_MIGRATIONS_DIR,
    schema = "public",
    direction = "status",
    count = 1,
    targetVersion = null,
  } = options;
  if (!pool) throw new Error("runMigrations requires a PostgreSQL pool");
  if (!['up', 'down', 'status'].includes(direction)) {
    throw new Error(`Unsupported migration direction: ${direction}`);
  }

  const allMigrations = loadMigrations(directory);
  const migrations = targetVersion === null
    ? allMigrations
    : allMigrations.filter((migration) => migration.version <= Number(targetVersion));
  const byVersion = new Map(migrations.map((migration) => [migration.version, migration]));
  const client = await pool.connect();
  const lockName = `nostalgia:migrations:${schema}`;
  try {
    await setSearchPath(client, schema);
    // Blocking advisory locks can deadlock with CREATE INDEX CONCURRENTLY.
    // Polling leaves no waiting virtual transaction for PostgreSQL to drain.
    await acquireMigrationLock(client, lockName);
    const ledgerResult = await client.query(
      "SELECT to_regclass('schema_migrations') AS ledger"
    );
    const hasLedger = !!ledgerResult.rows[0].ledger;
    if (!hasLedger && direction === "status") {
      return migrations.map((migration) => ({
        version: migration.version,
        name: migration.name,
        status: "pending",
        appliedAt: null,
      }));
    }
    if (!hasLedger && direction === "down") return [];
    if (!hasLedger) await ensureMigrationTable(client);
    const appliedResult = await client.query(
      "SELECT version, name, checksum, applied_at FROM schema_migrations ORDER BY version"
    );
    const applied = new Map(appliedResult.rows.map((row) => [Number(row.version), row]));

    for (const row of applied.values()) {
      const migration = byVersion.get(Number(row.version));
      if (!migration) throw new Error(`Applied migration ${row.version} is missing from disk`);
      if (row.checksum.trim() !== migration.checksum) {
        throw new Error(`Checksum mismatch for applied migration ${row.version}_${row.name}`);
      }
    }

    if (direction === "status") {
      return migrations.map((migration) => ({
        version: migration.version,
        name: migration.name,
        status: applied.has(migration.version) ? "applied" : "pending",
        appliedAt: applied.get(migration.version)?.applied_at || null,
      }));
    }

    if (direction === "up") {
      const pending = migrations.filter((migration) => !applied.has(migration.version));
      for (const migration of pending) {
        await executeTrackedMigration(client, migration, "up");
      }
      return pending.map((migration) => ({ version: migration.version, name: migration.name }));
    }

    const selected = [...applied.keys()]
      .sort((a, b) => b - a)
      .slice(0, Math.max(1, Number(count) || 1));
    const rolledBack = [];
    for (const version of selected) {
      const migration = byVersion.get(version);
      await executeTrackedMigration(client, migration, "down");
      rolledBack.push({ version: migration.version, name: migration.name });
    }
    return rolledBack;
  } finally {
    try {
      await client.query("SELECT pg_advisory_unlock(hashtext($1))", [lockName]);
    } finally {
      client.release();
    }
  }
}

function parseCount(args) {
  const value = args.find((arg) => arg.startsWith("--count="));
  return value ? Number.parseInt(value.slice("--count=".length), 10) : 1;
}

function writeLog(level, event, fields = {}) {
  const output = JSON.stringify({
    timestamp: new Date().toISOString(),
    level,
    component: "database-migration",
    event,
    ...fields,
  });
  if (level === "error") console.error(output);
  else console.log(output);
}

async function main() {
  loadLocalEnv();
  const args = process.argv.slice(2);
  const command = args.find((arg) => !arg.startsWith("--")) || "status";
  const options = connectionOptions(process.env);
  requireWriteApproval(command, options, process.env, args);
  const target = targetInfo(options);
  const pool = new Pool(options);
  try {
    const result = await runMigrations({
      pool,
      schema: process.env.MIGRATION_SCHEMA || "public",
      direction: command,
      count: parseCount(args),
    });
    writeLog("info", "migration_command_completed", {
      command,
      host: target.host,
      database: target.database,
      schema: process.env.MIGRATION_SCHEMA || "public",
      migrations: result,
    });
  } finally {
    await pool.end();
  }
}

if (require.main === module) {
  main().catch((error) => {
    writeLog("error", "migration_command_failed", {
      errorCode: error.code || "MIGRATION_ERROR",
      message: error.message,
    });
    process.exitCode = 1;
  });
}

module.exports = {
  checksum,
  connectionOptions,
  loadMigrations,
  runMigrations,
  splitSqlStatements,
  targetInfo,
};
