// This example contains PUBLIC placeholders, not working credentials.
// Cloudflare: prefer PUBLIC_SUPABASE_URL and PUBLIC_PUBLISHABLE_KEY at build time.
// Set REQUIRE_PUBLIC_AUTH_CONFIG=true for Auth-enabled staging builds.
// See docs/releases/5.1-STAGING.md. These placeholders do not activate a project.
window.LAUNCHPAD_AUTH_CONFIG = Object.freeze({
  supabaseUrl: 'https://YOUR_PROJECT_REF.supabase.co',
  publishableKey: 'sb_publishable_REPLACE_WITH_YOUR_PUBLIC_KEY'
});
// Never add sb_secret_*, service_role, a database password or SMTP credentials.
