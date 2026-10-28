// Commercial presentation only. Entitlements and records are supplied by the server.
const $ = (s) => document.querySelector(s);
const el = (tag, text, cls) => {
  const n = document.createElement(tag);
  if (text !== undefined) n.textContent = String(text);
  if (cls) n.className = cls;
  return n;
};
export function mountBillingExperience(screen) {
  const comparison = el(
    "section",
    undefined,
    "panel section-pad plan-comparison",
  );
  comparison.id = "planComparison";
  comparison.append(
    el("h2", "Find the right room to grow"),
    el(
      "p",
      "Prices and limits come from the current catalog. Availability still depends on verified account and service configuration.",
      "helper",
    ),
  );
  const region = el("div", undefined, "comparison-scroll");
  region.tabIndex = 0;
  region.setAttribute("role", "region");
  region.setAttribute("aria-label", "Plan feature comparison");
  const table = el("table");
  table.id = "planComparisonTable";
  table.append(el("caption", "Compare Free, Pro and Premium"));
  region.append(table);
  comparison.append(region);
  screen.querySelector("#pricingDisclosure").after(comparison);
  const methods = el("div", undefined, "checkout-trust");
  methods.append(
    el("span", "↗", "checkout-trust-icon"),
    el(
      "p",
      "When enabled, payment details are entered only in Paddle’s secure checkout. Available methods depend on your country, currency, device and the merchant configuration.",
      "helper",
    ),
  );
  const shield = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  shield.setAttribute("viewBox", "0 0 24 24");
  shield.setAttribute("aria-hidden", "true");
  shield.setAttribute("fill", "none");
  shield.setAttribute("stroke", "currentColor");
  shield.setAttribute("stroke-width", "1.8");
  const shieldPath = document.createElementNS(shield.namespaceURI, "path");
  shieldPath.setAttribute(
    "d",
    "M12 3 4 6v6c0 5 8 9 8 9s8-4 8-9V6zM8 12l3 3 5-6",
  );
  shield.append(shieldPath);
  methods.firstChild.replaceChildren(shield);
  screen.querySelector("#pricingCards").before(methods);
  const methodsDetail = el("details");
  methodsDetail.append(
    el("summary", "Which payment methods can I use?"),
    el(
      "p",
      "Choose from the methods actually shown by Paddle in your checkout. Card brands, PayPal, Apple Pay, Google Pay and local methods are not promised for a transaction before the provider displays them. Launchpad never collects card numbers or CVV.",
      "helper",
    ),
  );
  screen.querySelector(".billing-faq")?.append(methodsDetail);
  const activity = el(
    "section",
    undefined,
    "panel section-pad billing-activity",
  );
  activity.id = "billingActivity";
  activity.append(
    el("h2", "Your billing activity"),
    el(
      "p",
      "Server-recorded requests and reconciliation state. These are not payment receipts or a complete charge history; use the provider portal for confirmed invoices, payment methods and next-charge details.",
      "helper",
    ),
  );
  const rows = el("div");
  rows.id = "billingActivityRows";
  activity.append(rows);
  const provider = el("div", undefined, "provider-transactions");
  provider.append(
    el("h3", "Provider transactions"),
    el(
      "p",
      "Load up to ten owned Sandbox transactions from Paddle on request. Amounts and statuses are provider-reported; refunds, adjustments and invoices must be checked in the provider portal.",
      "helper",
    ),
  );
  const slot = el("div");
  slot.id = "loadProviderTransactions";
  const output = el("div");
  output.id = "providerTransactionRows";
  provider.append(slot, output);
  activity.append(provider);
  screen
    .querySelector("#subscriptionSummary")
    .closest("section")
    .after(activity);
  const coach = el("p", undefined, "coach-credit-balance helper");
  coach.id = "coachCreditBalance";
  coach.setAttribute("role", "status");
  $("#coachForm").prepend(coach);
}
export function renderBillingExperience(catalog, state) {
  const table = $("#planComparisonTable");
  if (!table) return;
  table.replaceChildren(el("caption", "Compare Free, Pro and Premium"));
  const head = el("thead"),
    header = el("tr");
  for (const name of ["Capability", "Free", "Pro", "Premium"]) {
    const th = el("th", name);
    th.scope = "col";
    header.append(th);
  }
  head.append(header);
  table.append(head);
  const rows = [
    ["Local organizer and JSON backup", () => "Included"],
    [
      "Career tracker cloud editing",
      (p) => (p.cloud ? "Included" : "Local organizer only"),
    ],
    [
      "Saved opportunities",
      (p) =>
        p.applications == null
          ? "Not supplied"
          : `${p.applications}${p.cloud ? " cloud" : " local-interface"}`,
    ],
    [
      "Employer favorites",
      (p) => (p.favorites == null ? "Not supplied" : String(p.favorites)),
    ],
    ["Monthly AI request credits", (p) => String(p.aiMonthly ?? 0)],
    [
      "Advanced analytics and Kanban",
      (p) => (p.cloud ? "Cloud + local tools" : "Local portfolio tools"),
    ],
    ["AI consent controls", () => "Always required"],
  ];
  const body = el("tbody");
  for (const [name, value] of rows) {
    const row = el("tr"),
      label = el("th", name);
    label.scope = "row";
    row.append(label);
    for (const id of ["free", "pro", "premium"])
      row.append(el("td", value(catalog[id] || {})));
    body.append(row);
  }
  table.append(body);
  if (!state) $("#providerTransactionRows").replaceChildren();
  const activity = $("#billingActivityRows");
  activity.replaceChildren();
  if (!state)
    activity.append(
      el(
        "p",
        "Sign in and refresh billing to check server-recorded activity.",
        "empty-copy",
      ),
    );
  else if (!state.activity?.length)
    activity.append(
      el(
        "p",
        "No billing requests are available in the loaded server history.",
        "empty-copy",
      ),
    );
  for (const item of state?.activity || []) {
    const row = el("article", undefined, "billing-activity-row");
    row.dataset.state = item.state;
    const description = el("div");
    description.append(
      el(
        "strong",
        `${String(item.action).replaceAll("_", " ")}${item.plan ? " · " + item.plan : ""}`,
      ),
      el(
        "p",
        item.createdAt
          ? new Date(item.createdAt).toLocaleString("en-US")
          : "Date not supplied",
        "helper",
      ),
    );
    row.append(
      description,
      el(
        "span",
        item.providerConfirmed
          ? "Provider event confirmed"
          : item.state === "complete"
            ? "Request complete · awaiting provider confirmation"
            : item.state,
        "billing-state",
      ),
    );
    activity.append(row);
  }
  $("#coachCreditBalance").textContent = state
    ? `Server-confirmed ${state.entitlement.plan} access · ${state.entitlement.aiRemaining} monthly AI requests remaining${state.entitlement.legacy ? " · legacy grant" : ""}. Daily limits also apply.`
    : "AI credits have not been checked. Open Plans & Billing to load your server-confirmed allowance.";
  for (const card of document.querySelectorAll("#pricingCards .pricing-card")) {
    card.classList.toggle(
      "current-plan",
      !!state && card.dataset.plan === state.entitlement.plan,
    );
    const previous = card.querySelector(".current-plan-label");
    previous?.remove();
    if (state && card.dataset.plan === state.entitlement.plan)
      card.prepend(
        el(
          "span",
          state.entitlement.legacy
            ? "Legacy access"
            : "Current server-confirmed access",
          "current-plan-label",
        ),
      );
  }
}

export function renderProviderTransactions(result) {
  const output = $("#providerTransactionRows");
  output.replaceChildren();
  if (!Array.isArray(result.transactions))
    throw new Error("The provider returned no usable history.");
  if (result.notRequested) {
    output.append(
      el("p", result.notice || "No provider request was made.", "empty-copy"),
    );
    return;
  }
  output.append(
    el(
      "p",
      `${result.source || "Paddle"} · ${result.environment} · fetched ${result.fetchedAt || "time not supplied"}`,
      "helper",
    ),
  );
  if (!result.transactions.length)
    output.append(
      el(
        "p",
        "No owned transactions were returned by the provider.",
        "empty-copy",
      ),
    );
  for (const row of result.transactions) {
    const item = el("article", undefined, "billing-activity-row");
    const info = el("div");
    info.append(
      el("strong", row.id),
      el(
        "p",
        row.createdAt
          ? new Date(row.createdAt).toLocaleString("en-US")
          : "Date not supplied",
        "helper",
      ),
    );
    const formatter = new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: row.currency,
    });
    const amount =
      row.total == null
        ? "Amount not supplied"
        : formatter.format(
            Number(row.total) /
              10 ** formatter.resolvedOptions().maximumFractionDigits,
          );
    item.append(info, el("span", `${row.status} · ${amount}`, "billing-state"));
    output.append(item);
  }
}
