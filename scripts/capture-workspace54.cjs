// Local visual evidence only. Explicit fixtures; no external account/provider calls.
const fs = require("node:fs/promises");
const path = require("node:path");
const { chromium } = require("@playwright/test");
const { createStaticServer } = require("./serve-production.cjs");
const { seedWorkspace54 } = require("../tests/helpers/workspace54-fixture.cjs");
const views = [
  "applications",
  "roadmap",
  "coach",
  "analytics",
  "companies",
  "settings",
];
(async () => {
  const baseline = process.env.LAUNCHPAD_BASELINE_DIR;
  if (!baseline)
    throw new Error(
      "Set LAUNCHPAD_BASELINE_DIR to an isolated b161d85 archive.",
    );
  const servers = [
    createStaticServer({ root: path.resolve(baseline), prefix: "/" }),
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
  const out = path.resolve(__dirname, "../docs/screenshots/5.4");
  await fs.mkdir(out, { recursive: true });
  const records = [];
  try {
    for (const stage of ["before", "after"])
      for (const size of ["desktop", "mobile"])
        for (const theme of stage === "before"
          ? ["light"]
          : ["light", "dark"]) {
          const context = await browser.newContext({
            viewport: { width: size === "desktop" ? 1440 : 390, height: 1000 },
            reducedMotion: "reduce",
          });
          const page = await context.newPage();
          await seedWorkspace54(page);
          await page.addInitScript(
            (t) => localStorage.setItem("launchpad-theme-v1", t),
            theme,
          );
          // Refuse external network; these are local UI evidence, not live integration tests.
          await page.route("**/*", (route) =>
            new URL(route.request().url()).hostname === "127.0.0.1"
              ? route.continue()
              : route.abort(),
          );
          const errors = [];
          page.on("pageerror", (e) => errors.push(e.message));
          const url =
            stage === "before"
              ? "http://127.0.0.1:8002/"
              : "http://127.0.0.1:8003/launchpad-career/";
          await page.goto(url);
          await page.waitForFunction(() => !!window.launchpadData?.navigate);
          if (
            (await page
              .locator("body")
              .evaluate((b) => b.classList.contains("dark"))) !==
            (theme === "dark")
          )
            await page.click("#themeToggle");
          await page.evaluate(() => {
            const banner = document.createElement("div");
            banner.textContent =
              "UI TEST FIXTURES · LOCAL BROWSER · NOT LIVE CUSTOMERS OR PROVIDERS";
            Object.assign(banner.style, {
              position: "fixed",
              bottom: "0",
              left: "0",
              right: "0",
              zIndex: "99999",
              background: "#101b3b",
              color: "white",
              font: "11px system-ui",
              padding: "6px",
              textAlign: "center",
            });
            document.body.append(banner);
          });
          async function capture(name, focus) {
            if (focus)
              await page
                .locator(focus)
                .evaluate((e) => e.scrollIntoView({ block: "start" }));
            else await page.evaluate(() => window.scrollTo(0, 0));
            await page.screenshot({
              path: path.join(out, name + ".jpg"),
              type: "jpeg",
              quality: 78,
              animations: "disabled",
            });
            records.push({
              file: name + ".jpg",
              width: size === "desktop" ? 1440 : 390,
              theme,
              stage,
              errors: [...errors],
            });
          }
          for (const view of views) {
            await page.evaluate((v) => window.launchpadData.navigate(v), view);
            await page
              .locator("#" + view + "View")
              .waitFor({ state: "visible" });
            await capture(`${stage}-${view}-${theme}-${size}`);
          }
          if (stage === "after") {
            await page.evaluate(() =>
              window.launchpadData.navigate("applications"),
            );
            await page.click("#boardViewBtn");
            await capture(`after-kanban-${theme}-${size}`, "#kanbanBoard");
            await page.click("#calendarViewBtn");
            await page.fill("#applicationMonth", "2026-10");
            await capture(
              `after-calendar-${theme}-${size}`,
              "#applicationsAgenda",
            );
            await page.click("#tableViewBtn");
            await page.click("#addApplicationBtn");
            await capture(`after-application-form-${theme}-${size}`);
            await page
              .locator("#applicationDialog")
              .evaluate((d) => d.close())
              .catch(async () => {
                await page.keyboard.press("Escape");
              });
          }
          if (errors.length)
            throw new Error("Browser errors: " + errors.join("; "));
          await context.close();
        }
    await fs.writeFile(
      path.join(out, "capture-manifest.json"),
      JSON.stringify(
        {
          baseline: "b161d85",
          implementationCommit: require("node:child_process").execFileSync("git", ["rev-parse", "HEAD"], { cwd: path.resolve(__dirname, ".."), encoding: "utf8" }).trim(),
          artifactVersion: require("../package.json").version,
          capturedAt: new Date().toISOString(),
          fixture: true,
          liveIntegrations: false,
          captures: records,
        },
        null,
        2,
      ) + "\n",
    );
    console.log(
      `Captured ${records.length} local browser images, no page errors.`,
    );
  } finally {
    await browser.close();
    await Promise.all(servers.map((s) => new Promise((r) => s.close(r))));
  }
})().catch((e) => {
  console.error(e.message);
  process.exitCode = 1;
});
