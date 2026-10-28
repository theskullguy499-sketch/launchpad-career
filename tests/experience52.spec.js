const { test, expect } = require("@playwright/test");
const { configureCommercial } = require("./helpers/commercial-fixture.cjs");
async function fixture(page) {
  const { PLANS } = await import("../lib/plans.mjs");
  return configureCommercial(page, PLANS);
}
async function login(page) {
  await page.click("#accountBtn");
  await page.fill("#authEmail", "buyer@example.com");
  await page.fill("#authPassword", "test-password");
  await page.click("#authSubmit");
  await expect(page.locator("#authStatus")).toContainText("Signed in as");
  await page.click("#closeAuthBtn");
}
test("workspace pill, source label and sync status agree across account and guest transitions without email autofill", async ({
  page,
}) => {
  await fixture(page);
  await page.goto("/#applications");
  await expect(page.locator("#searchInput")).toHaveAttribute(
    "autocomplete",
    "off",
  );
  await page.fill("#searchInput", "support@example.org");
  await page.evaluate(() => window.launchpadData.navigate("companies"));
  await page.evaluate(() => window.launchpadData.navigate("applications"));
  await expect(page.locator("#searchInput")).toHaveValue("support@example.org");
  await login(page);
  await expect(page.locator("#workspaceLabel")).toContainText(
    "Account workspace",
  );
  await expect(page.locator("#workspaceModeText")).toContainText(
    "ACCOUNT DATA",
  );
  await expect(page.locator("#syncStatus")).toContainText(
    "Cloud workspace loaded",
  );
  await expect(page.locator("#searchInput")).not.toHaveValue(
    "buyer@example.com",
  );
  await page.click("#useGuestBtn");
  await expect(page.locator("#workspaceLabel")).toContainText(
    "Guest workspace",
  );
  await expect(page.locator("#workspaceModeText")).toContainText("GUEST DATA");
  await expect(page.locator("#syncStatus")).not.toContainText(
    "Cloud workspace loaded",
  );
  await expect(page.locator("body")).toHaveAttribute("data-workspace", "guest");
});
test("password controls are keyboard accessible, report actual requirements and reset visibility without persisting passwords", async ({
  page,
}) => {
  await fixture(page);
  await page.goto("/");
  await page.click("#accountBtn");
  await expect(page.locator("#termsConsentLabel")).toBeHidden();
  await page.click("#signUpMode");
  await expect(page.locator("#termsConsentLabel")).toBeVisible();
  await page.fill("#authPassword", "secure-fixture-password-52");
  await page.fill("#authConfirmPassword", "secure-fixture-password-52");
  await expect(
    page.locator("#passwordRequirements li[data-met=true]"),
  ).toHaveCount(2);
  await page.locator("#togglePassword").focus();
  await page.keyboard.press("Enter");
  await expect(page.locator("#authPassword")).toHaveAttribute("type", "text");
  await expect(page.locator("#togglePassword")).toHaveAttribute(
    "aria-pressed",
    "true",
  );
  await page.click("#closeAuthBtn");
  await page.click("#accountBtn");
  await expect(page.locator("#authPassword")).toHaveValue("");
  await expect(page.locator("#authPassword")).toHaveAttribute(
    "type",
    "password",
  );
  expect(await page.evaluate(() => JSON.stringify(localStorage))).not.toContain(
    "secure-fixture-password-52",
  );
});
test("reported job filters, progressive loading, bookmarks, tracker and JSON backups survive reload", async ({
  page,
}) => {
  await fixture(page);
  let requests = 0;
  await page.route("**/functions/v1/job-explorer", (r) => {
    requests++;
    return r.fulfill({
      json: {
        source: "Remotive",
        fetchedAt: "2026-10-01",
        jobs: Array.from({ length: 25 }, (_, i) => ({
          id: "fixture-" + i,
          title: "Position " + String(i).padStart(3, "0"),
          company: "Source fixture employer",
          location: "Worldwide",
          source: "Remotive",
          arrangement: "Remote",
          category: i % 2 ? "Design" : "Software",
          salary: i % 2 ? "" : "USD 80,000–100,000 per year",
          tags: ["JavaScript"],
          postedAt: "2026-10-01",
          url: "https://remotive.com/remote-jobs/fixture-" + i,
        })),
      },
    });
  });
  await page.goto("/#jobs");
  await page
    .getByRole("button", { name: "Find opportunities", exact: true })
    .click();
  await expect(page.locator("#jobResults .job-card")).toHaveCount(12);
  await page.click("#loadMoreJobs");
  await expect(page.locator("#jobResults .job-card")).toHaveCount(24);
  await page.selectOption("#jobCategory", "Design");
  await expect(page.locator("#jobResults .job-card")).toHaveCount(12);
  expect(requests).toBe(1);
  await page.selectOption("#jobCategory", "");
  await page.fill("#jobTitle", "Position 000");
  await expect(page.locator("#jobResults .job-card")).toHaveCount(1);
  await page
    .getByRole("button", { name: "Bookmark opportunity", exact: true })
    .click();
  await page.reload();
  await page.check("#jobSavedOnly");
  await expect(page.locator("#jobResults")).toContainText("Position 000");
  await expect(page.locator("#jobResults")).toContainText(
    "availability may have changed",
  );
  await page
    .getByRole("button", { name: "Save to tracker", exact: true })
    .click();
  await page.evaluate(() => window.launchpadData.navigate("applications"));
  await expect(page.locator("td strong")).toHaveText("Source fixture employer");
  const download = page.waitForEvent("download");
  await page.click("#backupBtn");
  const data = JSON.parse(
    require("node:fs").readFileSync(await (await download).path(), "utf8"),
  );
  expect(data.extras.preferences.savedJobs).toHaveLength(1);
  expect(data.applications[0].country).toBe("Other");
  expect(data.applications[0].arrangement).toBe("Remote");
});
for (const theme of ["light", "dark"])
  test(`studio composition fits 390px and preserves accessible navigation in ${theme}`, async ({
    page,
  }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto("/#dashboard");
    if (theme === "dark") await page.click("#themeToggle");
    await expect(page.locator(".studio-workbench")).toBeVisible();
    await expect(page.locator("#careerCompass")).toBeVisible();
    for (const view of [
      "dashboard",
      "jobs",
      "billing",
      "coach",
      "settings",
      "applications",
      "roadmap",
      "analytics",
    ]) {
      await page.evaluate((v) => window.launchpadData.navigate(v), view);
      expect(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= innerWidth + 1,
        ),
        view,
      ).toBe(true);
    }
    await page.addScriptTag({ path: require.resolve("axe-core/axe.min.js") });
    const violations = await page.evaluate(async () => {
      const result = await axe.run(document, {
        runOnly: {
          type: "tag",
          values: ["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa"],
        },
      });
      return result.violations.map((v) => ({
        id: v.id,
        nodes: v.nodes.map((n) => n.target),
      }));
    });
    expect(violations).toEqual([]);
  });
test("pricing comparison and methods copy disclose provider availability instead of promising wallets or receipts", async ({
  page,
}) => {
  await page.goto("/#billing");
  await expect(page.locator("#planComparisonTable")).toContainText(
    "Monthly AI request credits",
  );
  await expect(page.locator("#billingActivity")).toContainText(
    "not payment receipts",
  );
  await page
    .getByText("Which payment methods can I use?", { exact: true })
    .click();
  await expect(page.locator(".billing-faq")).toContainText("not promised");
  await expect(page.locator("#billingMode")).toContainText("not activated");
  await expect(page.locator("#pricingCards")).toContainText("$9.00/month");
  await expect(page.locator("#pricingCards")).toContainText("$19.00/month");
});

test("job bookmarks remain isolated between a signed-in account and the guest workspace", async ({
  page,
}) => {
  await fixture(page);
  await page.addInitScript(() => {
    if (!localStorage.getItem("launchpad-workspace-v4"))
      localStorage.setItem(
        "launchpad-workspace-v4",
        JSON.stringify({
          preferences: {
            savedJobs: [
              {
                id: "private-guest-bookmark",
                title: "Guest-only bookmarked role",
                company: "Guest source fixture",
                source: "Remotive",
                url: "https://remotive.com/remote-jobs/guest-fixture",
                tags: [],
              },
            ],
          },
        }),
      );
  });
  await page.goto("/#jobs");
  await page.check("#jobSavedOnly");
  await expect(page.locator("#jobResults")).toContainText(
    "Guest-only bookmarked role",
  );
  await login(page);
  await page.check("#jobSavedOnly");
  await expect(page.locator("#jobResults")).not.toContainText(
    "Guest-only bookmarked role",
  );
  page.once("dialog", (dialog) => dialog.accept());
  await page.click("#importJobBookmarks");
  await expect(page.locator("#jobResults .job-card")).toHaveCount(1);
  page.once("dialog", (dialog) => dialog.accept());
  await page.click("#importJobBookmarks");
  await expect(page.locator("#jobResults .job-card")).toHaveCount(1);
  await page.click("#accountBtn");
  await page.click("#signOutBtn");
  await page.click("#closeAuthBtn");
  await page.check("#jobSavedOnly");
  await expect(page.locator("#jobResults")).toContainText(
    "Guest-only bookmarked role",
  );
});

test("provider transactions are loaded explicitly, remain labeled Sandbox and clear on logout", async ({
  page,
}) => {
  await fixture(page);
  await page.route("**/functions/v1/billing", async (route) => {
    if (route.request().postDataJSON().action !== "transactions")
      return route.fallback();
    return route.fulfill({
      json: {
        source: "Paddle",
        environment: "sandbox",
        fetchedAt: "2026-10-28T12:00:00Z",
        transactions: [
          {
            id: "txn_owned_fixture",
            status: "completed",
            currency: "USD",
            total: "900",
            createdAt: "2026-10-28T12:00:00Z",
          },
        ],
      },
    });
  });
  await page.goto("/#billing");
  await login(page);
  await expect(page.locator("#providerTransactionRows")).toBeEmpty();
  await page
    .getByRole("button", { name: "Load provider transactions", exact: true })
    .click();
  await expect(page.locator("#providerTransactionRows")).toContainText(
    "sandbox",
  );
  await expect(page.locator("#providerTransactionRows")).toContainText(
    "completed · $9.00",
  );
  await page.click("#accountBtn");
  await page.click("#signOutBtn");
  await page.click("#closeAuthBtn");
  await expect(page.locator("#providerTransactionRows")).toBeEmpty();
});
