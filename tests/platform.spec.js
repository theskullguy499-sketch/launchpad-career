const { test, expect } = require("@playwright/test");
const { cloudFixture } = require("./helpers/cloud-fixture.cjs");
const errorsByPage = new WeakMap();
test.beforeEach(async ({ page }) => {
  const errors = [];
  errorsByPage.set(page, errors);
  page.on("pageerror", (e) => errors.push(e.message));
});
test.afterEach(async ({ page }) => {
  expect(errorsByPage.get(page)).toEqual([]);
});
const nav = (page, view) =>
  page.locator(`.nav-list [data-view="${view}"]`).click();
async function add(page, name = "Launchpad Test Company") {
  await page.click("#addApplicationBtn");
  await page.fill("#company", name);
  await page.fill("#role", "Frontend Developer");
  await page.selectOption("#country", "Brazil");
  await page.click("#submitDialogBtn");
}
async function configure(page, { failCloud = false, service } = {}) {
  await page.route("**/auth-config.js", (r) =>
    r.fulfill({
      contentType: "text/javascript",
      body: "window.LAUNCHPAD_AUTH_CONFIG={supabaseUrl:'https://platform-test.supabase.co',publishableKey:'sb_publishable_browser_test'};",
    }),
  );
  let user;
  const states = new Map();
  await page.route("https://platform-test.supabase.co/**", async (r) => {
    const path = new URL(r.request().url()).pathname;
    if (path.endsWith("/token")) {
      const email = r.request().postDataJSON().email;
      user = {
        id: email.startsWith("alice")
          ? "00000000-0000-0000-0000-000000000001"
          : "00000000-0000-0000-0000-000000000002",
        email,
        email_confirmed_at: "2026-01-01",
        last_sign_in_at: new Date().toISOString(),
        role: "authenticated",
        aud: "authenticated",
      };
      return r.fulfill({
        json: {
          access_token: "test-access-token",
          refresh_token: "test-refresh",
          token_type: "bearer",
          expires_in: 3600,
          user,
        },
      });
    }
    if (path.endsWith("/user")) return r.fulfill({ json: user });
    if (path.includes("/functions/v1/")) {
      if (service) return service(r, path);
      return r.fulfill({
        status: 503,
        json: { error: "Service is not configured" },
      });
    }
    if (path.includes("/rpc/load_workspace") && failCloud)
      return r.fulfill({ status: 500, json: { message: "Migration missing" } });
    if (user) {
      if (!states.has(user.id)) states.set(user.id, cloudFixture());
      if (await states.get(user.id)(r)) return;
    }
    return r.fulfill({ json: {} });
  });
}
async function login(page, email = "alice@example.com") {
  await page.click("#accountBtn");
  await page.fill("#authEmail", email);
  await page.fill("#authPassword", "test-password");
  await page.click("#authSubmit");
  await expect(page.locator("#authStatus")).toContainText("Signed in as");
  await page.click("#closeAuthBtn");
}
async function logout(page) {
  await page.click("#accountBtn");
  await page.click("#signOutBtn");
  await expect(page.locator("#authStatus")).toContainText("Signed out");
  await page.click("#closeAuthBtn");
}
test("advanced applications, accessible Kanban stages, filters, exports and analytics persist", async ({
  page,
}) => {
  await page.goto("/");
  await page.click("#addApplicationBtn");
  await page.fill("#company", "Detailed Employer");
  await page.fill("#role", "Engineer");
  await page.selectOption("#country", "Canada");
  await page.fill("#location", "Toronto");
  await page.selectOption("#arrangement", "Remote");
  await expect(page.locator("#currency")).toHaveValue("USD");
  await page.fill("#salaryMin", "50000");
  await page.fill("#salaryMax", "70000");
  await page.selectOption("#currency", "CAD");
  await page.selectOption("#priority", "High");
  await page.fill("#applicationDate", "2026-10-01");
  await page.fill("#interviewAt", "2026-11-01T12:00");
  await page.fill("#followUp", "2026-11-02");
  await page.click("#submitDialogBtn");
  await page.click("#boardViewBtn");
  const saved = page.locator('.kanban-column[data-stage="Saved"]');
  await saved.getByLabel("Move to stage").selectOption("Hired");
  await expect(
    page.locator('.kanban-column[data-stage="Hired"]'),
  ).toContainText("Detailed Employer");
  await page.reload();
  await page.click("#boardViewBtn");
  await expect(
    page.locator('.kanban-column[data-stage="Hired"]'),
  ).toContainText("Detailed Employer");
  await page.click("#tableViewBtn");
  await page.selectOption("#arrangementFilter", "Remote");
  await page.selectOption("#countryFilter", "Canada");
  await expect(page.locator("td strong")).toHaveText("Detailed Employer");
  const dl = page.waitForEvent("download");
  await page.click("#backupBtn");
  const payload = JSON.parse(
    require("node:fs").readFileSync(await (await dl).path(), "utf8"),
  );
  expect(payload.applications[0]).toMatchObject({
    arrangement: "Remote",
    salaryMin: "50000",
    currency: "CAD",
    priority: "High",
    status: "Hired",
  });
  await nav(page, "analytics");
  await expect(page.locator("#analyticsMetrics")).toContainText("100%");
  await expect(page.locator("#analyticsCharts")).toContainText("Canada");
});
test("company directory, custom employers and favorites work without invented hiring claims", async ({
  page,
}) => {
  await page.goto("/");
  await nav(page, "companies");
  await page.fill("#companySearch", "Microsoft");
  await expect(page.locator("#companyList .directory-card")).toHaveCount(1);
  await page
    .getByRole("button", { name: "Favorite Microsoft", exact: true })
    .click();
  await page.reload();
  await expect(
    page.getByRole("button", { name: "Unfavorite Microsoft", exact: true }),
  ).toBeVisible();
  await page.click("#addCompanyBtn");
  await page.fill("#editor-name", "My Employer");
  await page.fill("#editor-industry", "Robotics");
  await page.fill("#editor-country", "Brazil");
  await page.fill("#editor-website", "https://example.com");
  await page
    .locator("#platformEditor")
    .getByRole("button", { name: "Save", exact: true })
    .click();
  await page.fill("#companySearch", "");
  await page.selectOption("#companyIndustry", "Robotics");
  await expect(page.locator("#companyList")).toContainText("My Employer");
  await nav(page, "dashboard");
  await expect(page.locator("#dashboardCompanies")).toContainText("Microsoft");
  await expect(page.locator("#dashboardCompanies")).toContainText(
    "My Employer",
  );
});
test("personal roadmap, tasks, reminders and profile survive reload and extended JSON restore", async ({
  page,
}) => {
  await page.goto("/");
  await nav(page, "roadmap");
  await page.getByRole("button", { name: "Add goal", exact: true }).click();
  await page.fill("#editor-title", "International frontend role");
  await page.fill("#editor-targetRole", "Frontend Engineer");
  await page.fill("#editor-skillsText", "JavaScript, accessibility");
  await page.fill("#editor-countriesText", "Canada, Ireland");
  await page
    .locator("#platformEditor")
    .getByRole("button", { name: "Save", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Create starter roadmap", exact: true })
    .click();
  await expect(page.locator("#personalMilestones .list-item")).toHaveCount(5);
  await page
    .locator("#personalMilestones input[type=checkbox]")
    .first()
    .check();
  await nav(page, "dashboard");
  await page.click("#addTaskBtn");
  await page.fill("#editor-title", "Prepare portfolio");
  await page.fill("#editor-dueDate", "2020-01-01");
  await page
    .locator("#platformEditor")
    .getByRole("button", { name: "Save", exact: true })
    .click();
  await expect(page.locator("#reminderList")).toContainText("Overdue");
  await nav(page, "settings");
  await page.fill("#profileName", "Career Planner");
  await page.selectOption("#profileAge", "18+");
  await page
    .getByRole("button", { name: "Save profile & preferences" })
    .click();
  await expect(page.locator("#settingsStatus")).toContainText(
    "Profile and preferences saved",
  );
  await page.reload();
  await expect(page.locator("#profileName")).toHaveValue("Career Planner");
  await nav(page, "roadmap");
  await expect(
    page.locator("#personalMilestones input[type=checkbox]").first(),
  ).toBeChecked();
  await nav(page, "applications");
  const dl = page.waitForEvent("download");
  await page.click("#backupBtn");
  const bytes = require("node:fs").readFileSync(await (await dl).path());
  const backup = JSON.parse(bytes);
  expect(backup.extras.tasks[0].title).toBe("Prepare portfolio");
  expect(backup.extras.goals[0].title).toBe("International frontend role");
  expect(backup.extras.milestones).toHaveLength(5);
  expect(backup.extras.milestones[0].completed).toBe(true);
  expect(backup.extras.profile.display_name).toBe("Career Planner");
  // Restore into a genuinely empty guest workspace, rather than over the same data.
  await nav(page, "settings");
  page.once("dialog", (d) => d.accept());
  await page
    .getByRole("button", { name: "Clear guest records", exact: true })
    .click();
  await expect(page.locator("#profileName")).toHaveValue("");
  await nav(page, "roadmap");
  await expect(page.locator("#personalMilestones .list-item")).toHaveCount(0);
  await nav(page, "applications");
  page.once("dialog", (d) => d.accept());
  await page.locator("#restoreFile").setInputFiles({
    name: "extended.json",
    mimeType: "application/json",
    buffer: bytes,
  });
  await expect(page.locator("#toast")).toContainText("restored successfully");
  await page.reload();
  await nav(page, "settings");
  await expect(page.locator("#profileName")).toHaveValue("Career Planner");
  await expect(page.locator("#profileAge")).toHaveValue("18+");
  await nav(page, "dashboard");
  await expect(page.locator("#taskList")).toContainText("Prepare portfolio");
  await expect(page.locator("#reminderList")).toContainText("Overdue");
  await nav(page, "roadmap");
  await expect(page.locator("#careerGoals")).toContainText(
    "International frontend role",
  );
  await expect(page.locator("#personalMilestones .list-item")).toHaveCount(5);
  await expect(
    page.locator("#personalMilestones input[type=checkbox]").first(),
  ).toBeChecked();
});
test("same-route hashchange and repeated navigation preserve profile drafts", async ({
  page,
}) => {
  await page.goto("/#settings");
  await page.fill("#profileName", "Career Planner");
  await page.selectOption("#profileAge", "18+");
  // A click sets the hash synchronously, but browsers deliver hashchange later.
  // Deliver the trailing event after editing to make the original race deterministic.
  await page.evaluate(() =>
    window.dispatchEvent(new HashChangeEvent("hashchange")),
  );
  await expect(page.locator("#profileName")).toHaveValue("Career Planner");
  await nav(page, "settings");
  await expect(page.locator("#profileName")).toHaveValue("Career Planner");
  await expect(page.locator("#profileAge")).toHaveValue("18+");
  await page
    .getByRole("button", { name: "Save profile & preferences" })
    .click();
  await expect(page.locator("#settingsStatus")).toContainText(
    "Profile and preferences saved",
  );
  await nav(page, "roadmap");
  await page.goBack();
  await expect(page.locator("#settingsView")).toBeVisible();
  await expect(page.locator("#profileName")).toHaveValue("Career Planner");
  await page.reload();
  await expect(page.locator("#profileName")).toHaveValue("Career Planner");
});
test("profile submit keeps its values behind an earlier cloud save", async ({
  page,
}) => {
  await configure(page);
  await page.goto("/");
  await login(page);
  await expect(page.locator("#syncStatus")).toContainText(
    "Cloud workspace loaded",
  );
  await nav(page, "settings");
  let release, started;
  const gate = new Promise((resolve) => {
    release = resolve;
  });
  const requestStarted = new Promise((resolve) => {
    started = resolve;
  });
  let first = true;
  await page.route("**/rpc/commit_workspace", async (route) => {
    if (first) {
      first = false;
      started();
      await gate;
    }
    await route.fallback();
  });
  // Hold a real SDK RPC response so the profile update queues behind it.
  await page.evaluate(() => {
    window.pendingTrackerSave = window.launchpadWorkspace.saveTracker([]);
  });
  await requestStarted;
  try {
    await page.fill("#profileName", "Queued Career Planner");
    await page.selectOption("#profileAge", "18+");
    await page
      .getByRole("button", { name: "Save profile & preferences" })
      .click();
  } finally {
    release();
  }
  await expect(page.locator("#settingsStatus")).toContainText(
    "Profile and preferences saved",
  );
  await expect(page.locator("#profileName")).toHaveValue(
    "Queued Career Planner",
  );
  await page.evaluate(() => window.pendingTrackerSave);
  await page.reload();
  await expect(page.locator("#syncStatus")).toContainText(
    "Cloud workspace loaded",
  );
  await expect(page.locator("#profileName")).toHaveValue(
    "Queued Career Planner",
  );
});
test("private account workspaces synchronize, isolate users, and retain original guest records", async ({
  page,
}) => {
  await configure(page);
  await page.goto("/");
  await add(page, "Guest Record");
  await login(page);
  await expect(page.locator("#syncStatus")).toContainText(
    "Cloud workspace loaded",
  );
  await expect(page.locator("td strong")).toHaveCount(0);
  await add(page, "Alice Private Record");
  await expect(page.locator("td strong")).toHaveText("Alice Private Record");
  expect(
    await page.evaluate(
      () =>
        JSON.parse(localStorage.getItem("launchpad-opportunities-v1"))[0]
          .company,
    ),
  ).toBe("Guest Record");
  await logout(page);
  await expect(page.locator("td strong")).toHaveText("Guest Record");
  await login(page, "bob@example.com");
  await expect(page.locator("#syncStatus")).toContainText(
    "Cloud workspace loaded",
  );
  await expect(page.locator("td strong")).toHaveCount(0);
  await add(page, "Bob Private Record");
  await logout(page);
  await login(page);
  await expect(page.locator("td strong")).toHaveText("Alice Private Record");
});
test("cloud failure blocks account mutation and offers an explicit safe return to guest mode", async ({
  page,
}) => {
  await configure(page, { failCloud: true });
  await page.goto("/");
  await add(page, "Guest safe");
  await login(page);
  await expect(page.locator("#syncStatus")).toContainText(
    "guest records are untouched",
  );
  await expect(page.locator("#workspaceContent")).toHaveAttribute("inert", "");
  await page.click("#useGuestBtn");
  await expect(page.locator("td strong")).toHaveText("Guest safe");
});
test("Job Explorer uses sourced backend results, saves once, and reports provider errors honestly", async ({
  page,
}) => {
  let unavailable = false;
  await configure(page, {
    service: (r) =>
      unavailable
        ? r.fulfill({ status: 503, json: { error: "Provider unavailable" } })
        : r.fulfill({
            json: {
              source: "Remotive",
              fetchedAt: "2026-10-26",
              jobs: [
                {
                  id: "fixture-1",
                  company: "Provider Fixture Employer",
                  title: "Frontend Engineer",
                  location: "Worldwide",
                  salary: "",
                  tags: ["JavaScript"],
                  postedAt: "2026-10-26",
                  source: "Remotive",
                  url: "https://remotive.com/remote-jobs/fixture-1",
                },
              ],
            },
          }),
  });
  await page.goto("/");
  await nav(page, "jobs");
  await page.fill("#jobTitle", "Frontend");
  await page.getByRole("button", { name: "Find opportunities" }).click();
  await expect(page.locator("#jobResults")).toContainText(
    "Provider Fixture Employer",
  );
  await expect(page.locator("#jobStatus")).toContainText("Source: Remotive");
  await page.getByRole("button", { name: "Save to tracker" }).click();
  await page.getByRole("button", { name: "Save to tracker" }).click();
  await expect(page.locator("#platformStatus")).toContainText("already");
  await nav(page, "applications");
  await expect(page.locator("td strong")).toHaveText(
    "Provider Fixture Employer",
  );
  await nav(page, "jobs");
  unavailable = true;
  await page.getByRole("button", { name: "Find opportunities" }).click();
  await expect(page.locator("#jobStatus")).toContainText("unavailable");
  await expect(page.locator("#jobResults .directory-card")).toHaveCount(0);
});
test("AI calls are consent-scoped and a returned roadmap is saved only after approval", async ({
  page,
}) => {
  const bodies = [];
  await configure(page, {
    service: (r, path) => {
      bodies.push(r.request().postDataJSON());
      return r.fulfill({
        json: {
          provider: "OpenAI",
          remaining: 9,
          response: "Mocked provider roadmap",
          plan: {
            milestones: [
              {
                title: "Review accessibility",
                kind: "Skill",
                targetDate: "2027-01-01",
                notes: "Mocked API test result",
              },
            ],
          },
        },
      });
    },
  });
  await page.goto("/");
  await login(page);
  await expect(page.locator("#syncStatus")).toContainText(
    "Cloud workspace loaded",
  );
  await nav(page, "coach");
  await page.fill("#coachPrompt", "Create a roadmap for frontend skills");
  await page.selectOption("#coachIntent", "roadmap");
  await page.getByRole("button", { name: "Ask coach" }).click();
  await expect(page.locator("#coachResponse")).toContainText(
    "Mocked provider roadmap",
  );
  expect(bodies[0].consent).toMatchObject({
    profile: false,
    goals: false,
    progress: false,
    history: false,
  });
  page.once("dialog", (d) => d.accept());
  await page
    .getByRole("button", { name: "Add these milestones to my roadmap" })
    .click();
  await expect(page.locator("#personalMilestones")).toContainText(
    "Review accessibility",
  );
});
test("account deletion reauthenticates with Supabase and never sends a password to the function", async ({
  page,
}) => {
  let body;
  await configure(page, {
    service: (r) => {
      body = r.request().postDataJSON();
      return r.fulfill({ json: { deleted: true } });
    },
  });
  await page.goto("/");
  await add(page, "Retained guest");
  await login(page);
  await expect(page.locator("#syncStatus")).toContainText(
    "Cloud workspace loaded",
  );
  await nav(page, "settings");
  await page.fill("#deletePassword", "test-password");
  page.once("dialog", (d) => d.accept());
  await page.click("#deleteAccountBtn");
  await expect(page.locator("#settingsStatus")).toContainText(
    "account was deleted",
  );
  expect(body).toEqual({
    confirmation: "DELETE",
    expected_user: "00000000-0000-0000-0000-000000000001",
  });
  await nav(page, "applications");
  await expect(page.locator("td strong")).toHaveText("Retained guest");
});
for (const width of [320, 768, 1440])
  test(`all platform screens navigate without overflow or page errors at ${width}px`, async ({
    page,
  }) => {
    const errors = [];
    page.on("pageerror", (e) => errors.push(e.message));
    await page.setViewportSize({ width, height: 900 });
    await page.goto("/");
    for (const view of [
      "home",
      "dashboard",
      "companies",
      "jobs",
      "roadmap",
      "coach",
      "analytics",
      "settings",
      "applications",
    ]) {
      await nav(page, view);
      await expect(page.locator("#" + view + "View")).toBeVisible();
      expect(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= innerWidth,
        ),
        view,
      ).toBe(true);
    }
    await nav(page, "home");
    await page.screenshot({
      path: `test-results/launchpad-v4-${width}.png`,
      fullPage: true,
    });
    expect(errors).toEqual([]);
  });
test("leaving an account clears visible private coach content and late responses are discarded", async ({
  page,
}) => {
  let release,
    requested = false;
  await configure(page, {
    service: (r) => {
      requested = true;
      return new Promise((resolve) => {
        release = async () => {
          await r.fulfill({
            json: {
              provider: "OpenAI",
              remaining: 9,
              response: "Private account response",
            },
          });
          resolve();
        };
      });
    },
  });
  await page.goto("/");
  await login(page);
  await expect(page.locator("#syncStatus")).toContainText(
    "Cloud workspace loaded",
  );
  await nav(page, "coach");
  await page.fill("#coachPrompt", "This is an account-only question");
  await page.getByRole("button", { name: "Ask coach" }).click();
  await expect.poll(() => requested).toBe(true);
  await page.click("#useGuestBtn");
  await release();
  await expect(page.locator("#coachResponse")).not.toContainText(
    "Private account response",
  );
  await expect(page.locator("#coachPrompt")).toHaveValue("");
  await expect(page.locator("#workspaceLabel")).toContainText("Guest");
});
test("clearing guest records is explicit and cancellation preserves them", async ({
  page,
}) => {
  await page.goto("/");
  await add(page, "Guest deletion test");
  await nav(page, "settings");
  page.once("dialog", (d) => d.dismiss());
  await page
    .getByRole("button", { name: "Clear guest records", exact: true })
    .click();
  await nav(page, "applications");
  await expect(page.locator("td strong")).toHaveText("Guest deletion test");
  await nav(page, "settings");
  page.once("dialog", (d) => d.accept());
  await page
    .getByRole("button", { name: "Clear guest records", exact: true })
    .click();
  await nav(page, "applications");
  await expect(page.locator("#statTotal")).toHaveText("0");
});
test("restored IDs remain stable so repeated guest migration cannot duplicate records", async ({
  page,
}) => {
  await page.goto("/");
  await add(page, "Stable imported record");
  const original = await page.evaluate(
    () => JSON.parse(localStorage.getItem("launchpad-opportunities-v1"))[0].id,
  );
  const dl = page.waitForEvent("download");
  await page.click("#backupBtn");
  const bytes = require("node:fs").readFileSync(await (await dl).path());
  page.once("dialog", (d) => d.accept());
  await page.locator("#restoreFile").setInputFiles({
    name: "backup.json",
    mimeType: "application/json",
    buffer: bytes,
  });
  await expect(page.locator("#toast")).toContainText("restored successfully");
  expect(
    await page.evaluate(
      () =>
        JSON.parse(localStorage.getItem("launchpad-opportunities-v1"))[0].id,
    ),
  ).toBe(original);
});
