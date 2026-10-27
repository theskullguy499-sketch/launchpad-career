# Commercial deployment, domains and staging

No Cloudflare deployment or custom domain was created by this task. No staging
preview URL exists yet. Credentials, owner approval and real acceptance are
required; placeholders below are not live URLs.

## Reproducible build

Node 24.19.0; `npm ci`; `npm run build:check`; `npm test`; `npm run build`.
The explicit public-file allowlist stages `_site/`, including the pinned SDK,
commercial UI/config, authentic screenshot and security headers. SQL, functions,
node_modules and secrets are excluded. Plan seed checks are part of the build.

`PUBLIC_SUPABASE_URL` and `PUBLIC_PUBLISHABLE_KEY` optionally override only the
built `_site/auth-config.js`. They are public values, validated by the same
strict HTTPS/publishable-key guard, hashed in the artifact, and never overwrite
committed `auth-config.js`. Never pass private backend credentials to the build.
Build/test first with blank public config; separately build the intended staging
configuration after tests and perform a real staging smoke test.

## Cloudflare staging

1. Create a dedicated Pages project ending in `-staging`, production branch `main`,
   with **no real commercial custom domain**. Keep it separate from production.
2. If connecting the repository, choose build `npm ci && npm run build`, output
   `_site`, Node 24.19.0. Disable unattended production publishing for the commercial
   project; prefer reviewed Direct Upload or required deployment approvals.
3. Create GitHub environment `cloudflare-staging` with required owner reviewers.
   Set variables `STAGING_SUPABASE_URL`, `STAGING_PUBLISHABLE_KEY`,
   `CLOUDFLARE_STAGING_PROJECT`; secrets `CLOUDFLARE_API_TOKEN` (least privilege
   for the staging Pages project) and `CLOUDFLARE_ACCOUNT_ID`.
4. Keep Paddle/OpenAI/SMTP/service-role secrets in **Supabase**, not Pages vars.
5. Run **Review and deploy Cloudflare staging** manually on the reviewed feature
   branch with `approve_staging=true`. It runs all tests, builds the configured
   artifact, and uses pinned Wrangler 4.153.0 with `--branch staging`. It cannot
   run on push or publish to a project without the `-staging` suffix.
6. For the first deployment before this workflow exists on the default branch, use the same pinned Wrangler command manually against the dedicated staging project after owner approval; GitHub requires a workflow on the default branch before its dispatch UI is available.
7. Record the actual Cloudflare preview/stable branch alias from the successful
   deployment. Configure that exact origin and callback in Supabase and Paddle,
   then run the real acceptance checklist in SETUP.md. Do not assert a preview
   works merely because the upload succeeded.

## Production commercial domain — explicit approval only

After approved live acceptance, create a separate production Pages project and
reviewed production Supabase/Paddle environment. Configure the owned domain in
Pages **Custom domains**, apply the provided DNS records at the actual registrar,
and wait for HTTPS/certificate activation. Verify redirects, origin/callback
allowlists, support/legal pages and payment-link domain approval. No domain
ownership, TLS issuance or registrar access is claimed here.

Build the approved main commit with production **public** values, retain the
artifact and manifest, then after explicit owner approval upload manually:

```sh
npx --yes wrangler@4.153.0 pages deploy _site --project-name YOUR_PRODUCTION_PROJECT --branch main
```

This command is an instruction, not an action performed by this task. Only set
production billing flags after the owner approves live charges. Keep sandbox and
production provider secrets/projects isolated.

GitHub Pages remains the portfolio/demo channel. Review/merge yourself, select
Settings → Pages → GitHub Actions, then manually run **Test and publish Launchpad**
on `main` with **deploy=true**. Normal pushes/PRs only test/build. Checkout rejects
GitHub Pages origins. Neither workflow is dispatched automatically here.

## Preserve data during domain migration

Cloud account data stays in the same approved production Supabase project and
keeps user IDs; add the new exact auth callback/CORS origin before switching.
Do not copy sandbox users/subscriptions into production or replace an existing
production project without an approved identity/data migration plan.

Guest localStorage and SDK sessions are origin-specific. Keep the original site
available. Export the full JSON on the old origin, sign in afresh on the new
origin, restore to its local workspace or explicitly import into the verified
account. Do not silently upload guest records, share session tokens between
origins, clear old storage or truncate records. Verify stable IDs and deduplication
with disposable data before moving real records.

## Rollback

Keep the previous tested commit, artifact/hash manifest, deployment identifier,
JSON exports and DB snapshot. Pause new checkout first. In Cloudflare's deployment
dashboard choose the previous verified production deployment/rollback action,
or upload its retained artifact after approval. For Pages, revert via reviewed
PR and manually redeploy with `deploy=true`. Keep additive SQL/billing records;
do not drop tables or rerun applied migrations. Existing older clients still hit
server ownership/entitlement guards. Reconcile in-flight payments before retrying.
