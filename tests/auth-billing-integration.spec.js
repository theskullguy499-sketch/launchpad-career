const { test, expect } = require("@playwright/test");
const { cloudFixture } = require("./helpers/cloud-fixture.cjs");
const { configureCommercial } = require("./helpers/commercial-fixture.cjs");
const user = {
  id: "00000000-0000-4000-8000-000000000001",
  email: "fixture@example.com",
  email_confirmed_at: "2026-01-01",
  aud: "authenticated",
  role: "authenticated",
};
const tokens = () => ({
  access_token: "fixture-token",
  refresh_token: "fixture-refresh",
  token_type: "bearer",
  expires_in: 3600,
  user,
});
async function login(page) {
  await page.click("#accountBtn");
  await page.fill("#authEmail", "buyer@example.com");
  await page.fill("#authPassword", "test-password");
  await page.click("#authSubmit");
  await expect(page.locator("#authStatus")).toContainText("Signed in as");
  await page.click("#closeAuthBtn");
}
async function configureAnon(page) {
  const payload = {
    iss: "supabase",
    ref: "oyatshlhqdxosvbelsvp",
    role: "anon",
  };
  const key = [
    Buffer.from(JSON.stringify({ alg: "HS256", typ: "JWT" })).toString(
      "base64url",
    ),
    Buffer.from(JSON.stringify(payload)).toString("base64url"),
    "notARealSignature",
  ].join(".");
  await page.route("**/auth-config.js", (r) =>
    r.fulfill({
      contentType: "text/javascript",
      body: `window.LAUNCHPAD_AUTH_CONFIG=${JSON.stringify({ supabaseUrl: "https://oyatshlhqdxosvbelsvp.supabase.co", publishableKey: key })}`,
    }),
  );
  const cloud = cloudFixture();
  const calls = [];
  await page.route("https://oyatshlhqdxosvbelsvp.supabase.co/**", async (r) => {
    if (await cloud(r)) return;
    const path = new URL(r.request().url()).pathname;
    calls.push(path);
    if (path.endsWith("/user")) return r.fulfill({ json: user });
    return r.fulfill({
      json: path.endsWith("/verify") || path.endsWith("/token") ? tokens() : {},
    });
  });
  return calls;
}
for (const type of ["email", "recovery"])
  test(`legacy public anon config supports query ${type} callback without an open redirect`, async ({
    page,
  }) => {
    const calls = await configureAnon(page);
    await page.goto(
      `/auth/callback.html?token_hash=fixture-query-hash&type=${type}&next=https://evil.example/`,
    );
    await expect(page.locator("#accountBtn")).toHaveText("Account ✓");
    expect(page.url()).not.toContain("evil.example");
    expect(page.url()).not.toContain("token_hash");
    expect(calls).toContain("/auth/v1/verify");
    if (type === "recovery")
      await expect(page.locator("#authTitle")).toHaveText(
        "Reset your password",
      );
    else {
      await page.reload();
      await page.click("#accountBtn");
      await expect(page.locator("#authStatus")).toContainText("Signed in as");
    }
  });
for (const plan of ["pro", "premium"])
  test(`mocked ${plan} checkout completion waits for server confirmation and clears the dashboard on logout`, async ({
    page,
  }) => {
    const { PLANS } = await import("../lib/plans.mjs");
    const fixture = await configureCommercial(page, PLANS);
    await page.clock.install();
    await page.goto("/#billing");
    await login(page);
    await page.check("#billingConsent");
    await page
      .getByRole("button", {
        name: plan === "pro" ? "Upgrade to Pro" : "Unlock Premium",
        exact: true,
      })
      .click();
    await expect
      .poll(() => page.evaluate(() => window.mockCheckout?.transactionId))
      .toBe("txn_mocked");
    await page.evaluate(() => {
      localStorage.setItem("plan", "premium");
      window.mockPaddleEvent({
        name: "checkout.completed",
        data: { transaction_id: "txn_mocked" },
      });
    });
    await expect(page.locator("#billingStatus")).toContainText(
      "verified server webhook",
    );
    await expect(page.locator("#subscriptionSummary")).toContainText(
      "Current access: free",
    );
    fixture.setPlan(plan);
    await page.clock.runFor(4100);
    await expect(page.locator("#subscriptionSummary")).toContainText(
      "Current access: " + plan,
    );
    await expect(page.locator("#billingStatus")).toContainText(
      "confirmed by the server",
    );
    await page.evaluate(() => window.launchpadData.navigate("dashboard"));
    await expect(page.locator("#dashboardPlanStatus")).toContainText(
      "Server-confirmed access: " + plan,
    );
    await page.click("#accountBtn");
    await page.click("#signOutBtn");
    await page.click("#closeAuthBtn");
    const calls = fixture.calls.filter((c) => c.action === "status").length;
    await page.clock.runFor(30000);
    expect(fixture.calls.filter((c) => c.action === "status")).toHaveLength(
      calls,
    );
    await expect(page.locator("#dashboardPlanStatus")).not.toContainText(
      "Server-confirmed access: " + plan,
    );
  });
test("closing or failing mocked checkout does not activate access or create a second purchase", async ({
  page,
}) => {
  const { PLANS } = await import("../lib/plans.mjs");
  const fixture = await configureCommercial(page, PLANS);
  await page.goto("/#billing");
  await login(page);
  await page.check("#billingConsent");
  await page
    .getByRole("button", { name: "Upgrade to Pro", exact: true })
    .click();
  await expect
    .poll(() => page.evaluate(() => window.mockCheckout?.transactionId))
    .toBe("txn_mocked");
  await page.evaluate(() =>
    window.mockPaddleEvent({ name: "checkout.closed" }),
  );
  await expect(page.locator("#billingStatus")).toContainText("Checkout closed");
  await page.evaluate(() =>
    window.mockPaddleEvent({ name: "checkout.payment.failed" }),
  );
  await expect(page.locator("#billingStatus")).toContainText(
    "could not finish",
  );
  await expect(page.locator("#subscriptionSummary")).toContainText(
    "Current access: free",
  );
  expect(fixture.calls.filter((c) => c.action === "checkout")).toHaveLength(1);
});

test("slow public catalog does not lose the authenticated current billing terms version", async ({
  page,
}) => {
  const { PLANS } = await import("../lib/plans.mjs");
  const fixture = await configureCommercial(page, PLANS);
  let release;
  const waiting = new Promise((resolve) => (release = resolve));
  await page.route("**/functions/v1/billing", async (route) => {
    if (route.request().postDataJSON().action === "catalog") await waiting;
    await route.fallback();
  });
  try {
    await page.goto("/#billing");
    await login(page);
    await expect(page.locator("#subscriptionSummary")).toContainText(
      "Current access: free",
    );
    await page.check("#billingConsent");
    await page
      .getByRole("button", { name: "Upgrade to Pro", exact: true })
      .click();
    await expect
      .poll(
        () => fixture.calls.find((c) => c.action === "checkout")?.termsVersion,
      )
      .toBe("mock-v1");
  } finally {
    release();
  }
});

test("checkout confirmation retries are bounded and never turn a missing webhook into paid access", async ({
  page,
}) => {
  const { PLANS } = await import("../lib/plans.mjs");
  const fixture = await configureCommercial(page, PLANS);
  await page.clock.install();
  await page.goto("/#billing");
  await login(page);
  await expect(page.locator("#subscriptionSummary")).toContainText(
    "Current access: free",
  );
  await page.check("#billingConsent");
  await page
    .getByRole("button", { name: "Upgrade to Pro", exact: true })
    .click();
  await expect
    .poll(() => page.evaluate(() => window.mockCheckout?.transactionId))
    .toBe("txn_mocked");
  const initial = fixture.calls.filter((c) => c.action === "status").length;
  await page.evaluate(() =>
    window.mockPaddleEvent({ name: "checkout.completed" }),
  );
  for (let i = 1; i <= 6; i++) {
    await page.clock.runFor(4100);
    await expect
      .poll(() => fixture.calls.filter((c) => c.action === "status").length)
      .toBe(initial + i);
  }
  await expect(page.locator("#billingStatus")).toContainText(
    "No new purchase was started",
  );
  await page.clock.runFor(20000);
  expect(fixture.calls.filter((c) => c.action === "status")).toHaveLength(
    initial + 6,
  );
  expect(fixture.calls.filter((c) => c.action === "checkout")).toHaveLength(1);
  await expect(page.locator("#subscriptionSummary")).toContainText(
    "Current access: free",
  );
});
