const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const { spawnSync } = require("node:child_process");
const { createHash } = require("node:crypto");
test("Cloudflare public build config is validated, hashed and never changes committed credentials", () => {
  const original = fs.readFileSync("auth-config.js", "utf8");
  const env = { ...process.env };
  delete env.PUBLIC_SUPABASE_URL;
  delete env.PUBLIC_PUBLISHABLE_KEY;
  const run = (extra) =>
    spawnSync(process.execPath, ["scripts/build.cjs"], {
      env: { ...env, ...extra },
      encoding: "utf8",
    });
  try {
    let r = run({
      PUBLIC_SUPABASE_URL: "https://build-fixture.supabase.co",
      PUBLIC_PUBLISHABLE_KEY: "sb_publishable_build_fixture",
    });
    assert.equal(r.status, 0, r.stderr);
    const built = fs.readFileSync("_site/auth-config.js");
    assert.match(built.toString(), /build-fixture/);
    assert.equal(fs.readFileSync("auth-config.js", "utf8"), original);
    const manifest = JSON.parse(fs.readFileSync("_site/build-manifest.json"));
    assert.equal(
      manifest.files["auth-config.js"],
      createHash("sha256").update(built).digest("hex"),
    );
    r = run({
      PUBLIC_SUPABASE_URL: "https://build-fixture.supabase.co",
      PUBLIC_PUBLISHABLE_KEY: "sb_secret_rejected_fixture",
    });
    assert.notEqual(r.status, 0);
    assert.match(r.stderr, /publishable|secret/i);
  } finally {
    const r = run({});
    assert.equal(r.status, 0, r.stderr);
  }
});
