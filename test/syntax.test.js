"use strict";

/**
 * Safety net: parse every project .js file with `node --check` so a stray
 * syntax error anywhere (frontend or server) fails the suite immediately.
 */

const { test } = require("node:test");
const assert = require("node:assert");
const { execFileSync } = require("node:child_process");
const fs = require("node:fs");
const path = require("node:path");

const ROOT = path.join(__dirname, "..");
const DIRS = ["js", "server"];

function collectJs(dir) {
  const abs = path.join(ROOT, dir);
  if (!fs.existsSync(abs)) return [];
  return fs
    .readdirSync(abs, { recursive: true })
    .map(String)
    .filter((f) => f.endsWith(".js"))
    .filter((f) => !f.split(path.sep).includes("node_modules"))
    .map((f) => path.join(dir, f));
}

const files = DIRS.flatMap(collectJs);

test("there are .js files to check", () => {
  assert.ok(files.length > 0, "no .js files found");
});

for (const rel of files) {
  test(`parses: ${rel}`, () => {
    try {
      execFileSync(process.execPath, ["--check", path.join(ROOT, rel)], {
        stdio: "pipe",
      });
    } catch (err) {
      const msg = (err.stderr && err.stderr.toString()) || err.message;
      assert.fail(`syntax error in ${rel}:\n${msg}`);
    }
  });
}
