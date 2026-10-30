// Real browser captures of before/after UI. Fixtures/mocked services are labelled on every image.
const fs = require("node:fs/promises"),
  path = require("node:path"),
  { createHash } = require("node:crypto");
const { chromium, expect } = require("@playwright/test");
const { createStaticServer } = require("./serve-production.cjs");
const { seedCareer55 } = require("../tests/helpers/career55-state.cjs");
const {
  configureCommercial,
} = require("../tests/helpers/commercial-fixture.cjs");
const { mockJobs53 } = require("../tests/helpers/jobs53-fixture.cjs");
(async () => {
  if (!process.env.LAUNCHPAD_BASELINE_DIR)
    throw Error("Set LAUNCHPAD_BASELINE_DIR to an isolated 499f0ac archive.");
  const root = path.resolve(__dirname, ".."),
    out = path.join(root, "docs/screenshots/5.7");
  await fs.mkdir(out, { recursive: true });
  const servers = [
    createStaticServer({
      root: path.resolve(process.env.LAUNCHPAD_BASELINE_DIR),
      prefix: "/",
    }),
    createStaticServer({
      root: path.join(root, "_site"),
      prefix: "/launchpad-career/",
    }),
  ];
  await Promise.all(
    servers.map(
      (s, i) => new Promise((r) => s.listen(8002 + i, "127.0.0.1", r)),
    ),
  );
  const browser = await chromium.launch({
    headless: true,
    ...(process.env.CHROMIUM_PATH
      ? { executablePath: process.env.CHROMIUM_PATH, args: ["--no-sandbox"] }
      : {}),
  });
  const captures = [];
  try {
    const { PLANS } = await import("../lib/plans.mjs");
    const setups = [
      { stage: "before", width: 1440, theme: "light" },
      ...["light", "dark"].flatMap((theme) =>
        [1440, 390].map((width) => ({ stage: "after", width, theme })),
      ),
      { stage: "after", width: 768, theme: "light" },
    ];
    const routes = [
      "home",
      "login",
      "registration",
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
    ];
    for (const setup of setups) {
      const { stage, width, theme } = setup;
      const context = await browser.newContext({
          viewport: { width, height: 1050 },
          reducedMotion: "reduce",
        }),
        page = await context.newPage(),
        errors = [],
        assetFailures = [];
      page.setDefaultTimeout(15000);
      page.on("pageerror", (e) => errors.push(e.message));
      page.on("console", (m) => {
        if (m.type() === "error") errors.push("console: " + m.text());
      });
      page.on("response", (r) => {
        if (r.url().startsWith("http://127.0.0.1:") && r.status() >= 400)
          assetFailures.push(new URL(r.url()).pathname + ":" + r.status());
      });
      await page.route("**/*", (r) =>
        new URL(r.request().url()).hostname === "127.0.0.1"
          ? r.continue()
          : r.abort(),
      );
      await configureCommercial(page, PLANS);
      await mockJobs53(page);
      await seedCareer55(page);
      await page.addInitScript(
        (t) => localStorage.setItem("launchpad-theme-v1", t),
        theme,
      );
      await page.goto(
        stage === "before"
          ? "http://127.0.0.1:8002/"
          : "http://127.0.0.1:8003/launchpad-career/",
      );
      await page.waitForFunction(() => !!window.launchpadData?.navigate);
      await expect(page.locator("#resumeForm")).toBeAttached();
      await page.evaluate(() => {
        const note = document.createElement("div");
        note.textContent =
          "LOCAL UI TEST DATA · MOCKED AUTH / JOBS / BILLING · NOT REAL USERS, VACANCIES OR INTEGRATION PROOF";
        Object.assign(note.style, {
          position: "fixed",
          bottom: "0",
          left: "0",
          right: "0",
          padding: "8px",
          background: "#101b42",
          color: "white",
          font: "10px system-ui",
          textAlign: "center",
          zIndex: "99999",
        });
        document.body.append(note);
      });
      async function shot(view, detail = "") {
        await page.evaluate(async () => {
          await document.fonts.ready;
          await new Promise((r) =>
            requestAnimationFrame(() => requestAnimationFrame(r)),
          );
        });
        const file = `${stage}-${view}${detail}-${theme}-${width}.jpg`;
        const overflow = await page.evaluate(
          () => document.documentElement.scrollWidth > innerWidth + 1,
        );
        if (overflow || errors.length || assetFailures.length)
          throw Error(
            JSON.stringify({ file, overflow, errors, assetFailures }),
          );
        await page.screenshot({
          path: path.join(out, file),
          type: "jpeg",
          quality: 80,
          animations: "disabled",
        });
        captures.push({
          file,
          ...setup,
          view,
          detail,
          overflow,
          errors: [...errors],
          assetFailures: [...assetFailures],
        });
      }
      for (const view of routes) {
        if (
          width === 768 &&
          !["dashboard", "jobs", "settings", "billing"].includes(view)
        )
          continue;
        if (["login", "registration"].includes(view)) {
          await page.click("#accountBtn");
          await page.click(view === "login" ? "#signInMode" : "#signUpMode");
          await expect(page.locator("#authSubmit")).toBeVisible();
          await shot(view);
          await page.click("#closeAuthBtn");
          continue;
        }
        await page.evaluate((v) => window.launchpadData.navigate(v), view);
        await expect(page.locator("#" + view + "View")).toBeVisible();
        await page.evaluate(() => scrollTo(0, 0));
        if (view === "jobs") {
          await page.click("#jobQuickSearch");
          await expect(page.locator(".job-card")).not.toHaveCount(0);
        }
        await shot(view);
        if (stage === "after" && width === 1440 && view === "applications") {
          await page.click("#boardViewBtn");
          await shot(view, "-kanban");
          await page.click("#tableViewBtn");
        }
        if (stage === "after" && width === 1440 && view === "settings") {
          await page.locator("#careerPreferences57").scrollIntoViewIfNeeded();
          await shot(view, "-preferences");
        }
      }
      await context.close();
    }
    const manifestBytes = await fs.readFile(
      path.join(root, "_site/build-manifest.json"),
    );
    await fs.writeFile(
      path.join(out, "manifest.json"),
      JSON.stringify(
        {
          capturedAt: new Date().toISOString(),
          baseline: "499f0ac",
          buildManifestSha256: createHash("sha256")
            .update(manifestBytes)
            .digest("hex"),
          mode: "Local rendered UI. Labelled test fixtures; mocked auth/jobs/billing, no provider calls or purchase.",
          captures,
        },
        null,
        2,
      ) + "\n",
    );
    console.log(
      `Captured ${captures.length} screenshots; no page/console errors, local asset HTTP failures or horizontal overflow.`,
    );
  } finally {
    await browser.close();
    await Promise.all(servers.map((s) => new Promise((r) => s.close(r))));
  }
})().catch((e) => {
  console.error(e.message);
  process.exitCode = 1;
});
