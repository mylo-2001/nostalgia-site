"use strict";

const { app, initialize } = require("../server/server");

module.exports = async function handler(req, res) {
  await initialize();
  return app(req, res);
};
