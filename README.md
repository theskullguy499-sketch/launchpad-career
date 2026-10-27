# Launchpad — Opportunity Management App

A responsive HTML/CSS/JavaScript dashboard for organizing job opportunities and applications. The original sidebar, light/dark themes, roadmap, sample data, search, filters, sorting, deadlines, CSV export, and JSON backup/restore remain available.

Opportunities, roadmap progress and theme are stored locally under their existing browser storage keys. Account creation, verification, sign-in and sign-out never migrate, overwrite or delete those records. Accounts do **not** provide cloud backup or synchronization. Different accounts using the same browser profile and origin share the local dashboard; use separate browser profiles on shared devices. Export a JSON backup before clearing browser storage or moving to a different deployment origin.

## Run and test

Local features still work by opening `index.html`; authentication needs an HTTP server (HTTPS in production).

Node.js 22+ and Python 3 are needed to build the optional authentication SDK and run development checks:

```sh
npm ci
npm run build
npm start
```

The build bundles the pinned official Supabase browser SDK into `vendor/supabase.js`; deploy that generated file along with `index.html`, `auth.js` and `auth-config.js`. Do not deploy `node_modules`. No third-party runtime CDN is needed. Local features remain usable if authentication is unconfigured or unavailable.

```sh
npx playwright install chromium
npm test
# Or use an existing Chromium installation:
CHROMIUM_PATH=/usr/bin/chromium npm test
```

Browser tests cover narrow and wide screens, long company names, field visibility, existing local data, editing, search, theme, roadmap persistence, CSV injection protection, JSON backup/restore, deletion, form validation, and authentication success/failure paths. Authentication tests mock Supabase HTTP responses through the real SDK: they do not prove actual email delivery or production project configuration.

## Supabase setup required before accounts work

1. Create/select a Supabase project. Under Authentication → Providers, enable Email and **Confirm email**. This is a mandatory server-side setting; browser checks cannot enforce server policy. Disable anonymous sign-ins unless separately needed. Configure an appropriate password policy (at least 12 characters is recommended), leaked-password protection where available, and authentication rate limits. The registration form requires at least 12 characters; sign-in accepts existing shorter passwords.
2. In Authentication → URL Configuration, set **Site URL** to the production HTTPS app URL and add the exact production app path and local development app path to **Redirect URLs**. Avoid broad production wildcards. Verification redirects are generated from the current origin and pathname, without query parameters or fragments. Use the same origin and browser for PKCE sign-up and the verification link; opening it in another browser/device may fail and require a new verification flow.
3. Configure a trusted SMTP provider, sender address and email templates for production email delivery. The built-in test sender has delivery/rate restrictions and is insufficient for general production signup. Keep provider credentials in Supabase settings, never in this repository. Keep the default confirmation template's `{{ .ConfirmationURL }}` link so Supabase verifies the token before redirecting. Test delivery, expiration, resend limits and the complete confirmation flow with a real mailbox.
4. Fill in the two **public** fields in `auth-config.js`: the project's HTTPS URL and a modern **publishable** key (`sb_publishable_…`). This integration intentionally rejects secret/service-role keys and legacy JWT keys. Publishable keys are designed for browser use; they are not credentials that grant administrative access. Never expose a Supabase secret key, service-role key, database password or SMTP credential.
5. Run `npm run build`, serve over HTTPS, and allow HTTPS requests to your project host (normally `<project-ref>.supabase.co`) in your hosting/network/CSP policy. If CSP is enabled, allow same-origin scripts and the existing inline app/style, plus the project host in `connect-src`; prefer moving inline code or using hashes over adding broad script permissions.
6. Validate signup → email arrives → confirmation link → confirmed session, sign-out → password sign-in, expired/invalid links, resend, reload, and network failure against the real project. **Live authentication and email delivery are not verified until these steps are performed.**

The client uses the official SDK's PKCE flow, session renewal and a separate `launchpad-auth-v1` storage namespace. Passwords are never written by application code to browser storage or logs and are cleared after submission/closing the account dialog. The SDK stores session tokens in localStorage to retain login; protecting the deployment against XSS and using a trusted device remain essential. Authentication UI is optional and does not gate or secure the local dashboard.

No database tables or RLS policies are needed for this authentication-only integration. Before adding cloud opportunity storage, design an explicit, consent-based migration of local records and enable/test RLS policies enforcing `auth.uid()` ownership. Authentication alone does not protect database tables.

## Deployment checklist

- Publish the built SDK and static files together under a stable HTTPS origin.
- Configure the Supabase project, public config, redirect allowlist and SMTP as above.
- Verify email delivery and real sessions; automated tests currently use mocked endpoints.
- Keep a JSON backup of local data; deploying under a new origin does not transfer localStorage.
