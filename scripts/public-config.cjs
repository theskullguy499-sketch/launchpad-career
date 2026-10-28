const vm = require("node:vm");
const { validatePublicAuth } = require("../lib/public-auth.mjs");
module.exports = function validatePublicConfig(source) {
  const context = { window: {} };
  vm.runInNewContext(source, context, { timeout: 1000 });
  return validatePublicAuth(context.window.LAUNCHPAD_AUTH_CONFIG);
};
