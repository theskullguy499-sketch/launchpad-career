import { test } from "node:test";
import assert from "node:assert/strict";
import { createHmac } from "node:crypto";
import {
  verifyPaddleSignature,
  paddleSnapshot,
  makeBillingHandler,
  signPlanQuote,
  verifyPlanQuote,
} from "../supabase/functions/_shared/billing.mjs";
import { PLANS } from "../lib/plans.mjs";
const owner = {
  id: "00000000-0000-4000-8000-000000000001",
  email: "fixture@example.com",
  email_confirmed_at: "2026-01-01",
};
const at = new Date("2026-10-27T12:00:00Z"),
  secret = "fixture-signing-secret-at-least-32-characters";
const price = {
  id: "pri_pro",
  status: "active",
  unit_price: { amount: "900", currency_code: "USD" },
  billing_cycle: { interval: "month", frequency: 1 },
};
const subscription = {
  id: "sub_owner",
  customer_id: "ctm_owner",
  status: "active",
  items: [{ quantity: 1, price }],
  updated_at: at.toISOString(),
  current_billing_period: {
    starts_at: at.toISOString(),
    ends_at: "2026-11-27T12:00:00Z",
  },
};
function signed(raw, ts = at.getTime() / 1000) {
  return `ts=${ts};h1=${createHmac("sha256", secret).update(`${ts}:${raw}`).digest("hex")}`;
}
test("Paddle signatures cover raw bytes, rotations, timestamp replay and malformed headers", async () => {
  const raw = '{"event_id":"evt_fixture"}';
  const sig = signed(raw);
  assert.equal(
    await verifyPaddleSignature(raw, sig, secret, at.getTime()),
    true,
  );
  for (const [body, header, time] of [
    [raw + " ", sig, at.getTime()],
    [raw, sig, at.getTime() + 301000],
    [raw, sig, at.getTime() - 301000],
    [raw, sig + ";ts=1793102400", at.getTime()],
    [raw, "ts=bad;h1=no", at.getTime()],
  ])
    assert.equal(
      await verifyPaddleSignature(body, header, secret, time),
      false,
    );
  assert.equal(
    await verifyPaddleSignature(
      raw,
      sig + ";h1=" + "0".repeat(64),
      secret,
      at.getTime(),
    ),
    true,
  );
});
test("Paddle snapshots accept only reviewed monthly USD prices and supported lifecycle states", () => {
  const map = { pro: "pri_pro", premium: "pri_premium" };
  assert.equal(paddleSnapshot(subscription, map, PLANS).plan, "pro");
  for (const data of [
    { ...subscription, items: [] },
    { ...subscription, items: [{ quantity: 2, price }] },
    {
      ...subscription,
      items: [
        {
          quantity: 1,
          price: {
            ...price,
            unit_price: { amount: "1", currency_code: "USD" },
          },
        },
      ],
    },
    { ...subscription, status: "forged" },
    { ...subscription, current_billing_period: null },
  ])
    assert.throws(() => paddleSnapshot(data, map, PLANS));
});
function fixture(options = {}) {
  const tables = {
    commercial_settings: [
      { id: true, enabled: true, environment: "sandbox", plans: PLANS },
    ],
    billing_customers: [
      { user_id: owner.id, customer_id: "ctm_owner", environment: "sandbox" },
    ],
    billing_subscriptions: options.subscriptions || [],
    billing_events: [],
    billing_operations: [],
    business_admins: [],
    user_profiles: [{ id: owner.id, age_band: options.age || "18+" }],
    ai_token_usage: [],
    ...options.tables,
  };
  const calls = [],
    requests = [];
  const client = {
    auth: {
      getUser: async () => ({
        data: { user: options.user === undefined ? owner : options.user },
      }),
    },
    from(table) {
      let filters = [],
        op = "select",
        value,
        single = false,
        limit;
      const q = {};
      for (const name of ["select", "order"]) q[name] = () => q;
      q.eq = (k, v) => {
        filters.push([k, v]);
        return q;
      };
      q.limit = (n) => {
        limit = n;
        return q;
      };
      q.range = () => q;
      q.single = q.maybeSingle = () => {
        single = true;
        return q;
      };
      for (const name of ["update", "insert", "upsert"])
        q[name] = (v) => {
          op = name;
          value = v;
          return q;
        };
      q.delete = () => {
        op = "delete";
        return q;
      };
      q.then = (resolve, reject) =>
        Promise.resolve()
          .then(() => {
            let rows = (tables[table] || []).filter((row) =>
              filters.every(
                ([k, v]) =>
                  (k.includes("->>")
                    ? row[k.split("->>")[0]]?.[k.split("->>")[1]]
                    : row[k]) === v,
              ),
            );
            if (op === "insert" || op === "upsert") {
              (tables[table] ||= []).push(value);
              rows = [value];
            }
            if (op === "update")
              rows.forEach((row) => Object.assign(row, value));
            if (op === "delete")
              tables[table] = (tables[table] || []).filter(
                (row) => !rows.includes(row),
              );
            if (limit) rows = rows.slice(0, limit);
            return { data: single ? rows[0] || null : rows };
          })
          .then(resolve, reject);
      return q;
    },
    rpc: async (name, args) => {
      calls.push([name, args]);
      if (name === "commercial_entitlement")
        return {
          data: {
            enabled: true,
            environment: "sandbox",
            plan: "free",
            catalog: PLANS,
            limits: PLANS.free,
            aiUsed: 0,
            aiRemaining: 0,
          },
        };
      if (name === "complete_billing_operation")
        return { data: args.operation_result };
      if (name === "reserve_billing_operation")
        return { data: { cached: false } };
      if (name === "apply_paddle_snapshot") {
        tables.billing_events.push({ event_id: args.event.id });
        return { data: true };
      }
      return { data: {} };
    },
  };
  const values = {
    SUPABASE_URL: "https://fixture.supabase.co",
    SUPABASE_PUBLISHABLE_KEY: "sb_publishable_fixture",
    SUPABASE_SERVICE_ROLE_KEY: "server-secret-fixture",
    PADDLE_API_KEY: "server-paddle-fixture",
    PADDLE_WEBHOOK_SECRET: secret,
    PADDLE_CLIENT_TOKEN: "test_public-fixture",
    PADDLE_PRICE_PRO: "pri_pro",
    PADDLE_PRICE_PREMIUM: "pri_premium",
    PADDLE_ENVIRONMENT: "sandbox",
    PUBLIC_SITE_URL: "https://commercial.example/",
    ALLOWED_ORIGINS: "https://commercial.example",
    BILLING_TERMS_VERSION: "test-reviewed-v1",
    BILLING_CHECKOUT_ENABLED: "true",
    BILLING_LEGAL_APPROVED: "true",
    BUSINESS_NAME: "Fixture business",
    PUBLIC_SUPPORT_EMAIL: "support@example.com",
    ...options.env,
  };
  const handler = (kind) =>
    makeBillingHandler(kind, {
      env: (k) => values[k],
      createClient: () => client,
      now: () => at,
      fetch: async (url, init) => {
        requests.push([url, init]);
        if (options.fetch) return options.fetch(url, init);
        const path = new URL(url).pathname;
        let data = path.startsWith("/prices/")
          ? path.endsWith("pri_premium")
            ? {
                ...price,
                id: "pri_premium",
                unit_price: { amount: "1900", currency_code: "USD" },
              }
            : price
          : path.startsWith("/transactions/") && init.method === "GET"
            ? {
                id: path.split("/").at(-1),
                customer_id: "ctm_owner",
                status: "ready",
                items: [{ price, quantity: 1 }],
              }
            : path.startsWith("/subscriptions/") && init.method === "GET"
              ? subscription
              : path.endsWith("/portal-sessions")
                ? {
                    urls: {
                      general: {
                        overview:
                          "https://sandbox-customer-portal.paddle.com/cpl_fixture",
                      },
                    },
                  }
                : path === "/transactions"
                  ? { id: "txn_fixture" }
                  : { id: "ctm_owner" };
        return Response.json({ data });
      },
    });
  const req = (body = {}, headers = {}) =>
    new Request("https://backend.example/billing", {
      method: "POST",
      headers: {
        Origin: "https://commercial.example",
        Authorization: "Bearer verified-token",
        "Content-Type": "application/json",
        ...headers,
      },
      body: JSON.stringify({
        expected_user: owner.id,
        termsVersion: "test-reviewed-v1",
        ...body,
      }),
    });
  return { handler, req, tables, calls, requests };
}
test("billing authenticates owners, rejects minors, live defaults and client-chosen permissions", async () => {
  let f = fixture();
  assert.equal(
    (
      await f.handler("billing")(
        f.req({ action: "status", expected_user: "other" }),
      )
    ).status,
    409,
  );
  f = fixture({ user: { ...owner, email_confirmed_at: null } });
  assert.equal(
    (await f.handler("billing")(f.req({ action: "status" }))).status,
    401,
  );
  f = fixture({ age: "16-17" });
  assert.equal(
    (
      await f.handler("billing")(
        f.req({ action: "checkout", plan: "premium", contractConsent: true }),
      )
    ).status,
    403,
  );
  assert.equal(f.requests.length, 0);
  f = fixture();
  assert.equal(
    (await f.handler("billing")(f.req({ action: "admin" }))).status,
    403,
  );
  assert.equal(
    (
      await f.handler("billing")(
        f.req({ action: "status" }, { Origin: "https://evil.example" }),
      )
    ).status,
    403,
  );
  f = fixture({ env: { PADDLE_ENVIRONMENT: "live" } });
  const r = await f.handler("billing")(
    f.req({
      action: "checkout",
      plan: "pro",
      contractConsent: true,
      requestId: crypto.randomUUID(),
    }),
  );
  assert.equal(r.status, 503);
  assert.equal(f.requests.length, 0);
});
test("sandbox checkout derives prices/customer from verified owner and exposes no server secrets", async () => {
  const f = fixture();
  const r = await f.handler("billing")(
    f.req({
      action: "checkout",
      plan: "pro",
      contractConsent: true,
      requestId: crypto.randomUUID(),
      customer_id: "ctm_victim",
      price_id: "pri_fake",
      entitlement: "premium",
    }),
  );
  assert.equal(r.status, 200);
  const result = await r.json();
  assert.equal(result.transactionId, "txn_fixture");
  assert.equal(result.clientToken, "test_public-fixture");
  const transaction = f.requests.find(([url]) => url.endsWith("/transactions"));
  assert.equal(new URL(transaction[0]).hostname, "sandbox-api.paddle.com");
  assert.deepEqual(JSON.parse(transaction[1].body).items, [
    { price_id: "pri_pro", quantity: 1 },
  ]);
  assert.equal(JSON.parse(transaction[1].body).customer_id, "ctm_owner");
  assert.ok(!JSON.stringify(result).includes("server-"));
  assert.equal(f.tables.billing_subscriptions.length, 0);
});
test("portal, preview, cancellation and changes use only the owner subscription", async () => {
  const f = fixture({
    subscriptions: [
      {
        user_id: owner.id,
        environment: "sandbox",
        subscription_id: "sub_owner",
        status: "active",
        provider_updated_at: at.toISOString(),
      },
    ],
  });
  assert.equal(
    (await f.handler("billing")(f.req({ action: "portal" }))).status,
    200,
  );
  assert.equal(
    (
      await f.handler("billing")(
        f.req({
          action: "preview_plan",
          plan: "premium",
          contractConsent: true,
        }),
      )
    ).status,
    200,
  );
  assert.equal(
    (
      await f.handler("billing")(
        f.req({
          action: "cancel",
          subscription_id: "sub_victim",
          requestId: crypto.randomUUID(),
        }),
      )
    ).status,
    200,
  );
  const request = f.requests.find(([url]) => url.endsWith("/cancel"));
  assert.ok(request[0].includes("sub_owner"));
  assert.equal(
    JSON.parse(request[1].body).effective_from,
    "next_billing_period",
  );
});
test("webhooks require signatures and obtain canonical provider snapshots before atomic idempotent processing", async () => {
  const f = fixture(),
    body = {
      event_id: "evt_fixture",
      event_type: "subscription.activated",
      occurred_at: at.toISOString(),
      data: {
        id: "sub_owner",
        customer_id: "ctm_victim",
        custom_data: { launchpad_user_id: "victim" },
      },
    },
    raw = JSON.stringify(body);
  const req = () =>
    new Request("https://backend.example/webhook", {
      method: "POST",
      headers: { "Paddle-Signature": signed(raw) },
      body: raw,
    });
  assert.equal(
    (
      await f.handler("paddle-webhook")(
        new Request("https://backend.example/webhook", {
          method: "POST",
          body: raw,
        }),
      )
    ).status,
    401,
  );
  assert.equal((await f.handler("paddle-webhook")(req())).status, 200);
  const applied = f.calls.find(([name]) => name === "apply_paddle_snapshot");
  assert.equal(applied[1].snapshot.customerId, "ctm_owner");
  assert.equal(
    (await (await f.handler("paddle-webhook")(req())).json()).duplicate,
    true,
  );
  assert.equal(
    f.calls.filter(([name]) => name === "apply_paddle_snapshot").length,
    1,
  );
});
test("uncertain provider failures are recorded and never presented as payment success", async () => {
  const f = fixture({
    fetch: () => {
      throw new Error("Provider transport unavailable");
    },
  });
  const r = await f.handler("billing")(
    f.req({
      action: "checkout",
      plan: "pro",
      contractConsent: true,
      requestId: crypto.randomUUID(),
    }),
  );
  assert.equal(r.status, 503);
  assert.ok((await r.json()).error);
  assert.equal(f.tables.billing_subscriptions.length, 0);
});

test("plan-change quotes are signed, owner-bound, scoped and expire", async () => {
  const payload = {
    user: owner.id,
    subscription: "sub_owner",
    plan: "premium",
    amount: 1900,
    expiresAt: at.getTime() + 300000,
  };
  const token = await signPlanQuote(payload, secret);
  assert.ok(
    await verifyPlanQuote(
      token,
      secret,
      { user: owner.id, plan: "premium", amount: 1900 },
      at.getTime(),
    ),
  );
  assert.equal(
    await verifyPlanQuote(
      token,
      secret,
      { user: "another-owner" },
      at.getTime(),
    ),
    null,
  );
  assert.equal(
    await verifyPlanQuote(token, secret, { amount: 1 }, at.getTime()),
    null,
  );
  assert.equal(
    await verifyPlanQuote(token + "bad", secret, {}, at.getTime()),
    null,
  );
  assert.equal(
    await verifyPlanQuote(token, secret, {}, at.getTime() + 300001),
    null,
  );
});
test("payment-link resumption requires an owned transaction and reviewed current consent", async () => {
  const f = fixture({
    tables: {
      billing_operations: [
        {
          id: crypto.randomUUID(),
          user_id: owner.id,
          action: "checkout",
          state: "complete",
          result: { transactionId: "txn_owned" },
        },
        {
          id: crypto.randomUUID(),
          user_id: "other-user",
          action: "checkout",
          state: "complete",
          result: { transactionId: "txn_victim" },
        },
      ],
    },
  });
  assert.equal(
    (
      await f.handler("billing")(
        f.req({
          action: "resume_checkout",
          transactionId: "txn_victim",
          contractConsent: true,
        }),
      )
    ).status,
    403,
  );
  const result = await f.handler("billing")(
    f.req({
      action: "resume_checkout",
      transactionId: "txn_owned",
      contractConsent: true,
    }),
  );
  assert.equal(result.status, 200);
  assert.equal((await result.json()).transactionId, "txn_owned");
});

test("signed sandbox simulator events acknowledge receipt without any backend or paid-access side effects", async () => {
  for (const type of ["subscription.activated", "transaction.completed"]) {
    const raw = JSON.stringify({
      event_id: "ntfsimevt_01jfixture123",
      event_type: type,
      occurred_at: at.toISOString(),
      data: {
        id: "sub_owner",
        subscription_id: "sub_owner",
        customer_id: "ctm_owner",
        status: "active",
      },
    });
    const handler = makeBillingHandler("paddle-webhook", {
      env: (k) =>
        ({ PADDLE_ENVIRONMENT: "sandbox", PADDLE_WEBHOOK_SECRET: secret })[k],
      now: () => at,
      createClient: () =>
        assert.fail(
          "Simulations must not access the database or grant entitlements",
        ),
      fetch: () =>
        assert.fail(
          "Simulations must not request provider data or create payments",
        ),
    });
    for (let delivery = 0; delivery < 2; delivery++) {
      const response = await handler(
        new Request("https://backend.example/webhook", {
          method: "POST",
          headers: { "Paddle-Signature": signed(raw) },
          body: raw,
        }),
      );
      assert.equal(response.status, 200);
      assert.deepEqual(await response.json(), {
        received: true,
        simulated: true,
        processed: false,
      });
    }
  }
});

test("simulator events still require valid raw-body signatures and fresh timestamps", async () => {
  const f = fixture();
  const raw = JSON.stringify({
    event_id: "ntfsimevt_01jfixture123",
    event_type: "subscription.activated",
    occurred_at: at.toISOString(),
    data: { id: "sub_owner" },
  });
  const before = JSON.stringify(f.tables);
  for (const [body, signature] of [
    [raw, ""],
    [raw, "ts=bad;h1=bad"],
    [raw + " ", signed(raw)],
    [raw, signed(raw, at.getTime() / 1000 - 301)],
    [raw, signed(raw, at.getTime() / 1000 + 301)],
  ]) {
    const response = await f.handler("paddle-webhook")(
      new Request("https://backend.example/webhook", {
        method: "POST",
        headers: { "Paddle-Signature": signature },
        body,
      }),
    );
    assert.equal(response.status, 401);
  }
  assert.deepEqual(f.calls, []);
  assert.deepEqual(f.requests, []);
  assert.equal(JSON.stringify(f.tables), before);
});

test("production and unspecified environments reject even correctly signed simulator events", async () => {
  for (const environment of ["live", "production", "", undefined]) {
    const f = fixture({ env: { PADDLE_ENVIRONMENT: environment } });
    const before = JSON.stringify(f.tables);
    const raw = JSON.stringify({
      event_id: "ntfsimevt_01jfixture123",
      event_type: "subscription.activated",
      occurred_at: at.toISOString(),
      data: { id: "sub_owner" },
    });
    const response = await f.handler("paddle-webhook")(
      new Request("https://backend.example/webhook", {
        method: "POST",
        headers: { "Paddle-Signature": signed(raw) },
        body: raw,
      }),
    );
    assert.equal(response.status, 400);
    assert.deepEqual(f.calls, []);
    assert.deepEqual(f.requests, []);
    assert.equal(JSON.stringify(f.tables), before);
  }
});

test("malformed signed webhook envelopes are rejected without ledger or provider access", async () => {
  const f = fixture();
  for (const body of [
    null,
    [],
    {
      event_id: "ntfsimevt_",
      occurred_at: at.toISOString(),
      event_type: "subscription.activated",
    },
    {
      event_id: "ntfsimevt_abc",
      occurred_at: "bad",
      event_type: "subscription.activated",
    },
    {
      event_id: "other_abc",
      occurred_at: at.toISOString(),
      event_type: "subscription.activated",
    },
  ]) {
    const raw = JSON.stringify(body);
    const response = await f.handler("paddle-webhook")(
      new Request("https://backend.example/webhook", {
        method: "POST",
        headers: { "Paddle-Signature": signed(raw) },
        body: raw,
      }),
    );
    assert.equal(response.status, 400);
  }
  assert.deepEqual(f.calls, []);
  assert.deepEqual(f.requests, []);
});

test("checkout readiness fails closed on incomplete site, CORS, environment, prices and legal configuration without exposing secrets", async () => {
  for (const [env, label] of [
    [{ PADDLE_PRICE_PRO: "" }, "Distinct monthly price IDs"],
    [{ PADDLE_PRICE_PREMIUM: "pri_pro" }, "Distinct monthly price IDs"],
    [{ PUBLIC_SITE_URL: "" }, "Configured checkout site"],
    [{ PUBLIC_SITE_URL: "ftp://localhost/" }, "Configured checkout site"],
    [
      { ALLOWED_ORIGINS: "https://commercial.example/path" },
      "Exact site CORS origin",
    ],
    [{ BILLING_CHECKOUT_ENABLED: "false" }, "Checkout operator approval"],
    [{ BILLING_LEGAL_APPROVED: "false" }, "Legal operator approval"],
    [{ BILLING_TERMS_VERSION: "" }, "Reviewed billing terms version"],
    [
      { PADDLE_CLIENT_TOKEN: "live_wrongenvironment" },
      "Environment-matched Paddle client token",
    ],
    [{ PADDLE_ENVIRONMENT: "live" }, "Matching Paddle environment"],
  ]) {
    const f = fixture({ env });
    const response = await f.handler("billing")(
      f.req({ action: "catalog" }, { Origin: "" }),
    );
    assert.equal(response.status, 200);
    const data = await response.json();
    assert.equal(data.checkoutReady, false);
    assert.ok(data.setupRequired.includes(label));
    assert.ok(!JSON.stringify(data).includes(secret));
    assert.ok(!JSON.stringify(data).includes("server-paddle-fixture"));
    assert.equal(f.requests.length, 0);
    assert.equal(f.tables.billing_subscriptions.length, 0);
  }
  const f = fixture({ env: { BILLING_LEGAL_APPROVED: "false" } });
  const response = await f.handler("billing")(
    f.req({
      action: "checkout",
      plan: "pro",
      contractConsent: true,
      requestId: crypto.randomUUID(),
    }),
  );
  assert.equal(response.status, 503);
  assert.equal(f.requests.length, 0);
  assert.equal(f.tables.billing_operations.length, 0);
});

test("authenticated billing status includes the authoritative terms version and readiness for slow catalog responses", async () => {
  const f = fixture();
  const response = await f.handler("billing")(f.req({ action: "status" }));
  assert.equal(response.status, 200);
  const data = await response.json();
  assert.equal(data.termsVersion, "test-reviewed-v1");
  assert.equal(data.checkoutReady, true);
  assert.deepEqual(data.setupRequired, []);
});

test("the known staging host cannot advertise live checkout even with matching live settings and an enabled live flag", async () => {
  const f = fixture({
    env: {
      PADDLE_ENVIRONMENT: "live",
      ALLOW_LIVE_BILLING: "true",
      PADDLE_CLIENT_TOKEN: "live_fixture",
      PUBLIC_SITE_URL: "https://launchpad-career-staging.pages.dev/",
      ALLOWED_ORIGINS: "https://launchpad-career-staging.pages.dev",
    },
    tables: {
      commercial_settings: [
        { id: true, enabled: true, environment: "live", plans: PLANS },
      ],
    },
  });
  const catalog = await (
    await f.handler("billing")(f.req({ action: "catalog" }, { Origin: "" }))
  ).json();
  assert.equal(catalog.checkoutReady, false);
  assert.ok(catalog.setupRequired.includes("Staging is Sandbox-only"));
  const response = await f.handler("billing")(
    f.req(
      {
        action: "checkout",
        plan: "pro",
        contractConsent: true,
        requestId: crypto.randomUUID(),
      },
      { Origin: "https://launchpad-career-staging.pages.dev" },
    ),
  );
  assert.equal(response.status, 503);
  assert.equal(f.requests.length, 0);
  assert.equal(f.tables.billing_operations.length, 0);
});

test("billing activity is owner-filtered and never exposes raw checkout results or claims requests are receipts", async () => {
  const f = fixture({
    tables: {
      billing_operations: [
        {
          id: "own",
          user_id: owner.id,
          action: "checkout",
          plan: "pro",
          state: "complete",
          created_at: at.toISOString(),
          result: {
            confirmedByEvent: "evt_verified_fixture",
            clientToken: "must-not-be-returned",
            url: "https://private.example/portal",
          },
        },
        {
          id: "foreign",
          user_id: "another-user",
          action: "checkout",
          state: "complete",
          result: { clientToken: "foreign-token" },
        },
      ],
    },
  });
  const response = await f.handler("billing")(f.req({ action: "status" }));
  assert.equal(response.status, 200);
  const data = await response.json();
  assert.equal(data.activity.length, 1);
  assert.equal(data.activity[0].id, "own");
  assert.equal(data.activity[0].providerConfirmed, true);
  assert.ok(!JSON.stringify(data.activity).includes("must-not-be-returned"));
  assert.ok(!JSON.stringify(data.activity).includes("private.example"));
  assert.ok(!JSON.stringify(data.activity).includes("foreign"));
});

test("Sandbox provider history uses only the owned customer and returns no card, checkout or foreign data", async () => {
  const f = fixture({
    fetch: (url, init) => {
      const parsed = new URL(url);
      assert.equal(init.method, "GET");
      assert.equal(parsed.pathname, "/transactions");
      assert.equal(parsed.searchParams.get("customer_id"), "ctm_owner");
      assert.equal(parsed.searchParams.get("per_page"), "10");
      return Response.json({
        data: [
          {
            id: "txn_owned",
            customer_id: "ctm_owner",
            status: "completed",
            currency_code: "USD",
            created_at: at.toISOString(),
            details: { totals: { grand_total: "900" } },
            payments: [{ card: { last4: "DO-NOT-RETURN" } }],
            checkout: { url: "https://sensitive.example/" },
          },
        ],
      });
    },
  });
  const response = await f.handler("billing")(
    f.req({ action: "transactions", customer_id: "ctm_victim" }),
  );
  assert.equal(response.status, 200);
  const data = await response.json();
  assert.equal(data.transactions[0].total, "900");
  assert.equal(data.transactions[0].status, "completed");
  assert.equal(data.environment, "sandbox");
  assert.ok(!JSON.stringify(data).includes("DO-NOT-RETURN"));
  assert.ok(!JSON.stringify(data).includes("sensitive.example"));
  assert.equal(
    f.calls.filter(([name]) => name === "apply_paddle_snapshot").length,
    0,
  );
});
test("provider history rejects foreign records and never calls live payment APIs on the new Sandbox endpoint", async () => {
  let f = fixture({
    fetch: () =>
      Response.json({
        data: [
          {
            id: "txn_victim",
            customer_id: "ctm_victim",
            status: "completed",
            currency_code: "USD",
          },
        ],
      }),
  });
  assert.equal(
    (await f.handler("billing")(f.req({ action: "transactions" }))).status,
    503,
  );
  f = fixture({
    env: { PADDLE_ENVIRONMENT: "live" },
    tables: {
      commercial_settings: [
        { id: true, enabled: true, environment: "live", plans: PLANS },
      ],
      billing_customers: [
        { user_id: owner.id, customer_id: "ctm_owner", environment: "live" },
      ],
    },
  });
  assert.equal(
    (await f.handler("billing")(f.req({ action: "transactions" }))).status,
    503,
  );
  assert.equal(f.requests.length, 0);
});

test("an account without a billing customer gets a truthful no-request state instead of a fabricated provider result", async () => {
  const f = fixture({ tables: { billing_customers: [] } });
  const response = await f.handler("billing")(
    f.req({ action: "transactions" }),
  );
  assert.equal(response.status, 200);
  const data = await response.json();
  assert.equal(data.notRequested, true);
  assert.match(data.notice, /has not been contacted/);
  assert.equal(f.requests.length, 0);
});
