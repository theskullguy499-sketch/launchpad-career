// Browser evidence of real local guest states. No provider mocks, accounts or live calls.
const fs = require("node:fs/promises"),
  path = require("node:path");
const { createHash } = require("node:crypto");
const { chromium, expect } = require("@playwright/test");
const { createStaticServer } = require("./serve-production.cjs");
(async () => {
  if (!process.env.LAUNCHPAD_BASELINE_DIR)
    throw Error("Set LAUNCHPAD_BASELINE_DIR to an isolated 4e02d55 archive.");
  const root = path.resolve(__dirname, ".."),
    out = path.join(root, "docs/screenshots/5.6");
  const manifestBytes = await fs.readFile(
    path.join(root, "_site/build-manifest.json"),
  );
  const build = JSON.parse(manifestBytes);
  if (build.publicAuthConfigured)
    throw Error(
      "Capture only an unconfigured guest build, never private accounts.",
    );
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
    await fs.mkdir(out, { recursive: true });
    for (const stage of ["before", "after"])
      for (const width of [1440, 390])
        for (const theme of ["light", "dark"]) {
          const context = await browser.newContext({
            viewport: { width, height: 1050 },
            reducedMotion: "reduce",
          });
          const page = await context.newPage(),
            errors = [],
            assetFailures = [];
          page.setDefaultTimeout(12000);
          page.on("pageerror", (e) => errors.push(e.message));
          page.on("console", (message) => {
            if (message.type() === "error") errors.push("console.error: " + message.text());
          });
          page.on("response", (r) => {
            if (r.url().startsWith("http://127.0.0.1:") && r.status() >= 400)
              assetFailures.push(new URL(r.url()).pathname + ": " + r.status());
          });
          await page.route("**/*", (r) =>
            new URL(r.request().url()).hostname === "127.0.0.1"
              ? r.continue()
              : r.abort(),
          );
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
            const note = document.createElement("div");
            note.textContent =
              "LOCAL GUEST MODE · SERVICES NOT CONFIGURED · NOT LIVE INTEGRATION EVIDENCE";
            Object.assign(note.style, {
              position: "fixed",
              bottom: "0",
              left: "0",
              right: "0",
              zIndex: "99999",
              padding: "7px",
              background: "#101b3b",
              color: "white",
              font: "10px system-ui",
              textAlign: "center",
            });
            document.body.append(note);
          });
          async function nav(view) {
            await page.evaluate((v) => window.launchpadData.navigate(v), view);
            await expect(page.locator("#" + view + "View")).toBeVisible();
          }
          async function shot(view) {
            await page.evaluate(async () => {
              await document.fonts.ready;
              scrollTo(0, 0);
              await new Promise((r) =>
                requestAnimationFrame(() => requestAnimationFrame(r)),
              );
            });
            const file = `${stage}-${view}-${theme}-${width}.jpg`;
            await page.screenshot({
              path: path.join(out, file),
              type: "jpeg",
              quality: 80,
              animations: "disabled",
            });
            const overflow = await page.evaluate(
              () => document.documentElement.scrollWidth > innerWidth + 1,
            );
            if (overflow || errors.length || assetFailures.length)
              throw Error(
                JSON.stringify({ file, overflow, errors, assetFailures }),
              );
            captures.push({
              file,
              stage,
              view,
              width,
              theme,
              overflow,
              errors: [...errors],
              assetFailures: [...assetFailures],
            });
          }
          await nav("home");
          await shot("home");
          if (stage === "after") {
            await page.click("#accountBtn");
            await expect(page.locator("#authDialog")).toBeVisible();
            await expect(page.locator("#authStatus")).toContainText(/not configured/i);
            await shot("login");
            await page.click("#closeAuthBtn");
            await nav("jobs");
            await page
              .locator("#jobQuickSearch")
              .click();
            await expect(page.locator("#jobStatus")).toContainText(
              /not configured|configure|unavailable/i,
            );
            await shot("jobs");
            await nav("coach");
            await shot("coach");
            await nav("billing");
            await expect(page.locator("#billingStatus")).not.toHaveText("");
            await shot("billing");
          }
          await context.close();
        }
    await fs.writeFile(
      path.join(out, "manifest.json"),
      JSON.stringify(
        {
          capturedAt: new Date().toISOString(),
          baseline: "4e02d55",
          buildManifestSha256: createHash("sha256")
            .update(manifestBytes)
            .digest("hex"),
          mode: "Local unconfigured guest; no provider mocks, no live accounts or integrations",
          captures,
        },
        null,
        2,
      ) + "\n",
    );
    console.log(
      `Captured ${captures.length} browser screenshots; zero page errors, asset HTTP failures or horizontal overflows.`,
    );
  } finally {
    await browser.close();
    await Promise.all(servers.map((s) => new Promise((r) => s.close(r))));
  }
})().catch((e) => {
  console.error(e.message);
  process.exitCode = 1;
});
