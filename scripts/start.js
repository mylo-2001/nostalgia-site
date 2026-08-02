#!/usr/bin/env node
/*
 * One-command startup: `npm start`.
 *
 * The Express server serves ALL three surfaces from a single process/port:
 *   • storefront (frontend)  →  http://localhost:PORT/
 *   • API (backend)          →  http://localhost:PORT/api
 *   • admin (React)          →  http://localhost:PORT{ADMIN_UI_PATH}
 *                               (/admin always 404 — set ADMIN_UI_PATH in .env)
 *
 * The admin is a built static bundle (admin/dist), so we build it first to make
 * sure the admin UI is up to date, then boot the server. Default PORT is 8000.
 *
 * For hot-reload admin development instead, use `npm run dev:all`.
 */
const { spawn, spawnSync } = require("child_process");
const { existsSync } = require("fs");
const path = require("path");

const root = path.join(__dirname, "..");
const adminDir = path.join(root, "admin");

function step(msg) { console.log("\x1b[36m[start]\x1b[0m " + msg); }

function runSync(cmd, cwd, env) {
  // Pass the whole command as a string with shell:true so "npm" resolves to
  // npm.cmd on Windows / npm on POSIX (and it avoids the DEP0190 warning that
  // shell:true + an args array triggers).
  const r = spawnSync(cmd, { stdio: "inherit", cwd, shell: true, env: env || process.env });
  if (r.status !== 0) {
    console.error("\x1b[31m[start]\x1b[0m command failed: " + cmd);
    process.exit(r.status || 1);
  }
}

// 1) Ensure admin dependencies are installed.
if (!existsSync(path.join(adminDir, "node_modules"))) {
  step("installing admin dependencies (first run)…");
  runSync("npm install", adminDir);
}

// 2) Build the React admin → admin/dist (served at /admin-react).
step("applying database migrations...");
runSync("npm run migrate:up", root, {
  ...process.env,
  /* npm start is an explicit operator action; keep the standalone migration
     command guarded, but allow this startup path to prepare a remote dev DB. */
  ALLOW_REMOTE_MIGRATIONS: "true",
});

step("checking backend syntax...");
runSync("node --check server/server.js", root);

step("checking backend tests...");
runSync("npm run test:unit", root);

step("building React admin...");
runSync("npm run build", adminDir);

// 3) Start the Express server (frontend + API + admin) in this process group.
step("starting server…");
const srv = spawn(process.execPath, [path.join(root, "server", "server.js")], {
  stdio: "inherit",
  env: process.env,
});

function forward(sig) { try { srv.kill(sig); } catch { /* ignore */ } }
process.on("SIGINT", () => forward("SIGINT"));
process.on("SIGTERM", () => forward("SIGTERM"));
srv.on("exit", (code, signal) => {
  if (signal) process.kill(process.pid, signal);
  else process.exit(code == null ? 0 : code);
});
