const { test, expect } = require("@playwright/test");
const { seedCareer55 } = require("./helpers/career55-state.cjs");
const { mockJobs53 } = require("./helpers/jobs53-fixture.cjs");
const { configureCommercial } = require("./helpers/commercial-fixture.cjs");
const nav = async (p, v) => {
  await p.evaluate((v) => window.launchpadData.navigate(v), v);
  await expect(p.locator("#" + v + "View")).toBeVisible();
};
async function configured(page) {
  const { PLANS } = await import("../lib/plans.mjs");
  return configureCommercial(page, PLANS);
}
test("5.8 demos are explicit isolated previews, not listings, saved data or AI responses", async ({
  page,
}) => {
  await page.goto("/#jobs");
  const before = await page.evaluate(() => JSON.stringify(localStorage));
  await page
    .getByRole("button", { name: "Preview job search demo", exact: true })
    .click();
  await expect(page.locator("#demo58Dialog")).toContainText("DEMO ONLY");
  await expect(
    page.getByRole("button", {
      name: "Application disabled — no real vacancy",
    }),
  ).toBeDisabled();
  await expect(page.locator(".job-card")).toHaveCount(0);
  await page.keyboard.press("Escape");
  await expect(
    page.getByRole("button", { name: "Preview job search demo", exact: true }),
  ).toBeFocused();
  await nav(page, "coach");
  await page
    .getByRole("button", { name: "Preview assistant demo", exact: true })
    .click();
  await expect(page.locator("#demo58Dialog")).toContainText(
    "Scripted example, not AI",
  );
  await expect(page.locator("#coachResponse")).toHaveText("");
  await page.keyboard.press("Escape");
  expect(await page.evaluate(() => JSON.stringify(localStorage))).toBe(before);
});
test("5.8 sourced recent history, recommendations and consented comparison use actual active data only", async ({
  page,
}) => {
  await configured(page);
  await mockJobs53(page);
  await seedCareer55(page);
  let aiCalls = 0;
  await page.route("**/functions/v1/ai-coach", (r) => {
    aiCalls++;
    return r.fulfill({
      status: 503,
      json: { error: "Test provider unavailable" },
    });
  });
  await page.goto("/#dashboard");
  await expect(page.locator("#resumeReadiness58")).toContainText(
    "7 of 7 fields present",
  );
  await nav(page, "jobs");
  await page.click("#jobQuickSearch");
  await page
    .locator(".job-card")
    .first()
    .getByRole("button", { name: "View details", exact: true })
    .click();
  await expect(page.locator("#comparison58")).toBeVisible();
  page.once("dialog", (d) => d.dismiss());
  await page.click("#prepareComparison58");
  await expect(page.locator("#jobDetails")).toBeVisible();
  expect(aiCalls).toBe(0);
  page.once("dialog", (d) => d.accept());
  await page.click("#prepareComparison58");
  await expect(page.locator("#coachView")).toBeVisible();
  await expect(page).toHaveURL(/#coach$/);
  await expect(page.locator("#coachPrompt")).toHaveValue(
    /Compare my self-declared resume/,
  );
  await expect(page.locator("#coachPrompt")).not.toHaveValue(
    /fixture@example\.com/,
  );
  expect(aiCalls).toBe(0);
  await nav(page, "dashboard");
  await expect(page.locator("#recommendations58 .opportunity58")).toHaveCount(
    2,
  );
  await nav(page, "jobs");
  await page.locator("#recentJobs58 summary").click();
  await expect(page.locator("#recentJobs58List")).toContainText(
    "Frontend Engineer",
  );
  await page.reload();
  await expect(page.locator("#recentJobs58List")).toContainText(
    "Open a retrieved",
  );
});
test("5.8 history clears on workspace changes while bookmarks remain in guest data", async ({
  page,
}) => {
  const fixture = await configured(page);
  fixture.setPlan("pro");
  await mockJobs53(page);
  await seedCareer55(page);
  await page.goto("/#jobs");
  await page.click("#jobQuickSearch");
  await page
    .locator(".job-card")
    .first()
    .getByRole("button", { name: "View details", exact: true })
    .click();
  await page.click("#accountBtn");
  await page.fill("#authEmail", "buyer@example.com");
  await page.fill("#authPassword", "test-password");
  await page.click("#authSubmit");
  await expect(page.locator("#authStatus")).toContainText("Signed in as");
  await page.click("#closeAuthBtn");
  await expect(page.locator("#syncStatus")).toContainText(
    "Cloud workspace loaded",
  );
  await expect(page.locator("#recentJobs58List")).not.toContainText(
    "Frontend Engineer",
  );
  await page.click("#useGuestBtn");
  await nav(page, "jobs");
  await expect(page).toHaveURL(/#jobs$/);
  await page.locator('.jobs-collection-tab[data-collection="saved"]').click();
  await expect(page.locator(".job-card")).toHaveCount(1);
});
test("5.8 demos reopen without a queued close clearing the new preview", async ({
  page,
}) => {
  await page.goto("/#jobs");
  await page
    .getByRole("button", { name: "Preview job search demo", exact: true })
    .click();
  await page.evaluate(() => {
    document.querySelector("#demo58Dialog").close();
    document.querySelector("#jobsView .screen-heading button").click();
  });
  await expect(page.locator("#demo58Dialog")).toBeVisible();
  await expect(page.locator("#demo58Dialog")).toContainText(
    "Illustrative frontend role",
  );
});
for (const width of [1440, 768, 390])
  for (const theme of ["light", "dark"])
    test(`5.8 core surfaces and demo fit ${width}px in ${theme} with WCAG checks`, async ({
      page,
    }) => {
      test.setTimeout(60000);
      const errors = [];
      page.on("pageerror", (e) => errors.push(e.message));
      await page.setViewportSize({ width, height: 1050 });
      await page.goto("/");
      if (theme === "dark") await page.click("#themeToggle");
      await page.addScriptTag({ path: require.resolve("axe-core/axe.min.js") });
      for (const view of ["dashboard", "jobs", "coach", "settings"]) {
        await nav(page, view);
        const violations = await page.evaluate(async () =>
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
        expect(violations, view).toEqual([]);
        expect(
          await page.evaluate(
            () => document.documentElement.scrollWidth <= innerWidth + 1,
          ),
          view,
        ).toBe(true);
      }
      await page
        .getByRole("button", { name: "Preview assistant demo", exact: true })
        .count();
      await nav(page, "coach");
      await page
        .getByRole("button", { name: "Preview assistant demo", exact: true })
        .click();
      const bad = await page.evaluate(async () =>
        (
          await axe.run(document, {
            runOnly: {
              type: "tag",
              values: ["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa"],
            },
          })
        ).violations.map((v) => v.id),
      );
      expect(bad).toEqual([]);
      expect(errors).toEqual([]);
    });
test("5.8 initial bookmarked detail links mount comparison without a previous listing search", async ({
  page,
}) => {
  await configured(page);
  await seedCareer55(page);
  const { jobs53 } = require("./helpers/jobs53-fixture.cjs");
  await page.goto(
    "/#jobs?job=" + encodeURIComponent("Remotive:" + jobs53[0].id),
  );
  await expect(page.locator("#comparison58")).toBeVisible();
  await expect(page.locator("#prepareComparison58")).toBeEnabled();
  await expect(page.locator("#recentJobs58List")).toContainText(
    "Frontend Engineer",
  );
});
test("5.8 arrangement filters expose hybrid/on-site only when source metadata supplies them", async ({
  page,
}) => {
  await configured(page);
  const rows = ["Hybrid", "On-site", "Remote"].map((arrangement, i) => ({
    id: "arrangement-" + i,
    title: "[Test fixture] Engineer",
    company: "UI fixture employer",
    url: "https://example.com/fixture/" + i,
    source: "Authorized adapter test fixture",
    arrangement,
    tags: [],
    location: "Test region",
    salary: "",
  }));
  await page.route("**/functions/v1/job-explorer", (r) =>
    r.fulfill({ json: { source: "Adapter test fixture", jobs: rows } }),
  );
  await page.goto("/#jobs");
  await expect(page.locator("#jobRemote option")).toHaveCount(2);
  await page.click("#jobQuickSearch");
  await expect(page.locator("#jobRemote option")).toHaveCount(4);
  await page.selectOption("#jobRemote", "Hybrid");
  await expect(page.locator(".job-card")).toHaveCount(1);
  await expect(page.locator(".job-card")).toContainText("Hybrid");
});
test("5.8 opening a mobile listing starts at its header instead of retaining results scroll", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await configured(page);
  await mockJobs53(page);
  await page.goto("/#jobs");
  await page.click("#jobQuickSearch");
  const action = page
    .locator(".job-card")
    .first()
    .getByRole("button", { name: "View details", exact: true });
  await action.scrollIntoViewIfNeeded();
  expect(await page.evaluate(() => scrollY)).toBeGreaterThan(0);
  await action.click();
  await expect(page.locator("#jobDetailsTitle")).toBeVisible();
  await expect.poll(() => page.evaluate(() => scrollY)).toBe(0);
  await expect(page.locator("#jobDetails")).toBeFocused();
});
test('5.8 changing pages clears stale scroll so mobile category targets remain unobscured',async({page})=>{
 await page.setViewportSize({width:375,height:1000});await page.goto('/#companies');await page.evaluate(()=>scrollTo(0,400));expect(await page.evaluate(()=>scrollY)).toBeGreaterThan(0);await nav(page,'settings');await expect.poll(()=>page.evaluate(()=>scrollY)).toBe(0);const headerBottom=await page.locator('#mobileHeader').evaluate(e=>e.getBoundingClientRect().bottom);for(const link of await page.locator('.settings-category-nav a').all()){const top=await link.evaluate(e=>e.getBoundingClientRect().top);expect(top).toBeGreaterThanOrEqual(headerBottom);}
});
