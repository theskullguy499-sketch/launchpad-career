import "./platform.js";
import { getAuthClient } from "./auth-client.js";
import { PLANS, BILLING_DISCLOSURE } from "./lib/plans.mjs";
const $ = (selector) => document.querySelector(selector);
const el = (tag, text, cls) => {
  const n = document.createElement(tag);
  if (text != null) n.textContent = text;
  if (cls) n.className = cls;
  return n;
};
const button = (text, fn, primary = false) => {
  const n = el(
    "button",
    text,
    "button " + (primary ? "button-primary" : "button-outline"),
  );
  n.type = "button";
  n.addEventListener("click", async () => {
    if (n.disabled) return;
    n.disabled = true;
    try {
      await fn();
    } catch (e) {
      status(e.message);
    } finally {
      n.disabled = false;
    }
  });
  return n;
};
let state = null,
  generation = 0,
  sessionVersion = 0,
  catalog = PLANS,
  publicConfig = { enabled: false },
  paddlePromise,
  checkoutOwner = null,
  checkoutScope = null,
  checkoutTransaction = null,
  checkoutPlan = null,
  checkoutPending = false,
  checkoutWatch = 0,
  checkoutTimer;
const navigate = (view) => window.launchpadData.navigate(view);
function status(message) {
  $("#billingStatus").textContent = message;
}
async function api(action, extra = {}) {
  const owner = window.launchpadSession?.id;
  const scope = sessionVersion;
  const client = await getAuthClient();
  if (
    action !== "catalog" &&
    (scope !== sessionVersion || owner !== window.launchpadSession?.id)
  )
    throw new Error("Your account changed before the request began.");
  const { data, error } = await client.functions.invoke("billing", {
    body: { action, ...extra, expected_user: owner },
  });
  if (
    action !== "catalog" &&
    (scope !== sessionVersion || owner !== window.launchpadSession?.id)
  )
    throw new Error("Your account changed. Refresh Billing before continuing.");
  if (error) {
    let message = "Billing is unavailable. No payment success is claimed.";
    try {
      message = (await error.context.json()).error || message;
    } catch {}
    throw new Error(message);
  }
  if (!data || data.error)
    throw new Error(data?.error || "Billing returned no usable data.");
  return data;
}
const query = new URL(location.href);
const requestedTransaction = query.searchParams.get("_ptxn");
let pendingTransaction = /^txn_[a-z0-9]+$/i.test(requestedTransaction || "")
  ? requestedTransaction
  : null;
if (query.searchParams.has("_ptxn")) {
  query.searchParams.delete("_ptxn");
  history.replaceState(null, "", query);
}
const openFreeOrganizer = () => {
  if (
    state?.entitlement.enabled &&
    !state.entitlement.limits.cloud &&
    window.launchpadWorkspace?.isAccount()
  )
    $("#useGuestBtn").click();
  navigate("dashboard");
};
const signup = () => {
  $("#accountBtn").click();
  $("#signUpMode").click();
};
const screen = el("section", null, "view");
screen.id = "billingView";
screen.hidden = true;
screen.setAttribute("aria-label", "Plans and billing");
screen.innerHTML = `<div class="screen-heading"><div><p class="eyebrow">GROW AT YOUR PACE</p><h1>Your next step.<br><em>Your choice.</em></h1><p class="intro-copy">Start with the local organizer. Paid accounts add protected cloud editing and AI request allowances when the commercial service is activated.</p></div></div><p id="billingMode" class="platform-status" role="note"></p><p id="billingStatus" class="platform-status" role="status" aria-live="polite"></p><div id="pricingCards" class="pricing-grid"></div><p class="helper" id="pricingDisclosure"></p><section class="panel section-pad"><h2>Before choosing a paid plan</h2><label class="check-label"><input type="checkbox" id="billingConsent" /> I am 18 or older and agree to the billing, cancellation and refund terms. I understand recurring billing and any displayed proration.</label><p class="helper">People aged 16–17 may use eligible free services. Paid contracting is restricted to adults; contact the operator about a legally reviewed guardian process before any purchase.</p><a href="legal/billing.html" target="_blank" rel="noopener noreferrer">Billing, cancellation & refund policy draft</a></section><section class="panel section-pad"><h2>Your account & subscription</h2><div id="subscriptionSummary"></div><div id="billingActions" class="button-row"></div><p class="helper">Checkout completion in the browser does not grant access. Only a verified provider event updates server entitlements. Existing records remain available for export after cancellation or expiration. Offline portfolio tools remain available; browser-only views are not a security boundary.</p></section><section class="panel section-pad"><h2>AI usage</h2><p id="creditSummary" class="helper"></p><div id="usageList"></div><p class="helper">Credits count submitted provider attempts, including failed attempts; retries can consume credits. Monthly credits reset at the start of each UTC calendar month. Daily and platform limits also apply. Cost estimates require operator-configured model rates; they are not provider invoices.</p></section><section class="panel section-pad"><h2>Early access & privacy choices</h2><p>Join early access using your verified account email. This is optional and separate from registration or buying a subscription. Withdrawing stops future launch messages; messages are sent only by the operator's configured process.</p><div id="earlyAccessActions" class="button-row"></div><label class="check-label"><input type="checkbox" id="conversionConsent" /> Allow an account-linked daily pricing-view count for simple conversion analysis. No third-party analytics are loaded.</label><p class="helper">Unchecking withdraws consent and deletes your account-linked pricing-view counts.</p></section>`;
const setupRequired = el("div", null, "helper");
setupRequired.id = "billingSetupRequired";
screen.querySelector("#billingMode").after(setupRequired);
$("#platformScreens").append(screen);
const business = el("section", null, "view");
business.id = "businessView";
business.hidden = true;
business.setAttribute("aria-label", "Business administration");
business.innerHTML =
  '<div class="screen-heading"><div><p class="eyebrow">VERIFIED BUSINESS RECORDS</p><h1>Business overview</h1></div></div><p class="helper">Restricted to operator-approved administrators. Sandbox records are test transactions, never real revenue. MRR is contracted monthly USD before tax/discounts, not settled cash.</p><p id="businessStatus" role="status"></p><div id="businessMetrics" class="metrics-grid"></div><div id="businessActions" class="button-row"></div>';
$("#platformScreens").append(business);
// This local organizer limit is UX only; database triggers and server AI quotas
// are the authorization boundary. Existing records are never truncated.
window.launchpadCommercial = {
  checkNewApplication(count) {
    if (!publicConfig.enabled || location.hostname.endsWith("github.io"))
      return;
    const limits = state?.entitlement?.limits || catalog.free;
    if (count >= limits.applications)
      throw new Error(
        "Your saved-opportunity allowance is full. Export or remove an existing entry, or review the available plans.",
      );
  },
};
function money(cents) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
  }).format(cents / 100);
}
function drawPricing() {
  const list = $("#pricingCards");
  list.replaceChildren();
  for (const [id, plan] of Object.entries(catalog)) {
    if (
      !["free", "pro", "premium"].includes(id) ||
      !Number.isInteger(plan.monthlyCents)
    )
      continue;
    const card = el("article", null, "panel section-pad pricing-card");
    card.append(
      el("h2", plan.name),
      el("p", money(plan.monthlyCents) + "/month", "price"),
    );
    const features = el("ul");
    for (const text of id === "free"
      ? [
          "Local guest organizer and JSON export",
          `${plan.applications} saved opportunities in the commercial Free interface`,
          "Basic employer research and roadmap",
          "Optional verified account and profile",
        ]
      : [
          "Includes the Free organizer",
          `${plan.applications} cloud opportunities; ${plan.favorites} employer favorites`,
          "Cloud editing, Kanban, analytics and reminders",
          `${plan.aiMonthly} AI request credits per UTC month`,
          "Consent-based career, interview, resume and portfolio guidance",
        ])
      features.append(el("li", text));
    card.append(
      features,
      button(
        id === "free"
          ? "Get Started Free"
          : id === "pro"
            ? "Upgrade to Pro"
            : "Unlock Premium",
        () => (id === "free" ? openFreeOrganizer() : purchase(id)),
        id !== "free",
      ),
    );
    const knownAge = state?.ageBand || $("#profileAge")?.value;
    if (id !== "free" && (knownAge === "16-17" || state?.entitlement.legacy)) {
      const cta = card.querySelector("button");
      cta.disabled = true;
      cta.textContent =
        knownAge === "16-17"
          ? "Adult contracting required"
          : "Legacy access preserved";
    }
    list.append(card);
  }
  $("#pricingDisclosure").textContent = BILLING_DISCLOSURE;
}
function draw() {
  const setup = $("#billingSetupRequired");
  if (setup) {
    setup.replaceChildren();
    if (publicConfig.setupRequired?.length) {
      setup.append(
        el(
          "p",
          "The operator still needs to complete these settings. No purchase has been started:",
        ),
      );
      const list = el("ul");
      for (const label of publicConfig.setupRequired)
        list.append(el("li", label));
      setup.append(list);
    }
  }
  const dashboard = $("#dashboardBillingSummary");
  if (dashboard)
    dashboard.textContent = state
      ? `Server-confirmed access: ${state.entitlement.plan}${state.entitlement.legacy ? " (legacy grant, not a paid subscription)" : ""}. ${state.entitlement.environment === "sandbox" ? "Sandbox test account. " : ""}View Plans & Billing.`
      : "Plan not checked. Open Plans & Billing to verify your account status.";
  $("#billingMode").textContent = publicConfig.enabled
    ? `${!publicConfig.checkoutReady ? "Commercial workspace rules are enabled, but checkout is paused or not configured." : publicConfig.environment === "sandbox" ? "SANDBOX — test purchases only." : "Commercial service enabled; complete the release acceptance checks before inviting customers."}`
    : "Portfolio / setup mode. Commercial checkout is not activated. Prices are proposals; no subscription is being sold here.";
  const summary = $("#subscriptionSummary");
  summary.replaceChildren();
  if (!state)
    summary.append(
      el(
        "p",
        window.launchpadSession
          ? "Refresh to check your verified server entitlement."
          : "Sign in to a verified account to view billing. Local guest data is unchanged.",
      ),
    );
  else {
    summary.append(
      el(
        "p",
        `Current access: ${state.entitlement.plan}${state.entitlement.legacy ? " · legacy feature grant, not a paid subscription" : ""}`,
      ),
    );
    if (state.deletion?.blocked)
      summary.append(el("p", state.deletion.reason, "helper"));
    for (const sub of state.subscriptions || [])
      summary.append(
        el(
          "p",
          `${sub.plan} · ${sub.status} · period ends ${sub.period_end ? new Date(sub.period_end).toLocaleString("en-US") : "not supplied"}${sub.cancel_at ? " · cancellation scheduled" : ""}`,
        ),
      );
    if (state.ageBand !== "18+")
      summary.append(
        el(
          "p",
          "Paid purchases are unavailable until adult contracting eligibility is established.",
          "helper",
        ),
      );
  }
  const actions = $("#billingActions");
  actions.replaceChildren(button("Refresh status", refresh));
  if (pendingTransaction)
    actions.append(button("Resume checkout link", resumeCheckout));
  if (state) {
    actions.append(
      button("Open local organizer", openFreeOrganizer),
      button("Open account profile", () => {
        if (!window.launchpadWorkspace?.isAccount())
          $("#openCloudBtn")?.click();
        navigate("settings");
      }),
    );
    if (!state.entitlement.limits.cloud)
      summary.append(
        el(
          "p",
          "The Free career organizer uses this browser’s shared guest storage. Profile data is account-owned; protected career cloud editing requires Pro/Premium. Use Open account profile to edit your account onboarding.",
          "helper",
        ),
      );
    actions.append(
      button("Open billing portal", async () => {
        const scope = sessionVersion;
        const r = await api("portal");
        if (scope !== sessionVersion)
          throw new Error(
            "Your account changed before opening the billing portal.",
          );
        location.assign(r.url);
      }),
      button("Cancel at period end", () => cancel(false)),
      button("Cancel immediately for account deletion", () => cancel(true)),
      button("Export billing & usage data", async () =>
        download(await api("export")),
      ),
    );
  }
  $("#creditSummary").textContent =
    state && !state.entitlement.enabled
      ? "Portfolio mode: commercial monthly credits are not active. The configured daily backend allowance applies."
      : state
        ? `${state.entitlement.aiRemaining} / ${state.entitlement.limits.aiMonthly || 0} monthly request credits remaining. Account cloud permission: ${state.entitlement.limits.cloud ? "included" : "not included"}.`
        : "No verified credit balance loaded.";
  const usage = $("#usageList");
  usage.replaceChildren();
  for (const row of state?.usage || [])
    usage.append(
      el(
        "p",
        `${new Date(row.created_at).toLocaleString("en-US")} · ${row.model} · ${row.input_tokens} input / ${row.output_tokens} output tokens · ${row.estimated_usd == null ? "cost not configured" : money(Number(row.estimated_usd) * 100) + " estimated"}`,
        "helper",
      ),
    );
  const early = $("#earlyAccessActions");
  early.replaceChildren(
    button("Join early access", async () => {
      if (!window.launchpadSession) {
        signup();
        return;
      }
      if (
        !confirm(
          "Allow Launchpad to use your verified email for early-access updates?",
        )
      )
        return;
      await api("early_access", { consent: true });
      status("Early-access consent saved. No email delivery is claimed.");
    }),
    button("Withdraw early-access consent", async () => {
      await api("early_access", { consent: false });
      status("Early-access consent withdrawn.");
    }),
  );
  const adminButton = $('.nav-list [data-view="business"]');
  adminButton.hidden = !state?.isAdmin;
  const settings = $("#commercialSettingsSummary");
  if (settings)
    settings.textContent = state
      ? `Access: ${state.entitlement.plan}. ${state.entitlement.aiRemaining} monthly AI requests remaining. Open Plans & Billing for provider-confirmed status.`
      : "Billing status has not been loaded. Guest records remain shared in this browser profile.";
}
async function refresh() {
  const ticket = ++generation;
  status("Checking server-confirmed billing status…");
  try {
    const r = await api("status");
    if (ticket !== generation) return;
    state = r;
    catalog = r.entitlement.catalog;
    publicConfig = {
      ...publicConfig,
      checkoutReady: r.checkoutReady,
      enabled: r.entitlement.enabled,
      environment: r.entitlement.environment,
      termsVersion: r.termsVersion ?? publicConfig.termsVersion,
      setupRequired: r.setupRequired || [],
    };
    drawPricing();
    draw();
    status(
      r.configured
        ? "Server status loaded. Payment changes may still be awaiting a verified webhook."
        : "Paddle is not configured. No purchase was started.",
    );
    return true;
  } catch (e) {
    if (ticket === generation) {
      state = null;
      draw();
      status(
        e.message === "not-configured"
          ? "Account and billing services are not configured. Guest tools remain available."
          : e.message,
      );
    }
  }
}
function stopCheckoutWatch() {
  checkoutWatch++;
  clearTimeout(checkoutTimer);
}
function handleCheckoutEvent(event) {
  if (
    !checkoutOwner ||
    checkoutOwner !== window.launchpadSession?.id ||
    checkoutScope !== sessionVersion
  )
    return;
  if (
    event.data?.transaction_id &&
    event.data.transaction_id !== checkoutTransaction
  )
    return;
  if (event.name === "checkout.closed" && !checkoutPending) {
    status(
      "Checkout closed. No payment success is claimed. Refresh status before retrying.",
    );
  }
  if (["checkout.error", "checkout.payment.failed"].includes(event.name)) {
    stopCheckoutWatch();
    checkoutPending = false;
    status(
      "Checkout could not finish. Check Plans & Billing or the provider portal before retrying. No payment success is claimed.",
    );
  }
  if (event.name !== "checkout.completed" || checkoutPending) return;
  checkoutPending = true;
  status(
    "Checkout reported completion. Waiting for the verified server webhook; access has not been confirmed.",
  );
  const watch = ++checkoutWatch,
    scope = sessionVersion,
    owner = checkoutOwner;
  let attempts = 0;
  const check = async () => {
    if (
      watch !== checkoutWatch ||
      scope !== sessionVersion ||
      owner !== window.launchpadSession?.id
    )
      return;
    const loaded = await refresh();
    if (
      watch !== checkoutWatch ||
      scope !== sessionVersion ||
      owner !== window.launchpadSession?.id
    )
      return;
    if (!loaded) {
      checkoutPending = false;
      return;
    }
    if (
      state &&
      !state.entitlement.legacy &&
      ["pro", "premium"].includes(state.entitlement.plan) &&
      (!checkoutPlan || state.entitlement.plan === checkoutPlan)
    ) {
      status(
        "Your plan is confirmed by the server. The verified server webhook controls access.",
      );
      checkoutPending = false;
      return;
    }
    if (++attempts >= 6) {
      status(
        "Still awaiting the verified server webhook. No new purchase was started. Refresh status later or contact support before retrying.",
      );
      checkoutPending = false;
      return;
    }
    status(
      "Still awaiting the verified server webhook. Checking server status again shortly…",
    );
    checkoutTimer = setTimeout(check, 4000);
  };
  checkoutTimer = setTimeout(check, 4000);
}
async function openCheckout(result, owner, scope, plan) {
  if (
    location.hostname === "launchpad-career-staging.pages.dev" &&
    result.environment !== "sandbox"
  )
    throw new Error("Only Sandbox checkout can open on this staging site.");
  const sdk = await paddle();
  if (scope !== sessionVersion || owner !== window.launchpadSession?.id)
    throw new Error("Your account changed before checkout opened.");
  stopCheckoutWatch();
  checkoutOwner = owner;
  checkoutScope = scope;
  checkoutTransaction = result.transactionId;
  checkoutPlan = plan || result.plan;
  checkoutPending = false;
  if (result.environment === "sandbox") sdk.Environment.set("sandbox");
  if (!window.launchpadPaddleInitialized) {
    sdk.Initialize({
      token: result.clientToken,
      eventCallback: handleCheckoutEvent,
    });
    window.launchpadPaddleInitialized = true;
  }
  sdk.Checkout.open({ transactionId: result.transactionId });
  status(result.notice);
}
async function paddle() {
  if (window.Paddle) return window.Paddle;
  if (!paddlePromise)
    paddlePromise = new Promise((resolve, reject) => {
      const script = document.createElement("script");
      script.src = "https://cdn.paddle.com/paddle/v2/paddle.js";
      script.onload = () =>
        window.Paddle
          ? resolve(window.Paddle)
          : reject(new Error("Paddle checkout did not initialize."));
      script.onerror = () => {
        paddlePromise = null;
        reject(
          new Error(
            "Paddle checkout could not load. No payment success is claimed.",
          ),
        );
      };
      document.head.append(script);
    });
  return paddlePromise;
}
async function purchase(plan) {
  const scope = sessionVersion;
  const purchaseOwner = window.launchpadSession?.id;
  if (!window.launchpadSession) {
    signup();
    return;
  }
  if (!$("#billingConsent").checked)
    throw new Error(
      "Review and accept the adult contracting and recurring billing terms first.",
    );
  if (!state) await refresh();
  if (scope !== sessionVersion || purchaseOwner !== window.launchpadSession?.id)
    throw new Error("Your account changed. Review Billing again.");
  if (!state) throw new Error("Billing status must load before a purchase.");
  if (state.entitlement.legacy)
    throw new Error(
      "Your existing legacy features are preserved. Contact support before choosing a paid plan; no new charge is needed for those features.",
    );
  if (state.ageBand !== "18+")
    throw new Error(
      "Paid subscriptions require age 18 or older. Contact support about guardian involvement.",
    );
  if (!publicConfig.enabled)
    throw new Error(
      "Commercial billing is not activated. No payment was started.",
    );
  if (
    location.hostname === "launchpad-career-staging.pages.dev" &&
    publicConfig.environment !== "sandbox"
  )
    throw new Error(
      "This staging site accepts Sandbox purchases only. No payment was started.",
    );
  if (!publicConfig.checkoutReady)
    throw new Error(
      "Checkout is unavailable until the operator completes the settings listed above. No payment was started.",
    );
  const active = state.subscriptions?.some((s) =>
    ["active", "trialing", "past_due", "paused"].includes(s.status),
  );
  if (active) {
    const r = await api("preview_plan", {
      plan,
      contractConsent: true,
      termsVersion: publicConfig.termsVersion,
    });
    if (
      scope !== sessionVersion ||
      purchaseOwner !== window.launchpadSession?.id
    )
      throw new Error("Your account changed before confirming the plan.");
    if (
      !confirm(
        `Change immediately to ${plan}? ${r.notice}\nEstimated due now: ${r.preview.immediate?.grand_total != null ? money(Number(r.preview.immediate.grand_total)) : "no immediate transaction supplied"}.\nNext payment estimate: ${r.preview.next?.grand_total != null ? money(Number(r.preview.next.grand_total)) : "not supplied"}.\nConfirm this recurring-plan change?`,
      )
    )
      return;
    const result = await api("change_plan", {
      quote: r.quote,
      plan,
      contractConsent: true,
      termsVersion: publicConfig.termsVersion,
      requestId: crypto.randomUUID(),
    });
    status(result.notice);
    return;
  }
  const r = await api("checkout", {
    plan,
    contractConsent: true,
    termsVersion: publicConfig.termsVersion,
    requestId: crypto.randomUUID(),
  });
  await openCheckout(r, purchaseOwner, scope, plan);
}
async function resumeCheckout() {
  const scope = sessionVersion;
  const owner = window.launchpadSession?.id;
  if (!owner) {
    signup();
    return;
  }
  if (!$("#billingConsent").checked)
    throw new Error(
      "Accept the current billing terms before resuming checkout.",
    );
  const r = await api("resume_checkout", {
    transactionId: pendingTransaction,
    contractConsent: true,
    termsVersion: publicConfig.termsVersion,
  });
  await openCheckout(r, owner, scope);
}
async function cancel(immediate) {
  if (
    !confirm(
      immediate
        ? "Cancel immediately before account deletion? Paid access ends after provider confirmation; refunds follow the reviewed policy."
        : "Cancel renewal at period end? Your verified status determines remaining access.",
    )
  )
    return;
  const r = await api(immediate ? "cancel_now" : "cancel", {
    requestId: crypto.randomUUID(),
  });
  status(r.notice);
}
function download(data) {
  const a = el("a");
  a.href = URL.createObjectURL(
    new Blob([JSON.stringify(data, null, 2)], { type: "application/json" }),
  );
  a.download = "launchpad-billing-data.json";
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 3000);
}
async function metrics() {
  const scope = sessionVersion;
  $("#businessStatus").textContent = "Checking administrator authorization…";
  $("#businessMetrics").replaceChildren();
  try {
    const r = await api("admin");
    if (scope !== sessionVersion) return;
    for (const [key, label] of Object.entries({
      registeredAccounts: "Registered accounts",
      activeFreeObserved30d: "Active free/legacy accounts observed, 30 days",
      activeSubscribers: "Active provider subscriptions",
      contractMrrCents: "Contract MRR, USD",
      churnPercent: "Monthly churn, %",
      upgradesThisMonth: "Upgrades this month",
      cancellationsThisMonth: "Cancellations this month",
      paymentFailuresThisMonth: "Payment failure events this month",
      aiAttemptsThisMonth: "AI attempts this month",
      estimatedAiUsd: "Estimated AI cost, USD",
      operatingCostsUsd: "Operator-entered monthly costs, USD",
      usageContributionMarginPercent: "Directional contribution estimate, %",
      earlyAccessOptIns: "Early-access opt-ins",
      consentedPricingAccountsThisMonth: "Consented pricing-view accounts",
      uncertainOperations: "Operations needing reconciliation",
    })) {
      const card = el("article", null, "metric-card");
      card.append(
        el("span", label),
        el(
          "strong",
          r[key] == null
            ? "Not available"
            : key === "contractMrrCents"
              ? money(r[key])
              : String(r[key]),
        ),
      );
      $("#businessMetrics").append(card);
    }
    $("#businessStatus").textContent =
      `${r.environment === "sandbox" ? "SANDBOX TEST RECORDS. " : ""}${r.notes} ${r.marginBasis}`;
  } catch (e) {
    $("#businessStatus").textContent = e.message;
  }
}
$("#businessActions").append(button("Refresh verified metrics", metrics));
$("#conversionConsent").addEventListener("change", async (event) => {
  try {
    await api("pricing_viewed", { consent: event.target.checked });
    status(
      event.target.checked
        ? "Consented pricing view recorded."
        : "Analytics consent withdrawn; account-linked pricing counts were deleted.",
    );
  } catch (e) {
    event.target.checked = false;
    status(e.message);
  }
});
window.addEventListener("launchpad:auth", () => {
  sessionVersion++;
  stopCheckoutWatch();
  checkoutOwner = null;
  checkoutScope = null;
  checkoutPending = false;
  try {
    window.Paddle?.Checkout?.close();
  } catch {
    location.reload();
  }
  generation++;
  state = null;
  $("#businessMetrics").replaceChildren();
  $("#businessStatus").textContent =
    "Administrator status must be checked for this account.";
  $("#billingConsent").checked = false;
  $("#conversionConsent").checked = false;
  drawPricing();
  draw();
  if (window.launchpadSession && !$("#billingView").hidden) refresh();
});
window.addEventListener("launchpad:navigate", (event) => {
  if (event.detail === "billing") {
    loadCatalog();
    if (window.launchpadSession) refresh();
  }
  if (event.detail === "business") metrics();
});
const dashboardSummary = el("a", null, "helper");
dashboardSummary.id = "dashboardBillingSummary";
dashboardSummary.href = "#billing";
$("#dashboardView .screen-heading").after(dashboardSummary);
const panel = el("section", null, "panel section-pad");
panel.append(el("h2", "Subscription & AI requests"), el("p", null, "helper"));
panel.lastChild.id = "commercialSettingsSummary";
panel.append(button("Plans & Billing", () => navigate("billing")));
$("#settingsView").prepend(panel);
const home = el("section", null, "panel section-pad");
home.id = "commercialFeatures";
home.innerHTML = `<h2>From ambition to a repeatable career routine</h2><p>Organize applications, research employers and turn learning goals into an editable plan. Explore the working interface using your own or empty workspace; no sample records are inserted.</p><img src="assets/dashboard-preview.jpg" width="1200" height="800" loading="lazy" alt="Authentic Launchpad dashboard preview with an empty guest workspace" class="product-preview" /><div id="commercialCtas" class="button-row"></div><h2>Simple monthly plans</h2><p>Free local organization. Compare the current proposed Pro and Premium monthly prices and allowances. No checkout is enabled until configuration is complete.</p><div id="homePricingLink" class="button-row"></div><h2>Frequently asked questions</h2><details><summary>Can I start without an account?</summary><p>Yes. Guest tools save on this browser. Export JSON before clearing browser storage or moving domains.</p></details><details><summary>Are AI and job integrations already active?</summary><p>Only when the operator has configured and tested their secure backends. Unavailable services display an honest error. No vacancies or AI replies are fabricated.</p></details><details><summary>How do cancellation and refunds work?</summary><p>Use your Paddle billing portal or account cancellation controls. Access follows verified billing status. Review the billing policy; statutory rights remain subject to legal review.</p></details><details><summary>Are local records private per account?</summary><p>No. Guest records are shared in this browser profile. Verified cloud workspaces require the configured database and Row Level Security.</p></details><footer><h2>Contact & company information</h2><p id="operatorDetails">Operator identity and support contact pending. Commercial sales are disabled until configured and legally reviewed.</p><div id="commercialLegal" class="button-row"></div></footer>`;
$("#homeView").append(home);
$("#commercialCtas").append(
  button("Get Started Free", openFreeOrganizer, true),
  button("Create Free account", signup),
  button("Sign In", () => {
    $("#accountBtn").click();
    $("#signInMode")?.click();
  }),
  button("Explore Features", () => navigate("applications")),
  button("Interactive workspace preview", () => navigate("dashboard")),
);
$("#homePricingLink").append(
  button("View Pricing", () => navigate("billing")),
  button("Upgrade to Pro", () => navigate("billing"), true),
  button("Unlock Premium", () => navigate("billing")),
);
for (const [name, path] of [
  ["Privacy Policy", "legal/privacy.html"],
  ["Terms of Service", "legal/terms.html"],
  ["Refund & cancellation policy", "legal/billing.html"],
]) {
  const a = el("a", name, "button button-outline");
  a.href = path;
  $("#commercialLegal").append(a);
}
drawPricing();
draw();
navigate(pendingTransaction ? "billing" : location.hash.slice(1));
async function loadCatalog() {
  try {
    const r = await api("catalog");
    publicConfig = r;
    if (r.catalog?.free) {
      catalog = r.catalog;
      drawPricing();
    }
    draw();
    if (
      /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(r.supportEmail || "") &&
      !$("#supportContact")
    ) {
      const contact = el("a", "Contact support", "button button-outline");
      contact.id = "supportContact";
      contact.href = "mailto:" + r.supportEmail;
      $("#commercialLegal").append(contact);
    }
    if (r.businessName && r.supportEmail)
      $("#operatorDetails").textContent =
        `${r.businessName} · Support: ${r.supportEmail}. Review the published legal terms before purchasing.`;
  } catch (e) {
    status(
      e.message === "not-configured"
        ? "Account and billing services are not configured. Prices shown are proposals; guest tools remain available."
        : "Commercial configuration could not be checked. Prices shown are proposals; no checkout is confirmed.",
    );
  }
}
if (["home", "billing"].includes(location.hash.slice(1))) loadCatalog();
if (window.launchpadSession && location.hash === "#billing") refresh();
