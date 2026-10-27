# Launchpad 5.0 — Commercial Release Candidate

Release evidence: 2026-10-27. Recommendation: **NO-GO for accepting paying
customers**. Suitable for code review and controlled local evaluation; a hosted
staging release still requires owner configuration and acceptance. No merge,
production deployment, service configuration or real charge was performed.

## Completed implementation

- Preserved the 4.x identity, logo, guest keys, JSON format, tracker, company
  directory, roadmap, tasks, analytics, authentication and original migrations.
  This branch includes the previously unmerged 4.1 responsive/accessibility work.
- Accessible mobile drawer with keyboard/Escape/focus handling and automatic
  close. Fixed an outside-pointer race during rapid reopen, retaining assertions.
  Responsive checks cover 320, 375, 390, 428 and 768 pixels; pricing/home received
  additional visual review at 390 and 1440 pixels. Light/dark automated checks pass.
- Commercial landing, authentic empty-dashboard preview, proposed Free/Pro/Premium
  pricing, eligibility/consent, account/billing screen, opt-in early access and
  opt-in daily conversion counting with withdrawal/deletion controls.
- Centralized USD prices and quotas; generated database catalog checked by build.
  Existing accounts receive explicit non-revenue legacy grants. Existing local
  backups are never truncated by new-entry limits; Free profile editing stays
  independent from local career data and paid cloud editing.
- Server-side Paddle sandbox-prepared checkout, owned payment-link resume, portal,
  signed short-lived plan-change quotes, proration confirmation and cancellation.
  Raw-body HMAC verification, atomic event deduplication, canonical provider
  snapshots, stale-event protection, uncertain-operation locks, versioned contract
  consent and provider-confirmed entitlement activation. Browser success never
  grants a plan. Pending/unbound billing also prevents unsafe account deletion.
- Additive forced-RLS billing/customer/usage/consent tables, direct-write and RPC
  paywall guards, per-account collection limits, monthly/daily/platform AI budgets,
  actual token reports and explicitly unknown costs. Account deletion preserves
  minimal financial records while deleting ordinary owned career records.
- Read-only, server-authorized business metrics; verified ledger-derived contract
  MRR, operational failures and usage. No fabricated business statistics.
- Reproducible static build, pinned SDK, strict public configuration injection,
  Cloudflare headers and manually approved staging workflow. GitHub Pages remains
  a demo/portfolio channel with the existing main/manual `deploy=true` requirement.
- Legal drafts, operator runbooks, launch/email/outreach drafts, acquisition due
  diligence checklist and cost worksheet. No messages were sent or waitlist created
  externally by this task.

## Executed verification

Node 24.19.0 on Debian 13; system Chromium 154.0.8037.57. The repository's
Playwright version is pinned. This is local CI-mode evidence, not a claim that
hosted GitHub Actions or other browser engines have run.

| Check | Result |
| --- | --- |
| `npm ci --cache /tmp/launchpad-npm-cache` | Passed |
| `npm run build:check` | Passed; pinned SDK, public files and catalog validated |
| `CI=true CHROMIUM_PATH=/usr/bin/chromium npm test` | Passed: 110 tests/test-file suites, zero skipped |
| Source Playwright | 68 passed |
| Built GitHub Pages artifact Playwright | 12 passed |
| Backend/model/workspace tests | 24 passed |
| PostgreSQL/PGlite security files | 3 passed, including real SQL RLS/entitlement assertions |
| Public build/configuration tests | 3 passed |
| Edge Function bundle/pin checks | All six passed; not live Deno deployment |
| Additional repeated navigation/auth regressions | 12 passed, serialized before final complete suite |
| `npm audit` | Zero known vulnerabilities reported |
| `git diff --check` | Passed |
| `npm run test:live` | NOT RUN: required secure test bindings absent |

Coverage includes signup/verification callbacks/recovery, session switching,
private workspace synchronization, CRUD, guest import, backup download/restore,
reload recovery, oversized preserved Free backups, theme contrast, navigation,
asset hashes/MIME checks, authenticated checkout authorization, ownership,
webhook tampering/replay/idempotence, renewal/failure/cancellation, direct paywall
bypass attempts, credits and billing-safe deletion. Provider requests are
scripted test responses. The SQL engine is real PostgreSQL WASM with simulated
Supabase Auth/JWT context, not a live Supabase deployment. Browser HMAC fixtures
and mocked Paddle responses do not demonstrate an actual sandbox purchase.

## Real versus unverified integrations

The bundled official Supabase SDK loads and runs against deterministic browser
fixtures. Official Paddle Node SDK schemas were inspected locally as a reference;
the implementation uses supported REST endpoints and Paddle.js. No real Paddle,
Supabase email, OpenAI, Remotive or Cloudflare integration was validated. There is
**no staging preview URL**. Production URL/remote provider access and GitHub API
were restricted in this environment. No hosted CI result is asserted. Physical
Android/iOS, Safari, Firefox and WebKit checks remain outstanding.

## Release blockers and activation gates

1. Configure separate staging Supabase/Paddle sandbox, apply all three migrations
   and reviewed plan seed; deploy six functions and exact origin/callback settings.
2. Confirm real signup/resend/recovery email with custom SMTP and DNS. Test server
   rejection before confirmation and two-account isolation with real credentials.
3. Complete merchant/domain approval and legal/operator/support/refund details.
   Validate real sandbox purchase, signed notifications, renewal, failure,
   plan changes, cancellation, deletion and reconciliation. No live-billing flag
   may be enabled before explicit owner approval.
4. Validate real AI responses, budget/token/cost reporting and authorized job data.
   Missing services deliberately report unavailable; no generated fake results.
5. Configure protected staging environment, deploy only after owner approval,
   run hosted CI, HTTPS/full-device/browser acceptance and backup/rollback drill.
6. Review retention, age/guardian handling, privacy/security/legal drafts with
   appropriate specialists. There is no claim of formal GDPR/LGPD/WCAG compliance.
7. Review configured prices before launch. Post-launch historical price changes
   need a separately reviewed migration; this RC supports the two configured
   monthly USD prices, not arbitrary currencies, trials or add-ons.

AI attempts consume credits even when providers fail. Browser-only offline views
and new-entry UX limits are not security boundaries. Free users retain local
organizing/export and profile editing; paid cloud mutations are server-enforced.
Legacy users are preserved and are not offered a duplicate paid purchase.
Operator reconciliation may be needed for uncertain or abandoned transactions.

## Configuration, costs and publishing

See [SETUP](SETUP.md) for exact dashboard/secret/migration steps and real acceptance;
[DEPLOYMENT](DEPLOYMENT.md) for staging, domains, manual production approval and
Pages `deploy=true`; [OPERATIONS](OPERATIONS.md) for recovery and cost recording.
Only the public Supabase URL/publishable key belong in browser build variables.
All private credentials remain in provider secret managers.

No external infrastructure costs or charges were incurred by this task. Actual
Supabase, Cloudflare, email, Paddle fees, domain and AI costs depend on the owner's
contracts/usage; no zero-cost production or margin guarantee is made. Record
actual invoices and model rates before using contribution estimates.

Principal changed areas: `commerce.js`, `navigation.js`, `platform.js`,
`tracker.js`, `index.html`, `styles/platform.css`, `lib/plans.mjs`, the billing
migration/seed, billing/AI/delete function handlers, public build scripts,
Cloudflare staging workflow, browser/backend/SQL tests, `legal/` and
`docs/commercial/`. Original migrations and guest storage formats are preserved.

A feature-branch PR must be reviewed before merge. If GitHub API access blocks PR
creation, the final handoff provides the pushed branch and compare form instead
of inventing a PR number. No commercial production deployment is automated here.
