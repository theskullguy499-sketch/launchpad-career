# Launchpad 4.0 CI bugfix audit

Base: main merge `e6eee8a43bb6335a69770c8c89c1a962ff887605`.
Branch: `fix/ci-dark-contrast-roadmap-restore`.

## Reproduced defects and corrections

- Dark primary buttons used navy text on hover background `#4474ed`. Axe reported
  **4.23:1**, below the 4.5:1 requirement for their 12px text. The dark hover
  background is now `#6b96ff`; both normal and hovered states are scanned.
- Navigation rendered synchronously on a click and again on the subsequent
  `hashchange`. The second render reset profile fields to saved values and
  replaced roadmap controls. Delivering that trailing event after entering
  `Career Planner` reproduced an empty profile field. Navigation now applies
  visibility but emits the render event only when the active route changes.
  Browser back navigation and startup-created screens remain supported.
- Profile submission read DOM values inside the asynchronous workspace mutation
  queue. An earlier cloud save could render the form before that mutation ran,
  causing the submitted name to be saved as empty. Holding the earlier SDK RPC
  response reproduces this against the original `platform.js`. Submitted values
  are now captured synchronously before entering the existing guarded queue.

No storage keys, SQL policies, authentication methods or backup formats change.
No migrations or production data operations are required.

## Regression coverage

The original accessibility and roadmap tests remain enabled with all original
assertions. Additional assertions cover:

- All nine main screens in both themes, plus populated applications, input,
  textarea and selected filter values, modal forms and primary-button hover.
- Application themes overriding the opposite browser color scheme.
- Duplicate same-route events, repeated navigation, back navigation and reload.
- Profile submission queued behind a deliberately held cloud response.
- A downloaded backup containing the goal, five milestones, completion, task
  and profile; explicit clearing of test guest data; JSON restore into that
  empty workspace; another reload; recovered profile, tasks, overdue reminder
  and milestone completion.

Axe results use Playwright attachments instead of a shared output filename.
Source and production tests have separate output directories. GitHub Actions
retains failure screenshots/traces and axe attachments for seven days, including
when `npm test` fails. Assertions and failure exit codes remain mandatory.

## Validation and limits

Final local verification passed:

| Check | Result |
| --- | --- |
| Clean `npm ci` (writable npm cache) | Passed |
| `npm run build:check` | Reproducible SDK and asset build passed |
| Public configuration tests | 2 passed |
| PostgreSQL migration/security test files | 2 passed |
| Backend/model/workspace tests | 12 passed |
| Function entrypoint/pin checks | All 4 passed |
| Source Playwright tests | 44 passed |
| Production artifact Playwright tests | 10 passed |
| Three repeats of the five targeted regressions | 15 passed |
| `git diff --check` | Passed |

This is **70 tests/test files**, plus the function build checks. All original
checks remain enabled. The source run took 2.4 minutes; production tests took
55.9 seconds while the separate regression repeat was also running.

Use `npm ci`, `npm run build:check`, then `npm test`. The local run used the
pinned Node **24.19.0**, locked dependencies, `CI=true` and two browser workers.
The local host is Debian 13 with Chromium **154.0.8037.57**, selected using
`CHROMIUM_PATH=/usr/bin/chromium`.

GitHub Actions uses `ubuntu-latest` and Playwright's pinned Chromium download
(156.0.8078.4 in this lockfile). Downloading that browser here failed with network
403. This environment therefore does **not** exactly reproduce the runner OS
or browser build.

The original two tests passed locally before changes, including eight repeats
of each. The controlled regression cases above failed before their fixes.
They establish real defects, but cannot prove which caused the historical CI
failures without their complete logs.

The public failed run was inspected:
https://github.com/theskullguy499-sketch/launchpad-career/actions/runs/40523066887

It identifies merge `e6eee8a` and the failed `npm test` step. Complete logs require
GitHub sign-in; the available API returned 403 and the public log endpoint 404.
A new green GitHub-hosted run must be checked before merging. Do not interpret
local success as a verified green remote workflow.

Database security tests execute the actual migrations in PGlite/PostgreSQL
with simulated auth roles. Browser cloud/auth/provider traffic is mocked.
No live Supabase, email, AI or SMTP validation is claimed. No merge or Pages
deployment is performed by this fix.
