import { test } from "node:test";
import assert from "node:assert/strict";
import {
  makeHandler,
  normalizeJobs,
} from "../supabase/functions/_shared/handlers.mjs";
const identity = {
  id: "owner-a",
  email: "test@example.com",
  email_confirmed_at: "2026-01-01",
  last_sign_in_at: "2026-10-26T12:00:00Z",
};
function harness(options = {}) {
  const calls = [];
  const requests = [];
  const values = {
    SUPABASE_URL: "https://test.supabase.co",
    SUPABASE_ANON_KEY: "public-test-key",
    SUPABASE_SERVICE_ROLE_KEY: "server-test-only-key",
    OPENAI_API_KEY: "ai-server-test-only",
    ...options.env,
  };
  const client = {
    auth: {
      getUser: async () => ({
        data: { user: options.user === undefined ? identity : options.user },
        error: options.authError,
      }),
      admin: {
        deleteUser: async (id) => {
          calls.push(["deleteUser", id]);
          return {};
        },
        getUserById: async () => ({ data: { user: identity } }),
      },
    },
    rpc: async (name, args) => {
      calls.push([name, args]);
      if (options.rpc) {
        const result = options.rpc(name, args);
        if (result !== undefined) return result;
      }
      if (name === "reserve_ai_usage")
        return options.limit ? { error: { message: "limit" } } : { data: 1 };
      if (name === "load_workspace")
        return {
          data: {
            profile: {
              display_name: "Authorized Name",
              title: "Engineer",
              country: "Brazil",
            },
            goals: [{ title: "Authorized goal" }],
            milestones: [],
            aiHistory: [],
          },
        };
      return { data: options.reserve ?? true };
    },
    from: (table) => {
      let operation = "select";
      const q = {};
      for (const method of [
        "select",
        "eq",
        "maybeSingle",
        "single",
        "limit",
        "lte",
        "range",
      ])
        q[method] = (...args) => {
          calls.push([table, method, ...args]);
          return q;
        };
      for (const method of ["insert", "update", "upsert", "delete"])
        q[method] = (...args) => {
          operation = method;
          calls.push([table, method, ...args]);
          return q;
        };
      q.then = (resolve, reject) =>
        Promise.resolve(
          options.resolve?.(table, operation) ?? {
            data:
              table === "user_profiles"
                ? { age_band: options.age ?? "18+" }
                : table === "provider_cache"
                  ? (options.cache ?? null)
                  : [],
          },
        ).then(resolve, reject);
      return q;
    },
  };
  return {
    calls,
    requests,
    handler: (kind) =>
      makeHandler(kind, {
        env: (name) => values[name],
        createClient: () => client,
        now: () => new Date("2026-10-26T12:01:00Z"),
        fetch: async (url, init) => {
          requests.push([url, init]);
          return options.fetch
            ? options.fetch(url, init)
            : new Response(
                JSON.stringify({ output_text: "A practical career plan." }),
                { status: 200 },
              );
        },
      }),
  };
}
const request = (
  body = {},
  token = true,
  origin = "https://theskullguy499-sketch.github.io",
) =>
  new Request("https://test.supabase.co/functions/v1/test", {
    method: "POST",
    headers: {
      Origin: origin,
      "Content-Type": "application/json",
      ...(token ? { Authorization: "Bearer user-token" } : {}),
    },
    body: JSON.stringify({ expected_user: "owner-a", ...body }),
  });
test("CORS, confirmed authentication and real configuration are enforced", async () => {
  assert.equal(
    (
      await harness().handler("ai-coach")(
        request({}, true, "https://attacker.example"),
      )
    ).status,
    403,
  );
  assert.equal(
    (await harness().handler("ai-coach")(request({}, false))).status,
    401,
  );
  assert.equal(
    (
      await harness({
        user: { ...identity, email_confirmed_at: null },
      }).handler("ai-coach")(request())
    ).status,
    401,
  );
  const h = harness({ env: { OPENAI_API_KEY: "" } });
  assert.equal(
    (await h.handler("ai-coach")(request({ prompt: "Help me" }))).status,
    503,
  );
  assert.equal(h.requests.length, 0);
});
test("AI uses the official endpoint with bounded costs and no context/history without consent", async () => {
  const h = harness();
  const response = await h.handler("ai-coach")(
    request({ prompt: "Help plan my study" }),
  );
  assert.equal(response.status, 200);
  const body = await response.json();
  assert.equal(body.provider, "OpenAI");
  assert.equal(body.remaining, 9);
  assert.equal(h.requests[0][0], "https://api.openai.com/v1/responses");
  const sent = JSON.parse(h.requests[0][1].body);
  assert.equal(sent.store, false);
  assert.equal(sent.max_output_tokens, 1200);
  assert.equal(sent.model, "gpt-4.1-mini");
  assert.ok(!sent.input[0].content.includes("Authorized"));
  assert.ok(!h.calls.some((c) => c[0] === "ai_planning_history"));
  assert.ok(!JSON.stringify(body).includes("ai-server-test-only"));
});
test("AI age policy, usage limit, provider failures and explicit history consent", async () => {
  const young = harness({ age: "" });
  assert.equal(
    (await young.handler("ai-coach")(request({ prompt: "Help me" }))).status,
    403,
  );
  assert.equal(young.requests.length, 0);
  const limited = harness({ limit: true });
  assert.equal(
    (await limited.handler("ai-coach")(request({ prompt: "Help me" }))).status,
    429,
  );
  assert.equal(limited.requests.length, 0);
  const fail = harness({ fetch: () => new Response("{}", { status: 503 }) });
  assert.equal(
    (await fail.handler("ai-coach")(request({ prompt: "Help me" }))).status,
    502,
  );
  const saved = harness();
  assert.equal(
    (
      await saved.handler("ai-coach")(
        request({
          prompt: "Help me",
          consent: { profile: true, goals: true, history: true },
        }),
      )
    ).status,
    200,
  );
  const input = JSON.parse(saved.requests[0][1].body).input[0].content;
  assert.ok(input.includes("Authorized Name"));
  assert.ok(
    saved.calls.some(
      (c) => c[0] === "ai_planning_history" && c[1] === "insert",
    ),
  );
});
test("job source is real, bounded, attributed, cached and never replaced by demo vacancies", async () => {
  const jobs = normalizeJobs({
    jobs: [
      {
        id: 1,
        title: "Engineer",
        company_name: "Real source company",
        url: "https://remotive.com/remote-jobs/1",
        description: "Do not copy HTML",
        candidate_required_location: "Worldwide",
        tags: ["JavaScript"],
      },
      { id: 2, title: "Bad", company_name: "Bad", url: "javascript:alert(1)" },
    ],
  });
  assert.equal(jobs.length, 1);
  assert.equal(jobs[0].source, "Remotive");
  assert.ok(!("description" in jobs[0]));
  const fresh = harness({
    cache: { payload: { jobs }, fetched_at: "2026-10-26T11:00:00Z" },
  });
  assert.equal((await fresh.handler("job-explorer")(request())).status, 200);
  assert.equal(fresh.requests.length, 0);
  const retrieved = harness({
    fetch: () =>
      new Response(
        JSON.stringify({
          jobs: [
            {
              id: 1,
              title: "Engineer",
              company_name: "Company",
              url: "https://remotive.com/remote-jobs/1",
            },
          ],
        }),
      ),
  });
  const result = await retrieved.handler("job-explorer")(request());
  assert.equal(result.status, 200);
  assert.equal(
    retrieved.requests[0][0],
    "https://remotive.com/api/remote-jobs?limit=100",
  );
  assert.ok(retrieved.calls.some((c) => c[0] === "reserve_job_refresh"));
  const denied = harness({ reserve: false });
  assert.equal((await denied.handler("job-explorer")(request())).status, 503);
  assert.equal(denied.requests.length, 0);
});
test("account deletion is bound to server-verified identity, recent login and explicit confirmation", async () => {
  const h = harness();
  assert.equal(
    (
      await h.handler("delete-account")(
        request({ confirmation: "DELETE", user_id: "attacker-target" }),
      )
    ).status,
    200,
  );
  assert.deepEqual(
    h.calls.find((c) => c[0] === "deleteUser"),
    ["deleteUser", "owner-a"],
  );
  assert.equal(
    (await harness().handler("delete-account")(request({}))).status,
    400,
  );
  assert.equal(
    (
      await harness({
        user: { ...identity, last_sign_in_at: "2020-01-01" },
      }).handler("delete-account")(request({ confirmation: "DELETE" }))
    ).status,
    403,
  );
});
test("scheduler cannot be invoked with a browser session or a missing server secret", async () => {
  assert.equal(
    (await harness().handler("reminder-worker")(request())).status,
    401,
  );
});
test("protected functions reject an account-switch identity mismatch", async () => {
  const h = harness();
  assert.equal(
    (
      await h.handler("delete-account")(
        request({ confirmation: "DELETE", expected_user: "different-owner" }),
      )
    ).status,
    403,
  );
  assert.ok(!h.calls.some((c) => c[0] === "deleteUser"));
});
test("scheduled email digests use the verified opt-in, private outbox and stable retry key", async () => {
  const secret = "server-only-test-secret-at-least-32-characters";
  const h = harness({
    env: {
      REMINDER_CRON_SECRET: secret,
      RESEND_API_KEY: "server-email-test-key",
      REMINDER_FROM: "test@example.invalid",
    },
    rpc: (name) =>
      name === "claim_reminder_emails"
        ? {
            data: [
              {
                id: "digest-1",
                user_id: "owner-a",
                attempts: 1,
                payload: [{ title: "Practice", date: "2026-10-26" }],
              },
            ],
          }
        : undefined,
    resolve: (table, operation) => ({
      data:
        table === "tasks"
          ? [
              {
                id: "task-1",
                user_id: "owner-a",
                title: "Practice",
                due_date: "2026-10-26",
              },
            ]
          : table === "notifications"
            ? [{ id: "notice" }]
            : table === "user_preferences"
              ? { data: { emailReminders: true } }
              : table === "user_profiles"
                ? { age_band: "18+" }
                : [],
    }),
  });
  const req = request();
  req.headers.set("X-Reminder-Secret", secret);
  const result = await h.handler("reminder-worker")(req);
  assert.equal(result.status, 200);
  assert.equal((await result.json()).emailed, 1);
  assert.equal(h.requests[0][0], "https://api.resend.com/emails");
  assert.equal(
    h.requests[0][1].headers["Idempotency-Key"],
    "launchpad:digest-1",
  );
  assert.ok(
    h.calls.some(
      (c) =>
        c[0] === "reminder_outbox" &&
        c[1] === "update" &&
        c[2].status === "sent",
    ),
  );
});
