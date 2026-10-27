# GitHub Pages deployment checklist

Production: **https://theskullguy499-sketch.github.io/launchpad-career/**

GitHub Pages does not run npm automatically. This branch now supports both of these explicit deployment paths:

- **Recommended: GitHub Actions** runs the committed workflow, builds and tests `_site/`, then uploads that artifact. The deploy job runs only on `main`; pull requests only test/build.
- **Static branch hosting** serves the committed root files, including the now-tracked `vendor/supabase.js` and `.nojekyll`. No npm build is required on Pages itself. Do not publish an older branch without these files. Branch deployments expose other public repository files; the Actions artifact includes only the required browser files and notices.

## Before merging

- [ ] Review the PR; preserve the existing localStorage keys and back up local records with JSON export.
- [ ] Use Node.js **24.19.0**, as pinned in `.node-version`.
- [ ] Run `npm ci`, then `npm run build:check`. This verifies committed SDK bytes/licenses/hashes against SDK **2.118.0**, esbuild **0.28.2** and the dependency integrity pins in `package-lock.json`.
- [ ] Run `CHROMIUM_PATH=/usr/bin/chromium npm test`, or install Chromium with `npx playwright install --with-deps chromium` and run `npm test`. Tests include the built artifact mounted only at `/launchpad-career/`, real SDK loading, all public-file hashes/MIME types, no failed app asset requests, browser/app light/dark combinations, and local backup safety. Supabase responses in browser tests are mocked.
- [ ] If changing SDK dependencies, run `npm run build` and commit **all three** generated `vendor/` files. CI rejects stale committed output before rebuilding it.
- [ ] Keep `auth-config.js` either entirely blank (fully usable guest mode) or populated only with the public project URL and `sb_publishable_` key. The build rejects secret/legacy keys, credentials in the URL, and extra config fields. Never commit SMTP, database or service-role credentials.
- [ ] If enabling accounts, complete the **separate** [Supabase and SMTP checklist](SUPABASE_SETUP.md#production-configuration-checklist). Do not advertise private account storage until the live migration and isolation tests pass. The local guest dashboard remains shared between accounts regardless of cloud configuration.

## Publish with Actions

1. In **Repository Settings → Pages → Build and deployment**, select **GitHub Actions**. Enable Actions if disabled; review any `github-pages` deployment environment protections.
2. Merge the approved PR into `main` yourself. Pushes/PRs now test and build only. To publish, explicitly dispatch the workflow on `main` with **deploy=true**. This task does **not** merge automatically. The `Test and publish Launchpad` workflow installs the locked dependencies, verifies the committed SDK, builds `_site/`, runs policy/build/browser tests and uploads only the public artifact.
3. Wait for the deployment job to succeed. Dispatching without **deploy=true** or on a feature branch does not deploy.
4. Check the deployed URL and the files below, including direct navigation to `auth/callback.html`. An invalid-link message without a token is expected; a 404 is not.
5. In browser DevTools, confirm no failed same-origin JavaScript/CSS/asset requests and no module errors. Check light and dark app themes with both system themes.
6. Verify local JSON export/restore using a disposable browser profile. Existing data stays at the same origin; deploying does not migrate or erase it.
7. Complete the real-mailbox checks separately. Pages workflow success does not establish SMTP delivery or live RLS readiness.

Launchpad 4.1 also stages `tracker.js`, `navigation.js`, `platform.js`, `lib/*.mjs`, `data/companies.mjs`, `styles/platform.css`, `assets/launchpad.svg` and both `legal/` drafts. Backend functions, secrets and SQL stay out of the browser artifact.

The original artifact files remain:

```text
index.html
.nojekyll
auth-config.js
auth.js
auth-client.js
cloud-data.js
auth/callback.html
auth/callback.js
vendor/supabase.js
vendor/LICENSES.txt
vendor/manifest.json
build-manifest.json
```

The original CSS is inline; the new platform stylesheet and SVG logo are explicitly staged. Fonts use the local system stack. The SDK is a self-contained browser bundle with no external runtime imports/CDN. `build-manifest.json` records a SHA-256 for each deployed input, without timestamps or secrets. The artifact excludes development dependencies, SQL tests and private configuration.

For static branch hosting instead, select **Deploy from a branch → main → /(root)** after the reviewed commit is merged. Disable the Actions deployment workflow if choosing that mode to avoid competing deployments. The committed bundle is what makes this no-build route work. Any SDK upgrade still requires regeneration and review before committing.

The local production-artifact server is for internal tests only: `node scripts/serve-production.cjs`. It intentionally returns 404 outside the project prefix, catching broken absolute-root asset imports. This task does not claim the workflow has run on GitHub or that the updated Pages site has been published.

## 4.1 mobile release gate

Use [the 4.1 release audit](RELEASE_4_1.md) alongside this checklist. Confirm the
closed/open drawer, focus return, Escape, touch navigation and all sections at
320, 375, 390, 428 and 768 px. Check desktop navigation at 1024 and 1440 px.
`navigation.js` must load from the project prefix with a JavaScript MIME type.
The production-artifact tests exercise touch emulation; real Safari/Firefox and
physical-device checks remain separate acceptance steps. A successful workflow
alone does not prove those checks or real email delivery.
