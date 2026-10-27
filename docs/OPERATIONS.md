# Operations, backups and rollback

## Approval boundary

A push or PR runs tests; it does not publish automatically. To deploy the frontend, review/merge yourself, choose Actions as the Pages source, then manually dispatch `Test and publish Launchpad` on `main` with **deploy=true**. The `github-pages` environment can require additional repository-owner review. Edge Functions, database migrations, Auth/SMTP and scheduler configuration are separate owner actions.

Keep production at https://theskullguy499-sketch.github.io/launchpad-career/ . Hash navigation avoids Pages rewrite dependencies; the email callback is a real file. The landing screen is `#home`; the root retains the original application tracker route for existing users.

## Backups

- Export guest JSON before clearing browser storage or changing origins. New exports retain the legacy format plus extended workspace fields.
- Account export retrieves the workspace and paginated saved AI exchanges. Preserve the file securely; it may contain personal career information. Do not commit exports to GitHub.
- Enable appropriate Supabase database backups/PITR for the chosen plan and document retention and restore ownership. A local SQL policy test is not a production backup.
- Back up before applying each migration. Test restore into an isolated non-production project, including Auth identities and foreign-key ownership. Do not restore production credentials into a public test environment.

## Rollback

1. Pause public deployment and scheduled reminders if investigating data or email incidents. Disable AI through removal of its server key if cost/abuse requires it; the UI will show unavailable.
2. For frontend regressions, revert the reviewed commit in a new PR, or manually deploy a previously reviewed artifact after approval. Do not reset/delete production data. Keep the same Pages URL/origin.
3. Prefer forward database fixes. The v4 migration is additive; do not blindly drop its tables/columns or roll back user data. Restoring an old frontend may omit new fields when editing, so put account editing in maintenance mode before serving an incompatible older client. Guest data remains in its original keys.
4. Restore a production database only through the operator's tested backup procedure, with an incident plan and impact assessment. Preserve new records before any point-in-time restore.
5. Roll back Edge Function code independently using the reviewed version; keep secrets in the secure platform store. Re-run Auth, ownership, imports, exports, conflicts and email acceptance checks before reopening.

## Monitoring

Review Auth rate-limit/delivery logs, Edge Function error rates, AI daily quotas and actual provider spending, cached job freshness, workspace conflict errors, worker backlog and failed outbox rows. Never log bearer tokens, passwords, full email links, API keys or full prompts/profile data for routine debugging. Give users clear availability messages rather than substituting fake data.

The RC uses bounded snapshot synchronization and a bounded reminder worker. Load-test realistic account sizes and add incremental writes/worker pagination before large-scale commercial use. The hosted environment cannot be called ready until live integration, restoration and operational tests pass.
