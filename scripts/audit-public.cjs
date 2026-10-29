// Read-only release gate. Reports paths/categories, never matching credential values.
const fs = require("node:fs/promises");
const path = require("node:path");
const { createHash } = require("node:crypto");
const patterns = [
  /sb_secret_[A-Za-z0-9_-]{12,}/g,
  /sk-(?:proj-|svcacct-)?[A-Za-z0-9_-]{24,}/g,
  /pdl_(?:sdbx|live)_apikey_[A-Za-z0-9_-]{12,}/g,
  /-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/g,
  /(?:postgres|postgresql):\/\/[^\s"'<>]+/g,
];
function containsSecret(text) {
  if (
    patterns.some((re) => {
      re.lastIndex = 0;
      return re.test(text);
    })
  )
    return true;
  const tokens =
    text.match(/eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+/g) || [];
  return tokens.some((token) => {
    try {
      const payload = JSON.parse(
        Buffer.from(token.split(".")[1], "base64url").toString(),
      );
      return payload.role && payload.role !== "anon";
    } catch {
      return false;
    }
  });
}
async function auditPublic(
  root,
  expectedFiles = require("./public-files.cjs"),
) {
  const findings = [];
  const manifest = JSON.parse(
    await fs.readFile(path.join(root, "build-manifest.json"), "utf8"),
  );
  const allowed = new Set([...expectedFiles, "build-manifest.json"]);
  const files = [];
  async function visit(dir, prefix = "") {
    for (const entry of await fs.readdir(dir, { withFileTypes: true })) {
      const relative = prefix + entry.name;
      if (entry.isDirectory())
        await visit(path.join(dir, entry.name), relative + "/");
      else if (!entry.isFile())
        findings.push({ file: relative, issue: "non-regular artifact" });
      else files.push(relative);
    }
  }
  await visit(root);
  for (const file of files) {
    if (!allowed.has(file))
      findings.push({ file, issue: "outside public allowlist" });
    const bytes = await fs.readFile(path.join(root, file));
    if (containsSecret(bytes.toString("utf8")))
      findings.push({ file, issue: "potential private credential" });
    if (
      file !== "build-manifest.json" &&
      createHash("sha256").update(bytes).digest("hex") !==
        manifest.files?.[file]
    )
      findings.push({ file, issue: "manifest hash mismatch" });
  }
  for (const file of expectedFiles)
    if (!files.includes(file))
      findings.push({ file, issue: "missing browser asset" });
  for (const file of Object.keys(manifest.files || {}))
    if (!expectedFiles.includes(file))
      findings.push({ file, issue: "unexpected manifest entry" });
  return {
    status: findings.length ? "FAIL" : "PASS",
    files: files.length - 1,
    findings,
  };
}
module.exports = { auditPublic, containsSecret };
if (require.main === module)
  auditPublic(path.resolve(__dirname, "../_site"))
    .then((result) => {
      console.log(JSON.stringify(result, null, 2));
      if (result.status !== "PASS") process.exitCode = 1;
    })
    .catch(() => {
      console.error(
        "FAIL: public artifact could not be audited; rebuild _site.",
      );
      process.exitCode = 1;
    });
