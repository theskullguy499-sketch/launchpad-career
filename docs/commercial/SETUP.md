# Launchpad 5.0 commercial setup and acceptance

**Commercial RC, not approved for paying customers.** No merchant, mailbox,
commercial domain or staging environment has been live-validated here. Production
charges and deployment require explicit owner approval outside this task.

## Architecture and modes

The existing static app remains the frontend. Cloudflare Pages is the proposed
commercial host. Supabase Auth/PostgreSQL and six Edge Functions supply the
backend; using the existing transactional backend avoids two payment processors
or duplicate server infrastructure. GitHub Pages remains the portfolio URL:
https://theskullguy499-sketch.github.io/launchpad-career/ . The billing backend
rejects checkout on `github.io`, regardless of browser flags.

`commercial_settings.enabled` defaults false. Existing tools continue operating
in portfolio mode. Once activated, cloud collection mutations require a trusted
Pro/Premium entitlement, and AI has monthly, daily and platform quotas. Browser
flags/localStorage are never billing authority. Local presentation, local
exports and client-only views are not enforceable security boundaries; the
existing offline portfolio is deliberately preserved. The Free saved-entry
interface limit is UX enforcement when commercial configuration is loaded;
server Free accounts cannot mutate paid cloud collections at all.

Existing 4.x accounts get an explicit legacy grant, preserving old collection
bounds and the previous 10/day AI capacity (310 attempts per UTC month maximum).
These grants are not paid subscriptions and never contribute MRR. New purchases
for legacy accounts require operator review, avoiding charging for existing
features. No existing records are truncated on downgrade; reads/exports/deletes
remain possible, and new cloud edits stop when paid access expires. Free users
can still edit profile/preferences. Do not silently revoke legacy grants.

## Order of installation

1. Create **separate Supabase projects and Paddle accounts/environments** for
   staging/sandbox and production. Do not mix sandbox billing records with real
   users or receipts. Back up any existing database before migrations.
2. Use Node 24.19.0, `npm ci`, `npm run build:check`, `npm test`.
3. Apply only unapplied migrations in order:
   - `202610270001_launchpad.sql`
   - `202610270002_launchpad_v4.sql`
   - `202610270003_launchpad_billing.sql`
   Existing migrations are unchanged. Migration 3 is additive, keeps existing
   records, wraps compatible RPCs and creates protected billing tables.
4. Review `lib/plans.mjs`: proposed USD/month prices Free 0, Pro 900 cents,
   Premium 1900 cents; limits and legacy grants are centralized there. Run
   `node scripts/generate-plans.mjs`, review and apply
   `supabase/seed-plan-catalog.sql` as project owner. Build checks reject stale
   seed output. **The seed does not enable billing.** Changing prices before
   launch also requires matching new Paddle prices/IDs. After sales begin,
   retain old price versions and design/test a price migration before editing
   active recurring contracts; this RC accepts only the configured two prices.
5. Complete [Supabase setup](../SUPABASE_SETUP.md): Email signup + **Confirm
   email**, minimum password 12, rate limits, custom SMTP with sender DNS,
   signup/recovery token-hash templates, before-user-created age/terms hook.
   Do not activate public Auth before real confirmation/recovery tests pass.
6. Set Site URL to the commercial HTTPS URL and allow its exact
   `/auth/callback.html`. Add the exact staging callback separately. Preserve
   the GitHub Pages callback only if it is intentionally used. No broad wildcards.
7. Deploy existing `ai-coach`, `job-explorer`, `delete-account`, optional
   `reminder-worker`, plus `billing` and `paddle-webhook` with the Supabase CLI.
   Keep their internal getUser/HMAC guards with gateway `verify_jwt=false`.
8. Publish reviewed legal/operator/support information before enabling checkout.
   The HTML files are legal drafts and still require owner/counsel input.

## Backend secrets (Supabase function secret manager only)

Supabase supplies its project URL and service-role runtime credentials. Never
put service-role, database, SMTP, Paddle API/signing or OpenAI keys in frontend
code, GitHub source, public variables or browser storage.

| Setting | Value/purpose |
| --- | --- |
| `PUBLIC_SITE_URL` | Exact approved commercial/staging URL with trailing slash. No credentials, query or fragment. Sandbox localhost is supported explicitly. |
| `ALLOWED_ORIGINS` | Exact comma-separated origins, e.g. the actual staging/commercial HTTPS origin, without paths or wildcard previews. |
| `PADDLE_ENVIRONMENT` | `sandbox` first. Must equal the database environment. |
| `PADDLE_API_KEY` | Server API key for that Paddle environment. |
| `PADDLE_WEBHOOK_SECRET` | Notification destination signing secret, at least 32 characters; also domain-separated signing of short-lived plan-change previews. |
| `PADDLE_CLIENT_TOKEN` | Public Paddle.js client token (`test_` sandbox, `live_` production). Returned only for an authorized checkout; it is not an API secret. |
| `PADDLE_PRICE_PRO`, `PADDLE_PRICE_PREMIUM` | Two active monthly USD catalog price IDs matching the reviewed amounts exactly. |
| `BUSINESS_NAME`, `PUBLIC_SUPPORT_EMAIL` | Real operator identity and monitored support address. No invented entity/address. |
| `BILLING_TERMS_VERSION` | Owner-approved version identifying published billing terms; stored with verified account consent. |
| `BILLING_LEGAL_APPROVED` | Default absent/false. Set `true` only after operator/legal approval and publication. This flag is not legal certification. |
| `BILLING_CHECKOUT_ENABLED` | Default absent/false. Explicitly `true` after acceptance to enable new sandbox checkout/plan changes. Pause this flag for incidents; portal/cancellation remain available. |
| `ALLOW_LIVE_BILLING` | Default absent/false. Never set true without explicit approval after all live release gates. |
| `OPENAI_API_KEY`, `OPENAI_MODEL` | Server-only provider access; verify the selected supported model and billing limits. |
| Reminder secrets | Existing optional Resend sender/key and cron secret, as documented in the 4.x setup. |

Keep production and sandbox projects separate. The DB refuses environment changes
once customers exist and refuses disabling entitlement enforcement after billing
starts. Pause checkout using its separate backend flag; do not unlock paid writes
by turning the database into portfolio mode.

## Paddle sandbox dashboard

1. Create/select the Paddle **sandbox** business; complete required identity/site
   configuration. Create Pro and Premium products with monthly USD prices matching
   the catalog. No trials/add-ons/multiple quantities/currency overrides are
   advertised or supported by this RC; test any later expansion explicitly.
2. Create an API key with the minimum transaction, customer, subscription,
   price-read and portal-session permissions required by these endpoints.
3. Create a sandbox Paddle.js client token; store it as `PADDLE_CLIENT_TOKEN`.
4. Configure an approved default payment-link URL at the actual staging app.
   `_ptxn` links route to Billing, strip the query from browser history, and can
   be resumed only after the server proves transaction ownership and fresh terms
   acceptance. Paddle.js checkout is provider-hosted; no card fields are ours.
5. Create a notification destination:
   `https://YOUR_PROJECT.supabase.co/functions/v1/paddle-webhook`.
   Subscribe to subscription created/activated/updated/past_due/paused/resumed/
   canceled events and transaction completed/payment_failed/updated/canceled
   events supported by your current Paddle account. Store its signing secret.
6. Signed raw bodies use HMAC-SHA256 `ts:body`, multiple `h1` rotation signatures
   and a 300-second timestamp tolerance. Event IDs are unique; canonical provider
   snapshots are fetched before atomic SQL processing. Stale snapshots cannot
   revert newer state. Unknown customers/prices are not granted access.
7. Configure `commercial_settings.environment='sandbox'`, then enable commercial
   enforcement only after the catalog/seed is installed. Enable sandbox checkout
   with the backend flags once the legal/configuration checks are satisfied.
8. Use a verified adult **test** account and official Paddle sandbox test payment
   methods from its dashboard/docs. Do not use real cards. Complete checkout;
   verify the destination delivery and database ledger, then refresh Billing.
   Browser `checkout.completed` alone never grants access.
9. Test renewal, past_due/failure, recovery, both plan changes, cancellation at
   period end, immediate cancellation, expiration, duplicate notifications,
   out-of-order delivery and attempts to access another customer's portal.
10. Plan changes need a signed five-minute owner/subscription/price/terms-bound
    preview, a second explicit confirmation, and unchanged provider state.
    They take effect immediately with provider-calculated proration; changes
    are not represented as scheduled next-month downgrades.

The integration uses official REST v1 endpoints and Paddle.js v2. Request/response
shapes were additionally reviewed against official `@paddle/paddle-node-sdk`
3.10.0 published types, including required portal `subscription_ids`. The SDK was
inspected outside the repository; no second SDK/dependency was added. Documentation
site access was network-blocked. Schema review and mocked tests are not a real
sandbox purchase or merchant approval.

## Idempotency, reconciliation and operational limits

A client-generated UUID identifies an operation. A transactional per-owner lock
rejects concurrent operations; retries of completed identical requests return the
stored result. The app reuses unfinished owned transactions rather than starting
another checkout. A provider/DB timeout is **uncertain**, never success, and blocks
blind retries. This is an application ledger; no undocumented provider idempotency
header is assumed. Operators must reconcile uncertain operations in Paddle and
DB before releasing them; see [OPERATIONS.md](OPERATIONS.md).

AI credits count attempts, including provider failures, and reset each UTC calendar
month. They are not per-token charges. Input/context/output and per-user/platform
limits bound cost; usage reports preserve actual provider token counts and mark
unknown costs rather than inventing zero. Set model rates from the provider's
current contract/invoice in `commercial_settings.ai_*_usd_per_million` before
using estimated cost/margin metrics. Monthly cost inputs in `operating_costs` must
come from actual operator records with `source_notes`.

## Required real acceptance evidence

- Real confirmation/resend/recovery email delivered; unconfirmed password login
  denied; sessions persist; cross-device token-hash callbacks work.
- Two real accounts with publishable credentials: private CRUD, direct table/RPC
  paywall attempts, Free profile-only edits, legacy preservation, explicit import,
  stale revisions, exports, cancellation/expiration and deletion behavior.
- Real sandbox checkout and signed notification receipts; server-only activation,
  renewed dates, failure handling, signed preview changes, portal and cancellation.
- AI real response with consent and recorded quotas/tokens; provider failures and
  spending alerts; Remotive real retrieval/source attribution and terms review.
- Staging HTTPS/mobile/physical Safari+Android/desktop browser matrix; no asset
  404s/console errors; restore and rollback rehearsal; green hosted CI.

Do not declare commercial readiness until these are completed and approved.

## Administrator access (project owner only)

After verifying the intended operator's confirmed Auth user UUID in the dashboard,
use the Supabase SQL editor as project owner. Replace the placeholder with that
actual UUID; never accept an ID from a customer request:

```sql
insert into public.business_admins(user_id)
values ('REPLACE_WITH_VERIFIED_OPERATOR_UUID'::uuid)
on conflict do nothing;
-- Revoke immediately when operator responsibilities change:
-- delete from public.business_admins
-- where user_id = 'REPLACE_WITH_VERIFIED_OPERATOR_UUID'::uuid;
```

No client role or localStorage flag grants this role. Re-authenticate, open
Business, and verify an unrelated account still receives 403. This is a read-only
metrics dashboard, not an arbitrary payment or entitlement editor.
