"use strict";

/**
 * One-off: rewrite legacy *.html links to clean paths (/collection, /account, …).
 * Safe to re-run — skips paths that are already clean.
 */

const fs = require("fs");
const path = require("path");

const ROOT = path.join(__dirname, "..");
const SKIP_DIRS = new Set(["node_modules", "server", ".git", ".pdf_tools", ".claude"]);

const PAGES = [
  "collection",
  "about",
  "contact",
  "cart",
  "checkout",
  "wishlist",
  "faq",
  "how-it-works",
  "journal",
  "scent-finder",
  "gift-experience",
  "shipping-returns",
  "payments",
  "privacy",
  "terms",
  "account",
];

function walk(dir, cb) {
  for (const ent of fs.readdirSync(dir, { withFileTypes: true })) {
    if (SKIP_DIRS.has(ent.name)) continue;
    const full = path.join(dir, ent.name);
    if (ent.isDirectory()) walk(full, cb);
    else if (/\.(html|js)$/.test(ent.name)) cb(full);
  }
}

function migrate(content) {
  let out = content;

  out = out.replace(/product\.html\?id=/g, "/product/");
  out = out.replace(/href="account\.html\?mode=register"/g, 'href="/account/register"');
  out = out.replace(/href='account\.html\?mode=register'/g, "href='/account/register'");
  out = out.replace(/account\.html\?mode=register/g, "/account/register");
  out = out.replace(/href="account\.html\?mode=login"/g, 'href="/account"');
  out = out.replace(/href='account\.html\?mode=login'/g, "href='/account'");
  out = out.replace(/account\.html\?mode=login/g, "/account");
  out = out.replace(/href="index\.html"/g, 'href="/"');
  out = out.replace(/href='index\.html'/g, "href='/'");
  out = out.replace(/href: "index\.html"/g, 'href: "/"');
  out = out.replace(/"index\.html"/g, '"/"');

  for (const page of PAGES) {
    const reHash = new RegExp(`href="${page}\\.html#`, "g");
    out = out.replace(reHash, `href="/${page}#`);
    const reHashS = new RegExp(`href='${page}\\.html#`, "g");
    out = out.replace(reHashS, `href='/${page}#`);
    const reHref = new RegExp(`href="${page}\\.html"`, "g");
    out = out.replace(reHref, `href="/${page}"`);
    const reHrefS = new RegExp(`href='${page}\\.html'`, "g");
    out = out.replace(reHrefS, `href='/${page}'`);
    const reHrefColon = new RegExp(`href: "${page}\\.html"`, "g");
    out = out.replace(reHrefColon, `href: "/${page}"`);
    const reHrefColonHash = new RegExp(`href: "${page}\\.html#`, "g");
    out = out.replace(reHrefColonHash, `href: "/${page}#`);
    out = out.replace(new RegExp(`${page}\\.html#`, "g"), `/${page}#`);
    out = out.replace(new RegExp(`"${page}\\.html"`, "g"), `"/${page}"`);
    out = out.replace(new RegExp(`'${page}\\.html'`, "g"), `'/${page}'`);
    out = out.replace(new RegExp(`window\\.location\\.href = "${page}\\.html"`, "g"), `window.location.href = "/${page}"`);
    out = out.replace(
      new RegExp(`history\\.replaceState\\(null, "", "${page}\\.html"\\)`, "g"),
      `history.replaceState(null, "", "/${page}")`
    );
  }

  out = out.replace(/ στο contact\.html/g, " στο /contact");
  out = out.replace(/ at contact\.html/g, " at /contact");

  return out;
}

let changed = 0;
walk(ROOT, (file) => {
  const before = fs.readFileSync(file, "utf8");
  const after = migrate(before);
  if (after !== before) {
    fs.writeFileSync(file, after, "utf8");
    changed++;
    console.log("updated", path.relative(ROOT, file));
  }
});

console.log("done,", changed, "file(s)");
