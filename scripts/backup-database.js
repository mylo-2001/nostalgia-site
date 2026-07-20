"use strict";

const crypto = require("node:crypto");
const fs = require("node:fs");
const path = require("node:path");
const { spawn } = require("node:child_process");

const MAGIC = Buffer.from("NOSTBKP1", "ascii");

function databaseProcessEnv(connectionString) {
  const url = new URL(connectionString);
  const clean = new URL(connectionString);
  clean.password = "";
  return { connection: clean.toString(), env: { ...process.env,
    PGPASSWORD: decodeURIComponent(url.password) } };
}

function encryptionKey() {
  const key = Buffer.from(process.env.BACKUP_ENCRYPTION_KEY || "", "base64");
  if (key.length !== 32) throw new Error("BACKUP_ENCRYPTION_KEY must be 32 random bytes in base64");
  return key;
}

async function backup() {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) throw new Error("DATABASE_URL is required");
  const directory = path.resolve(process.env.BACKUP_DIR || path.join(process.cwd(), "backups"));
  fs.mkdirSync(directory, { recursive: true, mode: 0o700 });
  const stamp = new Date().toISOString().replace(/[:.]/g, "-");
  const finalPath = path.join(directory, `nostalgia-${stamp}.dump.enc`);
  const temporaryPath = `${finalPath}.partial`;
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", encryptionKey(), iv);
  const output = fs.createWriteStream(temporaryPath, { mode: 0o600, flags: "wx" });
  output.write(MAGIC);
  output.write(iv);
  const database = databaseProcessEnv(databaseUrl);
  const child = spawn("pg_dump", ["--format=custom", "--no-owner", "--no-acl",
    "--dbname", database.connection], { env: database.env, stdio: ["ignore", "pipe", "pipe"] });
  let stderr = "";
  child.stderr.on("data", (chunk) => { stderr += chunk.toString("utf8").slice(0, 4000); });
  child.stdout.pipe(cipher).pipe(output, { end: false });
  await new Promise((resolve, reject) => {
    child.on("error", reject);
    child.on("close", (code) => code === 0 ? resolve() : reject(new Error(`pg_dump failed: ${stderr}`)));
  });
  await new Promise((resolve, reject) => {
    cipher.on("end", resolve);
    cipher.on("error", reject);
  });
  output.end(cipher.getAuthTag());
  await new Promise((resolve, reject) => { output.on("close", resolve); output.on("error", reject); });
  fs.renameSync(temporaryPath, finalPath);

  const retentionDays = Math.max(1, Number(process.env.BACKUP_RETENTION_DAYS || 30));
  const cutoff = Date.now() - retentionDays * 86400000;
  for (const name of fs.readdirSync(directory)) {
    if (!/^nostalgia-.*\.dump\.enc$/.test(name)) continue;
    const candidate = path.join(directory, name);
    if (fs.statSync(candidate).mtimeMs < cutoff) fs.unlinkSync(candidate);
  }
  console.log(JSON.stringify({ ok: true, backup: finalPath,
    sha256: crypto.createHash("sha256").update(fs.readFileSync(finalPath)).digest("hex") }));
}

backup().catch((error) => {
  console.error(JSON.stringify({ ok: false, error: error.message }));
  process.exitCode = 1;
});
