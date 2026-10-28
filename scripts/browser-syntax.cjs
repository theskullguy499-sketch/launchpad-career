const esbuild = require("esbuild");
module.exports = function validateBrowserSyntax(source, filename) {
  try {
    esbuild.transformSync(source, {
      loader: "js",
      target: "es2022",
      format: "esm",
      logLevel: "silent",
    });
  } catch {
    throw new Error(
      `Invalid browser JavaScript: ${filename}. Fix the source before building.`,
    );
  }
};
