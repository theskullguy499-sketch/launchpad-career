// Reproducible browser captures, explicit UI fixtures and mocked providers only.
const fs = require("node:fs/promises"),
  path = require("node:path");
const { chromium } = require("@playwright/test");
const { createStaticServer } = require("./serve-production.cjs");
const { seedCareer55 } = require("../tests/helpers/career55-state.cjs");
const {
  configureCommercial,
} = require("../tests/helpers/commercial-fixture.cjs");
const { mockJobs53 } = require("../tests/helpers/jobs53-fixture.cjs");
(async () => {
  if (!process.env.LAUNCHPAD_BASELINE_DIR)
    throw Error("Set LAUNCHPAD_BASELINE_DIR to an isolated c5dd8bd archive.");
  const servers = [
    createStaticServer({
      root: path.resolve(process.env.LAUNCHPAD_BASELINE_DIR),
      prefix: "/",
    }),
    createStaticServer({
      root: path.resolve(__dirname, "../_site"),
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
  const out = path.resolve(__dirname, "../docs/screenshots/5.5");
  await fs.mkdir(out, { recursive: true });
  const captures = [];
  try {
    const { PLANS } = await import("../lib/plans.mjs");
    for (const stage of ["before", "after"])
      for (const size of ["desktop", "mobile"])
        for (const theme of ["light", "dark"]) {
          const ctx = await browser.newContext({
            viewport: { width: size === "desktop" ? 1440 : 390, height: 1000 },
            reducedMotion: "reduce",
          });
          const page = await ctx.newPage();
          const errors = [];
          page.on("pageerror", (e) => errors.push(e.message));
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
          await page.evaluate(() => {
            const b = document.createElement("div");
            b.textContent =
              "UI TEST FIXTURES · LOCAL BROWSER · MOCKED JOB PROVIDER · NOT REAL CUSTOMERS";
            Object.assign(b.style, {
              position: "fixed",
              bottom: "0",
              left: "0",
              right: "0",
              background: "#101b3b",
              color: "white",
              padding: "7px",
              font: "10px system-ui",
              textAlign: "center",
              zIndex: "99999",
            });
            document.body.append(b);
          });
          async function shot(name, focus) {
            if (focus)
              await page
                .locator(focus)
                .evaluate((e) => e.scrollIntoView({ block: "center" }));
            else await page.evaluate(() => scrollTo(0, 0));
            await page.screenshot({
              path: path.join(out, name + ".jpg"),
              type: "jpeg",
              quality: 80,
              animations: "disabled",
            });
            captures.push({
              file: name + ".jpg",
              stage,
              size,
              theme,
              errors: [...errors],
            });
          }
          async function nav(v) {
            await page.evaluate(
              (view) => window.launchpadData.navigate(view),
              v,
            );
            await page.locator("#" + v + "View").waitFor({ state: "visible" });
          }
          await nav("dashboard");
          await shot(`${stage}-dashboard-${theme}-${size}`);
          if (stage === "after") {
            await nav("resume");
            await shot(`after-resume-${theme}-${size}`);
            await page.selectOption("#resumeTemplate", "modern");
            await shot(
              `after-resume-modern-${theme}-${size}`,
              "#resumePreview",
            );
            await nav("interview");
            await page
              .locator("#practiceHistory button")
              .filter({ hasText: "Open exercise" })
              .click();
            await shot(`after-interview-${theme}-${size}`);
            await page.click("#openGlobalSearch");
            await page.fill("#globalSearchInput", "resume");
            await shot(`after-search-${theme}-${size}`);
            await page.keyboard.press("Escape");
          }
          await nav("jobs");
          await page.click("#jobQuickSearch");
          await page
            .locator(".job-card")
            .first()
            .getByRole("button", { name: "View details", exact: true })
            .click();
          await shot(`${stage}-job-details-${theme}-${size}`);
          if (stage === "after")
            await shot(`after-job-fit-${theme}-${size}`, "#jobFitPanel");
          if (errors.length) throw Error("Browser errors: " + errors.join(";"));
          await ctx.close();
        }
    await fs.writeFile(
      path.join(out, "capture-manifest.json"),
      JSON.stringify(
        {
          baseline: "c5dd8bd",
          implementationCommit: require("node:child_process").execFileSync("git", ["rev-parse", "HEAD"], {cwd:path.resolve(__dirname,".."),encoding:"utf8"}).trim(),
          mockedAuthConfiguration: true,
          version: require("../package.json").version,
          capturedAt: new Date().toISOString(),
          fixture: true,
          mockedJobProvider: true,
          liveIntegrations: false,
          captures,
        },
        null,
        2,
      ) + "\n",
    );
    console.log(
      `Captured ${captures.length} real local browser frames; zero page errors.`,
    );
  } finally {
    await browser.close();
    await Promise.all(servers.map((s) => new Promise((r) => s.close(r))));
  }
})().catch((e) => {
  console.error(e.message);
  process.exitCode = 1;
});
