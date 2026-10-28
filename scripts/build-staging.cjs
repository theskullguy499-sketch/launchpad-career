// Dedicated Direct Upload build for the owner's existing staging project.
const { spawnSync } = require("node:child_process");
const expected = "https://oyatshlhqdxosvbelsvp.supabase.co";
if (
  process.env.PUBLIC_SUPABASE_URL &&
  process.env.PUBLIC_SUPABASE_URL.replace(/\/$/, "") !== expected
) {
  console.error(
    "The staging project URL does not match the reviewed project. No artifact was built.",
  );
  process.exitCode = 1;
} else {
  const result = spawnSync(process.execPath, ["scripts/build.cjs"], {
    stdio: "inherit",
    env: {
      ...process.env,
      PUBLIC_SUPABASE_URL: expected,
      REQUIRE_PUBLIC_AUTH_CONFIG: "true",
    },
  });
  process.exitCode = result.status ?? 1;
}
