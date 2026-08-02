#!/usr/bin/env node
/**
 * Regenerates html/dev-problems.html from the current TypeScript diagnostics
 * (root tsconfig.json = vanilla storefront JS safety net, admin/tsconfig.json
 * = the React admin app). Mirrors what VS Code's "Problems" panel shows.
 *
 * This page is intentionally NOT linked anywhere in the site (same pattern
 * as html/diag.html) — it's a dev-only snapshot, reachable directly at
 * /dev-problems, regenerated on demand with:
 *   npm run problems
 */

const { execFileSync } = require("child_process");
const fs = require("fs");
const path = require("path");

const ROOT = path.join(__dirname, "..");
const OUT_FILE = path.join(ROOT, "html", "dev-problems.html");

const TARGETS = [
  { label: "Storefront (root tsconfig.json)", cwd: ROOT, config: "tsconfig.json" },
  { label: "Admin panel (admin/tsconfig.json)", cwd: path.join(ROOT, "admin"), config: "tsconfig.json" },
];

// tsc line format: file(line,col): category TSxxxx: message
const LINE_RE = /^(.+?)\((\d+),(\d+)\): (error|warning) (TS\d+): (.+)$/;

function runTsc(target) {
  let output = "";
  try {
    execFileSync("npx", ["tsc", "-p", target.config, "--noEmit", "--pretty", "false"], {
      cwd: target.cwd,
      encoding: "utf8",
      stdio: ["ignore", "pipe", "pipe"],
    });
  } catch (err) {
    // tsc exits non-zero when it finds diagnostics; stdout still has them.
    output = (err.stdout || "") + (err.stderr || "");
  }
  const problems = [];
  output.split(/\r?\n/).forEach((line) => {
    const m = LINE_RE.exec(line);
    if (!m) return;
    problems.push({
      file: m[1].replace(/\\/g, "/"),
      line: Number(m[2]),
      col: Number(m[3]),
      severity: m[4],
      code: m[5],
      message: m[6],
    });
  });
  return problems;
}

function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, (c) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
  }[c]));
}

function renderGroup(target, problems) {
  if (!problems.length) {
    return `
    <section class="group">
      <h2>${escapeHtml(target.label)}</h2>
      <div class="empty">✓ Κανένα πρόβλημα</div>
    </section>`;
  }
  const byFile = new Map();
  problems.forEach((p) => {
    if (!byFile.has(p.file)) byFile.set(p.file, []);
    byFile.get(p.file).push(p);
  });
  const files = [...byFile.entries()]
    .map(([file, items]) => {
      const rows = items
        .map(
          (p) => `
        <div class="row ${p.severity}">
          <span class="loc">${p.line}:${p.col}</span>
          <span class="code">${escapeHtml(p.code)}</span>
          <span class="msg">${escapeHtml(p.message)}</span>
        </div>`
        )
        .join("");
      return `
      <div class="file">
        <h3>${escapeHtml(file)}</h3>
        ${rows}
      </div>`;
    })
    .join("");
  return `
    <section class="group">
      <h2>${escapeHtml(target.label)} <span class="count">${problems.length}</span></h2>
      ${files}
    </section>`;
}

function main() {
  const results = TARGETS.map((target) => ({ target, problems: runTsc(target) }));
  const total = results.reduce((sum, r) => sum + r.problems.length, 0);
  const generatedAt = new Date().toISOString();

  const html = `<!DOCTYPE html>
<html lang="el">
<head>
<meta charset="UTF-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<meta name="robots" content="noindex, nofollow" />
<title>Dev · Problems</title>
<style>
  body { font-family: system-ui, sans-serif; margin: 0; background: #0c0a08; color: #f3e4c4; }
  .wrap { max-width: 900px; margin: 0 auto; padding: 2rem 1.25rem 4rem; }
  h1 { font-size: 1.2rem; letter-spacing: .06em; text-transform: uppercase; margin-bottom: .25rem; }
  .meta { font-size: .8rem; opacity: .6; margin-bottom: 2rem; }
  h2 { font-size: 1rem; border-bottom: 1px solid #3a3026; padding-bottom: .4rem; margin-top: 2rem; display: flex; align-items: center; gap: .6rem; }
  .count { background: #ff7a7a; color: #1a0a0a; font-size: .75rem; font-weight: 700; padding: .1rem .5rem; border-radius: 999px; }
  .empty { color: #7fd18a; font-size: .95rem; padding: .5rem 0; }
  .file { margin-top: 1rem; }
  .file h3 { font-size: .82rem; opacity: .85; font-weight: 600; margin-bottom: .3rem; word-break: break-all; }
  .row { display: flex; gap: .75rem; padding: .45rem .6rem; border: 1px solid #3a3026; border-radius: 6px; margin: .3rem 0; font-size: .85rem; align-items: baseline; }
  .row.error { border-color: #6a2f2f; }
  .row.warning { border-color: #6a5a2f; }
  .loc { opacity: .6; min-width: 3.5rem; }
  .code { opacity: .7; min-width: 4.5rem; }
  .row.error .code { color: #ff7a7a; }
  .row.warning .code { color: #e8c96a; }
  .msg { flex: 1; }
  .refresh { margin-top: 2rem; font-size: .8rem; opacity: .6; }
  code { background: #1a1410; padding: .1rem .35rem; border-radius: 4px; }
</style>
</head>
<body>
  <div class="wrap">
    <h1>Dev Problems Snapshot</h1>
    <div class="meta">Παράχθηκε: ${generatedAt} · Σύνολο: ${total}</div>
    ${results.map((r) => renderGroup(r.target, r.problems)).join("")}
    <div class="refresh">Αυτή η σελίδα είναι στατική εικόνα των τελευταίων ελέγχων τύπων. Για ανανέωση: <code>npm run problems</code></div>
  </div>
</body>
</html>
`;

  fs.writeFileSync(OUT_FILE, html, "utf8");
  console.log(`dev-problems.html: ${total} problem(s) written to ${path.relative(ROOT, OUT_FILE)}`);
}

main();
