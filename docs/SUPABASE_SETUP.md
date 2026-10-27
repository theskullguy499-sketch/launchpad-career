# Supabase setup for Launchpad

Production: **https://theskullguy499-sketch.github.io/launchpad-career/**

Status: the application and migration are prepared. No live Supabase project URL, key, SMTP service, or mailbox is configured in this checkout. Automated browser tests mock Supabase HTTP responses through the real SDK. Database tests run the migration in an actual PostgreSQL WASM engine (PGlite), with an emulated Supabase Auth schema and JWT context. Neither test proves live email delivery, the state of your Supabase dashboard, or production authorization. Complete and test the following setup before calling live authentication ready.

## 1. Create the project and public configuration

1. Create/select your Supabase project. In **Project Settings → API / API Keys** (or the project's **Connect** dialog), copy the project HTTPS URL and a modern **publishable** key starting with `sb_publishable_`.
2. Edit the two fields in `auth-config.js`; see `auth-config.example.js`. These two values are intentionally public. The app rejects secret/service-role keys and legacy JWT keys.
3. Never copy service-role keys, database passwords, user passwords, SMTP credentials, or private provider tokens into frontend files, repository variables or browser tests. The official SDK sends passwords directly to Supabase over HTTPS; application code never saves them manually. SDK-managed access and refresh tokens persist under the separate `launchpad-auth-v1` localStorage namespace. Use a trusted device and keep the deployment protected from XSS.

## 2. Configure email registration and server-side confirmation

Under **Authentication → Sign In / Providers → Email** (dashboard labels may vary):

- Enable Email/password sign-up, and enable **Confirm email**. Leave public sign-ups enabled if users should be able to register.
- Keep **Confirm email enabled**. This is the server-side control that denies password sign-in for unconfirmed addresses. A frontend checkbox or an RLS policy cannot substitute for this setting. If it is disabled, Supabase can auto-confirm accounts, which is not proof of real mailbox ownership. The app also rejects immediate signup sessions as a configuration error.
- Set minimum password length to **12** and configure an appropriate password-strength policy. Enable leaked-password protection where your plan supports it.
- Under **Authentication → Rate Limits**, choose suitable signup, password recovery and email resend limits. Configure abuse protection/CAPTCHA in a separate change if needed; this implementation does not yet collect CAPTCHA tokens, so enabling a CAPTCHA requirement will block email requests until that integration is added.
- Keep anonymous Supabase sign-ins disabled unless separately needed. Launchpad guest mode uses local browser storage and does not require anonymous Auth users.

Before opening registration publicly, verify that email is actually delivered and unconfirmed sign-in is rejected by the Auth API. Previously auto-confirmed accounts cannot retrospectively prove email ownership; evaluate any existing production accounts separately.

## 3. Set the exact URLs

Under **Authentication → URL Configuration**:

**Site URL**:

```text
https://theskullguy499-sketch.github.io/launchpad-career/
```

**Redirect URLs** (exact entries, without broad production wildcards):

```text
https://theskullguy499-sketch.github.io/launchpad-career/auth/callback.html
http://127.0.0.1:8000/auth/callback.html
```

Add `http://localhost:8000/auth/callback.html` only if you actually use localhost. Those are different origins; do not mix them during a session. Use a separate development Supabase project for local email testing if possible.

The callback is a real static file, so GitHub Pages does not need SPA rewrites or a server endpoint. App requests derive the callback from the current project directory. The callback never uses a caller-supplied `next`/redirect destination: it returns to `../` within this project.

## 4. Configure confirmation and recovery email templates

In **Authentication → Email Templates**, use these production links. Keep the complete token placeholders; do not replace them with access tokens or secrets.

**Confirm signup**:

```html
<h2>Confirm your Launchpad email</h2>
<p>Confirm your address to finish creating your account.</p>
<p><a href="https://theskullguy499-sketch.github.io/launchpad-career/auth/callback.html#token_hash={{ .TokenHash }}&amp;type=email">Confirm email</a></p>
```

**Reset password**:

```html
<h2>Reset your Launchpad password</h2>
<p>If you requested a password reset, choose a new password using this link.</p>
<p><a href="https://theskullguy499-sketch.github.io/launchpad-career/auth/callback.html#token_hash={{ .TokenHash }}&amp;type=recovery">Reset password</a></p>
<p>If you did not request this, you can ignore this email.</p>
```

These `token_hash` links use the SDK's `verifyOtp` API and work when an email is opened in another browser/device, without a stored PKCE verifier. Verification credentials are in the URL fragment (not sent to the static web server), are removed from the address bar before the verification request, and are never logged by app code. The callback has `no-referrer` and loads only same-origin files. Successful recovery enables reset UI only after a valid server-verified session. A fabricated `?auth=recovery` alone cannot authorize a password update. Tokens remain sensitive one-time credentials: do not share emailed links.

The callback also supports default Supabase `{{ .ConfirmationURL }}` PKCE links ending in `?code=…`. Those require the same browser/origin that requested the email. For reliable cross-device recovery, use the token-hash templates above. For local email tests, replace only the fixed origin/project prefix in your **development** project's templates with `http://127.0.0.1:8000/auth/callback.html`; keep the fragment placeholders unchanged. The production templates intentionally always return to the production URL.

Configure a sensible OTP expiry in the email provider settings. Expired/used/invalid tokens show a friendly error and a link back to request a fresh email. Disable SMTP link tracking/rewriting if it breaks fragments or consumes verification links. Do not include third-party tracking in the callback page.

## 5. Configure production SMTP

Under **Project Settings → Authentication → SMTP Settings** or **Authentication → Emails → SMTP Settings**:

1. Enable custom SMTP and configure a provider you control.
2. Enter the provider's host, TLS port, username and password **only in Supabase**.
3. Set a verified sender email address and sender name such as “Launchpad”.
4. Follow your provider's domain verification steps (SPF/DKIM, and DMARC where appropriate).
5. Check Supabase email rate limits and provider sending quotas. The default Supabase email sender is restricted and must not be relied upon for general production registrations.
6. Test delivery to a real external mailbox, spam filtering, resend, expiration and recovery. Do not paste SMTP credentials or email tokens into issues or chat.

## 6. Apply the database migration

Back up any existing production database first. In **SQL Editor → New query**, run the complete contents of:

```text
supabase/migrations/202610270001_launchpad.sql
```

Alternatively apply it using your normal Supabase CLI migration workflow. Run it once with the project's database owner. It uses a transaction and creates new tables; it does not drop existing tables or touch browser storage. If any named table/function/trigger already exists, stop and compare schemas; do not drop production data to force the migration through. The local migration has not been run against your live project.

It creates:

| Table | Purpose | Owner |
| --- | --- | --- |
| `user_profiles` | Display name and timestamps; no passwords or privileged roles | `id = auth.uid()` |
| `job_applications` | Opportunities with the existing app's fields and a guest import ID | `user_id = auth.uid()` |
| `tasks` | User tasks, optional links to an owned application | `user_id = auth.uid()` |
| `roadmap_progress` | Per-user milestone completion | `user_id = auth.uid()` |

All four tables have RLS enabled and forced; authenticated CRUD policies require ownership **and** a server-confirmed email. Anonymous roles have no table privileges. A composite foreign key prevents attaching a task to another user's application. Signup triggers create profiles; existing accounts are backfilled without overwriting profiles. Deleting an Auth user cascades their cloud records. Explicitly deleting a cloud application cascades its linked tasks. The app adds no automatic deletion path.

`import_guest_backup` runs as the caller, with RLS, in one transaction. It only inserts missing guest opportunity IDs and roadmap rows. Existing cloud records win conflicts; repeated saves do not duplicate opportunities. It never accepts a caller-supplied owner and never deletes or overwrites existing cloud rows. A malformed import rolls back completely.

Verify live RLS using two real confirmed users and the publishable key, never a service-role key: each should see/edit/delete only their own rows; forged owner IDs, cross-user task links, unconfirmed users and unauthenticated requests must fail. Also verify repeated guest imports preserve existing cloud edits. The local test covers those rules with a simulated Auth schema, but live grants and project-specific policies must still be checked.

## 7. Understand local and cloud data

- Guest mode, opportunity editing, filters, sorting, deadlines, roadmap, themes, CSV export and JSON backup/restore continue to use the original localStorage keys. Signing in/out or resetting a password never clears or silently replaces those records.
- After sign-in, **Account → Save local data to account** asks before making an additive cloud copy. **Download account backup** downloads a separate file. To replace local records, the user must explicitly choose **Restore** and accept its existing replacement confirmation.
- The guest dashboard is shared by browser profile and origin, even across signed-in accounts. It is not automatically converted into an account workspace. Use separate browser profiles on shared devices. Changing the hosting origin/path is not a data migration; export a JSON backup first.
- The `tasks` table is ready for owned task storage and is included in account exports. There was no local tasks interface to migrate; no unrelated task UI is added. Existing local Restore ignores this extra export field, so preserve the account export if you need task records. Cloud task records are unaffected by local Restore.
- No automatic bidirectional synchronization is claimed. Saving a guest copy does not overwrite later cloud edits, and unchecking a local milestone does not reset an existing cloud row.

## 8. Live acceptance checklist (not yet executed)

1. Register a new address; verify no session is granted before confirmation and password sign-in is rejected before confirmation.
2. Receive an actual email, open its link, confirm the email in Supabase, and verify the callback returns under `/launchpad-career/`.
3. Sign out, sign in with the password, reload, and confirm session persistence. Verify local guest data remains unchanged.
4. Request another verification email; verify rate limits and friendly guidance for expired/used links.
5. Request password recovery from a real mailbox, open the link (including another browser/device), set a new password, then sign in with it. Verify the old password no longer works. Review Supabase session revocation settings if you need to invalidate other devices; the app signs out the current local session after reset.
6. Test two-user RLS and the explicit cloud copy/download path as above.
7. Check **Authentication → Logs** and provider delivery logs for failed sends; never copy credentials or full email links into reports.

Only after these checks pass against the configured production project can live confirmation and recovery be called verified.

## Production configuration checklist

This is separate from deploying the public files. None of the live items below is claimed complete by local tests.

- [ ] Supply the real project HTTPS URL and public `sb_publishable_` key in `auth-config.js`; leave both blank to retain guest-only deployment until ready. Use `auth-config.example.js` as the safe example.
- [ ] Enable Email sign-ups and **Confirm email**; enforce the intended password policy and rate limits server-side.
- [ ] Set Site URL to `https://theskullguy499-sketch.github.io/launchpad-career/`.
- [ ] Allow the exact production callback `https://theskullguy499-sketch.github.io/launchpad-career/auth/callback.html` and only the development callbacks actually used.
- [ ] Configure the confirmation and reset email templates from section 4. Use the token-hash template for cross-device verification; default PKCE links require the initiating browser/origin.
- [ ] Configure custom SMTP, a verified sender/domain, TLS and provider DNS records inside Supabase/provider dashboards. Never put these secrets in frontend files.
- [ ] Back up the database, review and apply `supabase/migrations/202610270001_launchpad.sql` once. Confirm all four tables have RLS enabled/forced and that anonymous users have no privileges.
- [ ] Test two real confirmed users with the publishable key: owned CRUD works, cross-user reads/writes and task links fail, and unconfirmed/anonymous access is denied. Do not use a service-role key for this test, since it bypasses RLS.
- [ ] Confirm a real email arrives; verify unconfirmed password sign-in is denied, the confirmation link completes, sign-in/out/session reload work, resend is delivered, and expired/used links show recovery guidance.
- [ ] Test real password-reset delivery and new-password sign-in. Do not share or log emailed tokens.
- [ ] Test explicit cloud copying/downloads with non-sensitive records. Guest records remain shared in the browser profile; applying RLS does not make the local dashboard private per account.

No real configured Supabase project, SMTP provider or mailbox was available during the local production audit. Live email verification and cloud isolation remain unverified until this checklist is completed.
