# Launchpad 5.0 Auth and billing integration handoff

Branch: `feat/launchpad-5-auth-billing-integration`, based on `3e2e993`.
The premium 5.1 branch remains unchanged and separate. This change targets
functional staging integration without a visual redesign.

## Concrete changes

- Shared browser/build validation for modern public publishable keys and legacy
  project-matched `anon` JWT keys. Privileged `service_role`, `sb_secret_`, wrong
  project legacy keys and extra secret fields are rejected before bundling.
  Decoding a public key is a configuration-category check, not authentication:
  Supabase validates actual keys/sessions and remains the only Auth authority.
- Dedicated `build:staging` fixes the owner's existing public project URL and
  requires a public key. Optional `REQUIRE_PUBLIC_AUTH_CONFIG=true` also guards
  normal builds; a configured manifest flag reports supplied public configuration.
  Source config stays blank and guest builds remain supported. No keys were supplied,
  discovered, guessed or committed for this task.
- Static callbacks support query and fragment token hashes and standard PKCE,
  reject ambiguous credentials/forged recovery flags, remove URL credentials before
  requests, verify confirmed server identity and dispose of the Auth listener.
  Storage failure signs out the newly verified session instead of pretending reset
  succeeded. Connection, wrong-password, unconfirmed, expired and rate-limit states
  retain friendly English guidance.
- Server-local billing readiness now includes DB/environment consistency, explicit
  flags, distinct price IDs, client token environment, webhook configuration,
  actual HTTPS/loopback-HTTP site and exact CORS origins, reviewed catalog and
  operator/support/terms configuration. Readiness is not provider API/domain/SMTP
  acceptance. Missing gate labels contain no secret values. The known staging
  host is explicitly Sandbox-only even if live settings and a live flag were
  accidentally supplied; a negative test verifies zero provider/operation calls.
- Authenticated status returns the current terms version. This fixes a race where
  status loaded before the public catalog and checkout sent no terms version.
- Shared checkout callback handles closed/failed/pending states. After completion,
  at most six server status polls run at four-second intervals. Only authenticated
  backend entitlement responses update the plan; browser completion and client
  storage never grant access. Pending states never start another purchase.
  Auth/account changes invalidate both timers and in-flight results. The dashboard
  shows only server-loaded plan state, otherwise an explicit unchecked message.
- Read-only `check:staging` inspects static routes, generated public configuration,
  the public Auth policy and billing catalog. It never evaluates remote JavaScript,
  logs keys/bodies, creates accounts, sends email, writes SQL or buys anything.

## Preserved security and data

Official SDK and existing confirmed-user checks, reauthenticated account deletion,
private workspace transitions, explicit guest import, exports and RLS remain.
All three SQL migrations and their existing commercial guards are unchanged; none
were applied to the owner's project. Subscription operation IDs, provider canonical
lookups, signed/age-limited webhooks, duplicate/stale processing, failure and
cancellation paths remain in place. `ntfsimevt_` remains Sandbox-only receipt with
no ledger/provider/grant calls. Existing Pro/Premium prices and quotas are unchanged.

No secret or approval flag was read or modified remotely. The six Paddle secrets,
applied migrations, confirmation policy and hosted simulator success are owner-
reported infrastructure; they were not independently inspected in this environment.
The new readiness helper is bundled into `billing` on reviewed deployment. Existing
`paddle-webhook` may remain at the already-deployed fix because this change does
not alter its cryptographic or grant-processing logic.

## Local test evidence

| Executed check | Result |
| --- | --- |
| `npm ci --cache /tmp/launchpad-npm-cache` | Passed; exact lockfile dependencies |
| `npm run build` | Passed; 29 allowlisted browser files |
| `npm run build:check` | Passed; pinned SDK/catalog/hash validation |
| `CI=true CHROMIUM_PATH=/usr/bin/chromium npm test` | **132 passed**, zero skipped: 75 source Playwright, 12 built-artifact Playwright, 38 backend/model/diagnostics, 3 PostgreSQL/PGlite files, 4 build/configuration tests |
| Six Edge Function bundle/pin checks | Passed, not live deployment |
| Additional targeted integration browser run | 7 passed before final full run |
| `npm audit` | Zero known vulnerabilities reported |
| `git diff --check` | Passed |
| `npm run check:staging` | NOT VERIFIED; network boundary prevented remote access |
| `npm run test:live` | NOT RUN; secure test-account/project environment bindings absent |

Local environment: Node 24.19.0, Debian 13, system Chromium 154.0.8037.57. The final
complete suite ran after dependency installation, with no overlapping asset writes
or reinstallation. These results do not claim a hosted GitHub Actions run.

Provider/browser tests use deterministic HTTP fixtures through the actual SDK.
PostgreSQL/PGlite tests execute the real SQL in an isolated local database with
simulated Supabase Auth/JWT roles. They do not access or migrate the owner's DB.
New coverage includes public-key categories, callback ambiguity/query recovery,
missing-gate enforcement, authoritative terms under slow catalog requests,
Pro/Premium browser-to-server confirmation, cancelled/failed checkout, bounded
waiting and logout cleanup. Existing tests cover signup/invalid email/wrong or
unconfirmed credentials, resend/recovery/expiry/session persistence, two-account
privacy, CRUD/import/backups, lifecycle events and paywall bypass attempts.

No failing assertion was disabled, skipped or changed to hide errors. A new
readiness test distinguishes the no-Origin read-only catalog diagnostic from the
existing browser-origin enforcement: an incorrect browser origin still returns
403 before any provider mutation.

## Live evidence and remaining gates

- Requests to the owner-reported staging and public Supabase Auth settings endpoint
  failed with HTTP 403 at this environment's network boundary.
- `npm run check:staging`: NOT VERIFIED for remote HTML/callback/SDK/configuration.
- No public project key or approved test-account bindings were provided. The
  frontend source remains blank; the owner must build `_site` with the real public
  value locally. No private credential needs to be sent in chat.
- Real signup/confirmation/resend/recovery email, two-account live RLS/cross-device
  reads/writes and deletion: not verified against the configured project.
- Real Paddle Sandbox transaction, signed real `evt_` delivery, grant, portal,
  renewal, failure/change/cancellation/reconciliation: not verified here.
- Exact current values of enabled/legal/checkout/site/CORS/operator/terms gates
  remain uninspected. The code reports missing local gates once deployed and
  reachable; it does not assume which owner settings are absent.
- Hosted CI and the updated `_site` deployment were not executed by this task.

The [Portuguese owner guide](AUTH_BILLING_STAGING_PT.md) provides exact Windows CMD
commands, existing-project Direct Upload steps, staging callback/email templates,
SMTP/DNS checks, read-only SQL and a step-by-step real acceptance matrix.
It expressly does not authorize setting legal/commercial flags or live charges.

Recommendation: **NO-GO for paying customers** until real acceptance and owner/legal
approvals pass. Suitable for review and controlled Sandbox acceptance preparation.
No production deployment, merge, new Cloudflare project or real charge occurred.

## Changed-file map

- `auth-client.js`, `lib/public-auth.mjs`, `lib/auth-callback.mjs`, `auth/callback.js`:
  public config and callback/error handling.
- `commerce.js`: setup diagnostics, terms race, bounded provider-status waiting,
  cancellation/failure guidance and server-derived dashboard summary.
- `supabase/functions/_shared/billing.mjs`, `billing-readiness.mjs`: prerequisites,
  current terms and owned checkout plan response; no migration/secret changes.
- Build/public validation/allowlist scripts, `build-staging.cjs`, `check-staging.mjs`,
  staging workflow and package script entries.
- Public config/build, backend/diagnostics and browser integration tests, aligned
  test fixture terms, README and these two handoff guides.
