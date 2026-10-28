const { test, expect } = require("@playwright/test");
const fs = require("node:fs");
for (const width of [375, 768, 1280, 1440]) {
  test(`premium screens fit ${width}px in both themes without script or asset errors`, async ({
    page,
  }) => {
    await page.setViewportSize({ width, height: 960 });
    const errors = [];
    page.on("pageerror", (e) => errors.push(e.message));
    page.on("response", (r) => {
      if (r.url().startsWith("http://127.0.0.1:8000") && r.status() >= 400)
        errors.push(`${r.status()} ${r.url()}`);
    });
    await page.goto("/#dashboard");
    for (const dark of [false, true]) {
      await page.evaluate((value) => {
        document.body.classList.toggle("dark", value);
        localStorage.setItem("launchpad-theme-v1", value ? "dark" : "light");
      }, dark);
      for (const screen of [
        "dashboard",
        "applications",
        "companies",
        "roadmap",
        "jobs",
        "coach",
        "analytics",
        "settings",
        "billing",
        "home",
      ]) {
        await page.evaluate(
          (view) => window.launchpadData.navigate(view),
          screen,
        );
        await expect(page.locator("#" + screen + "View")).toBeVisible();
        expect(
          await page.evaluate(
            () => document.documentElement.scrollWidth <= innerWidth + 1,
          ),
          `${screen} ${width} ${dark ? "dark" : "light"}`,
        ).toBe(true);
      }
    }
    expect(errors).toEqual([]);
  });
}
test("premium dashboard derives personal progress and recent applications from persisted records without rendering HTML", async ({
  page,
}) => {
  await page.addInitScript(() => {
    if (localStorage.getItem("premium-seeded")) return;
    localStorage.setItem("premium-seeded", "yes");
    localStorage.setItem(
      "launchpad-opportunities-v1",
      JSON.stringify([
        {
          id: "qa-app",
          company: "Google",
          role: "QA test role",
          country: "Canada",
          status: "Applied",
          applicationDate: "2026-10-01",
        },
      ]),
    );
    localStorage.setItem(
      "launchpad-workspace-v4",
      JSON.stringify({
        profile: {
          display_name: "<img src=x onerror=alert(1)>",
          age_band: "18+",
        },
        goals: [
          { id: "qa-goal", title: "QA career goal", targetRole: "QA Engineer" },
        ],
        milestones: [
          { id: "qa-one", title: "First test milestone", completed: true },
          { id: "qa-two", title: "Second test milestone", completed: false },
        ],
        tasks: [
          { id: "qa-task", title: "QA portfolio review", completed: false },
        ],
        preferences: { onboarded: true },
      }),
    );
  });
  await page.goto("/#dashboard");
  await expect(page.locator("#dashboardView h1")).toContainText(
    "<img src=x onerror=alert(1)>",
  );
  await expect(page.locator("#dashboardView h1 img")).toHaveCount(0);
  await expect(page.locator(".trajectory-ring strong")).toHaveText("50%");
  await expect(page.locator("#dashboardActivity")).toContainText("Google");
  await expect(page.locator("#dashboardFocus")).toContainText(
    "QA portfolio review",
  );
  await expect(
    page.locator("#dashboardMetrics .metric-card").first(),
  ).toContainText("1");
  await page.reload();
  await expect(page.locator(".trajectory-ring strong")).toHaveText("50%");
  await page.evaluate(() => window.launchpadData.navigate("applications"));
  const download = page.waitForEvent("download");
  await page.click("#backupBtn");
  const data = JSON.parse(
    fs.readFileSync(await (await download).path(), "utf8"),
  );
  expect(data.applications).toHaveLength(1);
  expect(data.extras.milestones).toHaveLength(2);
});
test("company marks follow curated identity and local fallback, while grid/list filters and favorites work", async ({
  page,
}) => {
  await page.goto("/#companies");
  await page.fill("#companySearch", "Google");
  const google = page.locator("#companyList .directory-card");
  await expect(google).toHaveCount(1);
  await expect(google.locator("img")).toHaveAttribute(
    "src",
    "assets/companies/google.svg",
  );
  expect(
    await google
      .locator("img")
      .evaluate((i) => i.complete && i.naturalWidth > 0),
  ).toBe(true);
  await page.getByRole("button", { name: "List view", exact: true }).click();
  await expect(page.locator("#companyList")).toHaveClass(/directory-list/);
  await page
    .getByRole("button", { name: "Favorite Google", exact: true })
    .click();
  await page.check("#favoritesOnly");
  await expect(google).toHaveCount(1);
  await page.uncheck("#favoritesOnly");
  await page.fill("#companySearch", "Microsoft");
  await expect(
    page.locator("#companyList .directory-card .employer-mark svg"),
  ).toHaveCount(1);
  await expect(page.locator("#companyList .directory-card img")).toHaveCount(0);
  await page.getByRole("button", { name: "Grid view", exact: true }).click();
  await expect(page.locator("#companyList")).not.toHaveClass(/directory-list/);
});
test("coach prompt suggestions do not send data or fabricate replies", async ({
  page,
}) => {
  const calls = [];
  page.on("request", (r) => {
    if (r.url().includes("/functions/v1/ai-coach")) calls.push(r.url());
  });
  await page.goto("/#coach");
  await page.getByRole("button", { name: "Plan my week", exact: true }).click();
  await expect(page.locator("#coachPrompt")).toBeFocused();
  await expect(page.locator("#coachPrompt")).toHaveValue(
    /weekly learning plan/,
  );
  await expect(page.locator("#coachResponse")).toBeEmpty();
  expect(calls).toEqual([]);
  for (const checkbox of [
    "shareProfile",
    "shareGoals",
    "shareProgress",
    "shareHistory",
  ])
    await expect(page.locator("#" + checkbox)).not.toBeChecked();
});
test("new dashboard widgets clear guest identity on account entry and restore it only on explicit logout", async ({
  page,
}) => {
  const { configureCommercial } = require("./helpers/commercial-fixture.cjs");
  const { PLANS } = await import("../lib/plans.mjs");
  await configureCommercial(page, PLANS);
  await page.addInitScript(() => {
    if (!localStorage.getItem("launchpad-workspace-v4"))
      localStorage.setItem(
        "launchpad-workspace-v4",
        JSON.stringify({
          profile: { display_name: "Guest-only identity" },
          preferences: { onboarded: true },
          goals: [
            { id: "private-guest-goal", targetRole: "Guest-only ambition" },
          ],
        }),
      );
  });
  await page.goto("/#dashboard");
  await expect(page.locator("#dashboardView h1")).toContainText(
    "Guest-only identity",
  );
  await expect(page.locator("#dashboardJourney")).toContainText(
    "Guest-only ambition",
  );
  await page.click("#accountBtn");
  await page.fill("#authEmail", "buyer@example.com");
  await page.fill("#authPassword", "test-password");
  await page.click("#authSubmit");
  await expect(page.locator("#authStatus")).toContainText("Signed in as");
  await page.click("#closeAuthBtn");
  await expect(page.locator("#workspaceLabel")).toContainText(
    "Account workspace",
  );
  await expect(page.locator("#dashboardView")).not.toContainText(
    "Guest-only identity",
  );
  await expect(page.locator("#dashboardJourney")).not.toContainText(
    "Guest-only ambition",
  );
  await page.click("#accountBtn");
  await page.click("#signOutBtn");
  await page.click("#closeAuthBtn");
  await expect(page.locator("#dashboardView h1")).toContainText(
    "Guest-only identity",
  );
  await expect(page.locator("#dashboardJourney")).toContainText(
    "Guest-only ambition",
  );
});

for (const theme of ["light", "dark"]) {
  test(`WCAG 2.2 AA target checks on premium screens and account dialog in ${theme}`, async ({
    page,
  }) => {
    await page.goto("/#dashboard");
    if (theme === "dark") await page.click("#themeToggle");
    await page.addScriptTag({ path: require.resolve("axe-core/axe.min.js") });
    const scan = async () => {
      const violations = await page.evaluate(async () => {
        const result = await axe.run(document, {
          runOnly: { type: "tag", values: ["wcag22aa"] },
        });
        return result.violations.map((v) => ({
          id: v.id,
          nodes: v.nodes.map((n) => n.target),
        }));
      });
      expect(violations).toEqual([]);
    };
    for (const view of [
      "dashboard",
      "companies",
      "applications",
      "roadmap",
      "coach",
      "billing",
    ]) {
      await page.evaluate((v) => window.launchpadData.navigate(v), view);
      await scan();
    }
    await page.click("#accountBtn");
    await expect(page.locator("#authDialog")).toBeVisible();
    await scan();
  });
}

test("dashboard access summary uses server-confirmed entitlement and clears it on logout", async ({
  page,
}) => {
  const { configureCommercial } = require("./helpers/commercial-fixture.cjs");
  const { PLANS } = await import("../lib/plans.mjs");
  const backend = await configureCommercial(page, PLANS);
  await page.goto("/#dashboard");
  await expect(page.locator("#dashboardPlanStatus")).toContainText(
    "Guest workspace",
  );
  await page.evaluate(() => {
    localStorage.setItem("launchpad-plan", "premium");
  });
  await expect(page.locator("#dashboardPlanStatus")).not.toContainText(
    "Access: premium",
  );
  await page.click("#accountBtn");
  await page.fill("#authEmail", "buyer@example.com");
  await page.fill("#authPassword", "test-password");
  await page.click("#authSubmit");
  await expect(page.locator("#authStatus")).toContainText("Signed in as");
  await page.click("#closeAuthBtn");
  backend.setPlan("premium");
  await page.click("#dashboardPlanStatus");
  await expect(page.locator("#subscriptionSummary")).toContainText(
    "Current access: premium",
  );
  await page.evaluate(() => window.launchpadData.navigate("dashboard"));
  await expect(page.locator("#dashboardPlanStatus")).toContainText(
    "Sandbox · Access: premium",
  );
  await page.click("#accountBtn");
  await page.click("#signOutBtn");
  await page.click("#closeAuthBtn");
  await expect(page.locator("#dashboardPlanStatus")).toContainText(
    "Guest workspace",
  );
});
