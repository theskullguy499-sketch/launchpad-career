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
      event_id: "ntfsimevt_01jfixture123", event_type: type,
      occurred_at: at.toISOString(),
      data: { id: "sub_owner", subscription_id: "sub_owner", customer_id: "ctm_owner", status: "active" },
    });
    const handler = makeBillingHandler("paddle-webhook", {
      env: k => ({ PADDLE_ENVIRONMENT: "sandbox", PADDLE_WEBHOOK_SECRET: secret })[k],
      now: () => at,
      createClient: () => assert.fail("Simulations must not access the database or grant entitlements"),
      fetch: () => assert.fail("Simulations must not request provider data or create payments"),
    });
    for (let delivery = 0; delivery < 2; delivery++) {
      const response = await handler(new Request("https://backend.example/webhook", {
        method: "POST", headers: { "Paddle-Signature": signed(raw) }, body: raw,
      }));
      assert.equal(response.status, 200);
      assert.deepEqual(await response.json(), { received: true, simulated: true, processed: false });
    }
  }
});

test("simulator events still require valid raw-body signatures and fresh timestamps", async () => {
  const f = fixture();
  const raw = JSON.stringify({ event_id: "ntfsimevt_01jfixture123", event_type: "subscription.activated", occurred_at: at.toISOString(), data: { id: "sub_owner" } });
  const before = JSON.stringify(f.tables);
  for (const [body, signature] of [
    [raw, ""], [raw, "ts=bad;h1=bad"], [raw + " ", signed(raw)],
    [raw, signed(raw, at.getTime() / 1000 - 301)],
    [raw, signed(raw, at.getTime() / 1000 + 301)],
  ]) {
    const response = await f.handler("paddle-webhook")(new Request("https://backend.example/webhook", {
      method: "POST", headers: { "Paddle-Signature": signature }, body,
    }));
    assert.equal(response.status, 401);
  }
  assert.deepEqual(f.calls, []); assert.deepEqual(f.requests, []);
  assert.equal(JSON.stringify(f.tables), before);
});

test("production and unspecified environments reject even correctly signed simulator events", async () => {
  for (const environment of ["live", "production", "", undefined]) {
    const f = fixture({ env: { PADDLE_ENVIRONMENT: environment } });
    const before = JSON.stringify(f.tables);
    const raw = JSON.stringify({ event_id: "ntfsimevt_01jfixture123", event_type: "subscription.activated", occurred_at: at.toISOString(), data: { id: "sub_owner" } });
    const response = await f.handler("paddle-webhook")(new Request("https://backend.example/webhook", {
      method: "POST", headers: { "Paddle-Signature": signed(raw) }, body: raw,
    }));
    assert.equal(response.status, 400);
    assert.deepEqual(f.calls, []); assert.deepEqual(f.requests, []);
    assert.equal(JSON.stringify(f.tables), before);
  }
});

test("malformed signed webhook envelopes are rejected without ledger or provider access", async () => {
  const f = fixture();
  for (const body of [null, [], {event_id:"ntfsimevt_",occurred_at:at.toISOString(),event_type:"subscription.activated"}, {event_id:"ntfsimevt_abc",occurred_at:"bad",event_type:"subscription.activated"}, {event_id:"other_abc",occurred_at:at.toISOString(),event_type:"subscription.activated"}]) {
    const raw = JSON.stringify(body);
    const response = await f.handler("paddle-webhook")(new Request("https://backend.example/webhook", {
      method: "POST", headers: { "Paddle-Signature": signed(raw) }, body: raw,
    }));
    assert.equal(response.status, 400);
  }
  assert.deepEqual(f.calls, []); assert.deepEqual(f.requests, []);
});
