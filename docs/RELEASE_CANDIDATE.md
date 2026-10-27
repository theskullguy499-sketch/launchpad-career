# Launchpad 4.0 Release Candidate — review package

**Your Career, Higher.** Prepared on `improve/launchpad-responsive-supabase-auth` for review against `main`.

## Implemented

The original tracker, guest keys, JSON backups, sample entries, themes and starter roadmap are preserved. The original tracker code is extracted into a readable module and extended, not replaced with a visual-only mockup.

Functional screens cover the landing page, sign-in, registration, explicit email verification, recovery/reset, dashboard, applications, companies, sourced jobs, editable roadmap, AI coach, analytics and settings. New features include detailed application fields, ISO-country/currency choices, accessible Kanban, favorites/custom employers, personal goals/milestones, tasks/reminders, real-record charts, profile editing, feedback, personal export and deletion controls.

Verified account workspaces are separated from guest data. Cloud writes are atomic, revision checked and bound to the expected owner. Explicit guest import preserves existing cloud rows and stable IDs. Private content, queued writes and late responses are cleared/discarded across account changes. Database policies and backend-only budgets/cache/outbox are supplied in the additive second migration.

Secure Edge Functions implement Remotive retrieval, official OpenAI Responses, recent-login account deletion and optional daily reminder digests. They are real service adapters with truthful unavailable/error states; no synthetic vacancies or fake generative responses are substituted.

## Executed validation

- **50 Playwright tests passed:** 40 source/platform/accessibility tests and 10 built-artifact tests.
- **12 backend/model/workspace tests passed.** Provider HTTP responses in these tests are mocked.
- **2 PostgreSQL policy tests passed:** actual PostgreSQL WASM engine, simulated Supabase Auth/JWT context, both migration generations, owner isolation, stale writes, imports, quotas and outbox claims.
- **2 public-build safety tests passed.**
- All four Edge Function entrypoints bundled with checked official SDK version pins. This does not establish deployed Deno/runtime readiness.
- Clean locked install, reproducible committed SDK verification, production build and whitespace checks succeeded. Dependency audit reported **0 known vulnerabilities**, including development dependencies.
- WCAG-tagged automated scans passed on all main screens in light/dark themes; modal naming, keyboard focus/Escape and responsive screens were tested. This is not a declaration of complete accessibility compliance.

The optional live smoke runner was explicitly **not run** because secure test credentials were missing. No live email arrival, verification, recovery, AI result, job-feed response, reminder delivery or production RLS is reported as proven. Authoritative Remotive API documentation was successfully reviewed; actual feed access was blocked by the current environment proxy.

## External release gates

Follow [LAUNCHPAD_4_SETUP.md](LAUNCHPAD_4_SETUP.md) and [PRODUCTION_READINESS.md](PRODUCTION_READINESS.md). Required actions include real public Supabase configuration, both database migrations, server-side confirmation and the age/terms hook, real SMTP/templates, Edge Function deployment/secrets, AI spending limits, provider terms/access, optional scheduler/Resend, real two-user/mailbox/provider acceptance tests, qualified legal/operator review and recovery drills.

The RC's bounded snapshot and reminder-worker capacities are documented; load-test expected usage before a commercial launch. No subscriptions, payment processing, customer counts, partnerships or legal compliance claims are fabricated.

## Deployment / PR status

No merge or deployment was performed. Frontend publication requires an explicit manual Actions dispatch on reviewed `main` with **deploy=true**, or a separately approved branch-hosting procedure. The same production URL is retained. GitHub API/GraphQL and the production hostname remain blocked by the environment proxy (HTTP 403), so PR creation/inspection and live HTTPS acceptance cannot be confirmed here. The feature branch and prepared PR form/description are the reviewable result.

## Files changed in this RC increment

- [`.github/workflows/pages.yml`](../.github/workflows/pages.yml)
- [`.gitignore`](../.gitignore)
- [`README.md`](../README.md)
- [`assets/launchpad.svg`](../assets/launchpad.svg)
- [`auth.js`](../auth.js)
- [`auth/callback.html`](../auth/callback.html)
- [`data/companies.mjs`](../data/companies.mjs)
- [`data/countries.mjs`](../data/countries.mjs)
- [`docs/COMMERCIAL_READINESS.md`](../docs/COMMERCIAL_READINESS.md)
- [`docs/GITHUB_PAGES.md`](../docs/GITHUB_PAGES.md)
- [`docs/LAUNCHPAD_4_SETUP.md`](../docs/LAUNCHPAD_4_SETUP.md)
- [`docs/OPERATIONS.md`](../docs/OPERATIONS.md)
- [`docs/PRODUCTION_READINESS.md`](../docs/PRODUCTION_READINESS.md)
- [`docs/RELEASE_CANDIDATE.md`](../docs/RELEASE_CANDIDATE.md)
- [`docs/SUPABASE_SETUP.md`](../docs/SUPABASE_SETUP.md)
- [`index.html`](../index.html)
- [`legal/privacy.html`](../legal/privacy.html)
- [`legal/terms.html`](../legal/terms.html)
- [`lib/model.mjs`](../lib/model.mjs)
- [`lib/workspace.mjs`](../lib/workspace.mjs)
- [`package-lock.json`](../package-lock.json)
- [`package.json`](../package.json)
- [`platform.js`](../platform.js)
- [`scripts/build.cjs`](../scripts/build.cjs)
- [`scripts/check-functions.cjs`](../scripts/check-functions.cjs)
- [`scripts/live-smoke.mjs`](../scripts/live-smoke.mjs)
- [`scripts/serve-production.cjs`](../scripts/serve-production.cjs)
- [`styles/platform.css`](../styles/platform.css)
- [`supabase/config.toml`](../supabase/config.toml)
- [`supabase/functions/_shared/handlers.mjs`](../supabase/functions/_shared/handlers.mjs)
- [`supabase/functions/ai-coach/index.ts`](../supabase/functions/ai-coach/index.ts)
- [`supabase/functions/delete-account/index.ts`](../supabase/functions/delete-account/index.ts)
- [`supabase/functions/job-explorer/index.ts`](../supabase/functions/job-explorer/index.ts)
- [`supabase/functions/reminder-worker/index.ts`](../supabase/functions/reminder-worker/index.ts)
- [`supabase/migrations/202610270002_launchpad_v4.sql`](../supabase/migrations/202610270002_launchpad_v4.sql)
- [`supabase/tests/v4.test.cjs`](../supabase/tests/v4.test.cjs)
- [`tests-unit/backend.test.mjs`](../tests-unit/backend.test.mjs)
- [`tests-unit/workspace.test.mjs`](../tests-unit/workspace.test.mjs)
- [`tests/accessibility.spec.js`](../tests/accessibility.spec.js)
- [`tests/app.spec.js`](../tests/app.spec.js)
- [`tests/helpers/cloud-fixture.cjs`](../tests/helpers/cloud-fixture.cjs)
- [`tests/platform.spec.js`](../tests/platform.spec.js)
- [`tests/production.spec.js`](../tests/production.spec.js)
- [`tracker.js`](../tracker.js)
