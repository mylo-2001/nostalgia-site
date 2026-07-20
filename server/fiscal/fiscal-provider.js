"use strict";

class FiscalProviderAdapter {
  constructor(name) {
    if (!/^[a-z0-9_-]{2,50}$/.test(String(name || ""))) {
      throw new TypeError("Fiscal provider requires a stable provider name");
    }
    this.name = name;
  }

  async issueDocument() {
    throw new Error("Fiscal provider issueDocument is not implemented");
  }

  async cancelDocument() {
    throw new Error("Fiscal provider cancelDocument is not implemented");
  }
}

module.exports = { FiscalProviderAdapter };
