# Paddle sandbox simulator event handling

## Cause and correction

The webhook envelope previously required `event_id` to start with `evt_`.
Paddle simulator notifications use `ntfsimevt_`, so even a correctly signed
simulator delivery returned HTTP 400 `Invalid event`.

The handler still verifies the original request body with `Paddle-Signature`
before parsing or accepting any event. Timestamp tolerance, body limits and
HMAC verification are unchanged. A valid simulator envelope is acknowledged
only when the server explicitly sets `PADDLE_ENVIRONMENT=sandbox`:

```json
{"received":true,"simulated":true,"processed":false}
```

HTTP 200 means receipt only. Simulations return before creating a Supabase client,
reading/writing the ledger, calling Paddle or invoking entitlement RPCs. Duplicate
simulations are also harmless acknowledgements; no payment event is recorded.
Production (`live`), invalid or unspecified environments reject simulations with
HTTP 400. Missing, expired, future-dated, malformed or tampered signatures return
HTTP 401. Signed malformed envelopes return HTTP 400.

Actual `evt_` deliveries retain the existing canonical provider lookup, atomic
snapshot processing, deduplication and account entitlement checks. No credentials,
SQL migrations, prices, live-charge flags or customer data were changed.

## Verification

Automated fixtures calculate real HMAC signatures using a non-production test
secret and a fixed clock. They exercise both activated-subscription and completed-
transaction simulator envelopes, repeated deliveries, invalid signatures/body
changes/timestamps, malformed envelopes and production rejection. A sentinel
throws on any attempted database or provider access for accepted simulations.
The existing real-event test verifies canonical provider retrieval and one-time
`apply_paddle_snapshot` processing. These are deterministic local tests, not a
claim that Paddle's hosted simulator has delivered a notification successfully.

Executed checks:

- `npm run build:check`: passed.
- `npm run test:backend`: 28 passed; all six function bundles validated.
- `npm run test:db`: all three PostgreSQL/PGlite security suites passed.
- `CI=true CHROMIUM_PATH=/usr/bin/chromium npm test`: passed, 114 tests/test-file suites (68 source Playwright, 12 built-artifact Playwright, 28 backend, 3 PostgreSQL/PGlite, 3 build/configuration), zero skipped. Node 24.19.0 and system Chromium 154; local evidence, not hosted CI.

## Applying the correction

Review/merge the fix into the intended Launchpad 5.0 branch before deploying the
reviewed `paddle-webhook` function through the existing Supabase deployment process.
This task does not deploy it automatically. In the intended sandbox project,
verify the existing notification signing secret and `PADDLE_ENVIRONMENT=sandbox`
in the function's secret manager without copying either into source or tickets.
Send a simulator event and confirm the acknowledgement above plus no subscription,
payment ledger or entitlement mutation. Then separately test actual sandbox
checkout notifications (`evt_`); a simulator receipt does not prove a purchase.
Do not enable live billing as part of this correction.
