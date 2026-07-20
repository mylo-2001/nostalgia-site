"use strict";

const crypto = require("node:crypto");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { spawn } = require("node:child_process");
const { Pool } = require("pg");

const MAGIC = Buffer.from("NOSTBKP1", "ascii");

function key() {
  const value = Buffer.from(process.env.BACKUP_ENCRYPTION_KEY || "", "base64");
  if (value.length !== 32) throw new Error("BACKUP_ENCRYPTION_KEY must be 32 bytes in base64");
  return value;
}

function connection(value) {
  const url = new URL(value);
  const clean = new URL(value);
  clean.password = "";
  return { value: clean.toString(), env: { ...process.env, PGPASSWORD: decodeURIComponent(url.password) } };
}

async function main() {
  const backupPath = path.resolve(process.argv[2] || "");
  const targetUrl = process.env.RESTORE_TEST_DATABASE_URL || "";
  if (!fs.existsSync(backupPath)) throw new Error("Encrypted backup file was not found");
  if (!targetUrl || !new URL(targetUrl).pathname.toLowerCase().includes("restore_test")) {
    throw new Error("RESTORE_TEST_DATABASE_URL must name an isolated database containing restore_test");
  }
  const data = fs.readFileSync(backupPath);
  if (!data.subarray(0, 8).equals(MAGIC) || data.length < 37) throw new Error("Invalid backup format");
  const decipher = crypto.createDecipheriv("aes-256-gcm", key(), data.subarray(8, 20));
  decipher.setAuthTag(data.subarray(data.length - 16));
  const plaintext = Buffer.concat([decipher.update(data.subarray(20, data.length - 16)), decipher.final()]);
  const temporary = path.join(os.tmpdir(), `nostalgia-restore-${crypto.randomUUID()}.dump`);
  fs.writeFileSync(temporary, plaintext, { mode: 0o600 });
  try {
    const target = connection(targetUrl);
    const child = spawn("pg_restore", ["--clean", "--if-exists", "--no-owner", "--no-acl",
      "--dbname", target.value, temporary], { env: target.env, stdio: "inherit" });
    const code = await new Promise((resolve, reject) => {
      child.on("error", reject); child.on("close", resolve);
    });
    if (code !== 0) throw new Error(`pg_restore exited with code ${code}`);
    const targetPool = new Pool({ connectionString: targetUrl });
    try {
      const checks = await targetPool.query(`SELECT
        to_regclass('public.orders') IS NOT NULL orders_exists,
        to_regclass('public.schema_migrations') IS NOT NULL migrations_exist`);
      if (!checks.rows[0].orders_exists) throw new Error("Restore verification failed: orders missing");
    } finally { await targetPool.end(); }
    if (process.env.DATABASE_URL) {
      const source = new Pool({ connectionString: process.env.DATABASE_URL });
      try { await source.query(`INSERT INTO backup_restore_tests
        (backup_reference,status,checksum_sha256,tested_by,completed_at)
        VALUES ($1,'succeeded',$2,$3,now())`, [path.basename(backupPath),
        crypto.createHash("sha256").update(data).digest("hex"),
        process.env.RESTORE_TEST_ACTOR || "restore-test-script"]); } finally { await source.end(); }
    }
    console.log(JSON.stringify({ ok: true, restored: path.basename(backupPath) }));
  } finally { fs.rmSync(temporary, { force: true }); }
}

main().catch((error) => { console.error(JSON.stringify({ ok: false, error: error.message }));
  process.exitCode = 1; });
