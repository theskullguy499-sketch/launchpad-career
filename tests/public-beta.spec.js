const { test, expect } = require("@playwright/test");
const fs = require("node:fs/promises");
const { seedCareer55 } = require("./helpers/career55-state.cjs");
const { configureCommercial } = require("./helpers/commercial-fixture.cjs");
const { jobs53, mockJobs53 } = require("./helpers/jobs53-fixture.cjs");
const nav = async (p, v) => {
  await p.evaluate((v) => window.launchpadData.navigate(v), v);
  await expect(p.locator("#" + v + "View")).toBeVisible();
};
async function configured(page) {
  const { PLANS } = await import("../lib/plans.mjs");
  return configureCommercial(page, PLANS);
}
test("5.9 public walkthrough is interactive, clearly labelled and never writes records or calls providers", async ({
  page,
}) => {
  let calls = 0;
  await page.route("**/functions/v1/**", (r) => {
    calls++;
    return r.abort();
  });
  await seedCareer55(page, { once: true });
  await page.goto("/#home");
  await expect(page.locator("#publicDemoEntry59")).toBeVisible();
  const storage = await page.evaluate(() => JSON.stringify(localStorage));
  const open = page.getByRole("button", {
    name: "Explore public demo",
    exact: true,
  });
  await open.click();
  const demo = page.locator("#portfolioDemo59");
  await expect(demo).toContainText("DEMO ONLY");
  await expect(demo).not.toContainText("fixture@example.com");
  await demo
    .getByRole("button", { name: "2. Applications", exact: true })
    .click();
  await demo
    .getByRole("button", { name: "Move sample to Interview", exact: true })
    .click();
  await expect(demo).toContainText("Sample moved to Interview");
  await demo.getByRole("button", { name: "3. Resume", exact: true }).click();
  await demo
    .getByRole("button", { name: "Switch sample resume template", exact: true })
    .click();
  await expect(demo).toContainText("Modern sample layout");
  await demo.getByRole("button", { name: "4. Interview", exact: true }).click();
  await demo
    .getByRole("button", { name: "Show sample answer structure", exact: true })
    .click();
  await expect(demo).toContainText("Explain your own contribution");
  await page.keyboard.press("Escape");
  await expect(open).toBeFocused();
  expect(await page.evaluate(() => JSON.stringify(localStorage))).toBe(storage);
  expect(calls).toBe(0);
  await open.click();
  await demo
    .getByRole("button", { name: "2. Applications", exact: true })
    .click();
  await expect(demo).toContainText("Sample starts in Applied");
});
test("5.9 public preview reuses the isolated job and scripted coach tours without focus loss", async ({
  page,
}) => {
  await page.goto("/#home");
  const entry = page.getByRole("button", {
    name: "Explore public demo",
    exact: true,
  });
  await entry.click();
  const demo = page.locator("#portfolioDemo59");
  await demo.getByRole("button", { name: "5. Jobs", exact: true }).click();
  await demo
    .getByRole("button", { name: "Open isolated job example", exact: true })
    .click();
  await expect(page.locator("#demo58Dialog")).toBeVisible();
  await expect(
    page.getByRole("button", {
      name: "Application disabled — no real vacancy",
    }),
  ).toBeDisabled();
  await page.keyboard.press("Escape");
  await expect(entry).toBeFocused();
  await entry.click();
  await demo.getByRole("button", { name: "6. AI coach", exact: true }).click();
  await demo
    .getByRole("button", { name: "Open scripted coach example", exact: true })
    .click();
  await expect(page.locator("#demo58Dialog")).toContainText(
    "Scripted example, not AI",
  );
  await page.keyboard.press("Escape");
  await expect(entry).toBeFocused();
});
test("5.9 tour rapid reopen preserves the new content and keyboard focus", async ({
  page,
}) => {
  await page.goto("/#home");
  await page
    .getByRole("button", { name: "Explore public demo", exact: true })
    .click();
  await page.evaluate(() => {
    document.querySelector("#portfolioDemo59").close();
    document.querySelector("#publicDemoEntry59 button").click();
  });
  await expect(page.locator("#portfolioDemo59")).toContainText(
    "A clearer next chapter",
  );
  await page.keyboard.press("Escape");
  await expect(
    page.getByRole("button", { name: "Explore public demo", exact: true }),
  ).toBeFocused();
});
test("5.9 text export uses the selected saved resume, excludes unsaved edits and survives reload", async ({
  page,
}) => {
  await seedCareer55(page, { once: true });
  await page.goto("/#resume");
  await expect(page.locator("#exportResumeText59")).toBeEnabled();
  await page.fill("#resume-name", "Unsaved private draft");
  const pending = page.waitForEvent("download");
  await page.click("#exportResumeText59");
  const download = await pending;
  expect(download.suggestedFilename()).toBe("launchpad-resume.txt");
  const text = await fs.readFile(await download.path(), "utf8");
  expect(text).toContain("UI Fixture");
  expect(text).toContain("English · self-declared practice level");
  expect(text).not.toContain("Unsaved private draft");
  expect(await page.locator("#resume-name").inputValue()).toBe(
    "Unsaved private draft",
  );
  await expect(page.locator("#resumeTextStatus59")).toContainText(
    "saved version",
  );
  await page.reload();
  await expect(page.locator("#resume-name")).toHaveValue("UI Fixture");
});
test("5.9 unsaved resume cannot export, then a newly saved version can", async ({
  page,
}) => {
  await page.goto("/#resume");
  await expect(page.locator("#exportResumeText59")).toBeDisabled();
  await page.fill("#resume-name", "Test candidate");
  await page.fill("#resume-label", "My version");
  await page.click("#saveResume");
  await expect(page.locator("#exportResumeText59")).toBeEnabled();
  await expect(page.locator("#resumeTextStatus59")).toContainText("My version");
  await page.reload();
  await expect(page.locator("#resumeTextStatus59")).toContainText("My version");
});
test("5.9 interview suggestions preserve unsaved answers when a change is declined and count only saved practice", async ({
  page,
}) => {
  await seedCareer55(page, { once: true });
  await page.goto("/#interview");
  await expect(page.locator("#practiceCoverage59")).toContainText("1 /");
  await page.selectOption("#practiceQuestion", "b-feedback");
  await page.fill("#practiceAnswer", "Keep this unsaved answer");
  page.once("dialog", (d) => d.dismiss());
  await page
    .getByRole("button", {
      name: "Practice next unanswered question",
      exact: true,
    })
    .click();
  await expect(page.locator("#practiceAnswer")).toHaveValue(
    "Keep this unsaved answer",
  );
  await expect(page.locator("#practiceQuestion")).toHaveValue("b-feedback");
  page.once("dialog", (d) => d.accept());
  await page
    .getByRole("button", {
      name: "Practice next unanswered question",
      exact: true,
    })
    .click();
  await expect(page.locator("#practiceQuestion")).toHaveValue("b-story");
  await expect(page.locator("#practiceAnswer")).toHaveValue("");
  await page.fill("#practiceAnswer", "My own problem-solving example.");
  await page.click("#savePractice");
  await expect(page.locator("#practiceCoverage59")).toContainText("2 /");
  await page.reload();
  await expect(page.locator("#practiceCoverage59")).toContainText("2 /");
  await page.selectOption("#practiceTopic", "React");
  await expect(page.locator("#practiceCoverage59")).toContainText("0 / 3");
});
test("5.9 source panel preserves ambiguous currency, location limits, negatives and safe external text", async ({
  page,
}) => {
  await configured(page);
  await page.route("**/functions/v1/job-explorer", (r) =>
    r.fulfill({
      json: {
        source: "Remotive",
        fetchedAt: new Date().toISOString(),
        jobs: [
          {
            ...jobs53[0],
            salary: "$90k–120k",
            descriptionText:
              "No visa sponsorship. Applicants must reside in Brazil. React is optional. <img src=x onerror=alert(1)>",
          },
        ],
      },
    }),
  );
  await page.goto("/#jobs");
  await page.click("#jobQuickSearch");
  await page
    .locator(".job-card")
    .first()
    .getByRole("button", { name: "View details", exact: true })
    .click();
  const facts = page.locator("#sourceFacts59");
  await expect(facts).toContainText("No explicit recognized currency code");
  await expect(facts).toContainText("No visa sponsorship.");
  await expect(facts).toContainText("reside in Brazil");
  await expect(facts).toContainText("Worldwide");
  await expect(facts.locator("img")).toHaveCount(0);
  await expect(facts).toContainText("does not establish eligibility");
  await expect(facts).toContainText("React");
});
test("5.9 public dialog and derived personal surfaces clear on real SDK sign-out (mocked server)", async ({
  page,
}) => {
  const fixture = await configured(page);
  fixture.setPlan("pro");
  await seedCareer55(page, { once: true });
  await page.goto("/#home");
  await page.click("#accountBtn");
  await page.fill("#authEmail", "buyer@example.com");
  await page.fill("#authPassword", "test-password");
  await page.click("#authSubmit");
  await expect(page.locator("#authStatus")).toContainText("Signed in as");
  await page.click("#closeAuthBtn");
  await expect(page.locator("#syncStatus")).toContainText(
    "Cloud workspace loaded",
  );
  await page
    .getByRole("button", { name: "Explore public demo", exact: true })
    .click();
  await page.evaluate(async () => {
    const { getAuthClient } = await import("/auth-client.js");
    await (await getAuthClient()).auth.signOut({ scope: "local" });
  });
  await expect(page.locator("#portfolioDemo59")).toBeHidden();
  await nav(page, "resume");
  await expect(page.locator("#resumeTextStatus59")).not.toContainText(
    "Cloud candidate",
  );
});
for (const width of [1440, 768, 375])
  for (const theme of ["light", "dark"])
    test(`5.9 beta screens and all demo sections fit ${width}px ${theme} with WCAG checks`, async ({
      page,
    }) => {
      await page.setViewportSize({ width, height: 1000 });
      await page.addInitScript(
        (t) => localStorage.setItem("launchpad-theme-v1", t),
        theme,
      );
      await seedCareer55(page, { once: true });
      await configured(page);
      await mockJobs53(page);
      const errors = [];
      page.on("pageerror", (e) => errors.push(e.message));
      await page.goto("/#home");
      await page.addScriptTag({ path: require.resolve("axe-core/axe.min.js") });
      const scan = async () => {
        expect(
          await page.evaluate(
            () => document.documentElement.scrollWidth <= innerWidth + 1,
          ),
        ).toBe(true);
        const violations = await page.evaluate(async () =>
          (
            await axe.run(document, {
              runOnly: {
                type: "tag",
                values: ["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa"],
              },
            })
          ).violations.map((x) => ({
            id: x.id,
            nodes: x.nodes.map((n) => ({
              target: n.target,
              summary: n.failureSummary,
            })),
          })),
        );
        expect(violations).toEqual([]);
      };
      for (const view of ["home", "dashboard", "resume", "interview"]) {
        await nav(page, view);
        await scan();
      }
      await nav(page, "jobs");
      await page.click("#jobQuickSearch");
      await page
        .locator(".job-card")
        .first()
        .getByRole("button", { name: "View details", exact: true })
        .click();
      await expect(page.locator("#sourceFacts59")).toBeVisible();
      await scan();
      await nav(page, "home");
      await page
        .getByRole("button", { name: "Explore public demo", exact: true })
        .click();
      for (let n = 0; n < 6; n++) {
        await expect.poll(() => page.locator('#portfolioDemo59').evaluate(d => d.scrollTop)).toBe(0);
        await scan();
        if (n < 5)
          await page
            .locator("#portfolioDemo59")
            .getByRole("button", { name: "Next section", exact: true })
            .click();
      }
      await page.keyboard.press("Escape");
      expect(errors).toEqual([]);
    });
