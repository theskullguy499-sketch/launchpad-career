const { test, expect } = require("@playwright/test");
for (const theme of ["light", "dark"])
  test(`WCAG automated scan of each main screen in ${theme} theme`, async ({
    page,
  }, testInfo) => {
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
    await testInfo.attach("axe-" + theme, {
      body: JSON.stringify(failures, null, 2),
      contentType: "application/json",
    });
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

for (const theme of ["light", "dark"]) {
  test(`form fields, populated tracker and primary hover retain contrast in ${theme} theme`, async ({
    page,
  }) => {
    test.setTimeout(60000);
    // The application theme must also win over the opposite browser color scheme.
    await page.emulateMedia({
      colorScheme: theme === "dark" ? "light" : "dark",
    });
    await page.goto("/");
    await page.addScriptTag({ path: require.resolve("axe-core/axe.min.js") });
    if (theme === "dark") await page.click("#themeToggle");
    const scan = async () => {
      const violations = await page.evaluate(async () => {
        const result = await axe.run(document, {
          runOnly: { type: "tag", values: ["wcag2a", "wcag2aa", "wcag21aa"] },
        });
        return result.violations.map((v) => ({
          id: v.id,
          nodes: v.nodes.map((n) => ({
            target: n.target,
            summary: n.failureSummary,
          })),
        }));
      });
      expect(violations).toEqual([]);
    };
    await page.click("#addApplicationBtn");
    await page.fill("#company", "Visible Company");
    await page.fill("#role", "Frontend Engineer");
    await page.selectOption("#country", "Brazil");
    await page.fill("#notes", "Visible notes");
    await page.locator("#submitDialogBtn").hover();
    await scan();
    await page.click("#submitDialogBtn");
    await expect(page.locator("td strong")).toHaveText("Visible Company");
    await page.selectOption("#statusFilter", "Saved");
    await page.locator("#addApplicationBtn").hover();
    await scan();
    await page.locator('.nav-list [data-view="home"]').click();
    await page.locator("#landingActions .button-primary").hover();
    await scan();
    await page.locator('.nav-list [data-view="settings"]').click();
    await page.fill("#profileName", "Visible Profile");
    await page.selectOption("#profileAge", "18+");
    await page.locator("#profileForm .button-primary").hover();
    await scan();
    await page.reload();
    await expect(page.locator("body")).toHaveClass(
      theme === "dark" ? /dark/ : /^$/,
    );
  });
}
