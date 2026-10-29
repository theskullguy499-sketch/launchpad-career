const { test, expect } = require("@playwright/test");
async function nav(page, view) {
  await page.evaluate((v) => window.launchpadData.navigate(v), view);
  await expect(page.locator("#" + view + "View")).toBeVisible();
}
async function start(page) {
  await page.goto("/");
  await page.waitForFunction(() => !!window.launchpadData?.navigate);
  await nav(page, "resume");
}
test("resume editor previews user-authored projects, persists versions and preserves existing workspace exports", async ({
  page,
}) => {
  await start(page);
  await page.fill("#resume-name", "Career Tester");
  await page.fill("#resume-label", "Frontend version");
  await page.fill("#resume-skills", "JavaScript, React");
  await page.getByRole("button", { name: "Add project", exact: true }).click();
  await page
    .getByLabel("Project name · projects 1", { exact: true })
    .fill("Launchpad");
  await page
    .getByLabel("Description / evidence · projects 1", { exact: true })
    .fill("Built my own career workspace.");
  await expect(page.locator("#resumePreview")).toContainText("Launchpad");
  await page.click("#saveResume");
  await expect(page.locator("#resumeStatus")).toContainText(
    "saved on this device",
  );
  await page.reload();
  await nav(page, "resume");
  await expect(page.locator("#resume-name")).toHaveValue("Career Tester");
  await page
    .getByRole("button", { name: "Duplicate version", exact: true })
    .click();
  await page.fill("#resume-label", "Backend version");
  await page.selectOption("#resumeTemplate", "modern");
  await page.click("#saveResume");
  await expect(page.locator("#resumeVersion option")).toHaveCount(2);
  await expect(page.locator("#resumePreview")).toHaveClass(/resume-modern/);
  await nav(page, "applications");
  const download = page.waitForEvent("download");
  await page.click("#backupBtn");
  const file = await (await download).path();
  const json = JSON.parse(require("node:fs").readFileSync(file, "utf8"));
  expect(json.extras.preferences.careerStudio55.resumes).toHaveLength(2);
  page.once("dialog", (d) => d.accept());
  await page.locator("#restoreFile").setInputFiles(file);
  await page.reload();
  await nav(page, "resume");
  await expect(page.locator("#resumeVersion option")).toHaveCount(2);
});
test("resume input remains text, unsafe links are rejected and deleting a version requires confirmation", async ({
  page,
}) => {
  await start(page);
  await page.fill("#resume-name", "<img src=x onerror=alert(1)>");
  await expect(page.locator("#resumePreview img")).toHaveCount(0);
  await page.fill("#resume-github", "https://user:password@example.com");
  await page.click("#saveResume");
  await expect(page.locator("#resumeStatus")).toContainText(
    "without embedded credentials",
  );
  await page.fill("#resume-github", "https://github.com/example");
  await page.click("#saveResume");
  page.once("dialog", (d) => d.dismiss());
  await page
    .getByRole("button", { name: "Delete version", exact: true })
    .click();
  await expect(page.locator("#resume-name")).toHaveValue(
    "<img src=x onerror=alert(1)>",
  );
  page.once("dialog", (d) => d.accept());
  await page
    .getByRole("button", { name: "Delete version", exact: true })
    .click();
  await expect(page.locator("#resume-name")).toHaveValue("");
});
test("browser print produces a text-first PDF and private print nodes clear when returning from print", async ({
  page,
}, testInfo) => {
  await start(page);
  await page.fill("#resume-name", "PDF Fixture");
  await page.fill("#resume-summary", "A user-written summary.");
  await page.evaluate(() => {
    window.print = () => {
      window.printInvoked = true;
    };
  });
  await page
    .getByRole("button", { name: "Print / Save PDF", exact: true })
    .click();
  expect(await page.evaluate(() => window.printInvoked)).toBeTruthy();
  await expect(page.locator("#resumePrintRoot")).toContainText("PDF Fixture");
  const pdf = await page.pdf({
    path: testInfo.outputPath("fixture-resume.pdf"),
  });
  expect(pdf.subarray(0, 4).toString()).toBe("%PDF");
  await page.evaluate(() => window.dispatchEvent(new Event("afterprint")));
  await expect(page.locator("#resumePrintRoot")).toHaveCount(0);
});
test("Interview Lab saves static exercises, edits history, pauses timer and persists preparation without inventing evaluation", async ({
  page,
}) => {
  await start(page);
  await nav(page, "interview");
  await page.selectOption("#practiceTopic", "JavaScript");
  await page.selectOption("#practiceQuestion", "js-closure");
  await page.fill(
    "#practiceAnswer",
    "A closure retains access to its lexical scope.",
  );
  await page.click("#practiceTimer");
  await expect(page.locator("#practiceTimer")).toHaveText("Pause timer");
  await page.evaluate(() =>
    document.dispatchEvent(new Event("visibilitychange")),
  );
  await nav(page, "resume");
  await nav(page, "interview");
  await expect(page.locator("#practiceTimer")).toHaveText("Start timer");
  await page.click("#savePractice");
  await expect(page.locator("#practiceStatus")).toContainText(
    "No AI evaluation",
  );
  await expect(page.locator("#practiceHistory article")).toHaveCount(1);
  await page.locator("#practiceChecks input").first().check();
  await page
    .getByRole("button", { name: "Save preparation checklist", exact: true })
    .click();
  await page.reload();
  await nav(page, "interview");
  await expect(page.locator("#practiceChecks input").first()).toBeChecked();
  await page
    .locator("#practiceHistory button")
    .filter({ hasText: "Open exercise" })
    .click();
  await expect(page.locator("#practiceAnswer")).toHaveValue(
    "A closure retains access to its lexical scope.",
  );
  await page.fill("#practiceAnswer", "Updated answer. " + "x".repeat(1800));
  await page.click("#savePractice");
  await expect(page.locator("#practiceHistory article")).toHaveCount(1);
  page.once("dialog", (d) => d.accept());
  await page
    .getByRole("button", { name: "Review in AI Coach", exact: true })
    .click();
  await expect(page.locator("#coachPrompt")).toHaveValue(/Updated answer\./);
  expect(await page.locator("#coachPrompt").inputValue()).toContain(
    "Updated answer. " + "x".repeat(1800),
  );
  await expect(page.locator("#coachResponse")).not.toContainText(
    "Updated answer.",
  );
});
test("Job Fit explains source and declared skills without a hiring score or geographic authorization claim", async ({
  page,
}) => {
  const { configureCommercial } = require("./helpers/commercial-fixture.cjs");
  const { mockJobs53 } = require("./helpers/jobs53-fixture.cjs");
  const { PLANS } = await import("../lib/plans.mjs");
  await configureCommercial(page, PLANS);
  await mockJobs53(page);
  await page.addInitScript(() =>
    localStorage.setItem(
      "launchpad-workspace-v4",
      JSON.stringify({
        goals: [{ id: "goal", title: "My goal", skills: ["TypeScript"] }],
        profile: { country: "Brazil" },
      }),
    ),
  );
  await page.goto("/#jobs");
  await page.click("#jobQuickSearch");
  await page
    .locator(".job-card")
    .first()
    .getByRole("button", { name: "View details", exact: true })
    .click();
  await expect(page.locator("#jobFitPanel")).toContainText(
    "Understand your fit",
  );
  await expect(page.locator("#jobFitPanel")).toContainText(
    "No score is assigned",
  );
  await expect(page.locator("#jobFitPanel .fit-matched")).toContainText(
    "TypeScript",
  );
  await expect(page.locator("#jobFitPanel")).toContainText("Brazil");
  await expect(page.locator("#jobFitPanel")).toContainText(
    "does not establish work authorization",
  );
  await page
    .locator("#jobFitPanel")
    .getByRole("link", { name: "Review my resume skills", exact: true })
    .click();
  await expect(page.locator("#resumeView")).toBeVisible();
});
async function careerLogin(page, email = "alice@example.com") {
  await page.click("#accountBtn");
  await page.fill("#authEmail", email);
  await page.fill("#authPassword", "test-password");
  await page.click("#authSubmit");
  await expect(page.locator("#authStatus")).toContainText("Signed in as");
  await page.click("#closeAuthBtn");
  await expect(page.locator("#syncStatus")).toContainText(
    "Cloud workspace loaded",
  );
}
async function careerLogout(page) {
  await page.evaluate(async () => {
    const { getAuthClient } = await import("/auth-client.js");
    await (await getAuthClient()).auth.signOut({ scope: "local" });
  });
  await expect(page.locator("#workspaceLabel")).toContainText(
    "Guest workspace",
  );
}
test("cloud career saving requires explicit consent, imports guest versions additively and isolates two SDK account workspaces", async ({
  page,
}) => {
  const {
    configureCareerCloud,
  } = require("./helpers/career55-cloud-fixture.cjs");
  const f = await configureCareerCloud(page);
  await start(page);
  await page.fill("#resume-name", "Guest Only Person");
  await page.fill("#resume-label", "Guest version");
  await page.click("#saveResume");
  await expect(page.locator("#resumeStatus")).toContainText(
    "saved on this device",
  );
  await careerLogin(page);
  await nav(page, "resume");
  await expect(page.locator("#resume-name")).toHaveValue("");
  await page.fill("#resume-name", "Alice Private Person");
  await page.fill("#resume-label", "Alice private version");
  await page.click("#saveResume");
  await expect(page.locator("#resumeStatus")).toContainText(
    "Confirm that you want",
  );
  expect(f.commits).toHaveLength(0);
  await page.check("#studioCloudConsent");
  await page.click("#saveResume");
  await expect(page.locator("#resumeStatus")).toContainText("private account");
  expect(f.commits).toHaveLength(1);
  page.once("dialog", (d) => d.accept());
  await page.click("#importGuestStudio");
  await expect(page.locator("#resumeStatus")).toContainText(
    "imported explicitly",
  );
  await expect(page.locator("#resumeVersion option")).toHaveCount(2);
  page.once("dialog", (d) => d.accept());
  await page.click("#importGuestStudio");
  await expect(page.locator("#resumeVersion option")).toHaveCount(2);
  await page.fill("#resume-name", "Unsaved Private Draft");
  await page.evaluate(() => (window.print = () => {}));
  await page
    .getByRole("button", { name: "Print / Save PDF", exact: true })
    .click();
  await expect(page.locator("#resumePrintRoot")).toContainText(
    "Unsaved Private Draft",
  );
  await careerLogout(page);
  await expect(page.locator("#resumePrintRoot")).toHaveCount(0);
  await expect(page.locator("#resume-name")).toHaveValue("Guest Only Person");
  await careerLogin(page, "bob@example.com");
  await nav(page, "resume");
  await expect(page.locator("#resume-name")).toHaveValue("");
  await page.click("#openGlobalSearch");
  await page.fill("#globalSearchInput", "Alice");
  await expect(page.locator("#globalSearchResults button")).toHaveCount(0);
  await page.keyboard.press("Escape");
  await careerLogout(page);
  await careerLogin(page);
  await nav(page, "resume");
  await expect(page.locator("#resumeVersion option")).toHaveCount(2);
  await expect(page.locator("#resumePreview")).not.toContainText(
    "Unsaved Private Draft",
  );
  expect(
    await page.evaluate(() => localStorage.getItem("launchpad-workspace-v4")),
  ).not.toContain("Alice Private Person");
});
test("global search supports shortcuts, keyboard navigation, owner-scoped records and real quick actions", async ({
  page,
}) => {
  await start(page);
  await page.fill("#resume-label", "My searchable resume");
  await page.click("#saveResume");
  await page.keyboard.press("Control+k");
  await expect(page.locator("#globalSearchDialog")).toBeVisible();
  await expect(page.locator("#globalSearchInput")).toBeFocused();
  await page.fill("#globalSearchInput", "My searchable");
  await expect(page.locator("#globalSearchResults button")).toHaveCount(1);
  await page.keyboard.press("ArrowDown");
  await expect(page.locator("#globalSearchResults button")).toBeFocused();
  await page.keyboard.press("Enter");
  await expect(page.locator("#resumeView")).toBeVisible();
  await expect(page.locator("#globalSearchDialog")).toBeHidden();
  await page.click("#openGlobalSearch");
  await page.fill("#globalSearchInput", "nonempty query");
  await page.keyboard.press("Escape");
  await expect(page.locator("#globalSearchDialog")).toBeHidden();
  await page.keyboard.press("Meta+k");
  await expect(page.locator("#globalSearchDialog")).toBeVisible();
  await page.fill("#globalSearchInput", "Add application");
  await page.locator("#globalSearchResults button").click();
  await expect(page.locator("#applicationDialog")).toBeVisible();
  await page.click("#closeDialogBtn");
  await page.click("#openGlobalSearch");
  await page.fill("#globalSearchInput", "Create career goal");
  await page.locator("#globalSearchResults button").click();
  await expect(page.locator("#platformEditor")).toBeVisible();
  await page.keyboard.press("Escape");
  await page.click("#openGlobalSearch");
  await page.fill("#globalSearchInput", "Saved Jobs");
  await page.locator("#globalSearchResults button").click();
  await expect(page.locator("#jobsView")).toBeVisible();
  await expect(
    page.locator('.jobs-collection-tab[data-collection="saved"]'),
  ).toHaveAttribute("aria-pressed", "true");
});
test("global results, draft answers and editor material clear immediately on SDK sign-out", async ({
  page,
}) => {
  const {
    configureCareerCloud,
  } = require("./helpers/career55-cloud-fixture.cjs");
  await configureCareerCloud(page);
  await start(page);
  await careerLogin(page);
  await nav(page, "resume");
  await page.fill("#resume-name", "Private Name");
  await page.fill("#resume-label", "Private Version");
  await page.check("#studioCloudConsent");
  await page.click("#saveResume");
  await expect(page.locator("#resumeStatus")).toContainText("private account");
  await nav(page, "interview");
  await page.fill("#practiceAnswer", "Private Answer");
  await page.click("#openGlobalSearch");
  await page.fill("#globalSearchInput", "Private Version");
  await expect(page.locator("#globalSearchResults")).toContainText(
    "Private Version",
  );
  await careerLogout(page);
  await expect(page.locator("#globalSearchDialog")).toBeHidden();
  await expect(page.locator("#globalSearchResults")).not.toContainText(
    "Private Version",
  );
  await expect(page.locator("#practiceAnswer")).toHaveValue("");
  await expect(page.locator("#resume-name")).toHaveValue("");
});
test("dashboard next steps and counts come from saved resumes, practice and actual dated commitments", async ({
  page,
}) => {
  await start(page);
  await nav(page, "dashboard");
  await expect(page.locator("#intelligenceDashboard")).toContainText(
    "Build a resume from your own work",
  );
  await expect(
    page.locator("#intelligenceDashboard .intelligence-value").first(),
  ).toHaveText("0");
  await nav(page, "resume");
  await page.fill("#resume-label", "Dashboard resume");
  await page.click("#saveResume");
  await nav(page, "dashboard");
  await expect(page.locator("#intelligenceDashboard")).toContainText(
    "Practice your project introduction",
  );
  await expect(
    page.locator("#intelligenceDashboard .intelligence-value").first(),
  ).toHaveText("1");
  await expect(page.locator("#intelligenceDashboard")).toContainText(
    "Resume saved · Dashboard resume",
  );
});
for (const width of [375, 390, 768, 1440])
  for (const theme of ["light", "dark"])
    test(`career screens, global search and job fit fit ${width}px in ${theme} with accessible controls`, async ({
      page,
    }) => {
      test.setTimeout(90000);
      const errors = [];
      page.on("pageerror", (e) => errors.push(e.message));
      await page.setViewportSize({ width, height: 1000 });
      const {
        configureCommercial,
      } = require("./helpers/commercial-fixture.cjs");
      const { mockJobs53 } = require("./helpers/jobs53-fixture.cjs");
      const { PLANS } = await import("../lib/plans.mjs");
      await configureCommercial(page, PLANS);
      await mockJobs53(page);
      await start(page);
      if (theme === "dark") await page.click("#themeToggle");
      await page.fill("#resume-name", "UI Fixture");
      await page.fill(
        "#resume-summary",
        "A user-authored summary for a local UI test.",
      );
      await page.click("#saveResume");
      async function scan() {
        await page.addScriptTag({
          path: require.resolve("axe-core/axe.min.js"),
        });
        const violations = await page.evaluate(async () => {
          const r = await axe.run(document, {
            runOnly: {
              type: "tag",
              values: ["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa"],
            },
          });
          return r.violations.map((v) => ({
            id: v.id,
            nodes: v.nodes.map((n) => n.target),
          }));
        });
        expect(violations).toEqual([]);
        expect(
          await page.evaluate(
            () => document.documentElement.scrollWidth <= innerWidth + 1,
          ),
        ).toBeTruthy();
      }
      for (const view of ["resume", "interview", "dashboard"]) {
        await nav(page, view);
        await scan();
      }
      await page.click("#openGlobalSearch");
      await scan();
      await page.keyboard.press("Escape");
      await nav(page, "jobs");
      await page.click("#jobQuickSearch");
      await page
        .locator(".job-card")
        .first()
        .getByRole("button", { name: "View details", exact: true })
        .click();
      await scan();
      expect(errors).toEqual([]);
    });
test("invalid career backup is rejected before replacing existing data", async ({
  page,
}) => {
  await start(page);
  await page.fill("#resume-name", "Preserved Name");
  await page.click("#saveResume");
  const backup = await page.evaluate(() => window.launchpadWorkspace.backup());
  backup.extras.preferences.careerStudio55.version = 99;
  await nav(page, "applications");
  page.once("dialog", (d) => d.accept());
  await page.locator("#restoreFile").setInputFiles({
    name: "unsupported.json",
    mimeType: "application/json",
    buffer: Buffer.from(JSON.stringify(backup)),
  });
  await expect(page.locator("#toast")).toContainText(
    "Unsupported career studio data",
  );
  await page.reload();
  await nav(page, "resume");
  await expect(page.locator("#resume-name")).toHaveValue("Preserved Name");
});
test("full shared preference budget reports an error without losing saved material", async ({
  page,
}) => {
  await page.addInitScript(() =>
    localStorage.setItem(
      "launchpad-workspace-v4",
      JSON.stringify({ preferences: { unrelated: "x".repeat(44500) } }),
    ),
  );
  await start(page);
  await page.fill("#resume-name", "Not saved");
  await page.fill("#resume-summary", "y".repeat(1400));
  await page.click("#saveResume");
  await expect(page.locator("#resumeStatus")).toContainText(
    "Nothing was saved",
  );
  expect(
    await page.evaluate(
      () =>
        JSON.parse(localStorage.getItem("launchpad-workspace-v4")).preferences
          .unrelated.length,
    ),
  ).toBe(44500);
  await page.reload();
  await nav(page, "resume");
  await expect(page.locator("#resume-name")).toHaveValue("");
});
test("a late private resume response cannot repopulate a guest or a different account", async ({
  page,
}) => {
  const {
    configureCareerCloud,
  } = require("./helpers/career55-cloud-fixture.cjs");
  const f = await configureCareerCloud(page);
  await start(page);
  await careerLogin(page);
  await nav(page, "resume");
  await page.fill("#resume-name", "Late Private Resume");
  await page.check("#studioCloudConsent");
  let release;
  const gate = new Promise((r) => (release = r));
  f.hold(gate);
  await page.click("#saveResume");
  await expect.poll(() => f.commits.length).toBe(1);
  await careerLogout(page);
  release();
  f.hold(null);
  await expect(page.locator("#saveResume")).toBeEnabled();
  await expect(page.locator("#resume-name")).toHaveValue("");
  await careerLogin(page, "bob@example.com");
  await nav(page, "resume");
  await expect(page.locator("#resume-name")).toHaveValue("");
  expect(
    await page.evaluate(
      () => localStorage.getItem("launchpad-workspace-v4") || "",
    ),
  ).not.toContain("Late Private Resume");
});
test("typing while a cloud resume save is pending never overwrites newer local edits", async ({
  page,
}) => {
  const {
    configureCareerCloud,
  } = require("./helpers/career55-cloud-fixture.cjs");
  const f = await configureCareerCloud(page);
  await start(page);
  await careerLogin(page);
  await nav(page, "resume");
  await page.check("#studioCloudConsent");
  await page.fill("#resume-name", "First saved snapshot");
  let release;
  f.hold(new Promise((r) => (release = r)));
  await page.click("#saveResume");
  await expect.poll(() => f.commits.length).toBe(1);
  await page.fill("#resume-name", "Newer draft typed while saving");
  release();
  f.hold(null);
  await expect(page.locator("#resumeStatus")).toContainText(
    "newer edits are still unsaved",
  );
  await expect(page.locator("#resume-name")).toHaveValue(
    "Newer draft typed while saving",
  );
  expect(f.commits[0].payload.preferences.careerStudio55.resumes[0].name).toBe(
    "First saved snapshot",
  );
  await page.click("#saveResume");
  await expect(page.locator("#resumeStatus")).toContainText("private account");
  await page.reload();
  await expect(page.locator("#syncStatus")).toContainText(
    "Cloud workspace loaded",
  );
  await nav(page, "resume");
  await expect(page.locator("#resume-name")).toHaveValue(
    "Newer draft typed while saving",
  );
});
test("a queued native close event cannot clear a rapidly reopened search or steal its focus", async ({
  page,
}) => {
  await start(page);
  await page.click("#openGlobalSearch");
  await page.evaluate(async () => {
    document.querySelector("#globalSearchDialog").close();
    document.querySelector("#openGlobalSearch").click();
    const input = document.querySelector("#globalSearchInput");
    input.value = "Resume";
    input.dispatchEvent(new Event("input"));
    await new Promise((r) =>
      requestAnimationFrame(() => requestAnimationFrame(r)),
    );
  });
  await expect(page.locator("#globalSearchDialog")).toBeVisible();
  await expect(page.locator("#globalSearchInput")).toHaveValue("Resume");
  await expect(page.locator("#globalSearchInput")).toBeFocused();
  await expect(page.locator("#globalSearchResults")).toContainText(
    "Resume Studio",
  );
  await page.keyboard.press("Escape");
  await expect(page.locator("#globalSearchDialog")).toBeHidden();
});
