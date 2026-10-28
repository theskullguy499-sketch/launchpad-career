import { test } from "node:test";
import assert from "node:assert/strict";
import { checkStaging, parseDeployedAuth } from "../scripts/check-staging.mjs";
const key = "sb_publishable_diagnostic_fixture",
  project = "https://oyatshlhqdxosvbelsvp.supabase.co";
const config =
  "window.LAUNCHPAD_AUTH_CONFIG = " +
  JSON.stringify({ supabaseUrl: project, publishableKey: key }) +
  ";\n";
test("public staging diagnostics parse only generated JSON, never execute downloaded code", () => {
  assert.equal(parseDeployedAuth(config).publishableKey, key);
  for (const source of [
    "process.exit(1)",
    "window.LAUNCHPAD_AUTH_CONFIG = {supabaseUrl:process.env.SECRET};",
    config + 'throw new Error("must not run")',
    config.replace(project, "https://other.supabase.co"),
  ])
    assert.throws(() => parseDeployedAuth(source));
});
test("staging diagnostics are read-only and never report fixture SMTP or purchases as verified", async () => {
  const calls = [];
  const checks = await checkStaging(async (url, options) => {
    calls.push([url, options]);
    if (url.endsWith("auth-config.js")) return new Response(config);
    if (url.endsWith("/settings"))
      return Response.json({
        external: { email: true },
        mailer_autoconfirm: false,
      });
    if (url.endsWith("/billing")) {
      assert.deepEqual(JSON.parse(options.body), { action: "catalog" });
      return Response.json({
        environment: "sandbox",
        checkoutReady: false,
        setupRequired: ["Legal operator approval"],
      });
    }
    return new Response("static asset", {
      headers: {
        "content-type": url.endsWith(".js") ? "text/javascript" : "text/html",
      },
    });
  });
  assert.ok(
    checks.some(
      (row) =>
        row.check === "Server-local checkout prerequisites" &&
        row.result === "FAIL",
    ),
  );
  assert.ok(!JSON.stringify(checks).includes(key));
  assert.equal(
    calls.filter(([, options]) => options.method === "POST").length,
    1,
  );
});
test("blocked networks and missing public build config remain explicitly unverified", async () => {
  const checks = await checkStaging(async () => {
    throw new Error("Blocked network with sensitive body omitted");
  });
  assert.ok(checks.every((row) => row.result === "NOT VERIFIED"));
  assert.ok(!JSON.stringify(checks).includes("sensitive"));
});
