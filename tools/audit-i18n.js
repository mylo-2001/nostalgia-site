"use strict";
const fs = require("fs");
const path = require("path");
const root = path.join(__dirname, "..");

function read(f) {
  try {
    return fs.readFileSync(f, "utf8");
  } catch {
    return "";
  }
}

const bundles = {};
for (const name of ["shared", "shop", "content", "home", "catalog"]) {
  const s = read(path.join(root, "js/i18n-bundles", name + ".js"));
  const m = s.match(/el:\s*\{([\s\S]*?)\n\s*\},\s*\n\s*en:/);
  if (!m) continue;
  bundles[name] = new Set([...m[1].matchAll(/^\s+([a-z0-9_]+):/gm)].map((x) => x[1]));
}

const allDefined = new Set();
Object.values(bundles).forEach((s) => s.forEach((k) => allDefined.add(k)));

const used = new Set();
function scan(file) {
  const s = read(path.join(root, file));
  for (const m of s.matchAll(/t\(\s*["']([a-z0-9_]+)["']/g)) used.add(m[1]);
  for (const m of s.matchAll(/data-i18n=["']([a-z0-9_]+)["']/g)) used.add(m[1]);
  for (const m of s.matchAll(/data-i18n-aria=["']([a-z0-9_]+)["']/g)) used.add(m[1]);
}

function walk(d) {
  for (const e of fs.readdirSync(d, { withFileTypes: true })) {
    const p = path.join(d, e.name);
    if (e.isDirectory() && e.name !== "node_modules" && e.name !== ".git" && e.name !== ".pdf_tools") {
      walk(p);
    } else if (/\.(js|html)$/.test(e.name)) {
      scan(path.relative(root, p).replace(/\\/g, "/"));
    }
  }
}
walk(root);

const skip = (k) =>
  k.startsWith("collection_cat") ||
  /^collection_[a-z0-9]+_prod/.test(k) ||
  k.startsWith("collection_") && k.includes("_prod");

const missing = [...used].filter((k) => !allDefined.has(k) && !skip(k)).sort();
console.log("MISSING", missing.length);
console.log(missing.join("\n"));

const shopOnly = [...used]
  .filter((k) => bundles.shop && bundles.shop.has(k) && !bundles.shared.has(k))
  .sort();
console.log("\nSHOP_ONLY_USED", shopOnly.length);
console.log(shopOnly.join("\n"));
