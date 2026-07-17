"use strict";

/**
 * Tiny JSON-file data store with atomic writes.
 * Data lives in server/data/db.json — no external database needed.
 */

const fs = require("fs");
const path = require("path");

const DATA_DIR = path.join(__dirname, "data");
const DB_FILE = path.join(DATA_DIR, "db.json");

const DEFAULTS = {
  users: [],
  orders: [],
  newsletter: [],
  messages: [],
  products: [], // custom products created from the admin panel
  stock: {},
  orderSeq: 0,
  productSeq: 0,
  admin: null,
  secret: null,
};

let db = null;
let writeTimer = null;

function ensureDir() {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

function load() {
  if (db) return db;
  ensureDir();
  try {
    const raw = fs.readFileSync(DB_FILE, "utf8");
    db = Object.assign({}, DEFAULTS, JSON.parse(raw));
  } catch (e) {
    db = Object.assign({}, DEFAULTS);
  }
  return db;
}

function flush() {
  ensureDir();
  const tmp = DB_FILE + ".tmp";
  fs.writeFileSync(tmp, JSON.stringify(db, null, 2), "utf8");
  fs.renameSync(tmp, DB_FILE);
}

/** Persist soon (debounced) so bursts of writes hit disk once. */
function save() {
  if (writeTimer) clearTimeout(writeTimer);
  writeTimer = setTimeout(() => {
    writeTimer = null;
    try {
      flush();
    } catch (e) {
      console.error("[store] failed to persist db:", e.message);
    }
  }, 150);
}

function saveNow() {
  if (writeTimer) {
    clearTimeout(writeTimer);
    writeTimer = null;
  }
  flush();
}

process.on("exit", () => {
  try {
    if (db && writeTimer) saveNow();
  } catch (e) {}
});

module.exports = { load, save, saveNow, DATA_DIR };
