# Launchpad 4.0 Release Candidate — setup and release gates

Production frontend: **https://theskullguy499-sketch.github.io/launchpad-career/**

This branch contains functional local features, account synchronization code, database migrations and secure server functions. It is **not a certification of production readiness**. Live Supabase, SMTP, OpenAI, Remotive, Resend, scheduled jobs and the updated public site have not been verified. The environment has no project credentials; direct Remotive requests were rejected by its network proxy. A working local test or mocked response is not a live integration result.

## 1. Build and preserve existing data

Use Node **24.19.0** (`.node-version`).

```sh
npm ci
npm run build:check
npm run build
npx playwright install --with-deps chromium
npm test
```

For installed Chromium: `CHROMIUM_PATH=/usr/bin/chromium npm test`.

The official SDK **2.118.0** and license/hash notices remain committed for static hosting. The build stages all required modules, styles, SVG artwork, legal drafts, callback files and the SDK in `_site/`; no backend code or secrets is copied. Source modules are not a rewrite of the original tracker: it has been extracted into `tracker.js` with the original IDs/storage keys, then extended.

Original guest keys remain:

- `launchpad-opportunities-v1`
- `launchpad-roadmap-v1`
- `launchpad-theme-v1`

`launchpad-workspace-v4` stores **guest** favorites, goals, tasks, personal milestones and preferences. Verified account workspaces stay in memory and in Supabase; they are not written to guest keys. SDK session tokens use their own existing key. Export JSON before clearing browser storage or intentionally restoring another backup.

JSON format version 1 remains supported. New exports have `workspaceVersion: 4` and `extras`; old clients may ignore these extra fields, so retain the original full file. Basic and extended restores are explicit replacements after confirmation. AI history is exported separately but is not silently re-imported from arbitrary backups as genuine AI output.

## 2. Supabase Auth and email

Complete the exact URL/template/SMTP steps in [SUPABASE_SETUP.md](SUPABASE_SETUP.md), especially:

- Public HTTPS project URL and modern `sb_publishable_` key in `auth-config.js`. Both may remain blank for guest-only use. Never insert any secret into browser code.
- Enable Email signup and **Confirm email**. Without this server policy, Supabase can auto-confirm users; browser checks cannot prove mailbox ownership.
- Site URL: `https://theskullguy499-sketch.github.io/launchpad-career/`.
- Exact production callback: `https://theskullguy499-sketch.github.io/launchpad-career/auth/callback.html`.
- Add development callback origins only when used.
- Configure custom SMTP, sender/domain verification, confirmation and recovery templates. Use the documented fragment `token_hash` templates for cross-device links. Default PKCE code links require the initiating browser/origin.
- Set password policy (at least 12 characters), email delivery limits and abuse controls. Do not enable an unsupported CAPTCHA requirement without adding the corresponding client flow.

Signup collects an age range (16–17 or 18+) and acknowledgement of the Terms/Privacy drafts. No exact birth date is collected. **Before public signup**, finalize the legal drafts and enable the supplied database **Before User Created** hook in **Authentication → Hooks**: `public.launchpad_before_user_created`. The migration grants execution to Supabase's managed `supabase_auth_admin` role when present. This prevents clients bypassing the age/terms fields in the UI, but remains self-attestation, not verified age checking. Review regional child-privacy obligations with counsel.

Existing users must complete Profile onboarding before AI/email reminders. Unknown age ranges cannot use the AI function. The original guest organizer remains usable without external profile processing.

## 3. Apply both migrations, in order

Back up the live project first. If migration 1 was already applied, do not rerun it or drop tables to make it run again. Apply only unapplied migrations through your established Supabase workflow:

1. `supabase/migrations/202610270001_launchpad.sql`
2. `supabase/migrations/202610270002_launchpad_v4.sql`

The second migration is additive. It extends statuses/fields and creates favorites, goals, personal milestones, preferences, AI history, notifications and feedback. It does not delete existing application records. Profile creation/backfill remains supported. All user-owned tables have confirmed-owner RLS. Server budgets, provider cache and email outbox have no browser privileges.

`load_workspace` reads only the caller's data. `commit_workspace` requires `payload`, `expected_revision` and `expected_owner`; it validates a bounded snapshot and uses a locked revision to reject stale saves atomically. Direct/legacy writes invalidate revisions through triggers. A stale client must reload before retrying; it does not silently overwrite another tab's changes. Cloud failures block account edits and present an explicit return to guest mode. Account records refresh when the window gains focus or after a minute if no input/editor is active; manual reload is always available.

Current RC bounds: 1,000 records per editable collection and a 2 MB workspace/backup payload. These limits reject oversized writes rather than truncate them. Test realistic account sizes before commercial launch; move to incremental/paginated editing before exceeding these bounds.

Guest import is explicit and account-named. `import_guest_workspace` verifies the expected owner and merges stable item IDs; existing account rows win conflicts. It never deletes guest records or overwrites account data with guest defaults. Original six legacy roadmap checkboxes remain separate from the new editable personal plan.

## 4. Deploy secure Edge Functions

Use a current Supabase CLI and your authenticated project-owner session:

```sh
supabase link --project-ref YOUR_PROJECT_REF
supabase functions deploy ai-coach
supabase functions deploy job-explorer
supabase functions deploy delete-account
supabase functions deploy reminder-worker
```

The committed `supabase/config.toml` disables gateway JWT verification for these functions because new publishable keys are not JWTs. **Do not deploy different/unguarded handler code with that setting.** AI/deletion requests carry `expected_user` (set automatically by the frontend) to reject account-switch races. The AI/deletion handlers validate bearer sessions with the official SDK `Auth.getUser`; the jobs endpoint serves public cached vacancies; the reminder worker requires its own server-only secret.

Supabase supplies `SUPABASE_URL`, `SUPABASE_ANON_KEY` and `SUPABASE_SERVICE_ROLE_KEY` inside its function runtime. These are never read from frontend files. If using modern keys server-side, configure the optional `SUPABASE_PUBLISHABLE_KEY` instead of the anonymous key. Service-role values must remain server-side.

Set function secrets securely in **Project Settings → Edge Functions → Secrets** or your secure CLI secret-management process. Do not paste values into GitHub, browser config, screenshots, chat or committed `.env` files.

| Server variable | Purpose |
| --- | --- |
| `ALLOWED_ORIGINS` | Exact comma-separated origins. Production is `https://theskullguy499-sketch.github.io` (no path). Add `http://127.0.0.1:8000` only for local testing. No wildcard CORS. |
| `OPENAI_API_KEY` | AI provider key, server only. Missing key returns 503; no fake response. |
| `OPENAI_MODEL` | Defaults to documented model `gpt-4.1-mini`; confirm access in the provider account. |
| `REMINDER_CRON_SECRET` | Random server-only value of at least 32 characters, supplied only by the scheduler. |
| `RESEND_API_KEY` | Optional reminder email transport key; not needed for Auth SMTP. |
| `REMINDER_FROM` | Verified sender for reminder digests, such as a domain/address you actually control. No invented address is provided. |

AI uses the official OpenAI Responses API over HTTPS. Requests set `store:false`, maximum output 1,200 tokens and explicit input/context bounds. Persistent reservations cap usage at **10 attempts/user/day and 100 attempts/platform/day**; failed provider calls also consume an attempt. There are no automatic provider retries. Configure provider project spending limits, alerts and account-level abuse controls as additional safeguards. Model availability, account billing and live responses remain unverified.

AI context is opt-in per request: saved profile, goals, progress or prior exchanges are included only when selected. Saving history is off by default and can be deleted. Age range is used for access controls, not sent as a birth date. Generated roadmaps must be reviewed/approved before saving. Local starter plans are labeled deterministic starter plans, not AI output.

## 5. Job provider

The `job-explorer` function uses Remotive's documented public API: `https://remotive.com/api/remote-jobs?limit=100`. Documentation: https://github.com/remotive-com/remote-jobs-api . Review current terms before public/commercial use; provider terms can change and free API access may not suit every commercial use.

The shared database cache refreshes at most once every six hours and at most four times per UTC day, with a refresh lease to prevent parallel fetch storms. The app filters a retrieved subset locally and clearly attributes Remotive. The provider's published terms were reviewed: listings are delayed 24 hours, must link back to their Remotive URL and name the source, may not be gated behind signup/email collection, and must not be submitted onwards to other job boards. The Job Explorer is accessible in guest mode and does not gate viewing behind account registration. Provider documentation was retrieved successfully; that is not a live vacancy-feed validation. Source descriptions are not copied as HTML. Only received vacancies are displayed; failures do not generate samples. Provider salary/location/posting fields may be absent. Experience is labeled as a title-text match, not an authoritative seniority classification.

Source/apply links use the provider's actual URLs; they are not mislabeled as independently verified employer-direct links. The company directory contains 24 curated employers, not every company or claims of hiring. Headquarters/career links are omitted until verified; custom companies may carry user-supplied links.

## 6. Background reminders

In-app reminders are functional while Launchpad is open. They cover deadlines, interviews, follow-ups, tasks and personal milestones. Dismissals and account notification read state persist. Closed-browser reminders require deploying/scheduling the worker.

Use **Supabase Cron** (or another trusted scheduler) to POST every 15 minutes to:

```text
https://YOUR_PROJECT_REF.supabase.co/functions/v1/reminder-worker
```

Supply `X-Reminder-Secret` from your scheduler's secure secret store. The browser must never know that secret. Enable the required scheduler/HTTP extension through the dashboard if using Supabase Cron. Store credentials in Supabase Vault and configure the HTTP job through the dashboard; do not hardcode credentials into SQL committed to this repository.

The worker creates deduplicated account notifications. Optional email is a **daily digest**, with one outbox row/user/day, at most three attempts, a 15-minute retry lease and stable Resend idempotency keys. It rechecks confirmed identity, age onboarding and opt-in before sending. SMTP for authentication and the optional Resend reminder service are separate configurations.

RC batch limits are 50 notification candidates and 25 email digests per invocation, with bounded source queries. For a larger deployment, implement cursor-based worker pagination and capacity monitoring before claiming complete coverage. Inspect worker logs, pending/failed outbox rows and provider delivery status; do not promise delivery from a saved preference alone. Live scheduling and reminder emails have not been tested here.

## 7. Release gates

Before activating public accounts or charging anyone:

- Verify real email signup, denial before confirmation, cross-device confirmation, resend, sign-in/out/reload and password recovery with real mailboxes.
- Test two actual users against every RLS table/RPC using the public key, plus unconfirmed/anonymous and forged-owner attempts. Never use a service-role key to prove RLS.
- Verify automatic/private synchronization, conflict detection, explicit guest import twice, cloud export, history deletion, recent-login account deletion and cascaded cleanup.
- Test real Remotive source access/terms, an actual AI response with spending limits, and scheduled reminder opt-in/opt-out, retries and deletion.
- Finalize operator/legal/support details, privacy retention, vendor agreements, incident response and backup recovery.
- Complete [GitHub Pages deployment](GITHUB_PAGES.md) and [operations/rollback](OPERATIONS.md). Deployment is manual and opt-in; the task does not merge or publish.
