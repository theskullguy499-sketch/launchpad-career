# Publish Launchpad on GitHub Pages

Target: https://theskullguy499-sketch.github.io/launchpad-career/

1. Review the pull request and `docs/SUPABASE_SETUP.md`. Add the public project URL and publishable key to `auth-config.js` if you want accounts enabled. No secret keys are needed for deployment. Empty config keeps guest mode available and clearly marks accounts unconfigured.
2. Apply the migration and configure Supabase Email, Confirm email, exact redirect URLs, email templates and custom SMTP. The code cannot apply those settings without project access.
3. In the repository's **Settings → Pages → Build and deployment**, choose **GitHub Actions** as the source. Enable GitHub Actions if the repository disables it, and approve the `github-pages` deployment environment if your repository requires it.
4. Merge the PR into `main`. The included `Test and publish Launchpad` workflow runs database tests and Chromium tests, builds the official SDK bundle and publishes only the public static files. PR runs test/build but do not deploy. You can also run the workflow manually from the **Actions** tab after it is on the default branch.
5. Wait for the deployment job to succeed, then open the production URL. Check `auth/callback.html` loads directly (it should show invalid-link guidance without a token). Confirm `vendor/supabase.js` loads successfully.
6. Run the real-mailbox acceptance checklist in `docs/SUPABASE_SETUP.md`. Workflow success or mocked browser tests do not prove live email delivery.

The deployment artifact includes `index.html`, `auth-config.js`, `auth.js`, `auth-client.js`, `cloud-data.js`, the `auth/` callback directory, `vendor/supabase.js` and `.nojekyll`. It excludes development dependencies, SQL tests and credentials. Simply publishing the repository root without building will omit the ignored SDK bundle and break configured authentication. Use the provided workflow or stage the same artifact after `npm ci && npm run build`.

Existing guest data stays in the same browser's localStorage at the existing origin. Neither deployment nor authentication automatically deletes or migrates it. Make a JSON backup before changing origins, clearing browser data or intentionally using Restore. Back up the live database before applying schema migrations.

This task prepares the workflow; it does not claim the workflow has run on GitHub or that Pages has been published.
