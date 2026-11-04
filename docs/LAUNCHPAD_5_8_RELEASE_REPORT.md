# Launchpad 5.8 — Premium SaaS Evolution RC

Branch: `feat/launchpad-5.8`. Base: 5.7 `7e412e0641b11498c27147127707a4cadf424cdc`.
Version: `5.8.0-rc.1`. No site deployment, release publication, paid resource, real charge, migration, secret or legal/commercial approval change is part of this work.

## A — Repository and architectural audit

The clean 5.7 working tree, README, package/lock, HTML entrypoint, frontend modules, data models, existing style layers, Supabase integration, tests and Pages workflow were inspected before implementation. The audit was shared before coding.

The stack remains HTML, CSS and native JavaScript modules. Supabase SDK 2.118.0 / esbuild 0.28.2 remain pinned; Playwright, axe and PGlite provide browser, accessibility and PostgreSQL checks. No runtime dependency was added. Existing 5.5 Resume Studio, Interview Lab and Job Fit, 5.6 service hardening and 5.7 owned career preferences remain intact.

Auth uses the official SDK, PKCE/token-hash callbacks and server-confirmed identities. Private data uses existing owned workspace RPC/RLS. Jobs use Remotive via a bounded backend cache. AI uses the secure provider function with consent/quotas. Paddle Sandbox uses signed webhooks, canonical provider confirmation and centralized Free/Pro/Premium entitlements. These backends and their migrations were not modified.

Baseline: 262 tests. CI still builds/tests before a manual `main` deployment with `deploy=true`. Neither hosted Actions nor production deployment is claimed as executed here.

**Reference limitation:** the supplied 5.8 attachment contains the brief, not a new screenshot. Earlier supplied Launchpad references and the explicit navy/indigo/violet direction were used. Exact matching against a new 5.8 screenshot is NOT VERIFIED and remains a visual acceptance step. No unrelated template or screenshot-as-UI was substituted.

## B — Shared design, app shell and navigation

`styles/experience58.css` layers navy navigation, restrained indigo/violet highlights, coherent light/dark surfaces, original brand marks, focus/touch styles and quieter cards over the existing application. The saved theme preference is respected; dark mode is not silently forced on an existing user. The logo remains unchanged. Glass-like depth is restrained; opaque text surfaces avoid relying on translucent low-contrast backgrounds.

All existing routes, mobile drawer, global search, filters and forms are retained. A genuine routing bug was corrected: explicit navigation from `#jobs?job=…` now updates the address to the destination, rather than keeping an old detail URL that reopens on reload. Hash-driven detail/settings links retain their own query. Unknown authentication fragments are preserved until the Auth controller handles them. Existing Auth tests were run against this behavior. Cross-page navigation also starts at the page header; same-page edits and section links retain their own position, preventing partially hidden mobile settings targets.

Files: `styles/experience58.css`, `index.html`, `tracker.js`, public-file allowlist. Relevant checks: source routing/Auth regression suite, all-screen axe, brand and mobile navigation checks in the complete run.

## C — Dashboard and Jobs

### Saved resume readiness

A first-class Dashboard panel examines the first saved resume version: name, headline, summary, skills, languages, evidence entry and a contact/portfolio link. It shows **fields present out of seven**, with an expandable checklist and its definition. Empty accounts show a real next action.

This is not an ATS score, qualification assessment, profile-strength prediction or hiring probability. A contact field is not required to save a resume; users are explicitly told not to add sensitive information just to complete the checklist. Unsaved drafts are not counted.

### Sourced recommendations

The Dashboard uses only listings already retrieved through Jobs, ordered by recognized technology overlap with declared resume/goal skills using the existing Job Fit logic. Ties preserve source order; up to three are displayed. Matching terms are explanatory, not a numeric fit score. No source result means no suggested vacancy. Opening a suggestion goes to its actual loaded details/source link.

### Recently viewed

Jobs now has a disclosure showing up to 12 actually viewed retrieved/bookmarked listings. Entries are validated, deduplicated, bounded and shortened with the existing bookmark serializer. They remain **in memory only**, clear on reload/workspace change and have an explicit clear control. They are not written to guest localStorage or cloud preferences. A saved listing may be recorded again on reload if the user opens its actual detail URL: that is a new view, not persistent history.

History can reopen its own loaded source snapshot during the same session. Availability is not guaranteed; users must check the original source. Unsaved detail URLs never fetch arbitrary URLs supplied by a fragment.

### Source-driven filters and detail usability

Remote remains available for the current Remotive source. Hybrid and On-site are exposed only if loaded/saved source metadata actually supplies them. Remotive itself remains remote-only; the additional metadata contract was verified with labelled adapter fixtures, not a claim of new live providers. Salary remains provider text/“salary supplied”; no currency conversion or estimated salary is fabricated.

Opening a different job now starts at its header, including on mobile after scrolling results. Updating the same detail does not force a new scroll position. Bookmarking, tracker insertion, pagination, source details and all existing statuses remain available.

Files: `experience58.js`, `lib/career58.mjs`, `jobs-experience.js`, `platform.js`, styles and tests.

## D — Auth and profile

Login, registration, recovery, email verification, password visibility and responsive forms use the shared palette while retaining the real authentication implementation. There are no fake OAuth buttons or simulated successful accounts. Provider activation, mail delivery and cross-device confirmation still require live configuration/validation.

Settings adds a local initials identity derived from the display name, with an explicit statement that no photo is uploaded or sent to an avatar provider. **Photo upload/cropping/storage is not implemented**; no insecure upload endpoint or unconsented third-party avatar service was added. Existing profile/career preferences, notifications, privacy, export and deletion controls are retained.

## E — Resume, tracker and AI

The existing editable CV versions, text-first previews, Classic/Modern templates and browser PDF export remain functional. The tracker retains Saved, Applied, Interview, Offer, Hired, Rejected and Withdrawn; old values and records were not renamed or removed.

A new job-detail action prepares a resume-to-job comparison in the existing Coach composer. It:

1. Requires a saved resume and explicit copy confirmation.
2. Uses the first saved version’s headline, summary, skills and project descriptions plus a bounded listing excerpt.
3. Does not copy name/email/phone fields, automatic hidden profile context or a private credential.
4. Preserves a byte budget for the existing 12 KB JSON request limit, including international characters and escaped JSON.
5. Only creates a user-reviewable draft. No provider call, credit consumption, history write or automatic submission occurs on preparation.
6. Still requires the normal verified account, server entitlement, age rules, consent and available credits when the user chooses Ask coach.

Freeform summary/project text can itself contain personal information: the user must review it before sending. This is not automatic redaction or a promise that personal data cannot occur in those excerpts.

The existing AI provider interface remains secure and server-side. No actual AI response was generated during this delivery. Context sharing, private history, errors and quotas remain authoritative on the backend.

### Clearly separated demo tours

Jobs and Coach include optional native-dialog product tours, available separately from live services. The Jobs example explicitly says it is not a real vacancy and its application control is disabled. The assistant example explicitly says “Scripted example, not AI”. Both tours state that nothing is saved or sent to a provider. They never populate the real job collection, tracked applications, AI response area or user history, and never invent provider success.

Tests verify unchanged localStorage, no AI call on comparison preparation, consent cancellation, modal focus/Escape/reopen and workspace isolation.

## F — Billing, internationalization and performance

Free/Pro/Premium, the existing proposed $0/$9/$19 monthly prices, quotas and billing UI remain centralized in the original plans module. No price or merchant/legal flag changed. The frontend does not grant rights because a card was clicked or a demo was viewed. Paddle Sandbox purchase/portal/renewal/cancellation remain unverified against the live provider.

`lib/i18n58.mjs` centralizes new 5.8 strings and provides tested English fallback for future dictionaries plus date/currency formatters. New source-history dates use validated ISO dates formatted consistently in UTC. Impossible/ambiguous dates stay unavailable. Currency formatting never parses or converts freeform source salary text.

**Localization is incremental:** legacy screens still contain existing English literals; Portuguese/Spanish dictionaries and a language picker are not shipped or advertised. The formatter/fallback architecture is prepared, not a claim of completed translations. All customer-facing content remains English.

No heavy dependency or new provider request was added. Recommendations reuse existing bounded Job Fit logic, avoid re-ranking an identical result-array on each filter edit and render only three cards. Session history is capped at 12. Existing storage/request/AI cost limits remain unchanged. Physical-device and slow-network performance is not certified.

## Automated verification

Final clean run: **284 tests passed, 0 failed** — 8 build, 3 PGlite database/RLS, 84 backend/model, 176 source Playwright and 13 built-artifact Playwright. Node 24.19.0, npm 11.9.0, Chromium 154.0.8037.57 on Debian 13, `CI=true`. [Machine-readable acceptance](releases/5.8-ACCEPTANCE.json).

| Check | Status | Scope |
|---|---|---|
| `npm ci` | PASS | Pinned lockfile/dependencies |
| `npm run build` | PASS | Fresh static artifact and SDK bundle |
| `npm run build:check` | PASS | Reproducible committed SDK/licenses/hashes |
| `npm test` | PASS | 284 tests; all prior coverage and new regressions |
| Public-artifact gate | PASS | Allowlist/hashes/known credential patterns |
| Real browser captures | PASS | 102 before/after/detail/demo captures, zero local asset/page/console/overflow errors |
| `npm audit` | PASS | 0 known dependency vulnerabilities at verification time |
| Hosted GitHub Actions | NOT RUN | Local CI mode is not a hosted workflow result |
| ESLint/TypeScript | NOT CONFIGURED | Existing build syntax/import and Edge Function bundle checks apply |
| Live Auth/SMTP/RLS/sync | NOT TESTED | No configured bindings/mailboxes in this environment |
| Live Remotive/OpenAI/Paddle Sandbox | NOT TESTED | No live provider or purchase validation |
| Exact new 5.8 screenshot comparison | NOT VERIFIED | No new reference image accompanied the brief |
| Accept paying customers | BLOCKED | Real integration gates, legal/operator approval and monitored operation remain required |

New tests cover seven-field readiness, validated/bounded/deduplicated history, transparent ranking, personal-field exclusions and UTF-8/JSON byte budgets, localization fallback/formatters, demos that cannot write user data, comparison cancellation/preparation, reload and workspace isolation, initial saved deep links, metadata-based arrangements, mobile detail scroll and axe checks at 1440/768/390 in both themes. A separate regression verifies Settings category controls stay below the fixed mobile header on page entry.

Development failures were investigated rather than hidden: the old October analytics fixture depended on the wall clock and was made deterministic with a scenario-local fixed date; an additional November boundary unit test verifies current rolling-window behavior. Mobile Settings target-size failures were resolved by resetting stale scroll on actual page changes, not by suppressing the accessibility rule. A detached comparison button lookup was corrected; initial-detail callbacks now run after the active workspace render; a textarea assertion was corrected to inspect its value; stale URL navigation was fixed rather than pretending session history was persistent; scoped sidebar color precedence and mobile detail scroll were corrected after visual inspection. Existing assertions were not disabled and test timeouts were not increased to hide failures.

The verified guest artifact contains **88 files / 1,168,856 bytes**; public Auth configuration is absent by design in this local build. All 102 captures match its manifest hash. `npm run test:live` exited with NOT RUN (missing secure test bindings), rather than making a live success claim.

## Visual evidence

[Complete before/after gallery](screenshots/5.8/README.md), [capture manifest](screenshots/5.8/manifest.json).

102 real Chromium captures: all 14 screens before/after (Auth split into Login and Registration), desktop/mobile light/dark, selected tablet views, Kanban/preferences, sourced Dashboard, job details/history and both scripted demo dialogs. Every fixture capture is visibly watermarked; no displayed fixture is claimed to be a real customer/vacancy or live integration result. Images reflect rendered application controls, not reference mockups embedded as UI.

The primary visual direction is navy/indigo/violet with the existing blue/green brand. The previous layout identity, sidebar, calendar, cards and editor remain recognizable; functional preparation/source panels provide a meaningful evolution. A definitive pixel/composition comparison with a new 5.8 reference remains pending its availability.

## Files and setup

Core: `experience58.js`, `lib/career58.mjs`, `lib/i18n58.mjs`, `styles/experience58.css`.
Adapters: `jobs-experience.js`, `platform.js`, `tracker.js`, `index.html`, `scripts/public-files.cjs`.
Quality: `tests/experience58.spec.js`, `tests-unit/career58.test.mjs`, deterministic date fixture in `tests/workspace54.spec.js`, date-boundary coverage in `tests-unit/workspace54.test.mjs`, `scripts/capture58.cjs`; package/lock metadata.
Delivery: this report, README, 5.8 Staging guide, acceptance summary and screenshots. Git diff is authoritative. Auth controllers/callbacks, database migrations, backend handlers, original logo assets, pricing/quotas and deployment configuration were not changed.

See [Windows CMD / local / Staging / rollback guide](releases/5.8-STAGING.md). No new migration, bucket, Edge Function or secret is needed relative to an already deployed 5.6+ backend. No deployment was performed. Guest build works without Auth; configured Staging requires only the owner’s public Supabase URL/publishable key during build.

## Remaining limitations and 5.9 recommendations

1. Obtain the actual new reference screenshot and review composition against the full real gallery. Current direction follows the text and prior references.
2. Validate real mailbox confirmation/recovery, two-account published RLS, token expiry, second-device sync, account deletion and actual private workspaces. Local/mock/PGlite tests do not certify the deployed project.
3. Validate real Remotive, OpenAI quotas/costs and Paddle Sandbox purchase/portal/renewal/failure/cancellation. Keep live charges and legal/operator flags unchanged until explicitly approved.
4. Recently viewed jobs are intentionally session-only. A future persistent/cloud history requires explicit consent, a retention/deletion policy and appropriate storage budgeting; do not silently convert this feature into tracking.
5. Recommendations are vocabulary overlap over the retrieved batch, not full-market search, geographic eligibility, an AI assessment or a hiring probability. Salary ranges/currency conversion require trustworthy structured source data.
6. Photo uploads and full PT/ES translation are not shipped. Complete those with storage/security/consent and linguistic review, not decorative non-working controls.
7. Resume completeness is field presence, not writing quality/ATS compatibility; AI comparison is draft preparation until a real authorized request succeeds. Browser printing is not universal ATS certification.
8. Consolidate tested legacy style/message layers incrementally in 5.9; prioritize actual integration acceptance and measured mobile performance before adding major features.

**Recommendation: controlled-review candidate; NO-GO for paying production customers until real release gates and owner approvals pass.**
