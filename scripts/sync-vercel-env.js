"use strict";

const fs = require("fs");
const { spawnSync } = require("child_process");

const envText = fs.readFileSync(".env", "utf8");
const map = {};
for (const line of envText.split(/\r?\n/)) {
  const t = line.trim();
  if (!t || t.startsWith("#")) continue;
  const i = t.indexOf("=");
  if (i < 0) continue;
  const k = t.slice(0, i).trim();
  let v = t.slice(i + 1).trim();
  if (
    (v.startsWith('"') && v.endsWith('"')) ||
    (v.startsWith("'") && v.endsWith("'"))
  ) {
    v = v.slice(1, -1);
  }
  if (k) map[k] = v;
}

const pairs = [
  ["DATABASE_URL", map.DATABASE_URL],
  ["SESSION_SECRET", map.SESSION_SECRET],
  ["GUEST_TOKEN_SECRET", map.GUEST_TOKEN_SECRET],
  ["TRUST_PROXY", map.TRUST_PROXY || "true"],
  ["ADMIN_USERNAME", map.ADMIN_USERNAME],
  ["ADMIN_UI_PATH", map.ADMIN_UI_PATH],
  ["ADMIN_2FA_REQUIRED", map.ADMIN_2FA_REQUIRED || "true"],
  ["SITE_URL", "https://www.nostalgiacandle.gr"],
  ["TURNSTILE_SITE_KEY", map.TURNSTILE_SITE_KEY],
  ["TURNSTILE_SECRET_KEY", map.TURNSTILE_SECRET_KEY],
];

let ok = 0;
let fail = 0;

for (const [name, value] of pairs) {
  if (!value) {
    console.log("skip", name);
    continue;
  }
  const r = spawnSync(
    "npx",
    [
      "--yes",
      "vercel@latest",
      "env",
      "add",
      name,
      "production",
      "--yes",
      "--force",
      "--sensitive",
    ],
    { input: value + "\n", encoding: "utf8", shell: true, timeout: 120000 }
  );
  const out = String(r.stdout || "") + String(r.stderr || "");
  if (r.status === 0 || /Overrode|Saved|Added/i.test(out)) {
    ok += 1;
    console.log("set", name);
  } else {
    fail += 1;
    console.log("FAIL", name, out.slice(-300).replace(/\s+/g, " "));
  }
}

console.log(JSON.stringify({ ok, fail }));
