#!/usr/bin/env node
/*
 * Concurrent development: `npm run dev:all`.
 *
 * Runs two processes with prefixed, colour-coded logs:
 *   • [server] Express  → http://localhost:8000   (storefront + API)
 *   • [admin]  Vite dev → http://localhost:5174   (React admin, hot reload;
 *                                                   /api is proxied to :8000)
 *
 * Use this while working on the admin (instant reload). `npm start` instead
 * builds the admin once and serves everything from the single Express port.
 * Ctrl+C stops both.
 */
const { spawn } = require("child_process");
const path = require("path");

const root = path.join(__dirname, "..");
const adminDir = path.join(root, "admin");
const children = [];

function launch(name, color, cmd, args, cwd, shell) {
  const tag = `\x1b[${color}m[${name}]\x1b[0m `;
  const p = spawn(cmd, args, { cwd, shell, env: process.env });
  children.push(p);
  const pipe = (src, dst) => {
    let buf = "";
    src.on("data", (chunk) => {
      buf += chunk.toString();
      const lines = buf.split(/\r?\n/);
      buf = lines.pop();
      for (const line of lines) dst.write(tag + line + "\n");
    });
  };
  pipe(p.stdout, process.stdout);
  pipe(p.stderr, process.stderr);
  p.on("exit", (code) => {
    process.stdout.write(tag + `exited (${code})\n`);
    shutdown();
  });
}

let shuttingDown = false;
function shutdown() {
  if (shuttingDown) return;
  shuttingDown = true;
  for (const c of children) { try { c.kill(); } catch { /* ignore */ } }
  setTimeout(() => process.exit(0), 200);
}
process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);

launch("server", "36", process.execPath, [path.join(root, "server", "server.js")], root, false);
// String command + shell:true resolves npm→npm.cmd on Windows without DEP0190.
launch("admin", "35", "npm run dev", undefined, adminDir, true);
