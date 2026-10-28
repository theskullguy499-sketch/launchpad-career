const { test } = require("node:test");
const assert = require("node:assert/strict");
const validate = require("./browser-syntax.cjs");
test("browser syntax gate accepts ESM and classic scripts without executing them", () => {
  assert.doesNotThrow(() =>
    validate("export const value = await Promise.resolve(1);", "module.mjs"),
  );
  assert.doesNotThrow(() =>
    validate("(()=>{ window.someValue = 1; })();", "classic.js"),
  );
  assert.equal(global.someValue, undefined);
});
test("browser syntax gate rejects an invalid module before static deployment", () => {
  assert.throws(
    () => validate("export const values = [...new Set([1,2])))];", "broken.js"),
    /Invalid browser JavaScript: broken.js/,
  );
});
