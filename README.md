# Launchpad 4.0 — Release Candidate

**Your Career, Higher.** An international career workspace that builds on the original HTML/CSS/JavaScript Launchpad app without discarding its tracker or guest records.

Production address remains https://theskullguy499-sketch.github.io/launchpad-career/ . The product landing screen is `#home`; the root retains the existing application-tracker route for returning users.

## Functional scope

- Premium responsive landing/dashboard and consistent navigation across applications, companies, jobs, roadmap, AI coach, analytics and settings; original light/dark themes retained.
- Detailed applications with company suggestions, location/arrangement, salary/currency/period, dates, priority, interviews, follow-ups, search/filters, table and keyboard-accessible Kanban, CSV/JSON exports. Stages include Saved, Applied, Interview, Offer, Hired, Rejected and Withdrawn.
- Curated 24-company directory, custom employers, industry/country filtering where data exists, favorites and company-specific tracked applications. No claim of live hiring or global completeness.
- Goals, editable skills/course/project/milestone plans, tasks, persistent progress and in-app reminders; legacy 2028 roadmap retained. Starter plans are not mislabeled as generative AI.
- Actual-record analytics, including grouped status/country/company and monthly activity. Explicit demo records are labeled.
- Official Supabase signup/confirmation/resend/sign-in/out/session/recovery/reset, profile editing, age-appropriate onboarding, reauthenticated deletion, private account workspaces, atomic cloud synchronization and confirmed guest import.
- Secure Edge Function implementations for sourced Remotive jobs, consent-scoped OpenAI coaching/roadmaps and optional scheduled reminder digests. Unconfigured services show honest unavailable states.
- Feedback collection, personal exports, optional AI history/deletion, privacy and Terms drafts for legal review.

**This RC is not declared fully production-ready.** No live Supabase project, SMTP mailbox, AI account or scheduler is configured here. Mocked HTTP tests and local PostgreSQL policy tests do not establish real email delivery, provider licensing/availability, live RLS, deployed Edge Functions or the public site's current state. See the [release gates](docs/LAUNCHPAD_4_SETUP.md#7-release-gates).

## Development and validation

Node **24.19.0** is pinned in `.node-version`. Python 3 serves the source development app.

```sh
npm ci
npm run build:check
npm run build
npm start
```

```sh
npx playwright install --with-deps chromium
npm test
# Or use existing Chromium:
CHROMIUM_PATH=/usr/bin/chromium npm test
```

The suite includes build-config safety tests, PostgreSQL WASM RLS/CAS/import/budget tests, pure backend/model/workspace tests, functional browser tests, accessibility scans and the built Pages artifact mounted at `/launchpad-career/`. Browser/provider responses are mocked unless explicitly using the opt-in `npm run test:live`; the live script requires secure environment bindings and does not certify mailbox delivery.

The SDK **2.118.0**, esbuild pin, license notices and SHA-256 manifest remain reproducible and committed. `npm run build` stages only public modules/styles/artwork/legal pages and the SDK in `_site/`. No backend key or function source is deployed to Pages. Static branch hosting also works with the committed browser assets.

## Data safety and privacy

Original guest keys and JSON format remain supported. New guest extras use `launchpad-workspace-v4`. Guest data is shared within a browser profile. Verified accounts switch to a separate server-owned workspace; account records are not cached in guest storage. Failed cloud loads block account mutation instead of silently falling back. Writes use revisions to reject stale overwrites and refresh when idle/on focus. Explicit guest import is non-destructive and deduplicates stable IDs.

Passwords are sent through the official Auth SDK, never saved manually. Only the public project URL/publishable key belongs in `auth-config.js`; blank values preserve guest mode. Service-role, AI, database, SMTP and scheduler secrets belong only in secure backend settings. Cloud isolation depends on applying and verifying the RLS migrations against your actual project.

Before clearing browser storage, changing origins or intentionally restoring another file, export a JSON backup. Account deletion is explicit and requires recent password login; it removes owned cloud records and retains guest records. See [operations/backup/rollback](docs/OPERATIONS.md).

## Deployment and commercial evaluation

1. Follow [Launchpad 4.0 setup](docs/LAUNCHPAD_4_SETUP.md), [Supabase email configuration](docs/SUPABASE_SETUP.md) and the [Pages checklist](docs/GITHUB_PAGES.md).
2. Apply both migrations in order, deploy the server functions, configure provider secrets securely and run live acceptance checks.
3. Review/merge yourself. Publishing requires a manual workflow dispatch on `main` with `deploy=true`; pushes and PRs only test/build.
4. Complete legal/operator/support/retention details and operational validation before a commercial launch. No subscriptions, payments, endorsements or revenue claims are fabricated. See [commercial evaluation](docs/COMMERCIAL_READINESS.md).

Architecture: `tracker.js` retains and extends the original tracker; `platform.js` composes the new screens; `lib/` holds the model/workspace logic; `supabase/migrations/` and `supabase/functions/` hold the server implementation. Live integration status and limitations are documented separately from local test results. The [RC review package](docs/RELEASE_CANDIDATE.md) includes the complete changed-file list and validation summary.
