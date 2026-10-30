const { test, expect } = require("@playwright/test");
const { seedCareer55 } = require("./helpers/career55-state.cjs");
const { configureCommercial } = require("./helpers/commercial-fixture.cjs");
const nav = async (page, v) => {
  await page.evaluate((v) => window.launchpadData.navigate(v), v);
  await expect(page.locator("#" + v + "View")).toBeVisible();
};
test("5.7 guest career preferences save, preserve newer drafts and survive reload and backup export", async ({
  page,
}) => {
  await page.goto("/#settings");
  await page.fill("#preference57-skills", "JavaScript, React");
  await page.fill("#preference57-countries", "Canada, Germany");
  await page
    .getByRole("button", { name: "Save career preferences", exact: true })
    .click();
  await expect(page.locator("#preference57Status")).toContainText(
    "saved in this workspace",
  );
  await page.reload();
  await expect(page.locator("#preference57-skills")).toHaveValue(
    "JavaScript, React",
  );
  await page.fill("#preference57-skills", "Unsaved new draft");
  await page.evaluate(() => window.launchpadData.navigate("dashboard"));
  await nav(page, "settings");
  await expect(page.locator("#preference57-skills")).toHaveValue(
    "Unsaved new draft",
  );
  const download = page.waitForEvent("download");
  await page
    .getByRole("button", { name: "Download JSON backup", exact: true })
    .click();
  const file = await (await download).path();
  const data = JSON.parse(require("node:fs").readFileSync(file, "utf8"));
  expect(JSON.stringify(data)).toContain("JavaScript, React");
  expect(JSON.stringify(data)).not.toContain("Unsaved new draft");
  page.once("dialog", (d) => d.accept());
  await page
    .getByRole("button", { name: "Clear guest records", exact: true })
    .click();
  await expect(page.locator("#preference57-skills")).toHaveValue("");
  page.once("dialog", (d) => d.accept());
  await page
    .locator("#restoreFile")
    .setInputFiles({
      name: "career57-backup.json",
      mimeType: "application/json",
      buffer: Buffer.from(JSON.stringify(data)),
    });
  await expect(page.locator("#toast")).toContainText("restored successfully");
  await page.reload();
  await nav(page, "settings");
  await expect(page.locator("#preference57-skills")).toHaveValue(
    "JavaScript, React",
  );
});
test("5.7 chart and snapshot use actual local records, preserve existing controls and show no invented outcomes", async ({
  page,
}) => {
  await seedCareer55(page);
  await page.goto("/#dashboard");
  await expect(page.locator("#momentum57Bars .momentum57-column")).toHaveCount(
    6,
  );
  await nav(page, "analytics");
  await expect(page.locator("#interviewSnapshot57")).toContainText(
    "not a historical interview conversion rate",
  );
  await nav(page, "home");
  for (const name of [
    "Explore jobs",
    "Open Resume Studio",
    "Build your roadmap",
  ])
    await expect(page.getByRole("link", { name, exact: true })).toBeVisible();
  await page
    .getByRole("link", { name: "Open Resume Studio", exact: true })
    .click();
  await expect(page.locator("#resumeView")).toBeVisible();
});
test("5.7 cloud preference consent and switching accounts never leak unsaved guest fields", async ({
  page,
}) => {
  const { PLANS } = await import("../lib/plans.mjs");
  const f = await configureCommercial(page, PLANS);
  f.setPlan("pro");
  await page.goto("/#settings");
  await page.fill("#preference57-skills", "Private guest draft");
  await page.click("#accountBtn");
  await page.fill("#authEmail", "buyer@example.com");
  await page.fill("#authPassword", "test-password");
  await page.click("#authSubmit");
  await expect(page.locator("#authStatus")).toContainText("Signed in as");
  await page.click("#closeAuthBtn");
  await expect(page.locator("#syncStatus")).toContainText(
    "Cloud workspace loaded",
  );
  await nav(page, "settings");
  await expect(page.locator("#preference57-skills")).toHaveValue("");
  await page.fill("#preference57-skills", "Account draft");
  await page
    .getByRole("button", { name: "Save career preferences", exact: true })
    .click();
  await expect(page.locator("#preference57Status")).toContainText(
    "Confirm private cloud storage",
  );
  await page.check("#preference57Consent");
  await page
    .getByRole("button", { name: "Save career preferences", exact: true })
    .click();
  await expect(page.locator("#preference57Status")).toContainText(
    "saved in this workspace",
  );
  await page.click("#useGuestBtn");
  await expect(page.locator("#preference57-skills")).toHaveValue("");
  await expect(page.locator("#preference57Consent")).not.toBeChecked();
});
for (const width of [1440, 768, 390])
  for (const theme of ["light", "dark"])
    test(`5.7 all career routes fit ${width}px in ${theme} with accessible new components`, async ({
      page,
    }) => {
      test.setTimeout(60000);
      const errors = [];
      page.on("pageerror", (e) => errors.push(e.message));
      await page.setViewportSize({ width, height: 1000 });
      await page.goto("/");
      if (theme === "dark") await page.click("#themeToggle");
      for (const view of [
        "home",
        "dashboard",
        "applications",
        "roadmap",
        "companies",
        "jobs",
        "resume",
        "interview",
        "coach",
        "analytics",
        "settings",
        "billing",
      ]) {
        await nav(page, view);
        expect(
          await page.evaluate(
            () => document.documentElement.scrollWidth <= innerWidth,
          ),
          view,
        ).toBe(true);
        await expect(page.locator("#" + view + "View h1")).toBeVisible();
      }
      await page.addScriptTag({ path: require.resolve("axe-core/axe.min.js") });
      for (const view of ["dashboard", "settings", "analytics"]) {
        await nav(page, view);
        const failures = await page.evaluate(async () =>
          (
            await axe.run(document, {
              runOnly: {
                type: "tag",
                values: ["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa"],
              },
            })
          ).violations.map((v) => ({
            id: v.id,
            nodes: v.nodes.map((n) => ({
              target: n.target,
              summary: n.failureSummary,
            })),
          })),
        );
        expect(failures, view).toEqual([]);
      }
      expect(errors).toEqual([]);
    });
test("5.7 cloud preferences keep newer typing while the submitted draft is pending", async ({
  page,
}) => {
  const { PLANS } = await import("../lib/plans.mjs");
  const f = await configureCommercial(page, PLANS);
  f.setPlan("pro");
  await page.goto("/#settings");
  await page.click("#accountBtn");
  await page.fill("#authEmail", "buyer@example.com");
  await page.fill("#authPassword", "test-password");
  await page.click("#authSubmit");
  await expect(page.locator("#authStatus")).toContainText("Signed in as");
  await page.click("#closeAuthBtn");
  await expect(page.locator("#syncStatus")).toContainText(
    "Cloud workspace loaded",
  );
  let release, arrived;
  const gate = new Promise((r) => (release = r)),
    waiting = new Promise((r) => (arrived = r));
  await page.route("**/rest/v1/rpc/commit_workspace", async (r) => {
    arrived();
    await gate;
    await r.fallback();
  });
  await page.check("#preference57Consent");
  await page.fill("#preference57-skills", "Submitted skills");
  await page
    .getByRole("button", { name: "Save career preferences", exact: true })
    .click();
  await waiting;
  await page.fill("#preference57-skills", "Newer typing");
  release();
  await expect(page.locator("#preference57Status")).toContainText(
    "Newer edits are still unsaved",
  );
  await expect(page.locator("#preference57-skills")).toHaveValue(
    "Newer typing",
  );
  await page.reload();
  await expect(page.locator("#preference57-skills")).toHaveValue(
    "Submitted skills",
  );
});
