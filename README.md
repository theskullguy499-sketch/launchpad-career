# Launchpad 5.2 — Commercial Experience Release Candidate

**Your Career, Higher.** An international career workspace that builds on the original HTML/CSS/JavaScript Launchpad app without discarding its tracker or guest records.

Production address remains https://theskullguy499-sketch.github.io/launchpad-career/ . The product landing screen is `#home`; the root retains the existing application-tracker route for returning users.

The inherited 5.0 commercial layer includes sandbox-prepared Paddle billing, server-enforced cloud/AI entitlements, customer billing/usage UI and restricted business metrics. **Live charges are disabled by default. No real sandbox purchase, mailbox delivery or staging deployment is claimed.** Start with [commercial setup](docs/commercial/SETUP.md), [deployment](docs/commercial/DEPLOYMENT.md) and [release evidence](docs/commercial/RELEASE.md).


## Current 5.2 handoff

Branch: **`feat/launchpad-5-2-commercial-experience`**, based on the integrated 5.1 release.
Start with [Windows CMD and existing Cloudflare Direct Upload instructions](docs/releases/5.2-STAGING.md),
[release evidence and blockers](docs/releases/5.2-RELEASE.md), and the [real screenshot gallery](docs/screenshots/5.2/README.md).
No deployment, merge, real payment, live email verification or new official-logo replacement is claimed.
The supplied-reference/new-logo files were not attached; current branding is preserved pending review.
Older component guides below remain historical; use the 5.2 guide for this branch.

## Previous unified staging handoff

Use **`integration/launchpad-5-1-staging`** for the combined design and Auth/billing
release. Start with [simple Windows CMD and existing Cloudflare Direct Upload steps](docs/INTEGRATED_STAGING.md).
Component reports below describe their original branches; the unified guide is
the current deployment and validation reference. No main merge, deployment,
credential change or approval/real-charge flag activation is included.

## 5.1: a clearer next chapter

An original career-ascent visual system adds a navy sidebar, responsive bento
personal dashboard, local employer marks with documented neutral fallbacks,
roadmap timeline, consent-preserving coach prompts and refined billing/auth UI.
No framework migration, guest-key rewrite, database reset or entitlement bypass
is included. All customer-facing copy is English.

The owner reports staging at https://launchpad-career-staging.pages.dev/ . This
environment could not independently access it (HTTP 403). For the existing Direct Upload workflow, public Supabase values must be supplied
locally before generating `_site`; dashboard variables do not modify uploaded
static files. Auth-required builds fail safely when values are missing; the
committed config remains blank.

- [Exact Cloudflare/Supabase/Paddle steps and Windows CMD commands](docs/releases/5.1-STAGING.md)
- [5.1 release evidence and remaining gates](docs/releases/5.1-RELEASE.md)
- [Real before/after screenshots](docs/screenshots/5.1/README.md)
- [60–90 second demonstration guide](docs/releases/5.1-DEMO.md)
- [Illustration/brand asset provenance and trademark limitations](docs/releases/5.1-ASSETS.md)

The 15 November 2026 milestone is an acceptance target, not permission to enable
real charges or skip testing. No production deployment or merge is performed.

The [4.1 audit](docs/RELEASE_4_1.md) remains historical background; its accessible mobile drawer is included in this branch.

## Existing staging: Auth and Sandbox integration

This integration joins premium branch `437bfcd` and Auth/billing branch `bdbe0cf`,
preserving their shared simulator fix `3e2e993`. It includes validated public publishable/anon
build configuration, query/fragment verification callbacks, truthful checkout
readiness and bounded server confirmation after checkout. It does not activate
legal/commercial flags or apply database migrations.

The owner-reported existing staging is https://launchpad-career-staging.pages.dev/;
project URL is https://oyatshlhqdxosvbelsvp.supabase.co. Direct Upload requires a
locally configured `_site` build; Pages dashboard variables cannot modify an
already uploaded static artifact. `npm run build:staging` requires the owner's
public key and fixes the reviewed project URL. `npm run check:staging` performs
read-only diagnostics without printing keys or claiming email/payment delivery.

See [beginner Windows CMD and owner acceptance guide (Portuguese)](docs/AUTH_BILLING_STAGING_PT.md)
and [technical verification report](docs/AUTH_BILLING_INTEGRATION.md). Real project
email delivery and Paddle Sandbox purchases remain external acceptance gates.

## Functional scope

- Premium responsive landing/dashboard and consistent navigation across applications, companies, jobs, roadmap, AI coach, analytics and settings; original light/dark themes retained.
- Detailed applications with company suggestions, location/arrangement, salary/currency/period, dates, priority, interviews, follow-ups, search/filters, table and keyboard-accessible Kanban, CSV/JSON exports. Stages include Saved, Applied, Interview, Offer, Hired, Rejected and Withdrawn.
- Curated 24-company directory, custom employers, industry/country filtering where data exists, favorites and company-specific tracked applications. No claim of live hiring or global completeness.
- Goals, editable skills/course/project/milestone plans, tasks, persistent progress and in-app reminders; legacy 2028 roadmap retained. Starter plans are not mislabeled as generative AI.
- Actual-record analytics, including grouped status/country/company and monthly activity. Explicit demo records are labeled.
- Official Supabase signup/confirmation/resend/sign-in/out/session/recovery/reset, profile editing, age-appropriate onboarding, reauthenticated deletion, private account workspaces, atomic cloud synchronization and confirmed guest import.
- Secure Edge Function implementations for sourced Remotive jobs, consent-scoped OpenAI coaching/roadmaps and optional scheduled reminder digests. Unconfigured services show honest unavailable states.
- Feedback collection, personal exports, optional AI history/deletion, privacy and Terms drafts for legal review.

**This RC is not declared fully production-ready.** No live Supabase project, Paddle merchant, SMTP mailbox, AI account, commercial domain or scheduler is configured here. Mocked HTTP tests and local PostgreSQL policy tests do not establish real email delivery, provider licensing/availability, live RLS, deployed Edge Functions or the public site's current state. See the [release gates](docs/LAUNCHPAD_4_SETUP.md#7-release-gates).

## Development and validation

Node **24.19.0** is pinned in `.node-version`. The same Node HTTP server serves the source app and the project-prefixed production artifact, using a shared public-file allowlist.

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

1. Follow [Backend setup](docs/LAUNCHPAD_4_SETUP.md), [Supabase email configuration](docs/SUPABASE_SETUP.md) and the [Pages checklist](docs/GITHUB_PAGES.md).
2. Apply both migrations in order, deploy the server functions, configure provider secrets securely and run live acceptance checks.
3. Review/merge yourself. Publishing requires a manual workflow dispatch on `main` with `deploy=true`; pushes and PRs only test/build.
4. Complete legal/operator/support/retention details and operational validation before a commercial launch. No subscriptions, payments, endorsements or revenue claims are fabricated. See [commercial evaluation](docs/COMMERCIAL_READINESS.md).

Architecture: `commerce.js` adds billing/pricing/business screens; [the commercial architecture](docs/commercial/ARCHITECTURE.md) describes its trust boundaries. `navigation.js` enhances the existing sidebar with a mobile modal drawer; `tracker.js` retains and extends the original tracker; `platform.js` composes the new screens; `lib/` holds the model/workspace logic; `supabase/migrations/` and `supabase/functions/` hold the server implementation. Live integration status and limitations are documented separately from local test results. The [4.1 release audit](docs/RELEASE_4_1.md) records current release gates; the [4.0 review package](docs/RELEASE_CANDIDATE.md) remains historical reference.

## Commercial operations and launch assets

- [Paddle/Supabase setup and real acceptance](docs/commercial/SETUP.md)
- [Cloudflare staging, domains and manual production release](docs/commercial/DEPLOYMENT.md)
- [Reconciliation, monitoring, costs and refunds/support](docs/commercial/OPERATIONS.md)
- [Honest launch drafts, onboarding emails and 30-day checklist](docs/commercial/LAUNCH_PACKAGE.md)
- [Buyer-readiness and IP/vendor diligence](docs/commercial/BUYER_READINESS.md)

Plans and quotas are centralized in `lib/plans.mjs`. After an intentional edit,
run `node scripts/generate-plans.mjs`, review the generated SQL seed and apply it
as owner in the intended environment. Price changes also require matching Paddle
prices before launch; live-contract price-version migrations need separate review.
The app never stores cards, manually stores passwords or accepts browser plan
flags as payment authority. Legacy grants and portfolio tools are preserved.
