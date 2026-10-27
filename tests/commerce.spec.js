const { test, expect } = require("@playwright/test");
const { configureCommercial } = require("./helpers/commercial-fixture.cjs");
const plans = {
  free: {
    name: "Free",
    monthlyCents: 0,
    applications: 25,
    aiMonthly: 0,
    cloud: false,
  },
  pro: {
    name: "Pro",
    monthlyCents: 900,
    applications: 1000,
    favorites: 100,
    aiMonthly: 25,
    cloud: true,
  },
  premium: {
    name: "Premium",
    monthlyCents: 1900,
    applications: 1000,
    favorites: 200,
    aiMonthly: 100,
    cloud: true,
  },
};
async function login(page) {
  await page.click("#accountBtn");
  await page.fill("#authEmail", "buyer@example.com");
  await page.fill("#authPassword", "test-password");
  await page.click("#authSubmit");
  await expect(page.locator("#authStatus")).toContainText("Signed in as");
  await page.click("#closeAuthBtn");
}
test("proposed pricing, support/legal links and unconfigured commerce stay honest", async ({
  page,
}) => {
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto("/#billing");
  await expect(page.locator("#pricingCards")).toContainText("$9.00/month");
  await expect(page.locator("#billingMode")).toContainText("not activated");
  await page
    .getByRole("button", { name: "Upgrade to Pro", exact: true })
    .click();
  await expect(page.locator("#authDialog")).toBeVisible();
  await page.click("#closeAuthBtn");
  expect(errors).toEqual([]);
});
test("mocked sandbox checkout does not activate a plan or trust local entitlement edits", async ({
  page,
}) => {
  const fixture = await configureCommercial(page, plans);
  await page.goto("/#billing");
  await login(page);
  await expect(page.locator("#subscriptionSummary")).toContainText(
    "Current access: free",
  );
  await page
    .getByRole("button", { name: "Upgrade to Pro", exact: true })
    .click();
  await expect(page.locator("#billingStatus")).toContainText("accept");
  expect(fixture.calls.filter((c) => c.action === "checkout")).toHaveLength(0);
  await page.check("#billingConsent");
  await page
    .getByRole("button", { name: "Upgrade to Pro", exact: true })
    .click();
  await expect
    .poll(() => page.evaluate(() => window.mockCheckout?.transactionId))
    .toBe("txn_mocked");
  await page.evaluate(() => {
    localStorage.setItem("plan", "premium");
    window.mockPaddleEvent({ name: "checkout.completed" });
  });
  await expect(page.locator("#billingStatus")).toContainText(
    "verified server webhook",
  );
  await page
    .getByRole("button", { name: "Refresh status", exact: true })
    .click();
  await expect(page.locator("#subscriptionSummary")).toContainText(
    "Current access: free",
  );
  fixture.setPlan("pro");
  await page
    .getByRole("button", { name: "Refresh status", exact: true })
    .click();
  await expect(page.locator("#subscriptionSummary")).toContainText(
    "Current access: pro",
  );
  await expect(page.locator("#creditSummary")).toContainText("25 / 25");
});
test("an unprivileged customer cannot open business metrics by changing the route", async ({
  page,
}) => {
  await configureCommercial(page, plans);
  await page.goto("/#billing");
  await login(page);
  await expect(page.locator('.nav-list [data-view="business"]')).toBeHidden();
  await page.evaluate(() => window.launchpadData.navigate("business"));
  await expect(page.locator("#businessStatus")).toContainText(
    "Administrator access required",
  );
  await expect(page.locator("#businessMetrics .metric-card")).toHaveCount(0);
});
for (const theme of ["light", "dark"])
  test(`commercial mobile pricing and navigation pass axe in ${theme} theme`, async ({
    page,
  }) => {
    test.setTimeout(60000);
    await page.setViewportSize({ width: 375, height: 844 });
    await page.goto("/#billing");
    if (theme === "dark") await page.click("#themeToggle");
    await page.addScriptTag({ path: require.resolve("axe-core/axe.min.js") });
    const result = await page.evaluate(async () =>
      (
        await axe.run(document, {
          runOnly: { type: "tag", values: ["wcag2a", "wcag2aa", "wcag21aa"] },
        })
      ).violations.map((v) => ({
        id: v.id,
        nodes: v.nodes.map((n) => ({
          target: n.target,
          summary: n.failureSummary,
        })),
      })),
    );
    expect(result).toEqual([]);
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
    await page.click("#menuToggle");
    await page.locator('.nav-list [data-view="billing"]').click();
    await expect(page.locator("#menuToggle")).toHaveAttribute(
      "aria-expanded",
      "false",
    );
  });
test("optional conversion consent can be withdrawn and account-linked counts removed", async ({
  page,
}) => {
  const fixture = await configureCommercial(page, plans);
  await page.goto("/#billing");
  await login(page);
  await page.check("#conversionConsent");
  await expect(page.locator("#billingStatus")).toContainText("recorded");
  await page.uncheck("#conversionConsent");
  await expect(page.locator("#billingStatus")).toContainText("deleted");
  expect(
    fixture.calls
      .filter((c) => c.action === "pricing_viewed")
      .map((c) => c.consent),
  ).toEqual([true, false]);
});
test("legacy access and known minors are not offered redundant or ineligible paid checkout", async ({
  page,
}) => {
  const f = await configureCommercial(page, plans);
  f.setPlan("pro");
  f.setLegacy(true);
  await page.goto("/#billing");
  await login(page);
  await expect(page.locator("#subscriptionSummary")).toContainText(
    "legacy feature grant",
  );
  await expect(
    page.getByRole("button", { name: "Legacy access preserved" }),
  ).toHaveCount(2);
  f.setLegacy(false);
  f.setAge("16-17");
  await page
    .getByRole("button", { name: "Refresh status", exact: true })
    .click();
  await expect(
    page.getByRole("button", { name: "Adult contracting required" }),
  ).toHaveCount(2);
  expect(f.calls.filter((c) => c.action === "checkout")).toHaveLength(0);
});
test("an in-flight checkout cannot open after sign-out", async ({ page }) => {
  await configureCommercial(page, plans);
  let release, started;
  const gate = new Promise((r) => (release = r));
  const began = new Promise((r) => (started = r));
  await page.route("**/functions/v1/billing", async (route) => {
    if (route.request().postDataJSON().action === "checkout") {
      started();
      await gate;
    }
    await route.fallback();
  });
  await page.goto("/#billing");
  await login(page);
  await expect(page.locator("#subscriptionSummary")).toContainText(
    "Current access: free",
  );
  await page.check("#billingConsent");
  await page
    .getByRole("button", { name: "Upgrade to Pro", exact: true })
    .click();
  await began;
  await page.click("#accountBtn");
  await page.click("#signOutBtn");
  await expect(page.locator("#authStatus")).toContainText("Signed out");
  await page.click("#closeAuthBtn");
  release();
  await expect(page.locator("#billingStatus")).toContainText("account changed");
  expect(await page.evaluate(() => window.mockCheckout)).toBeNull();
  await expect(page.locator("#subscriptionSummary")).toContainText("Sign in");
});
test("provider checkout links are stripped and resumed through authenticated ownership checks", async ({
  page,
}) => {
  const f = await configureCommercial(page, plans);
  await page.goto("/?_ptxn=txn_mocked");
  await expect(page.locator("#billingView")).toBeVisible();
  await expect(page).not.toHaveURL(/_ptxn/);
  await login(page);
  await expect(page.locator("#subscriptionSummary")).toContainText(
    "Current access: free",
  );
  await page.check("#billingConsent");
  await page.getByRole("button", { name: "Resume checkout link" }).click();
  await expect
    .poll(() => page.evaluate(() => window.mockCheckout?.transactionId))
    .toBe("txn_mocked");
  expect(
    f.calls.find((c) => c.action === "resume_checkout").expected_user,
  ).toBe("00000000-0000-4000-8000-000000000001");
});
test("a Free account can explicitly choose the local organizer without copying guest records to cloud", async ({
  page,
}) => {
  await configureCommercial(page, plans);
  await page.goto("/#billing");
  await login(page);
  await expect(page.locator("#subscriptionSummary")).toContainText(
    "Current access: free",
  );
  await page
    .getByRole("button", { name: "Open local organizer", exact: true })
    .click();
  await expect(page.locator("#workspaceLabel")).toContainText(
    "Guest workspace",
  );
  await page.evaluate(() => window.launchpadData.navigate("applications"));
  await page.click("#addApplicationBtn");
  await page.fill("#company", "Local-only career record");
  await page.fill("#role", "Engineer");
  await page.selectOption("#country", "Brazil");
  await page.click("#submitDialogBtn");
  await expect(page.locator("td strong")).toHaveText(
    "Local-only career record",
  );
  await page.locator('.nav-list [data-view="billing"]').click();
  await page
    .getByRole("button", { name: "Open account profile", exact: true })
    .click();
  await expect(page.locator("#workspaceLabel")).toContainText(
    "Account workspace",
  );
  await expect(page.locator("#syncStatus")).toContainText(
    "Cloud workspace loaded",
  );
  await page.fill("#profileName", "Owned Free profile");
  await page
    .getByRole("button", { name: "Save profile & preferences" })
    .click();
  await expect(page.locator("#settingsStatus")).toContainText("saved");
  expect(
    await page.evaluate(
      () =>
        JSON.parse(localStorage.getItem("launchpad-opportunities-v1"))[0]
          .company,
    ),
  ).toBe("Local-only career record");
  expect(
    await page.evaluate(() => window.launchpadData.snapshot().applications),
  ).toEqual([]);
});
test("extended legacy guest backups can exceed the new Free interface limit without truncation", async ({
  page,
}) => {
  await configureCommercial(page, plans);
  await page.goto("/#billing");
  await login(page);
  await expect(page.locator("#subscriptionSummary")).toContainText(
    "Current access: free",
  );
  await page
    .getByRole("button", { name: "Open local organizer", exact: true })
    .click();
  await page.evaluate(() => window.launchpadData.navigate("applications"));
  const applications = Array.from({ length: 30 }, (_, i) => ({
    id: "legacy-" + i,
    company: "Kept Company " + i,
    role: "Engineer",
    country: "Brazil",
    status: "Saved",
    notes: "Existing personal record",
    createdAt: "2026-01-01T00:00:00Z",
  }));
  const backup = {
    app: "launchpad",
    formatVersion: 1,
    workspaceVersion: 4,
    applications,
    completed: [],
    extras: {
      companies: [],
      goals: [],
      milestones: [],
      tasks: [],
      profile: { display_name: "Kept Guest" },
      preferences: {},
    },
  };
  page.once("dialog", (d) => d.accept());
  await page
    .locator("#restoreFile")
    .setInputFiles({
      name: "existing-guest.json",
      mimeType: "application/json",
      buffer: Buffer.from(JSON.stringify(backup)),
    });
  await expect(page.locator("#toast")).toContainText("restored successfully");
  expect(
    await page.evaluate(
      () => window.launchpadData.snapshot().applications.length,
    ),
  ).toBe(30);
  await page.reload();
  expect(
    await page.evaluate(
      () =>
        JSON.parse(localStorage.getItem("launchpad-opportunities-v1")).length,
    ),
  ).toBe(30);
  await page.locator('.nav-list [data-view="billing"]').click();
  await expect(page.locator("#subscriptionSummary")).toContainText(
    "Current access: free",
  );
  await page
    .getByRole("button", { name: "Open local organizer", exact: true })
    .click();
  await page.evaluate(() => window.launchpadData.navigate("applications"));
  await expect(page.locator("td strong")).toHaveCount(30);
});
