# Production-readiness audit

Target branch: `improve/launchpad-responsive-supabase-auth` → `main`

Production URL: https://theskullguy499-sketch.github.io/launchpad-career/

## Outcome

The deployment asset blocker is fixed in source: the pinned SDK, licenses and hash manifest are now committed under `vendor/`. Static branch publishing no longer depends on Pages running npm. The Actions workflow additionally verifies reproducibility, builds the complete `_site/` artifact and tests that artifact under the actual project prefix before deployment.

Guest functionality and the prepared account implementation are locally validated. **Live Supabase authentication, SMTP, cloud RLS and the updated live Pages deployment are not certified ready.** No real project configuration or mailbox was available, and this environment's proxy rejected requests to the production hostname and GitHub API with HTTP 403.

## Findings and corrections

| Area | Evidence and final behavior |
| --- | --- |
| Missing SDK on static publishing | `vendor/` is no longer ignored. SDK 2.118.0 is committed with licenses and SHA-256 hashes. Both app and callback import the same local bundle through `auth-client.js`. |
| Reproducible build | Node 24.19.0, esbuild 0.28.2, exact SDK and lockfile dependency integrity pins. Clean `npm ci` followed by `npm run build:check` matches committed bytes. No runtime CDN or timestamp-dependent output. |
| Complete artifact | `npm run build` explicitly stages all browser modules, callback HTML, SDK/notices, `.nojekyll` and a public-file hash manifest in `_site/`. No dependencies, SQL or private files are copied. |
| Browser asset loading | Tests serve only `_site/` under `/launchpad-career/`. Every manifest file returns 200 with a matching hash and JavaScript MIME type. Signup/confirmation/resend/signin/signout flows load the real bundle with no failed same-origin asset requests or page exceptions. A deliberate wrong-root negative-control request returns 404, proving checkout files cannot hide path mistakes. CSS and favicon are inline, fonts local. |
| Invisible field text | Controls, native options, placeholders, caret and autofill text have explicit app-theme colors. Tests verify ≥4.5:1 computed text contrast for opportunity/account fields, filters, company text, country options and placeholders across all browser/app light/dark combinations. Real third-party password-manager autofill remains a manual post-deploy check. |
| Guest mode and privacy | Clear on-page/account messaging states that local records are shared across accounts in the browser profile. Signup/signout do not make the guest dashboard private or upload it automatically. No local storage keys were renamed or cleared. |
| Data safety | JSON backups remain supported. Failed create/edit/delete/sample/milestone saves keep prior in-memory data; failed restore writes roll back earlier successful writes when storage permits. Errors no longer get overwritten with success toasts. Storage-failure tests verify original records and backup contents remain available. |
| Secrets | Actual config contains blank public fields. Build validation rejects secret/legacy keys, URL credentials and extra configuration fields. No service-role, database or SMTP credentials are included. SDK-managed session tokens remain separate from local guest data. |
| Supabase database | A migration prepares all four tables, confirmed-owner RLS, anonymous denial, cross-user task constraints and additive atomic imports. Tests execute it in PostgreSQL WASM with simulated Auth/JWT context. It has **not** been applied or verified against a live Supabase project. |
| Authentication | Official SDK flows are tested with mocked HTTP responses, including email-token and PKCE callbacks, expired links, resend, sessions, recovery/reset and errors. This is **not** evidence of actual email delivery or production dashboard configuration. |

## Validation

Run on the pinned Node runtime:

```sh
npm ci
npm run build:check
CHROMIUM_PATH=/usr/bin/chromium npm test
npm audit --omit=dev
```

The test command covers 23 application Playwright tests, 9 production-artifact Playwright tests, 2 public-build configuration tests and 1 PostgreSQL policy test. The audit found no reported production dependency vulnerabilities. A green local suite does not establish that the GitHub Actions workflow or live deployment has run.

## Remaining release/activation blockers

1. **Supabase project configuration:** real public URL/key, Confirm email, exact redirect allowlist and email templates are not supplied/configured here.
2. **SMTP and email delivery:** custom SMTP, verified sender and real-mailbox confirmation/recovery have not been tested.
3. **Live database isolation:** apply the reviewed SQL migration and test two-user/anonymous/unconfirmed access with the publishable key before claiming secure account cloud storage. Local records remain shared even after this step.
4. **Pages publication:** select one deployment method in repository settings, review/merge the PR yourself, wait for deployment and perform the documented live browser smoke checks. The updated production URL was not reachable from this environment because the proxy rejected the request.
5. **PR creation:** Git pushes work, but GitHub GraphQL/API requests are rejected by the proxy. A pushed feature branch and prepared PR form/description are provided; no automatic merge is performed.

Use the separate [Pages checklist](GITHUB_PAGES.md) and [Supabase/SMTP checklist](SUPABASE_SETUP.md#production-configuration-checklist). A guest-only release may retain blank Supabase configuration; account activation must wait for the applicable live checks.
