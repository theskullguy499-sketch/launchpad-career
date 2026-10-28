const { test } = require("node:test");
const assert = require("node:assert/strict");
const validate = require("./public-config.cjs");
const source = (config) =>
  `window.LAUNCHPAD_AUTH_CONFIG=Object.freeze(${JSON.stringify(config)});`;
test("blank public configuration supports guest deployment", () =>
  assert.equal(
    validate(source({ supabaseUrl: "", publishableKey: "" })),
    "guest",
  ));
test("only HTTPS URL and public publishable keys are accepted", () => {
  assert.equal(
    validate(
      source({
        supabaseUrl: "https://example.supabase.co",
        publishableKey: "sb_publishable_PUBLIC_EXAMPLE",
      }),
    ),
    "configured",
  );
  for (const config of [
    {
      supabaseUrl: "https://example.supabase.co",
      publishableKey: "sb_secret_NOT_A_REAL_KEY",
    },
    {
      supabaseUrl: "https://example.supabase.co",
      publishableKey: "legacy-service-role-jwt",
    },
    {
      supabaseUrl: "https://example.supabase.co",
      publishableKey: "sb_publishable_EXAMPLE",
      smtpPassword: "DO_NOT_DEPLOY",
    },
    {
      supabaseUrl: "https://user:password@example.supabase.co",
      publishableKey: "sb_publishable_EXAMPLE",
    },
    {
      supabaseUrl: "http://example.supabase.co",
      publishableKey: "sb_publishable_EXAMPLE",
    },
  ])
    assert.throws(() => validate(source(config)));
});
test("staging build refuses missing public keys and mismatched project URLs without changing committed configuration", () => {
  const { spawnSync } = require("node:child_process");
  const fs = require("node:fs");
  const before = fs.readFileSync("auth-config.js", "utf8");
  const env = {
    ...process.env,
    PUBLIC_SUPABASE_URL: "",
    PUBLIC_PUBLISHABLE_KEY: "",
  };
  let result = spawnSync(process.execPath, ["scripts/build-staging.cjs"], {
    env,
    encoding: "utf8",
  });
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /public|HTTPS/);
  result = spawnSync(process.execPath, ["scripts/build-staging.cjs"], {
    env: {
      ...env,
      PUBLIC_SUPABASE_URL: "https://different.supabase.co",
      PUBLIC_PUBLISHABLE_KEY: "sb_publishable_fixture",
    },
    encoding: "utf8",
  });
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /does not match/);
  assert.equal(fs.readFileSync("auth-config.js", "utf8"), before);
});
