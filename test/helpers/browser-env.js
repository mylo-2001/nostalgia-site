"use strict";

/**
 * Loads a browser-side IIFE script (js/*.js) inside an isolated VM context with
 * a minimal window/document stub, so its `window.Nostalgia*` API can be tested
 * in Node without a real browser. Not a test file itself.
 */

const fs = require("fs");
const path = require("path");
const vm = require("vm");

const ROOT = path.join(__dirname, "..", "..");

function noop() {}

function emptyList() {
  const arr = [];
  arr.forEach = Array.prototype.forEach.bind(arr);
  return arr;
}

function makeElement() {
  return {
    setAttribute: noop,
    getAttribute: () => null,
    appendChild: noop,
    removeChild: noop,
    replaceChild: noop,
    addEventListener: noop,
    removeEventListener: noop,
    dataset: {},
    style: {},
    classList: { add: noop, remove: noop, toggle: noop, contains: () => false },
    querySelector: () => null,
    querySelectorAll: () => emptyList(),
    closest: () => null,
    contains: () => false,
  };
}

/**
 * @param {string} relPath  e.g. "js/products.js"
 * @param {object} windowProps  properties merged onto `window` BEFORE the
 *                              script runs (e.g. a NostalgiaI18n stub).
 * @returns {object} the populated window object
 */
function loadBrowserScript(relPath, windowProps) {
  const code = fs.readFileSync(path.join(ROOT, relPath), "utf8");

  const win = Object.assign(
    {
      matchMedia: () => ({ matches: false, addListener: noop, addEventListener: noop }),
      addEventListener: noop,
      removeEventListener: noop,
      setTimeout: noop,
      clearTimeout: noop,
      location: { pathname: "/", search: "", href: "" },
      history: { pushState: noop, replaceState: noop },
    },
    windowProps || {}
  );

  const doc = {
    readyState: "complete",
    addEventListener: noop,
    removeEventListener: noop,
    querySelector: () => null,
    querySelectorAll: () => emptyList(),
    createElement: makeElement,
    dispatchEvent: noop,
    body: makeElement(),
    documentElement: makeElement(),
  };
  win.document = doc;

  const sandbox = {
    window: win,
    document: doc,
    console,
    navigator: { userAgent: "node-test" },
    setTimeout: noop,
    clearTimeout: noop,
    CustomEvent: function (type, init) {
      this.type = type;
      this.detail = init && init.detail;
    },
  };
  sandbox.self = win;
  sandbox.globalThis = sandbox;

  vm.createContext(sandbox);
  vm.runInContext(code, sandbox, { filename: relPath });
  return win;
}

module.exports = { loadBrowserScript, makeElement, emptyList, ROOT };
