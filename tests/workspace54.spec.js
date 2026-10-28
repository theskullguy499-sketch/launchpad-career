const { test, expect } = require("@playwright/test");
const fs = require("node:fs");
const {
  seedWorkspace54,
  workspace54,
} = require("./helpers/workspace54-fixture.cjs");
const { configureCommercial } = require("./helpers/commercial-fixture.cjs");
async function nav(page, view) {
  await page.evaluate((v) => window.launchpadData.navigate(v), view);
  await expect(page.locator("#" + view + "View")).toBeVisible();
}
async function fixture(page) {
  const { PLANS } = await import("../lib/plans.mjs");
  const f = await configureCommercial(page, PLANS);
  f.setPlan("pro");
  return f;
}
async function signIn(page) {
  await page.click("#accountBtn");
  await page.fill("#authEmail", "buyer@example.com");
  await page.fill("#authPassword", "test-password");
  await page.click("#authSubmit");
  await expect(page.locator("#authStatus")).toContainText("Signed in as");
  await page.click("#closeAuthBtn");
}
test("application updates are recorded only after actual edits and survive reload and JSON replacement", async ({
  page,
}) => {
  await page.goto("/");
  await page.click("#addApplicationBtn");
  await page.fill("#company", "History employer");
  await page.fill("#role", "Engineer");
  await page.selectOption("#country", "Canada");
  await page.click("#submitDialogBtn");
  await page
    .locator("#applicationsBody")
    .getByRole("button", { name: "History", exact: true })
    .click();
  await expect(page.locator("#workspaceDetailDialog")).toContainText(
    "Opportunity created",
  );
  await page.getByRole("button", { name: "Close workspace details" }).click();
  await page.click("#boardViewBtn");
  await page
    .locator("[data-stage=Saved]")
    .getByLabel("Move to stage")
    .selectOption("Interview");
  await page
    .locator("[data-stage=Interview]")
    .getByRole("button", { name: "History", exact: true })
    .click();
  await expect(page.locator("#workspaceDetailDialog")).toContainText(
    "Saved → Interview",
  );
  await page.getByRole("button", { name: "Close workspace details" }).click();
  await page.reload();
  await page
    .locator("#applicationsBody")
    .getByRole("button", { name: "History", exact: true })
    .click();
  await expect(
    page.locator("#workspaceDetailDialog .application-update-list li"),
  ).toHaveCount(2);
  await page.getByRole("button", { name: "Close workspace details" }).click();
  const downloading = page.waitForEvent("download");
  await page.click("#backupBtn");
  const backup = await (await downloading).path();
  const data = JSON.parse(fs.readFileSync(backup, "utf8"));
  expect(data.applications[0].updates).toHaveLength(2);
  page.once("dialog", (d) => d.accept());
  await page.locator("#restoreFile").setInputFiles(backup);
  await expect(page.locator("#toast")).toContainText("restored");
  await page.reload();
  await page
    .locator("#applicationsBody")
    .getByRole("button", { name: "History", exact: true })
    .click();
  await expect(
    page.locator("#workspaceDetailDialog .application-update-list li"),
  ).toHaveCount(2);
});
test("application calendar derives actual dates and respects tracker filters with a seven-column mobile grid", async ({
  page,
}) => {
  await page.setViewportSize({ width: 375, height: 900 });
  await seedWorkspace54(page);
  await page.goto("/");
  await page.click("#calendarViewBtn");
  await page.fill("#applicationMonth", "2026-10");
  await expect(page.locator(".workspace-month-grid th")).toHaveCount(7);
  const columns = await page
    .locator(".workspace-month-grid th")
    .evaluateAll((es) => es.map((e) => e.getBoundingClientRect().x));
  expect(columns.every((x, i) => !i || x > columns[i - 1])).toBeTruthy();
  await expect(page.locator(".agenda-event")).toHaveCount(2);
  await page.fill("#searchInput", "Google");
  await expect(page.locator(".agenda-event")).toHaveCount(1);
  await expect(page.locator(".agenda-event")).toContainText("Interview");
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBeTruthy();
  await page.click("#tableViewBtn");
  await expect(page.locator("#tableWrap")).toBeVisible();
  await expect(page.locator("#applicationsBody")).toContainText("Google");
});
test("roadmap stage and text filtering preserve all existing goals and completion data", async ({
  page,
}) => {
  await seedWorkspace54(page);
  await page.goto("/#roadmap");
  await expect(page.locator("#roadmapStudioSummary")).toContainText("33%");
  await page.selectOption("#milestoneKind", "Weekly");
  await expect(
    page.locator("#personalMilestones .list-item:visible"),
  ).toHaveCount(1);
  await expect(
    page.locator("#personalMilestones .list-item:visible"),
  ).toContainText("accessible forms");
  await page.fill("#milestoneSearch", "no matching milestone");
  await expect(
    page.locator("#personalMilestones .list-item:visible"),
  ).toHaveCount(0);
  await page.fill("#milestoneSearch", "");
  await page.selectOption("#milestoneKind", "all");
  await expect(
    page.locator("#personalMilestones .list-item:visible"),
  ).toHaveCount(3);
  await page.reload();
  await expect(page.locator("#personalMilestones input:checked")).toHaveCount(
    1,
  );
});
test("analytics period excludes undated tracking timestamps and displays only recorded monthly data", async ({
  page,
}) => {
  await seedWorkspace54(page);
  await page.goto("/#analytics");
  await expect(
    page.locator("#analyticsMetrics .metric-card").first(),
  ).toContainText("4");
  await page.selectOption("#analyticsPeriod", "30");
  await expect(
    page.locator("#analyticsMetrics .metric-card").first(),
  ).toContainText("2");
  await expect(page.locator("#analyticsDatedTrend")).toContainText("2026-10");
  await expect(page.locator("#analyticsDatedTrend")).not.toContainText(
    "2025-05",
  );
  await page.selectOption("#analyticsPeriod", "all");
  await page.locator("#analyticsDatedTrend summary").click();
  await expect(page.locator("#analyticsDatedTrend tbody tr")).toHaveCount(2);
  await expect(page.locator("#analyticsDatedTrend")).toContainText(
    "1 selected records have no application date",
  );
});
test("company details use curated links and related tracked applications without hiring or rating claims", async ({
  page,
}) => {
  await seedWorkspace54(page);
  await page.goto("/#companies");
  await page.fill("#companySearch", "Google");
  await page
    .locator("#companyList")
    .getByRole("button", { name: "Company details", exact: true })
    .click();
  await expect(page.locator("#workspaceDetailDialog")).toContainText(
    "1 tracked applications",
  );
  await expect(page.locator("#workspaceDetailDialog")).toContainText(
    "Frontend Engineer",
  );
  await expect(page.locator("#workspaceDetailDialog")).toContainText(
    "No affiliation, hiring status",
  );
  await expect(
    page
      .locator("#workspaceDetailDialog")
      .getByRole("link", { name: "Company website" }),
  ).toHaveAttribute("rel", "noopener noreferrer");
  await page.getByRole("button", { name: "Close workspace details" }).click();
  await page
    .getByRole("button", { name: "Unfavorite Google", exact: true })
    .click();
  await page.reload();
  await page.fill("#companySearch", "Google");
  await expect(
    page.getByRole("button", { name: "Favorite Google", exact: true }),
  ).toBeVisible();
});
test("settings categories retain profile, notifications, privacy, theme and active-workspace exports", async ({
  page,
}) => {
  await seedWorkspace54(page);
  await page.goto("/#settings");
  await expect(page.locator(".settings-category-nav a")).toHaveCount(8);
  await page
    .locator(".settings-category-nav")
    .getByRole("link", { name: "Notifications", exact: true })
    .click();
  await expect(page.locator("#settings-notifications")).toBeFocused();
  await page.check("#emailPreference");
  await page
    .getByRole("button", { name: "Save notification preference", exact: true })
    .click();
  await expect(page.locator("#settingsStatus")).toContainText("saved");
  await page.click("#settingsThemeToggle");
  await expect(page.locator("body")).toHaveClass("dark");
  await page.reload();
  await expect(page.locator("#emailPreference")).toBeChecked();
  await expect(page.locator("body")).toHaveClass("dark");
  const downloading = page.waitForEvent("download");
  await page
    .getByRole("button", { name: "Download JSON backup", exact: true })
    .click();
  const backup = JSON.parse(
    fs.readFileSync(await (await downloading).path(), "utf8"),
  );
  expect(backup.applications).toHaveLength(4);
  expect(backup.extras.preferences.emailReminders).toBe(true);
  await expect(page.locator("#deletePassword")).toBeVisible();
});
test("coach uses real pending/error states, consented requests and owned history without canned responses", async ({
  page,
}) => {
  await fixture(page);
  const privateData = workspace54();
  privateData.aiHistory = [
    {
      id: "saved-exchange",
      prompt: "[UI fixture] Saved question",
      response: "[UI fixture] Saved answer",
      createdAt: "2026-10-28",
    },
  ];
  await page.route("**/rest/v1/rpc/load_workspace", (r) =>
    r.fulfill({ json: privateData }),
  );
  let count = 0,
    release;
  await page.route("**/functions/v1/ai-coach", (r) => {
    count++;
    const body = r.request().postDataJSON();
    expect(body.consent.profile).toBe(true);
    return new Promise((resolve) => {
      release = () =>
        r
          .fulfill({
            json: {
              response: "[UI fixture] Actual mocked provider result",
              provider: "Test provider",
              remaining: 2,
            },
          })
          .then(resolve);
    });
  });
  await page.goto("/#coach");
  await signIn(page);
  await page.fill("#coachPrompt", "Review my career next step");
  await page.check("#shareProfile");
  await page
    .locator("#coachForm")
    .getByRole("button", { name: "Ask coach", exact: true })
    .click();
  await expect(page.locator("#coachView")).toHaveAttribute(
    "data-coach-state",
    "loading",
  );
  await expect(page.locator("#newCoachConversation")).toBeDisabled();
  await expect.poll(() => typeof release).toBe("function");
  await release();
  await expect(page.locator("#coachResponse")).toContainText(
    "Actual mocked provider result",
  );
  await page.click("#newCoachConversation");
  await expect(page.locator("#coachResponse")).toBeEmpty();
  await expect(page.locator("#coachHistory details")).toHaveCount(1);
  await page.locator("#coachHistory summary").click();
  await page
    .locator("#coachHistory")
    .getByRole("button", { name: "Open exchange" })
    .click();
  await expect(page.locator("#coachResponse")).toHaveText(
    "[UI fixture] Saved answer",
  );
  expect(count).toBe(1);
});
test("owned application detail closes and private conversation content clears on SDK sign-out", async ({
  page,
}) => {
  await fixture(page);
  const data = workspace54();
  await page.route("**/rest/v1/rpc/load_workspace", (r) =>
    r.fulfill({ json: data }),
  );
  await page.goto("/");
  await signIn(page);
  await page
    .locator("#applicationsBody tr")
    .first()
    .getByRole("button", { name: "History", exact: true })
    .click();
  await expect(page.locator("#workspaceDetailDialog")).toBeVisible();
  await page.evaluate(async () => {
    const { getAuthClient } = await import("/auth-client.js");
    const client = await getAuthClient();
    await client.auth.signOut({ scope: "local" });
  });
  await expect(page.locator("#workspaceDetailDialog")).toBeHidden();
  await expect(page.locator("#workspaceLabel")).toContainText(
    "Guest workspace",
  );
  await expect(page.locator("#applicationsBody")).not.toContainText(
    "Frontend Engineer",
  );
});
for (const width of [375, 768, 1440])
  for (const theme of ["light", "dark"])
    test(`premium workspace screens remain accessible at ${width}px in ${theme}`, async ({
      page,
    }) => {
      test.setTimeout(120000);
      await seedWorkspace54(page);
      await page.setViewportSize({ width, height: 1000 });
      const errors = [];
      page.on("pageerror", (e) => errors.push(e.message));
      await page.goto("/");
      if (theme === "dark") await page.click("#themeToggle");
      for (const view of [
        "applications",
        "roadmap",
        "coach",
        "analytics",
        "companies",
        "settings",
      ]) {
        await nav(page, view);
        if (view === "applications") await page.click("#boardViewBtn");
        await page.addScriptTag({
          path: require.resolve("axe-core/axe.min.js"),
        });
        const violations = await page.evaluate(() =>
          axe
            .run(document, {
              runOnly: {
                type: "tag",
                values: ["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa"],
              },
            })
            .then((r) =>
              r.violations.map((v) => ({
                id: v.id,
                nodes: v.nodes.map((n) => ({
                  target: n.target,
                  summary: n.failureSummary,
                })),
              })),
            ),
        );
        expect(violations, view).toEqual([]);
        expect(
          await page.evaluate(
            () => document.documentElement.scrollWidth <= innerWidth,
          ),
          view,
        ).toBeTruthy();
      }
      expect(errors).toEqual([]);
    });
