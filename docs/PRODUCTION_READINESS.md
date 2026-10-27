# Launchpad 4.0 RC — production-readiness status

Target: `improve/launchpad-responsive-supabase-auth` → `main`.

Public URL remains https://theskullguy499-sketch.github.io/launchpad-career/ . No merge or deployment is performed by this task. Production deployment now requires an explicit manual dispatch on `main` with `deploy=true`.

## Completed implementation

- Preserved/extracted original tracker, storage keys, sample data, exports/restores and legacy roadmap; added detailed fields, company suggestions, filters and accessible Kanban stages.
- Added the landing page, dashboard, curated/custom company directory, favorites, tasks, editable goals/milestones, real-data analytics, profile/preferences, feedback and personal-data controls. A custom SVG logo avoids font-dependent branding.
- Added isolated account workspaces, bounded atomic snapshot synchronization, optimistic revision conflicts, owner guards and explicit non-destructive guest import. Account data is not stored in guest keys. Leaving an account clears private editors/coach content; queued saves and late AI replies are discarded across workspace switches.
- Added Supabase SQL for all owned collections, confirmed-owner RLS, cross-user constraints, server-only quotas/cache/outbox, revision invalidation for legacy/direct writes and the optional age/terms signup hook.
- Implemented secure Edge Functions for official OpenAI Responses, Remotive retrieval, recent-login account deletion and opt-in scheduled reminder digests. Missing configuration returns unavailable states, never simulated output or fake vacancies.
- Added privacy/Terms drafts, setup, release gates, commercial-evaluation notes and backup/rollback procedures. No billing, customer metrics, partnerships or legal compliance claims are invented.

## Local evidence

The complete suite includes **50 Playwright tests** (40 source app/platform/accessibility tests and 10 built-artifact tests), **12 backend/model/workspace tests**, **2 PostgreSQL policy tests**, and **2 public-build configuration tests**. Tests include actual browser interactions, scripted provider responses through the real SDK, and the real PostgreSQL WASM engine with simulated Supabase Auth/JWT context.

Coverage includes original features, detailed applications/stages, company search/favorites, personal planning/tasks, reminders, analytics, signup/confirmation/recovery, account isolation/synchronization, repeat imports, deletion reauthentication, background-response privacy, stable restored IDs, keyboard interaction, light/dark WCAG scans, 320–1440px layouts, no broken built assets, expected MIME types, and hash routing under the real project prefix.

`npm run build:check` verifies the committed SDK **2.118.0** against pinned Node/esbuild/dependency integrity inputs. The production artifact includes all required modules, stylesheet, SVG artwork, legal pages and callback files. Negative-control wrong-root requests intentionally return 404; required assets return 200. Four server entrypoints bundle locally with the pinned npm SDK import externalized for the Deno runtime. This is syntax/bundle validation, not a claim of deployed Deno execution.

The production dependency audit reports no known vulnerabilities. Automated scans do not establish complete security or accessibility compliance; human assistive-technology testing and operational review remain necessary.

## Explicit unverified integrations and blockers

| Item | Status / action required |
| --- | --- |
| Supabase Auth / real email | No live project URL/key or mailbox configured. Complete Confirm email, exact callback URLs, templates and custom SMTP, then test actual arrival, confirmation, resend and recovery. |
| Live database/RLS | SQL passes isolated policy tests, including stale saves, spoofed ownership, service budgets and outbox claims. Apply both migrations to the intended project and verify two real users/anonymous/unconfirmed access with the publishable key. |
| AI | Real server implementation, mocked provider tests, bounded requests and opt-in context. No AI key/account was available; no real generative response is claimed. |
| Job source | Real Remotive API adapter, attribution, lease/cache and maximum four refreshes/day. Direct live retrieval was rejected by the environment proxy. Review current commercial/provider terms and validate actual results after deployment. |
| Reminder emails | Worker, daily outbox, bounded retries, idempotency and opt-in checks are implemented and tested locally/mocked. Deploy Cron, its secret and optional Resend sender; prove live delivery and capacity. |
| Public Pages | Built artifact passes local project-prefix tests. The public hostname is blocked by the current environment's proxy, and no update was deployed. Live HTTPS acceptance remains unverified. |
| Pull Request | Git authentication/push works. GitHub API/GraphQL is blocked by HTTP 403, so PR inspection/creation may require the supplied comparison form. No PR number/link is fabricated. |
| Commercial/legal operations | Operator/contact/retention details, qualified legal review, age-policy review, support, provider agreements, incident response and recovery drills remain open. No commercial readiness certification is made. |
| Scale | Snapshot limits (1,000 items/collection, 2 MB) and bounded worker batches are explicit. Load-test expected usage; add incremental editing and worker pagination before serving large accounts/populations. |

No live product integrations are reported as successfully validated. Local correctness and mocked-provider evidence are kept separate from the live checklist.

Start with [LAUNCHPAD_4_SETUP.md](LAUNCHPAD_4_SETUP.md), then the separate [Pages checklist](GITHUB_PAGES.md), [Auth/SMTP instructions](SUPABASE_SETUP.md), [operations guide](OPERATIONS.md) and [commercial review](COMMERCIAL_READINESS.md).
