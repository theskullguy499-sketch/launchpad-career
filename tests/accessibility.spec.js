const { test, expect } = require("@playwright/test");
for (const theme of ["light", "dark"])
  test(`WCAG automated scan of each main screen in ${theme} theme`, async ({
    page,
  }) => {
    test.setTimeout(60000);
    const failures = [];
    await page.goto("/");
    await page.addScriptTag({ path: require.resolve("axe-core/axe.min.js") });
    if (theme === "dark") await page.click("#themeToggle");
    for (const view of [
      "home",
      "dashboard",
      "applications",
      "companies",
      "jobs",
      "roadmap",
      "coach",
      "analytics",
      "settings",
    ]) {
      await page.locator(`.nav-list [data-view="${view}"]`).click();
      const violations = await page.evaluate(async () => {
        const result = await axe.run(document, {
          runOnly: { type: "tag", values: ["wcag2a", "wcag2aa", "wcag21aa"] },
        });
        return result.violations.map((v) => ({
          id: v.id,
          impact: v.impact,
          nodes: v.nodes.map((n) => ({
            target: n.target,
            summary: n.failureSummary,
          })),
        }));
      });
      if (violations.length) failures.push({ view, violations });
    }
    require("node:fs").writeFileSync(
      "test-results/axe-" + theme + ".json",
      JSON.stringify(failures, null, 2),
    );
    expect(failures).toEqual([]);
  });
test("dialogs have accessible names and keyboard focus/escape, including task editing", async ({
  page,
}) => {
  await page.goto("/");
  await page.addScriptTag({ path: require.resolve("axe-core/axe.min.js") });
  await page.click("#addApplicationBtn");
  await expect(page.locator("#company")).toBeFocused();
  await page.keyboard.press("Escape");
  await expect(page.locator("#applicationDialog")).toBeHidden();
  await page.locator('.nav-list [data-view="dashboard"]').focus();
  await page.keyboard.press("Enter");
  await expect(page.locator("#dashboardView")).toBeVisible();
  await page.click("#addTaskBtn");
  await expect(page.locator("#editor-title")).toBeFocused();
  const result = await page.evaluate(async () => {
    const r = await axe.run(document, {
      runOnly: { type: "tag", values: ["wcag2a", "wcag2aa", "wcag21aa"] },
    });
    return r.violations.map((v) => ({
      id: v.id,
      nodes: v.nodes.map((n) => n.target),
    }));
  });
  expect(result).toEqual([]);
  await page.keyboard.press("Escape");
  await expect(page.locator("#platformEditor")).toBeHidden();
  await page.locator(".skip-link").focus();
  await page.keyboard.press("Enter");
  await expect(page.locator("#mainContent")).toBeFocused();
});
