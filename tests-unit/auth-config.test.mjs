import { test } from "node:test";
import assert from "node:assert/strict";
import { validatePublicAuth, publicKeyKind } from "../lib/public-auth.mjs";
import { parseAuthCallback } from "../lib/auth-callback.mjs";
const url = "https://oyatshlhqdxosvbelsvp.supabase.co";
const jwt = (role, ref = "oyatshlhqdxosvbelsvp") =>
  [
    Buffer.from(JSON.stringify({ alg: "HS256", typ: "JWT" })).toString(
      "base64url",
    ),
    Buffer.from(JSON.stringify({ iss: "supabase", role, ref })).toString(
      "base64url",
    ),
    "notARealSignature",
  ].join(".");
test("public Auth config accepts publishable and project-matched legacy anon keys without authorizing sessions", () => {
  assert.equal(
    validatePublicAuth({
      supabaseUrl: url,
      publishableKey: "sb_publishable_fixture",
    }),
    "configured",
  );
  assert.equal(publicKeyKind(jwt("anon"), url), "anon");
  assert.equal(
    validatePublicAuth({ supabaseUrl: url, publishableKey: jwt("anon") }),
    "configured",
  );
  assert.equal(
    validatePublicAuth({ supabaseUrl: "", publishableKey: "" }),
    "guest",
  );
});
test("public Auth config rejects privileged, wrong-project, malformed and partial credentials", () => {
  for (const key of [
    jwt("service_role"),
    jwt("authenticated"),
    jwt("anon", "anotherproject"),
    "sb_secret_fixture",
    "abc.def.ghi",
    "",
  ])
    assert.throws(() =>
      validatePublicAuth({ supabaseUrl: url, publishableKey: key }),
    );
  assert.throws(() =>
    validatePublicAuth({
      supabaseUrl: "",
      publishableKey: "sb_publishable_fixture",
    }),
  );
  assert.throws(() =>
    validatePublicAuth({
      supabaseUrl: url,
      publishableKey: "sb_publishable_fixture",
      secret: "never-allow-extra-fields",
    }),
  );
});
test("Auth callbacks accept email/recovery fragments, query templates and same-browser PKCE", () => {
  for (const prefix of ["#", "?"])
    for (const type of ["email", "signup", "recovery"])
      assert.deepEqual(
        parseAuthCallback(
          `https://staging.example/auth/callback.html${prefix}token_hash=one-time-hash&type=${type}`,
        ),
        { tokenHash: "one-time-hash", type, code: null },
      );
  assert.deepEqual(
    parseAuthCallback(
      "https://staging.example/auth/callback.html?code=one-time-pkce&next=https://evil.example",
    ),
    { code: "one-time-pkce", tokenHash: null, type: null },
  );
});
test("Auth callbacks reject ambiguous credentials, forged recovery flags and provider errors", () => {
  for (const suffix of [
    "",
    "?auth=recovery",
    "#access_token=forged&type=recovery",
    "?token_hash=x&type=recovery#token_hash=y",
    "?code=x&token_hash=y&type=email",
    "?code=x&code=y",
    "?token_hash=x&type=unknown",
    "?error_code=otp_expired&code=x",
    "?token_hash=x&type=email#type=recovery",
  ])
    assert.throws(() =>
      parseAuthCallback("https://staging.example/auth/callback.html" + suffix),
    );
});
