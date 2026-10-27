import { test } from "node:test";
import assert from "node:assert/strict";
import { createRequire } from "node:module";
import path from "node:path";
const require = createRequire(import.meta.url);
const { createStaticServer } = require("../scripts/serve-production.cjs");
test("static server handles concurrent assets and never serves source secrets or backend files", async (t) => {
  const server = createStaticServer({
    root: path.resolve(import.meta.dirname, ".."),
    prefix: "/launchpad-career/",
  });
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  t.after(() => new Promise((resolve) => server.close(resolve)));
  const base = `http://127.0.0.1:${server.address().port}/launchpad-career/`;
  const responses = await Promise.all(
    Array.from({ length: 32 }, () => fetch(base + "navigation.js")),
  );
  for (const response of responses) {
    assert.equal(response.status, 200);
    assert.match(response.headers.get("content-type"), /javascript/);
    await response.text();
  }
  for (const file of [
    ".env",
    ".git/config",
    "package.json",
    "supabase/migrations/202610270001_launchpad.sql",
    "../auth-config.js",
    "%2e%2e/auth-config.js",
  ])
    assert.equal((await fetch(base + file)).status, 404, file);
  assert.equal(
    (await fetch(base + "index.html", { method: "POST" })).status,
    405,
  );
  const head = await fetch(base + "index.html", { method: "HEAD" });
  assert.equal(head.status, 200);
  assert.equal(await head.text(), "");
  assert.equal(head.headers.get("x-content-type-options"), "nosniff");
});
