# Launchpad 5.7 — Premium Workspace Release Candidate

Branch: `feat/launchpad-5.7`. Base: Launchpad 5.6 `499f0ac1405c5953de0d2fd2098b6c8d368e4d3f`.

**Recommendation: NO-GO for paying customers.** This is a reviewable, locally tested product increment, not certification of a live commercial service. No merge, deployment, secrets, commercial/legal approvals or real charges were changed.

## Phase 0 — audit before implementation

The working tree was clean on the 5.6 branch. The existing README, package/lock, static entrypoint, module structure, styles, fixtures, tests, Supabase functions/migrations and Pages workflow were inspected before implementation. The audit was also reported in the conversation before code changes.

- Architecture: HTML + native ES modules, layered CSS, static Pages artifact `_site`. No React/framework migration or new runtime dependency.
- Dependencies: pinned Supabase SDK 2.118.0; esbuild 0.28.2; Playwright 1.64.1, axe-core 4.10.3, PGlite 0.5.12. Node 24.19.0. Baseline: 248 local tests.
- Guest persistence: existing browser keys for opportunities, extended workspace, theme and SDK-managed Auth session. Existing backup/export and explicit import remain intact.
- Private accounts: official Supabase Auth; email confirmation and safe callback; owned workspace RPC/RLS, revision guards, consent and account-switch cleanup. No passwords stored manually.
- Jobs: Remotive through `job-explorer`, bounded/cached source results, no fallback vacancies; saved/tracked collections and official source links already exist.
- AI: server-side `ai-coach`, explicit context/history consent, atomic limits and server-derived credits; no fabricated response when unavailable.
- Billing: canonical Free/Pro/Premium prices and quotas; Paddle Sandbox, HMAC webhooks, canonical provider confirmation and server-side entitlements. Simulated events never grant paid access.
- CI: `npm ci`, reproducible build checks, PostgreSQL/RLS and backend tests, Playwright source + built Pages tests. Deployment still requires manual workflow dispatch on `main` with `deploy=true`.
- No configured lint/TypeScript project. The existing build validates browser JavaScript syntax, pinned SDK and imports; Edge Functions are checked with esbuild. These checks are not claimed as ESLint, TypeScript or live Deno validation.

The managed environment reports a restricted proxy and no service credential bindings. Prior 5.6 external requests were denied before reaching services. No repeated attempts, credential requests, owner dashboard changes or bypass were made during this release.

## Implemented changes

The existing feature controllers remain authoritative. A new bounded presentation module and stylesheet compose actual rendered controls; reference images are not embedded as UI.

| Screen | Delivered in 5.7 |
|---|---|
| Discover | Original globe/orbit SVG; brand retained; Explore / Build / Plan cards link to actual Jobs, Resume and Roadmap; clear guest/account entry |
| Login / Registration | Consistent split-panel navy story, blue actions, legible forms, quiet mode tabs and responsive layout. Existing password visibility, validation, confirmation/resend/recovery, legal/age controls and guest return retained. No fictional OAuth buttons |
| Dashboard | Metrics moved before the large legacy preparation panel; actual six-month dated-record chart, accessible data/definition disclosure, empty guidance and contextual next-step card. Existing calendar, goals, activity, tasks, saved jobs and intelligent preparation panels remain available |
| Applications | Refined table/filters/colored Kanban columns, compact header, company marks and status hierarchy. Existing create/edit/delete/move, dates, salary, interviews, history, calendar and export retained |
| Career Roadmap | Shared header scale, softer journey panel, timeline/checklists and responsive cards. All existing editable goals, milestones and user deadlines preserved |
| Companies | Coherent directory cards, locally curated identities/fallbacks, filters and official links; no invented hiring counts or vacancies |
| Job Explorer | Refined source cards/search/filter surfaces, shared spacing and responsive details. Existing saved/tracked tabs, pagination, bookmarks, source dates and application links retained |
| Resume Studio | Editor/preview workbench, quieter version toolbar, compact accessible Storage and privacy disclosure. Cloud consent remains outside the disclosure and is still mandatory. Classic/Modern single-column templates, save versions and browser PDF export preserved |
| Interview Lab | Real saved-exercise count, saved checklist completion and clearly labelled static question-bank count; better prompt, timer/history and preparation surfaces. No employer-verification or fake AI scoring claims |
| AI Career Coach | Refined conversation, suggestions, context and history surfaces; additional international-career and salary-negotiation prompt starters only fill the existing composer. They never auto-send data or generate simulated answers |
| Analytics | Real current-status interview-stage snapshot with explicit denominator/limitations, alongside existing period charts, status/company distribution and goal progress |
| Profile & Settings | New editable countries, role types, arrangements, technology skills, languages and experience context. Saved through the active workspace, explicit cloud-storage consent, reload/backup/restore and pending-save typing protection. Existing Account/Security/Privacy/Notifications/Data/Subscription/Appearance remain intact |
| Plans & Billing | Shared premium card/button/table system, readable Free/Pro/Premium proposals and honest current-access/unknown/unavailable states. Checkout and credits remain server-authoritative |

Shared tokens: navy #101B42, action blue #155DFC, violet/mint accents, light canvas #F7F9FE; dark equivalents use readable foregrounds. Consistent 17px cards, subtle shadows, restrained motion, focus states and mobile touch controls. Native responsive drawer and global Ctrl/Cmd+K search are retained, not replaced by decorative controls.

## Data, formulas and safety

- No database migration or backend contract change. Additional fields live under `preferences.careerPreferences57`, using the existing owned JSON preferences storage. The combined preferences payload is capped locally at 45,000 UTF-8 bytes, conservatively below the existing server limit; no automatic truncation/deletion.
- Six-month chart counts valid stored `applicationDate` values in the last six calendar months, including Saved records. Invalid/undated/out-of-range entries are excluded. It is tracked-record activity, not hiring success or growth. Dates are validated, not silently normalized into another day/month.
- Interview-stage snapshot: current Interview + Offer + Hired records divided by current non-Saved records (Applied, Interview, Offer, Hired, Rejected, Withdrawn). Empty denominator shows “—”. It always uses all workspace records; the existing date selector applies to the original charts/KPIs, not this overall snapshot. This is explicitly **not** a historical conversion funnel: later rejections do not reconstruct prior interview stages.
- Existing canonical status `Interview` represents interviewing; Hired/Withdrawn remain supported. No destructive rename of stored values or loss of old statuses.
- Career preferences are self-declared, not verified qualifications/work authorization. They are not silently copied into resume versions, Job Fit, an AI prompt or another account. This release does not add a separate automatic guest-preferences migration; guest records remain available and can be exported/restored explicitly.
- Unsaved new preferences survive ordinary navigation and concurrent saves without replacing newer typing. Scope changes clear drafts, consent, pending UI effects, chart details and summaries. Confirmed guest clear / JSON replacement clears stale drafts; invalid new preference shapes are rejected before backup replacement.
- Existing RLS, Auth SDK, callback, age/consent checks, Paddle handlers, commercial prices/limits, migrations and deployment workflow were not modified. No new third-party PII destination was introduced.
- Guest data remains shared within a browser profile. A static frontend uses SDK-managed tokens; XSS prevention and trusted devices remain important. Legal/account deletion and billing-retention procedures still require owner/legal review.

## Visual evidence and comparison

[Full before/after gallery](screenshots/5.7/README.md), [capture manifest](screenshots/5.7/manifest.json).

**78 actual Chromium screenshots**, covering all 14 requested screens (Auth is shown as Login and Registration): baseline 5.6 desktop light, 5.7 desktop light/dark, mobile light/dark; additional tablet, Kanban and preference detail captures. Browser-rendered UI, not illustrations pretending to be a website.

Every image has an explicit test-data/mock watermark. Account form availability, job rows and billing catalog use test fixtures through the actual SDK/UI; no live account, purchased subscription, real AI response or verified vacancy is claimed. Source responses are mocked only in the capture/test harness, never added as fallback product data.

Compared against the attached references:

- Closer: compact sidebar/header, softer bento surfaces, purpose-colored metrics, chart/next-step hierarchy, company cards, paper preview, question workbench and consistent auth forms.
- The first visual review found the legacy preparation panel still pushing the chart below the fold. It was moved later, preserving its actions/data. Resume privacy information was made a disclosure to give the actual editor/paper a better first viewport, with cloud consent kept visible.
- Intentional differences: no fake 67% profile score, testimonials, market counts, salary examples, hiring badges, ATS score, OAuth providers or AI feedback. Charts contain only fixture/user records and the definitions above. Native confirmation dialogs remain for existing destructive actions.
- Further visual work may refine individual page density/illustration details after controlled feedback. This is an incremental application-wide evolution, not a claim that every reference component was implemented verbatim. The original brand and current architecture are preserved.

The capture script fails on page/console errors, failed local assets or horizontal overflow. The output is local; no screenshots imply that Staging was updated. Separate tests cover 1440/768/390px and inherited smaller widths.

## Verification results

Final run: **262 tests passed**, preserving the 248 baseline cases and adding 14. There were no failures, skipped tests or retries in the completed final run. Earlier interrupted/failed development runs are described below and are not presented as successful final runs.

| Check | Result | Scope |
|---|---|---|
| Dependency installation | PASS | `npm ci`, lockfile integrity |
| Build and pinned SDK | PASS | `npm run build`, `npm run build:check` |
| Existing + new complete suite | PASS | `npm test`: 8 build + 3 PostgreSQL + 76 backend/model + 162 source Playwright + 13 built-artifact Playwright = 262 |
| Public artifact inspection | PASS | Allowlist, hashes, known private credential patterns |
| Browser captures | PASS | 78 local screenshots; zero page/console errors, asset failures or horizontal overflow |
| Hosted GitHub Actions | NOT RUN | Local `CI=true` execution is not a hosted workflow run |
| Lint / TypeScript | NOT CONFIGURED | No such existing project scripts; syntax/import checks run through build |
| Live Supabase / email delivery / second device | NOT TESTED | No configured bindings or external mailbox access |
| Published RLS / cloud sync | NOT TESTED | Local SQL and mocked accounts do not prove deployed policies |
| Live Remotive / external careers links | NOT TESTED | Restricted access; fixtures do not prove current vacancies/link availability |
| Live OpenAI / cost reporting | NOT TESTED | No provider bindings or real generation |
| Paddle Sandbox purchase / portal / renewal | NOT TESTED | No authorized test purchase or owner dashboard access |
| Real billing and legal activation | BLOCKED | Requires owner approval and real release gates; not changed |

Environment: Node 24.19.0, npm 11.9.0, Chromium 154.0.8037.57 on Debian 13, headless with `CI=true` and two workers. The artifact contains 84 public files, 1,138,015 aggregate uncompressed bytes (not a measurement of initial network transfer). No heavy dependencies or new provider requests were added. Physical-device/slow-network performance was not benchmarked.

The generated local artifact is intentionally guest-only (`publicAuthConfigured: false`); a configured Staging build requires the owner's public Supabase values. Its hash matches the captured UI artifact. `npm audit --audit-level=high` reported zero vulnerabilities; this is not a guarantee against unknown issues. The optional `npm run test:live` exited 2 without running because the four secure bindings were absent, so no live account or provider result is claimed.

[Machine-readable acceptance summary](releases/5.7-ACCEPTANCE.json). All six Edge Function bundles were additionally validated by esbuild; no live Deno deployment was performed.

New tests cover calendar aggregation, status-ratio formula, bounded preference schemas/budgets, preservation of unknown existing data, guest save/reload/JSON clear+restore, cloud consent, workspace switching, typing during a held cloud save, navigation and axe/overflow checks at 1440/768/390 in both themes.

During development, the following issues were fixed rather than hiding failures:

1. A legacy `.dashboard-bento` node had already been removed by the 5.2 composer; composition now uses the current studio tree.
2. An added body class broke the theme-only class contract. A data attribute now identifies the release without changing that interface.
3. Global `scroll-margin-top` on the sticky mobile button shifted scroll by six pixels during focus/click. The rule is now limited to view content; the original exact-scroll regression assertion remains.
4. The mobile drawer must leave its outside backdrop reachable; its original bounded width was preserved.
5. A new backup test initially selected a hidden legacy Applications button from Settings. It now exercises the actual visible Download JSON backup control and asserts restored values, without weakening existing tests.
6. A legacy control carried both outline and primary classes; their new cascade order caused dark text over a blue hover state. Primary variants now win consistently, and the unchanged light-theme axe regression passed.
7. Visual inspection caught low-contrast monochrome employer marks on dark surfaces. Neutral logo badges now retain the original artwork without recoloring it; the Coach welcome area was also compacted to bring the composer closer.
8. An interrupted early Playwright server was accidentally reused, causing connection refusals. Later runs use fresh `CI=true` server lifecycles; no timeout/assertion changes were made to disguise this infrastructure failure.
9. The managed executor restarted during the final rerun, removing running processes and `/tmp` logs. Source commits and all browser captures survived. The complete validation was restarted with logs under the persistent `/workspace/launchpad57-verification` directory; an interrupted run is not counted as complete.

## Files and deployment

Primary files: `experience57.js`, `lib/workspace57.mjs`, `styles/experience57.css`, original `assets/orbit57.svg`, integration hooks in `platform.js`, stylesheet in `index.html`, explicit public-file allowlist, package/lock version 5.7.0-rc.1. Tests: `tests-unit/workspace57.test.mjs`, `tests/workspace57.spec.js`. Delivery: this report, README, capture script/gallery, 5.7 Staging guide. Git diff is authoritative.

See [Windows CMD / Cloudflare / rollback instructions](releases/5.7-STAGING.md). This release only changes the frontend; no new Edge Function or migration deployment is required **relative to a fully deployed 5.6 backend**. If 5.6 functions were never published, their owner-reviewed fixes remain a separate pending step.

## Remaining risks and next actions

1. Review the actual before/after images; run the entire suite in the hosted PR CI as well. Local Chromium Linux is not a guarantee for every physical device/browser, screen reader or WCAG/legal compliance.
2. Supply only the public Supabase project URL/publishable key during the Staging build; validate exact Staging callback/domains and mailbox confirmation/reset externally when service access exists. No secrets should enter client artifacts.
3. Validate two real accounts, RLS, expired/revoked tokens, cloud-write failures, second-device sync, account deletion and owner-consented import on the published project.
4. Validate Remotive source terms/current results, AI provider budgets/credits/cost reporting and real Sandbox purchase/webhook/portal/renewal/cancel/failure scenarios. No live integration was activated here.
5. Job salary filtering remains source-text/“salary supplied”; no invented normalized salary ranges or geographic eligibility guarantees. Job Fit uses its existing explicit declared sources, not an opaque new match score.
6. Resume PDF uses browser printing, not a server PDF/ATS certification. Unsaved drafts stay in memory until explicit Save; navigating is supported but refresh may discard unsaved edits. Native confirmations are still used for destructive operations.
7. Legal drafts, operator identity, support, privacy/retention, monitored costs, backups and business approvals remain prerequisites before accepting paying customers. Do not enable flags or real charges automatically.

**Release status: reviewable candidate for controlled Staging validation; NO-GO for paid production until real integration and owner approval gates pass.**
