const { test, expect } = require("@playwright/test");
const { configureCommercial } = require("./helpers/commercial-fixture.cjs");
const { jobs53, mockJobs53 } = require("./helpers/jobs53-fixture.cjs");
const fs = require("node:fs");
async function configure(page) {
  const { PLANS } = await import("../lib/plans.mjs");
  const fixture = await configureCommercial(page, PLANS);
  await mockJobs53(page);
  return fixture;
}
async function search(page) {
  await page.goto("/#jobs");
  await page.click("#jobQuickSearch");
  await expect(page.locator(".job-card")).toHaveCount(2);
}
async function login(page) {
  await page.click("#accountBtn");
  await page.fill("#authEmail", "buyer@example.com");
  await page.fill("#authPassword", "test-password");
  await page.click("#authSubmit");
  await expect(page.locator("#authStatus")).toContainText("Signed in as");
}
test("retrieved description, source application link, keyboard tabs, bookmarks, tracker and JSON survive reload", async ({
  page,
}) => {
  await configure(page);
  await search(page);
  await page
    .locator(".job-card")
    .first()
    .getByRole("button", { name: "View details", exact: true })
    .click();
  await expect(page.locator("#jobDetailsTitle")).toHaveText(jobs53[0].title);
  await expect(page.locator("#jobPanel-overview")).toContainText(
    "UI TEST FIXTURE",
  );
  await expect(
    page.getByRole("link", { name: "Apply at source" }),
  ).toHaveAttribute("href", jobs53[0].url);
  await expect(
    page.getByRole("link", { name: "Apply at source" }),
  ).toHaveAttribute("rel", "noopener noreferrer");
  await page.getByRole("tab", { name: "Overview", exact: true }).focus();
  await page.keyboard.press("ArrowRight");
  await expect(page.getByRole("tab", { name: "Listing facts" })).toBeFocused();
  await expect(page.locator("#jobPanel-facts")).toContainText(
    "Salary (provider text)",
  );
  await expect(page.locator("#jobPanel-facts")).toContainText("Not supplied");
  await page.click("#detailBookmark");
  await expect(page.locator("#detailBookmark")).toHaveAttribute(
    "aria-pressed",
    "true",
  );
  await page.click("#detailSaveTracker");
  await expect(page.locator("#detailSaveTracker")).toHaveText(
    "Already in tracker",
  );
  await page.reload();
  await expect(page.locator("#jobDetailsTitle")).toHaveText(jobs53[0].title);
  await expect(page.locator("#jobPanel-overview")).toContainText(
    "UI TEST FIXTURE",
  );
  await page.getByRole("link", { name: "Back to results" }).click();
  await expect(page.locator("#jobQuery")).toBeFocused();
  await page.getByRole("button", { name: "Saved jobs", exact: true }).click();
  await expect(page.locator(".job-card")).toHaveCount(1);
  await page.evaluate(() => window.launchpadData.navigate("applications"));
  await expect(page.locator("#applicationsBody")).toContainText("Saved");
  const downloading = page.waitForEvent("download");
  await page.click("#backupBtn");
  const data = JSON.parse(
    fs.readFileSync(await (await downloading).path(), "utf8"),
  );
  expect(data.applications).toHaveLength(1);
  expect(data.applications[0].country).toBe("Other");
  expect(data.extras.preferences.savedJobs[0].descriptionText).toContain(
    "UI TEST FIXTURE",
  );
});
test("search, real reported job types, saved and tracked collections and removable filters share one state", async ({
  page,
}) => {
  await configure(page);
  await search(page);
  await page.selectOption("#jobEmploymentType", "contract");
  await expect(page.locator(".job-card")).toHaveCount(1);
  await expect(page.locator(".job-card")).toContainText("Product Designer");
  await page
    .getByRole("button", { name: "Remove filter: contract", exact: true })
    .click();
  await expect(page.locator(".job-card")).toHaveCount(2);
  await page.fill("#jobQuery", "TypeScript");
  await expect(page.locator(".job-card")).toHaveCount(1);
  await page.click("#clearJobFilters");
  await expect(page.locator(".job-card")).toHaveCount(2);
  await page
    .locator(".job-card")
    .first()
    .getByRole("button", { name: "Save to tracker", exact: true })
    .click();
  await page.getByRole("button", { name: "Tracked jobs", exact: true }).click();
  await expect(page.locator(".job-card")).toHaveCount(1);
  await page.getByRole("button", { name: "Saved jobs", exact: true }).click();
  await expect(page.locator(".job-card")).toHaveCount(0);
  await page.getByRole("button", { name: "All jobs", exact: true }).click();
  await expect(page.locator(".job-card")).toHaveCount(2);
});
test("details render external content as text and unavailable deep links never fetch a URL supplied by the fragment", async ({
  page,
}) => {
  await configure(page);
  let maliciousRequests = 0;
  page.on("request", (request) => {
    if (request.url().includes("evil.invalid")) maliciousRequests++;
  });
  await page.route("**/functions/v1/job-explorer", (route) =>
    route.fulfill({
      json: {
        source: "Remotive",
        jobs: [
          {
            ...jobs53[0],
            descriptionText:
              '<img src="https://evil.invalid/track" onerror="alert(1)"> literal source text',
          },
        ],
      },
    }),
  );
  await page.goto("/#jobs");
  await page.click("#jobQuickSearch");
  await page
    .locator(".job-card")
    .getByRole("button", { name: "View details" })
    .click();
  await expect(page.locator("#jobPanel-overview")).toContainText("<img src=");
  await expect(page.locator("#jobPanel-overview img")).toHaveCount(0);
  expect(maliciousRequests).toBe(0);
  await page.goto("/#jobs?job=https%3A%2F%2Fevil.invalid%2Ftrack");
  await expect(page.locator("#jobDetails")).toContainText(
    "This listing is not loaded",
  );
  expect(maliciousRequests).toBe(0);
});
test("a previous workspace detail is cleared before the next account can display it", async ({
  page,
}) => {
  await configure(page);
  await search(page);
  await page
    .locator(".job-card")
    .first()
    .getByRole("button", { name: "Bookmark opportunity" })
    .click();
  await page
    .locator(".job-card")
    .first()
    .getByRole("button", { name: "View details" })
    .click();
  await login(page);
  await page.click("#closeAuthBtn");
  await expect(page.locator("#jobDetails")).not.toContainText(
    "Responsibilities",
  );
  await expect(page.locator("#jobDetails")).toContainText(
    "This listing is not loaded",
  );
  await expect(page.locator("#jobDetails img")).toHaveCount(0);
});
test("signup keeps real confirmation pending and validation never claims an account is ready", async ({
  page,
}) => {
  await configure(page);
  let registrations = 0;
  await page.route("**/auth/v1/signup*", async (route) => {
    registrations++;
    await route.fulfill({
      json: {
        user: {
          id: "fixture-signup",
          email: "new@example.com",
          identities: [],
          email_confirmed_at: null,
        },
        session: null,
      },
    });
  });
  await page.goto("/");
  await page.click("#accountBtn");
  await page.click("#signUpMode");
  await page.fill("#authEmail", "not-an-email");
  await page.click("#authSubmit");
  await expect(page.locator("#authEmail")).toHaveAttribute(
    "aria-invalid",
    "true",
  );
  await expect(page.locator("#authStatus")).toHaveAttribute(
    "data-tone",
    "error",
  );
  await page.fill("#authEmail", "new@example.com");
  await page.fill("#authPassword", "a-valid-test-password");
  await page.fill("#authConfirmPassword", "a-valid-test-password");
  await page.click("#authSubmit");
  await expect(page.locator("#authStatus")).toContainText("at least 16");
  await expect(page.locator("#authPassword")).toHaveValue(
    "a-valid-test-password",
  );
  expect(registrations).toBe(0);
  await page.selectOption("#signupAge", "18+");
  await page.check("#signupTerms");
  await page.click("#authSubmit");
  await expect(page.locator("#emailVerificationPanel")).toBeVisible();
  await expect(
    page.locator("#registrationSteps [aria-current=step]"),
  ).toContainText("Confirm email");
  await expect(page.locator("#accountSetupPanel")).toBeHidden();
  expect(
    await page.evaluate(() => window.launchpadSession?.id ?? null),
  ).toBeNull();
  expect(registrations).toBe(1);
  expect(await page.evaluate(() => JSON.stringify(localStorage))).not.toContain(
    "a-valid-test-password",
  );
  await expect(page.locator("#authDialog")).not.toContainText(
    "Continue with Google",
  );
});
test("verified onboarding uses saved account facts and existing profile and goal forms", async ({
  page,
}) => {
  const fixture = await configure(page);
  fixture.setPlan("pro");
  await page.goto("/#dashboard");
  await login(page);
  await expect(page.locator("#accountSetupPanel")).toBeVisible();
  await page
    .locator("#accountSetupPanel")
    .getByRole("button", { name: "Set up my profile", exact: true })
    .click();
  await page.fill("#profileName", "Account fixture");
  await page
    .locator("#profileForm")
    .getByRole("button", { name: "Save profile & preferences" })
    .click();
  await expect(page.locator("#syncStatus")).toContainText("All changes saved");
  await page.click("#accountBtn");
  await expect(page.locator("#accountSetupStatus")).toContainText(
    "Profile saved",
  );
  await page
    .getByRole("button", { name: "Define my career goal", exact: true })
    .click();
  await page.getByRole("button", { name: "Add goal", exact: true }).click();
  await page
    .locator("#platformEditor [name=title]")
    .fill("A considered career");
  await page
    .locator("#platformEditor [name=targetRole]")
    .fill("Frontend Engineer");
  await page
    .locator("#platformEditor")
    .getByRole("button", { name: "Save", exact: true })
    .click();
  await expect(page.locator("#syncStatus")).toContainText("All changes saved");
  await page.click("#accountBtn");
  await expect(
    page.locator("#registrationSteps [aria-current=step]"),
  ).toContainText("Ready");
  await expect(page.locator("#accountSetupStatus")).toContainText(
    "profile and a career goal are saved",
  );
});
for (const width of [375, 390, 768, 1280, 1440])
  for (const theme of ["light", "dark"])
    test(`premium jobs details and Auth fit ${width}px in ${theme} with accessible controls`, async ({
      page,
    }) => {
      test.setTimeout(60000);
      await page.setViewportSize({ width, height: 1000 });
      await configure(page);
      await search(page);
      if (theme === "dark") await page.click("#themeToggle");
      const errors = [];
      page.on("pageerror", (error) => errors.push(error.message));
      for (const state of ["list", "detail", "signin", "signup"]) {
        if (state === "detail")
          await page
            .locator(".job-card")
            .first()
            .getByRole("button", { name: "View details" })
            .click();
        if (state === "signin") await page.click("#accountBtn");
        if (state === "signup") await page.click("#signUpMode");
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
            .then((result) =>
              result.violations.map((v) => ({
                id: v.id,
                nodes: v.nodes.map((n) => ({
                  target: n.target,
                  summary: n.failureSummary,
                })),
              })),
            ),
        );
        expect(violations, state).toEqual([]);
        expect(
          await page.evaluate(
            () => document.documentElement.scrollWidth <= innerWidth,
          ),
          state,
        ).toBeTruthy();
      }
      expect(errors).toEqual([]);
    });
