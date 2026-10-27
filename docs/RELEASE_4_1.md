# Launchpad 4.1 — Release Candidate audit

Version: `4.1.0-rc.1` · Branch: `improve/launchpad-4-1-polish`.
Base: main merge `d310c95` (includes the 4.0 CI bugfix PR).
Production URL: https://theskullguy499-sketch.github.io/launchpad-career/

## Changes and preserved behavior

- Replaced the overflowing mobile navigation strip with a modal drawer through
  768 px, using the original sidebar, logo, palette, typography and links.
  It supports all nine sections, a visible close button, backdrop dismissal,
  Escape, forward/backward Tab wrapping, background inertness and focus return.
  Focus follows the actual transition, including reduced-motion preferences.
  Navigation closes the drawer and starts the selected page at the top;
  dismissal alone preserves scroll. Desktop keeps its original sidebar.
- Added a compact mobile brand/Menu header, 44px minimum button targets and
  checkbox-label targets, readable 16px mobile fields/filters, and long-text
  wrapping. No new product features or framework dependencies were added.
- Fixed the skip link changing the current screen: it now focuses main content
  without changing the route or saved state.
- Removed notification opacity animation. An axe failure reproduced intermediate
  toast contrast of **2.43:1** during fading. Toasts retain the short movement
  animation with fully opaque text/background when visible.
- Added descriptive loading labels and `aria-busy` to Jobs and AI; duplicate
  submits are guarded. Missing backend configuration produces English guidance
  rather than the internal `not-configured` string.
- AI clears stale displayed output when a new request begins. Account changes
  reset its busy state and invalidate pending successes, failures and cleanup,
  preventing late errors from one account appearing in another account's UI.
- Company/job text filters trim surrounding spaces. Retrieved jobs have bounded,
  explicit schema/link validation before rendering. Unsafe URLs, malformed fields
  or oversized results fail visibly; external text remains DOM text, never HTML.
- Source and artifact tests now share a Node HTTP/1.1 static server and public-file
  allowlist. A recovery-test trace showed a **23-second initial page load** under
  the previous Python HTTP/1.0 server, exhausting the existing 30-second test
  budget despite the recovery flow subsequently completing. The prior server's
  listen backlog was five. Node keeps connections reusable, and the shared
  server also prevents accidental serving of `.env`, Git metadata, SQL or backend
  files. No existing test timeout or authentication assertion was relaxed.

Original storage keys, JSON/CSV formats, guest data, Supabase SDK pin, auth flows,
owned workspaces, guest import, deletion guards, SQL migrations and server
functions are preserved. No migration is added and no production data is touched.
Guest data remains shared within the browser profile; it is not account-private.
Cloud account privacy depends on the real project having the migrations/RLS.

## Validation

The first full run found the toast contrast failure and the recovery-test initial
load timeout above. Both tests subsequently passed three repeats each, with
unchanged assertions and timeouts. Final full-suite results are recorded below.

Node 24.19.0 and locked dependencies match the workflow configuration. Local
browser tests use Debian 13 and installed Chromium 154.0.8037.57 with two workers
and `CI=true`. They include touch emulation, not a physical mobile device.

- Clean `npm ci` and `npm run build:check`: passed.
- `npm audit`: zero known dependency vulnerabilities (not a security certification).
- Final `npm test`: **86 passed**: 56 source Playwright tests, 11 production
  Playwright tests, 2 public-config tests, 2 SQL security test files and 15
  backend/model/workspace/static-server tests. Four function entrypoint/pin checks
  also passed. Source browsers took 2.6 minutes; production browsers 24.5 seconds.
- The two first-run failures passed all **6 repeated executions** after fixes.
- Desktop home, mobile home/drawer and a dark mobile application form were
  visually inspected from the built artifact. `git diff --check` passed.
- New static-server checks exercise 32 concurrent requests, method restrictions,
  HEAD/MIME behavior and denial of non-public repository files.
- Browser coverage includes drawer navigation at **320, 375, 390, 428, 768 px**,
  existing 1024/1440px layouts, open/closed mobile axe scans in both themes,
  desktop WCAG scans, reduced motion, scroll/focus/resize behavior, all prior
  application/roadmap/backup tests and a touch test under the Pages prefix.
- Auth/cloud/provider browser responses are mocked through the actual SDK.
  Database tests execute both real SQL migrations in PGlite/PostgreSQL, with
  simulated Supabase Auth roles/JWT context. Backend tests mock external APIs.
- `npm run test:live`: **NOT RUN**, no secure live-project test bindings exist.
- Chromium 156, Firefox and WebKit downloads failed with network 403. Safari,
  Firefox, physical iOS/Android and the exact GitHub runner browser remain
  unverified; complete the manual browser matrix before public release.

Direct reads of the production site and Remotive feed were network-blocked
(403). GitHub Actions/GraphQL access is also blocked (403). Local test success
must not be described as a verified green GitHub run or public deployment.

## Integration and security status

**No live product integration has been successfully validated in this environment.**
Email confirmation/recovery, account isolation, account deletion, cloud sync,
OpenAI responses, Remotive retrieval and optional reminder delivery still need
live owner-controlled acceptance. No SMTP/provider/service-role credentials were
read, changed or committed. `auth-config.js` remains blank for guest operation.

The code review retains official SDK authentication, confirmed-user checks,
owner-bound queued writes, revision conflicts, explicit idempotent guest import,
server-side reauthentication for deletion, safe fixed callback redirects, owned
RLS and backend-only API secrets. Browser-owned data is rendered as text; the
remaining `innerHTML` assignments use static app templates/icons only. Backend
AI budgets remain 10 attempts/user/day and 100/platform/day, bounded context and
output, no retries and optional history. Jobs remain public, attributed and
cached, with no invented vacancies or salaries.

Residual release limits include SDK session tokens in localStorage (a trusted
browser and XSS prevention remain important), self-attested age bands, legal
and operator details awaiting review, RC workspace bounds of 1,000 records/type
and 2MB, and bounded reminder batches. Automated axe is not a full human
accessibility audit. No penetration, capacity or disaster-recovery certification
is claimed. See [operations](OPERATIONS.md) and [commercial review](COMMERCIAL_READINESS.md).

## Separate Supabase/provider checklist

Dashboard labels may vary. Follow [SUPABASE_SETUP.md](SUPABASE_SETUP.md) for exact
email templates, and [LAUNCHPAD_4_SETUP.md](LAUNCHPAD_4_SETUP.md) for existing server
functions, policies, limits and optional reminder scheduling.

1. Back up the real database. Apply only unapplied migrations, in order:
   `202610270001_launchpad.sql`, then `202610270002_launchpad_v4.sql`.
   Never rerun/drop existing tables as an upgrade step. 4.1 adds no SQL changes.
2. Authentication → Sign In/Providers → Email: enable signup and **Confirm email**;
   set minimum password length 12, sensible rate limits and supported protections.
3. Authentication → URL Configuration: set Site URL to
   `https://theskullguy499-sketch.github.io/launchpad-career/` and allow exactly
   `https://theskullguy499-sketch.github.io/launchpad-career/auth/callback.html`.
   Add development URLs only if used; no broad production wildcards.
4. Authentication → Email Templates: use the documented signup/recovery fragment
   `token_hash` templates for cross-device links. Default PKCE code links need
   the initiating browser. Test expired/reused links and credential stripping.
5. Authentication → SMTP Settings: enter the provider host/TLS port/username/
   password only there; verify sender/domain and SPF/DKIM/DMARC with the provider.
   Test real external mailbox delivery, resend, spam handling and recovery.
6. Authentication → Hooks → Before User Created: enable
   `public.launchpad_before_user_created` after legal/onboarding review.
7. Configure only the real HTTPS project URL and `sb_publishable_` key in the
   public `auth-config.js`, using `auth-config.example.js`. Leave both blank until
   intentionally enabling accounts. Test anonymous/unconfirmed denial and two
   confirmed users' CRUD, isolation, concurrent edits, import and deletion with
   publishable credentials, not service-role bypasses.
8. Deploy existing Edge Functions if not already deployed; retain their guards
   with `verify_jwt=false`. Set exact production CORS origin
   `https://theskullguy499-sketch.github.io` (no path). Set OpenAI key/model access,
   billing/spending alerts and provider limits only in backend settings. Test real
   consented coaching/roadmaps and private optional history. Verify Remotive's
   current terms, attribution and actual results through `job-explorer`.
9. If enabling email reminders, configure server-only Resend sender/key, cron
   secret and the scheduled worker per the setup guide; test opt-in, deduplication
   and retries. Browser-only reminders do not execute while Launchpad is closed.

## Exact publishing checklist (owner approval required)

1. Review this branch/PR, export existing guest JSON backups and retain a database
   backup if accounts are enabled. Require a green GitHub-hosted **Test and
   publish Launchpad** run; inspect retained diagnostics if a check fails.
2. Complete the relevant live gates above, legal/operator details, physical-device
   checks and rollback rehearsal. For a guest-only trial, keep account/provider
   configuration blank and communicate that those services are unavailable.
3. Review and merge the PR into `main` yourself. Do not delete guest storage or
   rewrite SQL migrations. Pushes and PRs only test/build; they do not publish.
4. Repository **Settings → Pages → Build and deployment → Source: GitHub Actions**.
5. **Actions → Test and publish Launchpad → Run workflow → branch: main →
   deploy=true** (enable the explicit deployment checkbox). Run the workflow and
   satisfy any `github-pages` environment approval. Dispatching without this flag
   or on a feature branch must not deploy.
6. Wait for **test-and-build** and **deploy** to succeed. Open the production URL
   and `/#home`; confirm the 4.1 RC badge, all routes, mobile drawer, native forms,
   both themes, and no console/module/asset errors. Confirm `navigation.js` and
   `vendor/supabase.js` return 200 with JavaScript MIME types. A tokenless callback
   should show invalid-link guidance, never a 404.
7. Check retained user data, JSON export/restore in a disposable browser profile,
   then complete real mailbox/account/provider checks separately. Record release
   SHA, workflow run, browser/device matrix and live results without secrets.
8. For rollback, revert the reviewed frontend change on main through another PR,
   rerun all checks, then manually dispatch with **deploy=true**. Keep the previous
   artifact/commit and JSON/DB backups; do not downgrade/drop existing data tables.
   See [GITHUB_PAGES.md](GITHUB_PAGES.md) and [OPERATIONS.md](OPERATIONS.md).

## Recommendation

**NO-GO for a public/commercial SaaS production release** until the green hosted
workflow, live auth/email/RLS/provider checks, physical-browser verification and
operational/legal gates pass. **GO for RC review and local guest demonstrations**
after the full local suite passes. A controlled guest-only published trial needs
owner approval, green hosted checks and a successful public HTTPS smoke test;
none is implied by this source update. No merge or deployment is performed here.
