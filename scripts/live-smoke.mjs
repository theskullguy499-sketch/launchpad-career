// Optional live checks. No credentials are embedded, printed or written to browser storage.
import { createClient } from "@supabase/supabase-js";
const required = [
  "LIVE_SUPABASE_URL",
  "LIVE_PUBLISHABLE_KEY",
  "LIVE_TEST_EMAIL",
  "LIVE_TEST_PASSWORD",
];
const missing = required.filter((name) => !process.env[name]);
if (missing.length) {
  console.error(
    "NOT RUN: configure these secure environment bindings: " +
      missing.join(", "),
  );
  process.exitCode = 2;
} else {
  const client = createClient(
    process.env.LIVE_SUPABASE_URL,
    process.env.LIVE_PUBLISHABLE_KEY,
    { auth: { persistSession: false, autoRefreshToken: false } },
  );
  try {
    const login = await client.auth.signInWithPassword({
      email: process.env.LIVE_TEST_EMAIL,
      password: process.env.LIVE_TEST_PASSWORD,
    });
    if (login.error)
      throw new Error("Live sign-in failed. No verified result is claimed.");
    const identity = await client.auth.getUser();
    if (identity.error || !identity.data.user?.email_confirmed_at)
      throw new Error("The test identity is not server-confirmed.");
    console.log("PASS: live sign-in and server-confirmed identity.");
    const workspace = await client.rpc("load_workspace");
    if (workspace.error || !Array.isArray(workspace.data?.applications))
      throw new Error(
        "Live workspace load failed. Apply and validate migrations.",
      );
    console.log("PASS: live owned workspace read.");
    if (process.env.LIVE_JOBS === "1") {
      const jobs = await client.functions.invoke("job-explorer", { body: {} });
      if (jobs.error || !Array.isArray(jobs.data?.jobs))
        throw new Error("Live jobs function failed.");
      console.log(
        "PASS: real job provider function response; received " +
          jobs.data.jobs.length +
          " sourced rows.",
      );
    }
    if (process.env.LIVE_AI === "1") {
      const ai = await client.functions.invoke("ai-coach", {
        body: {
          expected_user: identity.data.user.id,
          prompt:
            "Suggest one practical step for preparing a software engineering interview.",
          intent: "advice",
          consent: {
            profile: false,
            goals: false,
            progress: false,
            history: false,
            historyContext: false,
          },
        },
      });
      if (ai.error || typeof ai.data?.response !== "string")
        throw new Error("Live AI function failed.");
      console.log(
        "PASS: real AI provider response (not logged). One usage attempt was consumed.",
      );
    }
    console.log(
      "Email arrival, mailbox confirmation, resend/recovery delivery, write isolation and deployment still require the documented acceptance checklist. This read-only smoke test does not certify them.",
    );
  } catch (error) {
    console.error(error.message);
    process.exitCode = 1;
  } finally {
    await client.auth.signOut({ scope: "local" });
  }
}
