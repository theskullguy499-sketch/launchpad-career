import { billingReadiness } from "./billing-readiness.mjs";
// Official Paddle Billing REST endpoints; WebCrypto verifies the exact signed bytes.
const PRODUCTION_DEMO = "https://theskullguy499-sketch.github.io";
const uuid = (value) =>
  typeof value === "string" &&
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    value,
  );
const checked = async (query) => {
  const r = await query;
  if (r.error) throw new Error(r.error.message || "Database operation failed");
  return r.data;
};
export async function verifyPaddleSignature(
  raw,
  header,
  secret,
  now = Date.now(),
) {
  if (!secret || secret.length < 32 || !header || raw.length > 256000)
    return false;
  const parts = header.split(";").map((part) => part.trim().split("="));
  const timestamps = parts.filter(([key]) => key === "ts");
  if (timestamps.length !== 1 || !/^\d{10}$/.test(timestamps[0][1]))
    return false;
  const ts = Number(timestamps[0][1]);
  if (Math.abs(now / 1000 - ts) > 300) return false;
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["verify"],
  );
  for (const [name, value] of parts)
    if (name === "h1" && /^[0-9a-f]{64}$/i.test(value)) {
      const signature = Uint8Array.from(value.match(/../g), (x) =>
        parseInt(x, 16),
      );
      if (
        await crypto.subtle.verify(
          "HMAC",
          key,
          signature,
          new TextEncoder().encode(`${ts}:${raw}`),
        )
      )
        return true;
    }
  return false;
}
const encode64 = (bytes) =>
  btoa(String.fromCharCode(...bytes))
    .replaceAll("+", "-")
    .replaceAll("/", "_")
    .replace(/=+$/, "");
const decode64 = (text) =>
  Uint8Array.from(atob(text.replaceAll("-", "+").replaceAll("_", "/")), (c) =>
    c.charCodeAt(0),
  );
export async function signPlanQuote(payload, secret) {
  if (!secret || secret.length < 32)
    throw new Error("Webhook/quote signing is not configured");
  const encoded = encode64(new TextEncoder().encode(JSON.stringify(payload)));
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const signature = await crypto.subtle.sign(
    "HMAC",
    key,
    new TextEncoder().encode("launchpad-plan-change:" + encoded),
  );
  return encoded + "." + encode64(new Uint8Array(signature));
}
export async function verifyPlanQuote(
  token,
  secret,
  expected,
  now = Date.now(),
) {
  try {
    if (
      typeof token !== "string" ||
      token.length > 4096 ||
      !secret ||
      secret.length < 32
    )
      return null;
    const [encoded, signature, ...extra] = token.split(".");
    if (extra.length || !signature) return null;
    const key = await crypto.subtle.importKey(
      "raw",
      new TextEncoder().encode(secret),
      { name: "HMAC", hash: "SHA-256" },
      false,
      ["verify"],
    );
    if (
      !(await crypto.subtle.verify(
        "HMAC",
        key,
        decode64(signature),
        new TextEncoder().encode("launchpad-plan-change:" + encoded),
      ))
    )
      return null;
    const payload = JSON.parse(new TextDecoder().decode(decode64(encoded)));
    if (
      !Number.isFinite(payload.expiresAt) ||
      payload.expiresAt < now ||
      payload.expiresAt > now + 300000
    )
      return null;
    for (const [key, value] of Object.entries(expected))
      if (payload[key] !== value) return null;
    return payload;
  } catch {
    return null;
  }
}
export function paddleSnapshot(data, mapping, catalog) {
  if (
    !data ||
    !/^sub_[a-z0-9]+$/i.test(data.id) ||
    !/^ctm_[a-z0-9]+$/i.test(data.customer_id) ||
    !["active", "trialing", "past_due", "paused", "canceled"].includes(
      data.status,
    ) ||
    !Array.isArray(data.items) ||
    data.items.length !== 1
  )
    throw new Error("Unsupported subscription snapshot");
  const item = data.items[0],
    plan = Object.keys(mapping).find((key) => mapping[key] === item.price?.id);
  const config = catalog[plan];
  if (
    !config ||
    item.quantity !== 1 ||
    item.price.unit_price?.currency_code !== "USD" ||
    Number(item.price.unit_price?.amount) !== config.monthlyCents ||
    item.price.billing_cycle?.interval !== "month" ||
    item.price.billing_cycle?.frequency !== 1
  )
    throw new Error("Subscription price does not match the reviewed catalog");
  const date = (value, required = false) => {
    if (!value && !required) return null;
    if (!value || !Number.isFinite(Date.parse(value)))
      throw new Error("Invalid provider date");
    return new Date(value).toISOString();
  };
  return {
    id: data.id,
    customerId: data.customer_id,
    plan,
    status: data.status,
    periodStart: date(data.current_billing_period?.starts_at),
    periodEnd: date(
      data.current_billing_period?.ends_at,
      data.status === "active",
    ),
    cancelAt: date(
      data.scheduled_change?.action === "cancel"
        ? data.scheduled_change.effective_at
        : null,
    ),
    unitAmount: config.monthlyCents,
    currency: "USD",
    updatedAt: date(data.updated_at, true),
  };
}
export function makeBillingHandler(
  kind,
  {
    env,
    createClient,
    fetch: request = globalThis.fetch,
    now = () => new Date(),
  },
) {
  const environment = env("PADDLE_ENVIRONMENT") || "sandbox";
  const mapping = {
    pro: env("PADDLE_PRICE_PRO"),
    premium: env("PADDLE_PRICE_PREMIUM"),
  };
  const site = env("PUBLIC_SITE_URL");
  const origins = new Set(
    (env("ALLOWED_ORIGINS") || PRODUCTION_DEMO).split(",").map((s) => s.trim()),
  );
  async function provider(path, method = "GET", body) {
    if (!env("PADDLE_API_KEY") || !["sandbox", "live"].includes(environment))
      throw new Error("Paddle sandbox is not configured");
    if (
      environment === "live" &&
      env("ALLOW_LIVE_BILLING") !== "true" &&
      method !== "GET" &&
      !path.endsWith("/cancel") &&
      !path.endsWith("/portal-sessions") &&
      !path.endsWith("/preview")
    )
      throw new Error("Live charges are disabled");
    const response = await request(
      `https://${environment === "sandbox" ? "sandbox-api" : "api"}.paddle.com${path}`,
      {
        method,
        headers: {
          Authorization: `Bearer ${env("PADDLE_API_KEY")}`,
          "Content-Type": "application/json",
          "Paddle-Version": "1",
        },
        body: body ? JSON.stringify(body) : undefined,
        signal: AbortSignal.timeout(20000),
      },
    );
    if (!response.ok)
      throw new Error(
        "Paddle could not complete the operation. Check the portal before retrying.",
      );
    const result = await response.json();
    if (!result.data) throw new Error("Paddle returned no usable data");
    return result.data;
  }
  return async (req) => {
    const headers = {
      "Content-Type": "application/json",
      "Cache-Control": "no-store",
      Vary: "Origin",
    };
    const origin = req.headers.get("Origin");
    if (origin && origins.has(origin))
      Object.assign(headers, {
        "Access-Control-Allow-Origin": origin,
        "Access-Control-Allow-Headers":
          "authorization,apikey,content-type,x-client-info",
        "Access-Control-Allow-Methods": "POST,OPTIONS",
      });
    const respond = (data, status = 200) =>
      new Response(JSON.stringify(data), { status, headers });
    if (kind !== "paddle-webhook" && origin && !origins.has(origin))
      return respond({ error: "This origin is not allowed." }, 403);
    if (req.method === "OPTIONS" && kind !== "paddle-webhook")
      return new Response(null, { status: 204, headers });
    if (req.method !== "POST") return respond({ error: "Use POST." }, 405);
    try {
      if (Number(req.headers.get("content-length") || 0) > 256000)
        return respond({ error: "Request too large." }, 413);
      const chunks = [];
      let size = 0;
      const reader = req.body?.getReader();
      if (reader)
        while (true) {
          const part = await reader.read();
          if (part.done) break;
          size += part.value.byteLength;
          if (size > 256000) {
            await reader.cancel();
            return respond({ error: "Request too large." }, 413);
          }
          chunks.push(part.value);
        }
      const bytes = new Uint8Array(size);
      let offset = 0;
      for (const chunk of chunks) {
        bytes.set(chunk, offset);
        offset += chunk.length;
      }
      let raw;
      try {
        raw = new TextDecoder("utf-8", { fatal: true }).decode(bytes);
      } catch {
        return respond({ error: "Invalid UTF-8." }, 400);
      }
      if (
        kind === "paddle-webhook" &&
        !(await verifyPaddleSignature(
          raw,
          req.headers.get("Paddle-Signature"),
          env("PADDLE_WEBHOOK_SECRET"),
          now().getTime(),
        ))
      )
        return respond({ error: "Invalid webhook signature." }, 401);
      let body;
      try {
        body = JSON.parse(raw || "{}");
      } catch {
        return respond({ error: "Invalid JSON." }, 400);
      }
      if (kind === "paddle-webhook") {
        if (
          body === null ||
          typeof body !== "object" ||
          Array.isArray(body) ||
          typeof body.event_id !== "string" ||
          !/^(evt_|ntfsimevt_)[a-z0-9]+$/i.test(body.event_id) ||
          !Number.isFinite(Date.parse(body.occurred_at)) ||
          typeof body.event_type !== "string"
        )
          return respond({ error: "Invalid event." }, 400);
        if (/^ntfsimevt_/i.test(body.event_id)) {
          // Signature verification above is mandatory. Simulations never reach
          // provider requests, the payment ledger or entitlement mutation RPCs.
          if (env("PADDLE_ENVIRONMENT") !== "sandbox")
            return respond(
              { error: "Simulated events are only allowed in sandbox." },
              400,
            );
          return respond({ received: true, simulated: true, processed: false });
        }
      }
      const url = env("SUPABASE_URL"),
        key = env("SUPABASE_PUBLISHABLE_KEY") || env("SUPABASE_ANON_KEY"),
        secret = env("SUPABASE_SERVICE_ROLE_KEY");
      if (!url || !key || !secret)
        return respond({ error: "The secure backend is not configured." }, 503);
      const admin = createClient(url, secret, {
        auth: { persistSession: false, autoRefreshToken: false },
      });
      const settings = await checked(
        admin.from("commercial_settings").select("*").eq("id", true).single(),
      );
      if (kind === "paddle-webhook") {
        const event = {
          id: body.event_id,
          type: body.event_type,
          occurredAt: body.occurred_at,
          environment,
          termsVersion: env("BILLING_TERMS_VERSION"),
        };
        const previous = await checked(
          admin
            .from("billing_events")
            .select("event_id")
            .eq("event_id", body.event_id)
            .maybeSingle(),
        );
        if (previous) return respond({ received: true, duplicate: true });
        if (settings.environment !== environment)
          throw new Error("Billing environment mismatch");
        let subscriptionId = body.event_type.startsWith("subscription.")
          ? body.data?.id
          : body.data?.subscription_id;
        if (
          body.event_type.startsWith("transaction.") &&
          /^txn_[a-z0-9]+$/i.test(body.data?.id || "")
        ) {
          const transaction = await provider(`/transactions/${body.data.id}`);
          subscriptionId = transaction.subscription_id;
          event.transactionId = transaction.id;
          event.transactionStatus = transaction.status;
          event.operationId = transaction.custom_data?.launchpad_operation_id;
          event.termsVersion =
            transaction.custom_data?.launchpad_terms_version ||
            event.termsVersion;
          if (
            transaction.items?.length === 1 &&
            Object.values(mapping).includes(transaction.items[0].price?.id)
          )
            event.customerId = transaction.customer_id;
        }
        let snapshot = null;
        if (subscriptionId) {
          if (!/^sub_[a-z0-9]+$/i.test(subscriptionId))
            throw new Error("Invalid subscription ID");
          snapshot = paddleSnapshot(
            await provider(`/subscriptions/${subscriptionId}`),
            mapping,
            settings.plans,
          );
        }
        await checked(admin.rpc("apply_paddle_snapshot", { event, snapshot }));
        return respond({ received: true });
      }
      const readiness = billingReadiness(env, settings, environment, origins);
      const checkoutReady = readiness.ready;
      if (body === null || typeof body !== "object" || Array.isArray(body))
        return respond({ error: "Invalid request object." }, 400);
      if (body.action === "catalog")
        return respond({
          enabled: settings.enabled,
          checkoutReady,
          setupRequired: readiness.missing,
          environment: settings.environment,
          catalog: settings.plans,
          supportEmail: env("PUBLIC_SUPPORT_EMAIL") || "",
          businessName: env("BUSINESS_NAME") || "",
          legalApproved: env("BILLING_LEGAL_APPROVED") === "true",
          termsVersion: env("BILLING_TERMS_VERSION") || "",
        });
      if (settings.environment !== environment)
        return respond(
          {
            error:
              "Billing environment mismatch. Use separate staging and production projects.",
          },
          503,
        );
      const authorization = req.headers.get("Authorization") || "";
      if (!authorization.startsWith("Bearer "))
        return respond({ error: "Sign in to a verified account first." }, 401);
      const client = createClient(url, key, {
        global: { headers: { Authorization: authorization } },
        auth: { persistSession: false, autoRefreshToken: false },
      });
      const { data, error } = await client.auth.getUser();
      const user = data?.user;
      if (error || !user?.email_confirmed_at)
        return respond(
          { error: "Confirm your email before opening Billing." },
          401,
        );
      if (body.expected_user !== user.id)
        return respond(
          { error: "Your account changed. Reload before continuing." },
          409,
        );
      await checked(
        admin.rpc("reserve_billing_rate", {
          owner_id: user.id,
          provider_call: ![
            "status",
            "early_access",
            "pricing_viewed",
            "admin",
            "export",
          ].includes(body.action),
        }),
      );
      const entitlement = await checked(
        admin.rpc("commercial_entitlement", { owner_id: user.id }),
      );
      const subs = await checked(
        admin
          .from("billing_subscriptions")
          .select("*")
          .eq("user_id", user.id)
          .eq("environment", environment),
      );
      if (body.action === "status") {
        await checked(
          admin
            .from("commercial_activity")
            .upsert({ user_id: user.id, last_seen_at: now().toISOString() }),
        );
        const usage = await checked(
          admin
            .from("ai_token_usage")
            .select("input_tokens,output_tokens,estimated_usd,model,created_at")
            .eq("user_id", user.id)
            .order("created_at", { ascending: false })
            .limit(20),
        );
        const profile = await checked(
          admin
            .from("user_profiles")
            .select("age_band")
            .eq("id", user.id)
            .single(),
        );
        const deletion = await checked(
          admin.rpc("billing_deletion_status", { owner_id: user.id }),
        );
        const operations = await checked(
          admin
            .from("billing_operations")
            .select("id,action,plan,state,created_at,result")
            .eq("user_id", user.id)
            .order("created_at", { ascending: false })
            .limit(20),
        );
        const activity = operations.map((item) => ({
          id: item.id,
          action: item.action,
          plan: item.plan,
          state: item.state,
          createdAt: item.created_at,
          providerConfirmed: typeof item.result?.confirmedByEvent === "string",
        }));
        return respond({
          activity,
          deletion,
          checkoutReady,
          setupRequired: readiness.missing,
          termsVersion: env("BILLING_TERMS_VERSION") || "",
          ageBand: profile.age_band,
          entitlement,
          subscriptions: subs,
          usage,
          configured: !!env("PADDLE_API_KEY"),
          isAdmin: !!(await checked(
            admin
              .from("business_admins")
              .select("user_id")
              .eq("user_id", user.id)
              .maybeSingle(),
          )),
        });
      }
      if (body.action === "export") {
        const result = { exportedAt: now().toISOString() };
        for (const table of [
          "billing_customers",
          "billing_subscriptions",
          "billing_operations",
          "ai_monthly_usage",
          "ai_token_usage",
          "early_access",
          "conversion_events",
          "contract_consents",
        ]) {
          result[table] = [];
          for (let offset = 0; offset < 100000; offset += 500) {
            const rows = await checked(
              admin
                .from(table)
                .select("*")
                .eq("user_id", user.id)
                .range(offset, offset + 499),
            );
            result[table].push(...rows);
            if (rows.length < 500) break;
            if (offset === 99500)
              throw new Error(
                "Request the full archive from support; automatic export is too large.",
              );
          }
        }
        return respond(result);
      }
      if (body.action === "early_access") {
        if (body.consent === true)
          await checked(
            admin.from("early_access").upsert({
              user_id: user.id,
              consent_version: "launchpad-5-early-access-v1",
            }),
          );
        else
          await checked(
            admin.from("early_access").delete().eq("user_id", user.id),
          );
        return respond({ saved: true, consent: body.consent === true });
      }
      if (body.action === "pricing_viewed") {
        if (body.consent !== true) {
          await checked(
            admin.from("conversion_events").delete().eq("user_id", user.id),
          );
          return respond({ withdrawn: true });
        }
        await checked(
          admin.from("conversion_events").upsert(
            {
              user_id: user.id,
              day: now().toISOString().slice(0, 10),
              event: "pricing_viewed",
            },
            { onConflict: "user_id,day,event" },
          ),
        );
        return respond({ recorded: true });
      }
      if (body.action === "admin") {
        const allowed = await checked(
          admin
            .from("business_admins")
            .select("user_id")
            .eq("user_id", user.id)
            .maybeSingle(),
        );
        if (!allowed)
          return respond({ error: "Administrator access required." }, 403);
        return respond(await checked(admin.rpc("commercial_metrics")));
      }
      if (
        ![
          "checkout",
          "portal",
          "cancel",
          "cancel_now",
          "change_plan",
          "preview_plan",
          "resume_checkout",
          "transactions",
        ].includes(body.action)
      )
        return respond({ error: "Unknown billing action." }, 400);
      if (
        (!settings.enabled &&
          !["portal", "cancel", "cancel_now", "transactions"].includes(
            body.action,
          )) ||
        settings.environment !== environment
      )
        return respond(
          {
            error:
              "Commercial billing is not activated. No payment was started.",
          },
          503,
        );
      let website;
      try {
        website = new URL(site);
      } catch {
        return respond(
          { error: "The commercial domain is not configured." },
          503,
        );
      }
      const local =
        environment === "sandbox" &&
        ["127.0.0.1", "localhost"].includes(website.hostname);
      if (
        website.username ||
        website.password ||
        website.search ||
        website.hash ||
        (website.protocol !== "https:" &&
          !(local && website.protocol === "http:")) ||
        website.hostname.endsWith("github.io") ||
        origin !== website.origin
      )
        return respond(
          {
            error:
              "Checkout is available only on the configured commercial site.",
          },
          403,
        );
      if (
        ["checkout", "change_plan", "preview_plan"].includes(body.action) &&
        env("BILLING_CHECKOUT_ENABLED") !== "true"
      )
        return respond(
          {
            error:
              "Checkout is paused. Existing customers can still use the billing portal and cancellation controls.",
          },
          503,
        );
      if (
        ["checkout", "change_plan", "preview_plan"].includes(body.action) &&
        !checkoutReady
      )
        return respond(
          {
            error:
              "Checkout configuration and legal approval are incomplete. No payment was started.",
          },
          503,
        );
      const customer = await checked(
        admin
          .from("billing_customers")
          .select("*")
          .eq("user_id", user.id)
          .maybeSingle(),
      );
      if (customer && customer.environment !== environment)
        throw new Error("Use a separate project for sandbox and production");
      const active = subs
        .filter((s) =>
          ["active", "trialing", "past_due", "paused"].includes(s.status),
        )
        .sort((a, b) =>
          b.provider_updated_at.localeCompare(a.provider_updated_at),
        )[0];
      if (body.action === "transactions") {
        if (environment !== "sandbox")
          return respond(
            {
              error:
                "Provider transaction history is Sandbox-only in this release candidate.",
            },
            503,
          );
        if (!customer)
          return respond({
            transactions: [],
            environment,
            source: "Launchpad",
            notRequested: true,
            notice:
              "No billing customer exists for this account. Paddle has not been contacted.",
          });
        const query = new URLSearchParams({
          customer_id: customer.customer_id,
          per_page: "10",
          order_by: "created_at[DESC]",
        });
        const rows = await provider(`/transactions?${query}`);
        if (!Array.isArray(rows) || rows.length > 10)
          throw new Error("Invalid provider transaction history.");
        const transactions = rows.map((row) => {
          if (
            row.customer_id !== customer.customer_id ||
            !/^txn_[a-z0-9]+$/i.test(row.id) ||
            ![
              "draft",
              "ready",
              "billed",
              "paid",
              "completed",
              "canceled",
              "past_due",
            ].includes(row.status) ||
            !/^[A-Z]{3}$/.test(row.currency_code)
          )
            throw new Error(
              "Provider transaction ownership or format is invalid.",
            );
          const amount = row.details?.totals?.grand_total;
          return {
            id: row.id,
            status: row.status,
            currency: row.currency_code,
            total:
              typeof amount === "string" && /^\d{1,12}$/.test(amount)
                ? amount
                : null,
            createdAt:
              typeof row.created_at === "string" &&
              Number.isFinite(Date.parse(row.created_at))
                ? row.created_at
                : null,
          };
        });
        return respond({
          transactions,
          environment,
          source: "Paddle",
          fetchedAt: now().toISOString(),
        });
      }
      if (body.action === "portal") {
        if (!customer)
          return respond({ error: "No billing customer exists yet." }, 404);
        const portal = await provider(
          `/customers/${customer.customer_id}/portal-sessions`,
          "POST",
          { subscription_ids: subs.map((sub) => sub.subscription_id) },
        );
        const portalUrl = portal.urls?.general?.overview;
        if (
          !portalUrl ||
          new URL(portalUrl).protocol !== "https:" ||
          ![
            "customer-portal.paddle.com",
            "sandbox-customer-portal.paddle.com",
          ].includes(new URL(portalUrl).hostname)
        )
          throw new Error("Invalid provider portal URL");
        return respond({ url: portalUrl });
      }
      if (body.action === "resume_checkout") {
        if (
          !checkoutReady ||
          !customer ||
          !/^txn_[a-z0-9]+$/i.test(body.transactionId)
        )
          return respond(
            {
              error:
                "Checkout cannot be resumed while configuration is incomplete.",
            },
            503,
          );
        const profile = await checked(
          admin
            .from("user_profiles")
            .select("age_band")
            .eq("id", user.id)
            .single(),
        );
        if (
          profile.age_band !== "18+" ||
          body.contractConsent !== true ||
          body.termsVersion !== env("BILLING_TERMS_VERSION")
        )
          return respond(
            {
              error:
                "Review the current adult contracting and billing terms first.",
            },
            403,
          );
        const owned = await checked(
          admin
            .from("billing_operations")
            .select("*")
            .eq("user_id", user.id)
            .eq("action", "checkout")
            .eq("state", "complete")
            .eq("result->>transactionId", body.transactionId)
            .maybeSingle(),
        );
        if (!owned)
          return respond(
            { error: "This checkout does not belong to your account." },
            403,
          );
        const transaction = await provider(
          `/transactions/${body.transactionId}`,
        );
        if (
          transaction.customer_id !== customer.customer_id ||
          !["draft", "ready", "billed"].includes(transaction.status)
        )
          return respond(
            {
              error:
                "This checkout is complete or unavailable. Refresh subscription status.",
            },
            409,
          );
        await checked(
          admin.from("contract_consents").insert({
            user_id: user.id,
            operation_id: owned.id,
            customer_id: customer.customer_id,
            version: env("BILLING_TERMS_VERSION"),
          }),
        );
        return respond({
          transactionId: body.transactionId,
          plan: owned.plan,
          environment,
          clientToken: env("PADDLE_CLIENT_TOKEN"),
          notice: "Only a verified provider event activates access.",
        });
      }
      const plan = body.plan;
      if (body.action === "checkout" && !active && entitlement.legacy)
        return respond(
          {
            error:
              "Your legacy grant preserves the existing feature set. Contact support before choosing any paid plan; no new payment was started.",
          },
          409,
        );
      if (["checkout", "change_plan", "preview_plan"].includes(body.action)) {
        if (!["pro", "premium"].includes(plan) || !mapping[plan])
          return respond({ error: "Choose a configured paid plan." }, 400);
        const profile = await checked(
          admin
            .from("user_profiles")
            .select("age_band")
            .eq("id", user.id)
            .single(),
        );
        if (
          profile.age_band !== "18+" ||
          body.contractConsent !== true ||
          body.termsVersion !== env("BILLING_TERMS_VERSION")
        )
          return respond(
            {
              error:
                "Paid subscriptions require age 18 or older and explicit agreement to billing terms. No payment was started.",
            },
            403,
          );
        const price = await provider(`/prices/${mapping[plan]}`);
        if (
          price.status !== "active" ||
          Number(price.unit_price?.amount) !==
            settings.plans[plan]?.monthlyCents ||
          price.unit_price?.currency_code !== "USD" ||
          price.billing_cycle?.interval !== "month" ||
          price.billing_cycle?.frequency !== 1
        )
          throw new Error(
            "Paddle price differs from the reviewed catalog. Checkout is disabled.",
          );
      }
      if (
        ["checkout", "change_plan"].includes(body.action) &&
        (env("BILLING_LEGAL_APPROVED") !== "true" ||
          !env("PUBLIC_SUPPORT_EMAIL") ||
          !env("BUSINESS_NAME") ||
          !env("BILLING_TERMS_VERSION"))
      )
        return respond(
          {
            error:
              "The operator must configure support and approve billing/legal terms before checkout.",
          },
          503,
        );
      const change = {
        items: [{ price_id: mapping[plan], quantity: 1 }],
        proration_billing_mode: "prorated_immediately",
        on_payment_failure: "prevent_change",
      };
      if (body.action === "preview_plan") {
        if (!active)
          return respond(
            { error: "No subscription is available to change." },
            404,
          );
        const canonical = await provider(
          `/subscriptions/${active.subscription_id}`,
        );
        if (canonical.items?.[0]?.price?.id === mapping[plan])
          return respond(
            {
              error:
                "The provider already has this plan. Refresh status before making another change.",
            },
            409,
          );
        const quote = await signPlanQuote(
          {
            user: user.id,
            subscription: active.subscription_id,
            plan,
            price: mapping[plan],
            amount: settings.plans[plan].monthlyCents,
            updatedAt: canonical.updated_at,
            terms: env("BILLING_TERMS_VERSION"),
            expiresAt: now().getTime() + 300000,
          },
          env("PADDLE_WEBHOOK_SECRET"),
        );
        const preview = await provider(
          `/subscriptions/${active.subscription_id}/preview`,
          "PATCH",
          change,
        );
        return respond({
          quote,
          preview: {
            immediate: preview.immediate_transaction?.details?.totals || null,
            next: preview.next_transaction?.details?.totals || null,
            currency: preview.currency_code || "USD",
          },
          notice:
            "The plan changes immediately; Paddle calculates proration. Review the amount before confirming.",
        });
      }
      if (body.action === "change_plan") {
        if (!active)
          return respond(
            { error: "No subscription is available to change." },
            404,
          );
        const quote = await verifyPlanQuote(
          body.quote,
          env("PADDLE_WEBHOOK_SECRET"),
          {
            user: user.id,
            subscription: active.subscription_id,
            plan,
            price: mapping[plan],
            amount: settings.plans[plan].monthlyCents,
            terms: env("BILLING_TERMS_VERSION"),
          },
          now().getTime(),
        );
        if (!quote)
          return respond(
            {
              error:
                "The plan-change preview is expired or invalid. Request a fresh preview.",
            },
            409,
          );
        const current = await provider(
          `/subscriptions/${active.subscription_id}`,
        );
        if (current.updated_at !== quote.updatedAt)
          return respond(
            {
              error:
                "Your subscription changed after the preview. Refresh before confirming.",
            },
            409,
          );
      }
      if (body.action === "checkout" && customer && !active) {
        const last = await checked(
          admin
            .from("billing_operations")
            .select("*")
            .eq("user_id", user.id)
            .eq("action", "checkout")
            .eq("state", "complete")
            .order("created_at", { ascending: false })
            .limit(1)
            .maybeSingle(),
        );
        if (last?.result?.transactionId) {
          const old = await provider(
            `/transactions/${last.result.transactionId}`,
          );
          if (["draft", "ready", "billed", "paid"].includes(old.status)) {
            if (last.plan !== plan)
              throw new Error(
                "Finish or reconcile your existing checkout before choosing another plan.",
              );
            return respond(last.result);
          }
          if (
            old.status === "completed" &&
            !subs.some(
              (s) =>
                s.subscription_id === old.subscription_id &&
                s.status === "canceled",
            )
          )
            throw new Error(
              "Your purchase is awaiting verified reconciliation. Refresh status before retrying.",
            );
        }
      }
      if (body.action === "checkout" && active)
        return respond(
          {
            error:
              "Manage your existing subscription instead of starting another checkout.",
          },
          409,
        );
      if (body.action !== "checkout" && !active)
        return respond(
          { error: "No subscription is available to change." },
          404,
        );
      if (
        body.action === "checkout" &&
        (!env("PADDLE_CLIENT_TOKEN") ||
          !env("PADDLE_CLIENT_TOKEN").startsWith(
            environment === "sandbox" ? "test_" : "live_",
          ))
      )
        return respond(
          { error: "The Paddle public client token is not configured." },
          503,
        );
      if (!uuid(body.requestId))
        return respond({ error: "A valid operation ID is required." }, 400);
      const reserved = await checked(
        admin.rpc("reserve_billing_operation", {
          operation_id: body.requestId,
          owner_id: user.id,
          operation: body.action,
          target_plan: plan || null,
        }),
      );
      if (reserved.cached) return respond(reserved.result);
      try {
        let result;
        if (body.action === "checkout") {
          if (active)
            throw new Error(
              "Use the billing portal or plan change for your existing subscription.",
            );
          let owner = customer;
          if (!owner) {
            const created = await provider("/customers", "POST", {
              email: user.email,
              custom_data: { launchpad_user_id: user.id },
            });
            if (!/^ctm_[a-z0-9]+$/i.test(created.id))
              throw new Error("Invalid customer response");
            owner = { customer_id: created.id, user_id: user.id, environment };
            await checked(admin.from("billing_customers").insert(owner));
          }
          await checked(
            admin.from("contract_consents").insert({
              user_id: user.id,
              operation_id: body.requestId,
              customer_id: owner.customer_id,
              version: env("BILLING_TERMS_VERSION"),
            }),
          );
          const transaction = await provider("/transactions", "POST", {
            items: [{ price_id: mapping[plan], quantity: 1 }],
            customer_id: owner.customer_id,
            collection_mode: "automatic",
            currency_code: "USD",
            custom_data: {
              launchpad_user_id: user.id,
              launchpad_operation_id: body.requestId,
              launchpad_terms_version: env("BILLING_TERMS_VERSION"),
            },
            checkout: { url: website.href },
          });
          if (!/^txn_[a-z0-9]+$/i.test(transaction.id))
            throw new Error("Invalid transaction response");
          const clientToken = env("PADDLE_CLIENT_TOKEN");
          if (
            !clientToken ||
            !clientToken.startsWith(
              environment === "sandbox" ? "test_" : "live_",
            )
          )
            throw new Error("Paddle public client token is not configured");
          result = {
            transactionId: transaction.id,
            plan,
            clientToken,
            environment,
            notice:
              "Access is activated only after a verified provider webhook. Closing checkout does not confirm payment.",
          };
        } else {
          if (!active)
            throw new Error("No subscription is available to change.");
          if (body.action === "change_plan") {
            await checked(
              admin.from("contract_consents").insert({
                user_id: user.id,
                operation_id: body.requestId,
                customer_id: customer.customer_id,
                version: env("BILLING_TERMS_VERSION"),
              }),
            );
            await provider(
              `/subscriptions/${active.subscription_id}`,
              "PATCH",
              change,
            );
          } else
            await provider(
              `/subscriptions/${active.subscription_id}/cancel`,
              "POST",
              {
                effective_from:
                  body.action === "cancel_now"
                    ? "immediately"
                    : "next_billing_period",
              },
            );
          result = {
            pending: true,
            notice:
              "Request sent to Paddle. Access and billing status update only after the verified webhook. Refresh status before retrying.",
          };
        }
        const persisted = await checked(
          admin.rpc("complete_billing_operation", {
            operation_id: body.requestId,
            owner_id: user.id,
            operation_result: result,
          }),
        );
        return respond(persisted || result);
      } catch (error) {
        await admin.rpc("fail_billing_operation", {
          operation_id: body.requestId,
          owner_id: user.id,
        });
        throw error;
      }
    } catch (error) {
      return respond(
        {
          error:
            error.message || "Billing is unavailable. No success is claimed.",
        },
        503,
      );
    }
  };
}
