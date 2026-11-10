# Launchpad 5.9 — Public Beta & Portfolio Readiness

Branch: `feat/launchpad-5.9-public-beta`.
Base: 5.8 `47839edf737c9313bffcd4b42abd52d6cccda834`.
Version: `5.9.0-beta.1`. No merge, deployment, secret, price, migration, merchant/legal approval or real-charge change.

## Audit and implementation plan

The repository was clean on the requested 5.8 branch. README, 5.8 release/acceptance, source modules, data models, Auth and service adapters, public build allowlist, Playwright and hosted Pages workflow were inspected before code changes. The audit and brief plan were shared before implementation.

Architecture remains native HTML/CSS/JavaScript. Dependencies remain pinned: Supabase SDK 2.118.0, esbuild 0.28.2, Playwright 1.64.1, axe 4.10.3 and PGlite 0.5.12. No runtime dependency or framework migration. The baseline reports 284 local checks; those are not a live-service certification.

The implemented sequence was: isolated public walkthrough; useful workspace preparation/export/practice controls; literal source facts for international roles; shared presentation/accessibility; targeted and full regression verification; build/capture/setup handoff. Existing 5.8 jobs/coach tours were reused rather than replacing real integrations.

## Public portfolio walkthrough

Discover (`#home`) now offers **Explore public demo**. Its native, labelled dialog has six sections: Overview, Applications, Resume, Interview, Jobs and AI coach. It is available without an account or payment.

The application example can move/reset a fictional card; the resume example changes template; the interview example reveals/hides a static preparation structure. Jobs and Coach hand off to the existing explicitly isolated 5.8 tours. No fictional vacancy can be applied to, and no scripted answer is presented as generative AI.

All example content is fixed and explicitly labelled fictional/demo. It never reads personal records, writes guest/cloud data, calls a provider, imports sample data or changes entitlements. It is not a simulated login or separate account. State resets on close/reopen and the dialog closes on workspace changes. Native Escape/focus trapping and focus return are retained, including handoff to old tours and rapid reopen. New section navigation resets dialog scroll, keeping its title and Close control reachable on mobile.

## Useful workspace improvements

### Dashboard

A compact preparation queue uses the active workspace's saved resume and practice history. It links to Resume Studio, Interview Lab and source checking. Counts reflect stored records only; coverage is not a readiness grade. Existing application/interview dates, calendar, roadmap, activity and sourced recommendations remain available.

### Resume Studio

**Export saved resume as text** creates a UTF-8 `.txt` copy of the selected saved version, including only fields and evidence the user supplied. It stays disabled for an unsaved version. The UI explicitly excludes unsaved edits, preserving the editor draft and existing save/duplicate/PDF controls. Export never uploads data or requests AI. The fixed filename avoids leaking a personal name in the download filename. Contact details inside the exported content remain personal data the user must review before sharing. This is not an ATS compatibility guarantee.

### Interview Lab

Topic-scoped practice coverage counts distinct static questions with a nonempty saved answer, not the number of repeated exercises. A functional **Practice next unanswered question** control uses the existing question selector and its confirmation flow; declining never discards an unsaved answer. All-answered topics invite history review without inventing skill gains or scores. Existing timer, answer persistence, checklist, history and consented AI preparation remain unchanged.

### International source facts

Actual job details show source location, work arrangement, salary text, explicitly recognized currency identifiers and technology mentions. Bare `$`/`£` do not infer a country or ISO currency. Codes and unambiguous markers (e.g. USD/US$/EUR/€) are recognized only from supplied salary text; amounts are not estimated or converted.

Up to three bounded literal source excerpts identify wording about authorization, residence, sponsorship or time zones. Negative wording is preserved. “Worldwide” or “Remote” never grants work eligibility. A recognized technology can be optional/negated; the UI explicitly asks the reader to check original requirements. Missing recognized excerpts do not prove the absence of restrictions. All excerpts render as text, not HTML, and source URLs continue through existing validation.

## Design, accessibility and bugs fixed

Shared navy/indigo/violet surfaces and original branding remain. New cards/dialogs use existing typography and color tokens, readable hierarchy, touch targets, wrapping, reduced-motion behavior and both saved themes. The public dialog and source facts stack at mobile widths; the desktop shell is preserved.

Targeted tests found two inherited activity statuses below AA contrast when populated with records: Interview (4.4:1) and Offer (4.27:1). Their light-theme text was darkened with the original amber/green identity retained. Hired uses the same safe green treatment. Accessibility checks were not suppressed.

Visual review found stale inner-dialog scroll after changing tour sections on mobile. It was fixed by resetting scroll only on section navigation; example actions keep their current context. A regression assertion checks the top after every section transition.

A new persistence test exposed a test-harness problem: the old screenshot seed helper rewrote its fixture on every reload. It now supports opt-in once-only seeding for the new persistence cases, so changes genuinely survive reload. Existing default fixtures/old assertions remain unchanged. The application was not altered to accommodate a destructive test fixture.

No heavy dependency, polling loop or external asset service was introduced. Event listeners mount once. Blob URLs for text export are revoked. The three new browser files are explicitly included in the static deployment allowlist; documentation/screenshots/backend/tests are not deployed. No Lighthouse score or real-device performance claim is made.

## Verification

Final complete run: **308 passed, 0 failed, 0 skipped** — 8 build, 3 PGlite, 93 backend/model, 190 source Playwright and 14 built-artifact Playwright. The separate 14 targeted cases are included in the 190, not counted twice. [Machine-readable acceptance and hashes](releases/5.9-ACCEPTANCE.json).

Node 24.19.0, npm 11.9.0, Chromium 154.0.8037.57 on Debian 13, `CI=true`. The built guest artifact contains **91 allowlisted files / 1,194,526 bytes**, with `publicAuthConfigured: false`. No private key or personal test binding is present.

| Check | Status | Evidence / limit |
|---|---|---|
| `npm ci` | PASS | Clean pinned install before implementation |
| `npm run build` | PASS | Fresh build, not an old `_site` reuse |
| `npm run build:check` | PASS | Reproducible SDK/version/license/hash check |
| Targeted 5.9 Playwright | PASS | Functional cases and 375/768/1440 light/dark WCAG 2.2 tagged checks |
| New pure model/unit tests | PASS | 9 tests: literal facts, negative restrictions, bounded text, coverage, export/validation |
| Complete `npm test` | PASS | Includes all existing build/DB/backend/browser/production tests |
| Artifact/security gate | PASS | Explicit allowlist, hashes, missing assets, known private credential patterns |
| Real rendered screenshots | PASS | 146 before/after captures; zero page/console/asset/overflow errors; current artifact hash matches |
| `npm audit` | PASS | 0 known vulnerabilities at verification time |
| `npm run test:live` | NOT RUN | Guard correctly reported missing secure test bindings; no live success claimed |
| ESLint/TypeScript | NOT CONFIGURED | Existing JS syntax/import and six Edge Function bundle checks remain in the suite |
| Hosted GitHub Actions | NOT RUN | Local CI mode does not equal a hosted workflow result |
| Live Supabase email/SMTP and published RLS/sync | NOT VERIFIED | No live account/test credentials configured |
| Live Remotive, AI and Paddle Sandbox | NOT VERIFIED | No provider response or real sandbox purchase claimed |
| Staging/production deployment | NOT RUN | Owner review and publication remain separate |

One incomplete full test run was deliberately stopped after screenshot review identified the tour-scroll bug; it is not counted as passing. The final suite is rerun after that correction. Safe mocks belong only to test fixtures. PGlite tests execute local PostgreSQL/RLS rules, not the configured hosted project. Browser mocks do not certify email delivery, account isolation in production, AI output or paid subscription behavior.

## Preserved security and data boundaries

Auth controllers/callbacks/config, cloud synchronization/RPC, migrations, Edge Functions, original logos, canonical plans and GitHub Actions deployment gates are unchanged from 5.8. Existing RLS, owner/revision protections, guest/account separation, age/consent rules, JSON backup/restore and account deletion are retained. No paid capability is granted by a demo action or browser value.

All new preparation views derive from the active owner scope, clear on scope changes and show loading rather than guest material during account loading. Text export is deliberate and scoped to the currently selected saved resume. No guest key or cloud schema was migrated; no existing user data was touched.

## Files and visual evidence

Core: `experience59.js`, `lib/public-beta.mjs`, `styles/public-beta.css`.
Adapters: `platform.js`, exported existing `showDemo58` in `experience58.js`, `index.html`, `scripts/public-files.cjs`; package/lock version metadata only.
Checks: `tests/public-beta.spec.js`, `tests-unit/public-beta.test.mjs`, appended production browser case, opt-in once-only seed helper, `scripts/capture59.cjs`.
Handoff: this report, acceptance JSON, beta/Windows runbook, README, all-screen screenshot gallery/manifest. Git diff is authoritative.

[Actual rendered before/after gallery](screenshots/5.9/README.md) · [Windows CMD / free beta build / publication checklist](releases/5.9-BETA.md).

Captures use clearly watermarked local test records and mocked services. They are real rendered UI, not mockups or proof of real vacancies/accounts. The 5.8 gallery is preserved; no new visual reference image accompanied the 5.9 request, so visual comparison is against the existing product and the specified palette, not an unavailable new reference.

## Readiness recommendation and remaining gates

**Candidate for code/portfolio review; no automatic approval for public accounts or paying customers.** An isolated demo can be reviewed without backend configuration. Public account beta requires real mailbox confirmation/recovery, token expiry, two-account deployed RLS/ownership, second-device sync, guest import/export/deletion, monitoring and support acceptance. Provider-configured beta additionally requires live Remotive/AI testing and quotas. Paid release remains NO-GO until real Paddle Sandbox/portal/renewal/failure/cancellation and owner legal/merchant approval gates pass.

The free static hosting path is prepared, not published. Free tiers have operator-controlled limits; AI, SMTP, database retention and payment-provider costs are not claimed free. Full PT/ES translation, photo upload and persistent viewed-job history remain outside this release. Existing 5.8 resume readiness/job-comparison preparation still use the first saved resume; the new text export uses the currently selected saved version. The currency vocabulary/technology recognition is finite and may miss source wording; no automated geographic eligibility assessment is shipped. Chromium automation does not establish Safari/Firefox/Windows/real-device coverage or formal WCAG compliance.
