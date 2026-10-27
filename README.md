# Launchpad — Opportunity Management App

A responsive HTML/CSS/JavaScript dashboard for organizing job opportunities and applications. Existing layout, light/dark themes, guest mode, roadmap, sample data, search, filters, sorting, deadlines, CSV export and JSON backup/restore are preserved.

Optional Supabase accounts support email/password registration, real server-side email confirmation, sign-in/out, persisted sessions, resend verification, forgot password and password reset. A dedicated static callback works under the GitHub Pages project path. Passwords are handled by the official SDK and Supabase; the app never saves them manually. No service-role or SMTP credentials belong in browser code.

**Live authentication is not configured or verified in this checkout.** Supply your public project URL/key and complete [Supabase dashboard setup](docs/SUPABASE_SETUP.md), including custom email templates, confirmation policy, redirects, database migration and SMTP. See [GitHub Pages publication](docs/GITHUB_PAGES.md) for the exact deployment steps for https://theskullguy499-sketch.github.io/launchpad-career/.

## Run locally

Guest features still work by opening `index.html`. Authentication needs an HTTP origin (HTTPS in production). For build/testing use Node.js 22+ and Python 3:

```sh
npm ci
npm run build
npm start
```

The build bundles the pinned official Supabase SDK into `vendor/supabase.js`. No runtime CDN is used. `auth-config.example.js` shows safe public placeholders; edit `auth-config.js` only after setting up your Supabase project. Blank configuration leaves guest features fully usable.

## Validation

```sh
npx playwright install chromium
npm test
# Or use an installed Chromium:
CHROMIUM_PATH=/usr/bin/chromium npm test
# PostgreSQL policy tests only:
npm run test:db
```

Browser tests exercise the real SDK with **mocked Supabase HTTP responses**: registration, confirmation, recovery/reset, sign-in/out, sessions, rate limits, cross-device token verification, PKCE, GitHub Pages paths, explicit cloud copies and the existing local features at 320–1440px.

Database tests execute the SQL migration in PostgreSQL WASM (PGlite), with a **simulated Auth schema/JWT context**. They test row ownership, anonymous/unconfirmed denial, cross-user write prevention, task foreign keys, atomic imports and idempotence. These are meaningful local policy tests, not a live Supabase deployment or a real mailbox delivery test. The [live acceptance checklist](docs/SUPABASE_SETUP.md#8-live-acceptance-checklist-not-yet-executed) must still be completed.

## Data safety and cloud storage

Original browser keys for opportunities, roadmap and theme are unchanged. Signing in, signing out and resetting passwords never clear, migrate or replace existing local records. Guests remain fully supported. Different accounts in the same browser profile share that local guest dashboard; use separate profiles on shared devices.

The migration creates `user_profiles`, `job_applications`, `tasks` and `roadmap_progress` with ownership/confirmed-email RLS. **Save local data to account** explicitly requests an additive, atomic cloud copy; it never overwrites cloud records or deletes guest data. **Download account backup** exports cloud records separately. Restore remains an explicit, confirmed local replacement action. Tasks have secure storage prepared without adding an unrelated tasks UI. Automatic two-way synchronization is not included.

Export a JSON backup before clearing browser storage, moving to a different origin or intentionally replacing local records. Account sessions use SDK-managed tokens under a separate key; secrets and user passwords are never committed.
