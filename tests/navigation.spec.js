const { test, expect } = require("@playwright/test");
const views = [
  "home",
  "dashboard",
  "applications",
  "companies",
  "jobs",
  "roadmap",
  "coach",
  "analytics",
  "settings",
];
for (const width of [320, 375, 390, 428, 768]) {
  test(`mobile drawer reaches every screen without overflow at ${width}px`, async ({
    page,
  }) => {
    test.setTimeout(60000);
    const errors = [];
    page.on("pageerror", (error) => errors.push(error.message));
    await page.setViewportSize({ width, height: 844 });
    await page.goto("/");
    const toggle = page.locator("#menuToggle");
    const sidebar = page.locator("#mainNavigation");
    await expect(sidebar).toBeHidden();
    for (const view of views) {
      await toggle.click();
      await expect(toggle).toHaveAttribute("aria-expanded", "true");
      await expect(sidebar).toHaveAttribute("aria-modal", "true");
      await expect(page.locator("#closeNavigation")).toBeFocused();
      expect(await page.locator("#mainContent").evaluate((e) => e.inert)).toBe(
        true,
      );
      await sidebar.locator(`[data-view="${view}"]`).click();
      await expect(page.locator(`#${view}View`)).toBeVisible();
      await expect(sidebar).toBeHidden();
      await expect(toggle).toHaveAttribute("aria-expanded", "false");
      await expect(page.locator("#mainContent")).toBeFocused();
      expect(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= innerWidth,
        ),
        view,
      ).toBe(true);
    }
    await toggle.click();
    await page.keyboard.press("Shift+Tab");
    await expect(sidebar.locator('[data-view="billing"]')).toBeFocused();
    await page.keyboard.press("Tab");
    await expect(page.locator("#closeNavigation")).toBeFocused();
    await page.keyboard.press("Escape");
    await expect(sidebar).toBeHidden();
    await expect(toggle).toBeFocused();
    await toggle.click();
    await page.mouse.click(width - 8, 400);
    await expect(toggle).toHaveAttribute("aria-expanded", "false");
    expect(await page.locator("#mainContent").evaluate((e) => e.inert)).toBe(
      false,
    );
    expect(errors).toEqual([]);
  });
}
for (const theme of ["light", "dark"]) {
  test(`mobile drawer and closed navigation pass axe in ${theme} theme`, async ({
    page,
  }) => {
    await page.setViewportSize({ width: 375, height: 812 });
    await page.emulateMedia({
      colorScheme: theme === "light" ? "dark" : "light",
      reducedMotion: "reduce",
    });
    await page.goto("/");
    if (theme === "dark") await page.click("#themeToggle");
    await page.addScriptTag({ path: require.resolve("axe-core/axe.min.js") });
    for (const open of [false, true]) {
      if (open) await page.click("#menuToggle");
      const violations = await page.evaluate(async () =>
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
      expect(violations).toEqual([]);
    }
  });
}
test("drawer adapts to desktop resizing and skip link preserves the selected route", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/#settings");
  await page.click("#menuToggle");
  await page.setViewportSize({ width: 1280, height: 900 });
  await expect(page.locator("#menuToggle")).toBeHidden();
  await expect(page.locator("#mainNavigation")).toBeVisible();
  await expect(page.locator("#mainNavigation")).not.toHaveAttribute(
    "aria-modal",
    "true",
  );
  expect(await page.locator("#mainContent").evaluate((e) => e.inert)).toBe(
    false,
  );
  await page.setViewportSize({ width: 390, height: 844 });
  await expect(page.locator("#mainNavigation")).toBeHidden();
  await page.locator(".skip-link").focus();
  await page.keyboard.press("Enter");
  await expect(page.locator("#mainContent")).toBeFocused();
  await expect(page.locator("#settingsView")).toBeVisible();
  await expect(page).toHaveURL(/#settings$/);
});

test("dismissing the drawer preserves scroll and selecting a page starts at the top", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 640 });
  await page.goto("/#settings");
  await page.evaluate(() => window.scrollTo(0, 300));
  const before = await page.evaluate(() => scrollY);
  expect(before).toBeGreaterThan(0);
  await page.click("#menuToggle");
  await expect(page.locator("#closeNavigation")).toBeFocused();
  await page.keyboard.press("Escape");
  expect(await page.evaluate(() => scrollY)).toBe(before);
  await page.click("#menuToggle");
  await page.locator('.nav-list [data-view="dashboard"]').click();
  await expect(page.locator("#dashboardView")).toBeVisible();
  expect(await page.evaluate(() => scrollY)).toBe(0);
});
test("rapid drawer reopens dismiss on an immediate outside pointer during animation", async ({
  page,
}) => {
  test.setTimeout(60000);
  await page.setViewportSize({ width: 375, height: 844 });
  await page.goto("/#settings");
  for (let i = 0; i < 12; i++) {
    await page.click("#menuToggle");
    await page.mouse.click(367, 400);
    await expect(page.locator("#menuToggle")).toHaveAttribute(
      "aria-expanded",
      "false",
    );
    expect(await page.locator("#mainContent").evaluate((e) => e.inert)).toBe(
      false,
    );
  }
});
