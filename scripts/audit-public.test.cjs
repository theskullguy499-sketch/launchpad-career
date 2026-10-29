const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs/promises"),
  os = require("node:os"),
  path = require("node:path");
const { createHash } = require("node:crypto");
const { auditPublic, containsSecret } = require("./audit-public.cjs");
test("public scan rejects private keys, database URLs and session/admin JWTs but accepts public configuration", () => {
  const jwt = (role) =>
    "eyJhbGciOiJIUzI1NiJ9." +
    Buffer.from(JSON.stringify({ role })).toString("base64url") +
    ".signature";
  assert.equal(containsSecret(jwt("anon")), false);
  for (const role of ["authenticated", "service_role"])
    assert.equal(containsSecret(jwt(role)), true);
  for (const text of [
    "sb_secret_" + "x".repeat(30),
    "sk-proj-" + "x".repeat(30),
    "postgresql://user:password@db/private",
    "-----BEGIN PRIVATE KEY-----",
  ])
    assert.equal(containsSecret(text), true);
  assert.equal(containsSecret("sb_publishable_publicfixture"), false);
});
test("public gate checks allowlist, missing assets, content hashes and redacts suspicious contents", async () => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), "launchpad-audit-"));
  try {
    const source = "window.publicConfig = {};";
    await fs.writeFile(path.join(root, "app.js"), source);
    await fs.writeFile(
      path.join(root, "build-manifest.json"),
      JSON.stringify({
        files: { "app.js": createHash("sha256").update(source).digest("hex") },
      }),
    );
    assert.equal((await auditPublic(root, ["app.js"])).status, "PASS");
    const secret = "sb_secret_" + "x".repeat(30);
    await fs.writeFile(path.join(root, "app.js"), secret);
    await fs.writeFile(path.join(root, ".env"), "PRIVATE_FILE");
    const result = await auditPublic(root, ["app.js", "missing.css"]);
    assert.equal(result.status, "FAIL");
    assert.ok(
      result.findings.some((f) => f.issue === "potential private credential"),
    );
    assert.ok(
      result.findings.some((f) => f.issue === "manifest hash mismatch"),
    );
    assert.ok(
      result.findings.some((f) => f.issue === "outside public allowlist"),
    );
    assert.ok(result.findings.some((f) => f.issue === "missing browser asset"));
    assert.ok(!JSON.stringify(result).includes(secret));
  } finally {
    await fs.rm(root, { recursive: true, force: true });
  }
});
