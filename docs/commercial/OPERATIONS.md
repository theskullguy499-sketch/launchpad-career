# Billing operations, monitoring and recovery

The operator must own this runbook before customers pay. No monitoring service,
backup plan, mail transport or incident response staffing was activated here.

## Daily checks and alerts

- Supabase Auth/email delivery errors, rate limits and age/onboarding failures.
- Paddle notification failures/non-200 responses and signature failures. Webhook
  failures retry; do not acknowledge invalid signatures or grant browser success.
- `billing_events` with quarantined records (unknown customer or incomplete authorized transaction/terms), `billing_operations` pending/uncertain,
  active records with expired periods and duplicate active subscriptions.
- AI monthly/daily/platform limits, token-report coverage, unknown costs, provider
  error rates and actual provider spend alerts. Failed attempts consume credits;
  actual failed-provider charges can be unknown until invoice reconciliation.
- Remotive refresh failures/cache age; no fallback fake vacancies.
- Support inbox, cancellation requests and privacy/data-subject requests.

Use platform alert destinations configured by the owner. Redact emails, Auth
links/tokens, portal-session URLs and all secrets from tickets/logs. Financial
metrics use verified provider records; sandbox numbers are test records.

## Reconcile an uncertain operation

1. Pause **new checkout** with `BILLING_CHECKOUT_ENABLED=false`; leave database
   commercial enforcement enabled. Portal/cancel operations remain available.
2. Find the owned operation/customer/subscription/transaction in the DB and Paddle
   dashboard/API. Check actual provider state, receipts, notifications and the
   intended plan. Never blindly repeat a transaction or change provider IDs.
3. Replay the genuine notification through Paddle after fixing configuration.
   The handler fetches canonical provider data, not browser-supplied state.
   New subscriptions require a server-authorized checkout and versioned consent;
   subscription-only events may wait for the corresponding transaction event.
4. A verified matching snapshot can resolve pending/uncertain intended changes.
   Exact transaction/subscription binding is kept even when the snapshot is stale,
   and completion merges existing reconciliation fields rather than overwriting
   them. Unmatched or transport-lost operations still require operator review.
5. If a transaction was definitively canceled, record that evidence and mark its
   operation failed through an owner-controlled SQL change. If completed, retain
   its IDs and provider-confirmed subscription association. Do not mark completed
   without provider evidence or manually invent a payment event.
6. Preserve an audit note referencing the provider receipt/delivery and operator.
   Recheck the account via publishable credentials, then resume checkout after
   approval. Do not delete the event ledger to make a failed test pass.

Quarantined event IDs are acknowledged as received, not as access activation.
After resolving a quarantined mapping/terms issue, owner-controlled reconciliation
must use fresh verified provider data; merely replaying an already-recorded ID
is idempotent. Keep the original receipt and document any manual correction.
No customer-facing automatic refund or arbitrary admin entitlement editor is
provided; refund decisions belong to the reviewed policy and Paddle operator tools.

## Cancellation and deletion

- Period-end cancellation retains valid access until the provider period ends.
- Immediate cancellation for deletion must be provider-confirmed first.
- past_due, paused, expired or canceled records do not authorize new paid writes
  or AI. Existing career records stay readable/exportable/deletable.
- Active subscriptions, unconfirmed checkouts and unresolved operations block
  account deletion to avoid orphaned recurring charges. Explain the blocking
  reason and assist through support/portal; do not work around the DB trigger.
- Normal deletion removes career/profile/AI history records and retains guest
  local data. Minimal customer/subscription/event/consent identifiers may remain
  under a finalized lawful financial retention schedule. Paddle may independently
  retain invoices. Do not promise total financial erasure.

## Backups, restore and rollback

Before migrations/releases, export guest JSON on the original origin and take a
project-owner database backup/snapshot. Confirm what the chosen Supabase plan
actually includes (PITR is not assumed). Encrypt backups, restrict access, define
retention and rehearse restoration in a separate disposable project. Preserve
Auth user IDs and provider/environment mappings during restoration.

For incident rollback, pause new checkout, retain signed-event/operation records,
restore the previous verified frontend artifact and keep additive SQL ownership
and billing guards in place. Do not downgrade/drop billing tables or reapply old
migrations. Review in-flight provider operations before retrying. Renew webhook
secrets/API keys via provider secret managers; never paste them into GitHub.

## Cost worksheet — no invented operating costs

- Current contracted MRR: sum active, unexpired provider monthly USD base prices.
  It excludes legacy grants and is before tax/discounts, not settled cash revenue.
- Estimated AI cost: actual reported input/output tokens multiplied by the
  operator's verified model rates. Unknown rates/reports stay unknown.
- Populate `operating_costs` for the UTC month with real hosting, email, payment
  fees and other invoices plus `source_notes`. Fields are service/operator-only.
- The dashboard's directional contribution estimate compares current contract
  MRR with entered monthly costs and observed AI estimates. It is not accounting
  gross profit, valuation or a revenue guarantee; missing inputs display N/A.
- Supabase, Cloudflare, Paddle, SMTP/Resend, OpenAI, domain and legal/support costs
  depend on the actual account tier, country, usage and vendor contract. None has
  been quoted or incurred by this task. Review current provider pricing and
  configure spending alerts before any live launch.

## Stripe as a future alternative

Do not operate two billing systems now. A later Stripe adapter would need its
own server checkout/portal, signature verifier, price mappings and normalized
snapshot processing against the same ownership/ledger invariants. Migration of
customers/payment methods is a provider/legal project; do not copy card data or
assume Paddle merchant accounts can be transferred without approval.

## Recording real operating costs

As project owner, insert/update `public.operating_costs` for the first day of the
actual UTC reporting month. Required USD fields are `hosting_usd`, `email_usd`,
`payment_fees_usd`, `other_usd`, plus `source_notes` identifying actual invoices or
approved cost records. Do not use proposed vendor list prices as actual costs.
Set the two model token rates in `commercial_settings` from the actual provider
contract. Keep unknown inputs absent: the dashboard must show unavailable margin
rather than manufactured zero costs. Contract MRR is a base-price indicator,
not settled revenue, net revenue, or accounting profit.
