-- Additive commercial layer. Disabled by default. Apply the reviewed plan seed separately.
create table public.commercial_settings(id boolean primary key default true check(id),enabled boolean not null default false,environment text not null default 'sandbox' check(environment in('sandbox','live')),plans jsonb not null default '{}',ai_input_usd_per_million numeric check(ai_input_usd_per_million>=0),ai_output_usd_per_million numeric check(ai_output_usd_per_million>=0));
insert into public.commercial_settings(id) values(true);
create table public.business_admins(user_id uuid primary key references auth.users(id) on delete cascade);
create table public.commercial_grants(user_id uuid primary key references auth.users(id) on delete cascade,plan text not null check(plan in('pro','premium')),reason text not null,expires_at timestamptz);
-- Preserve existing account features; legacy grants are never counted as paid MRR.
insert into public.commercial_grants(user_id,plan,reason) select id,'pro','Existing Launchpad account before commercial migration' from public.user_profiles;
create table public.billing_customers(user_id uuid unique references auth.users(id) on delete set null,customer_id text primary key,environment text not null check(environment in('sandbox','live')),created_at timestamptz not null default now());
create table public.billing_subscriptions(subscription_id text primary key,user_id uuid references auth.users(id) on delete set null,customer_id text not null references public.billing_customers(customer_id),environment text not null,plan text not null check(plan in('pro','premium')),status text not null check(status in('active','trialing','past_due','paused','canceled')),period_start timestamptz,period_end timestamptz,cancel_at timestamptz,unit_amount integer not null check(unit_amount>=0),currency text not null check(currency='USD'),provider_updated_at timestamptz not null,first_seen_at timestamptz not null default now(),updated_at timestamptz not null default now());
create index on public.billing_subscriptions(user_id);
create table public.billing_events(event_id text primary key,event_type text not null,occurred_at timestamptz not null,received_at timestamptz not null default now(),environment text not null,status text not null default 'received',subscription_id text,details jsonb not null default '{}');
create table public.billing_history(id bigint generated always as identity primary key,event_id text unique references public.billing_events(event_id),subscription_id text,old_status text,new_status text,old_plan text,new_plan text,effective_at timestamptz not null);
create table public.billing_operations(id uuid primary key,user_id uuid not null references auth.users(id) on delete cascade,action text not null,plan text,state text not null default 'pending' check(state in('pending','complete','uncertain','failed')),created_at timestamptz not null default now(),result jsonb);
create index on public.billing_operations(user_id,created_at desc);
create table public.ai_monthly_usage(user_id uuid not null references auth.users(id) on delete cascade,month date not null,requests integer not null default 0 check(requests>=0),primary key(user_id,month));
create table public.ai_token_usage(request_id uuid primary key,user_id uuid references auth.users(id) on delete set null,input_tokens bigint not null check(input_tokens>=0),output_tokens bigint not null check(output_tokens>=0),estimated_usd numeric,model text not null,created_at timestamptz not null default now());
create table public.commercial_activity(user_id uuid primary key references auth.users(id) on delete cascade,last_seen_at timestamptz not null default now());
create table public.early_access(user_id uuid primary key references auth.users(id) on delete cascade,consent_version text not null,created_at timestamptz not null default now());
create table public.conversion_events(user_id uuid not null references auth.users(id) on delete cascade,day date not null default current_date,event text not null check(event in('pricing_viewed')),primary key(user_id,day,event));

-- Browser reads only their own non-secret billing/usage records. All writes use verified services.
do $$ declare t text; begin
 foreach t in array array['commercial_settings','business_admins','commercial_grants','billing_customers','billing_subscriptions','billing_events','billing_history','billing_operations','ai_monthly_usage','ai_token_usage','commercial_activity','early_access','conversion_events'] loop
  execute format('alter table public.%I enable row level security',t);
  execute format('alter table public.%I force row level security',t);
  execute format('revoke all on public.%I from anon,authenticated',t);
  execute format('grant all on public.%I to service_role',t);
 end loop;
 foreach t in array array['commercial_grants','billing_customers','billing_subscriptions','billing_operations','ai_monthly_usage','ai_token_usage','early_access'] loop
  execute format('grant select on public.%I to authenticated',t);
  execute format('create policy own_read on public.%I for select to authenticated using(user_id=(select auth.uid()) and (select public.launchpad_confirmed()))',t);
 end loop;
end $$;
grant usage,select on sequence public.billing_history_id_seq to service_role;

create function public.commercial_entitlement(owner_id uuid) returns jsonb language plpgsql security definer set search_path='' as $$
declare p text='free';s public.billing_subscriptions;g public.commercial_grants;settings public.commercial_settings;used integer=0;
begin
 if auth.role() is distinct from 'service_role' and (owner_id is distinct from auth.uid() or not public.launchpad_confirmed()) then raise exception 'Confirmed owner required';end if;
 select * into settings from public.commercial_settings where id=true;
 select * into s from public.billing_subscriptions where user_id=owner_id and environment=settings.environment and status='active' and period_end>now() order by case plan when 'premium' then 2 else 1 end desc,provider_updated_at desc limit 1;
 select * into g from public.commercial_grants where user_id=owner_id and (expires_at is null or expires_at>now());
 if s.subscription_id is not null then p=s.plan;elsif g.user_id is not null then p=g.plan;end if;
 select requests into used from public.ai_monthly_usage where user_id=owner_id and month=date_trunc('month',now())::date;
 return jsonb_build_object('enabled',settings.enabled,'environment',settings.environment,'plan',p,'legacy',g.user_id is not null,'limits',coalesce(settings.plans->p,'{}'::jsonb),'aiUsed',coalesce(used,0),'aiRemaining',greatest(0,coalesce((settings.plans->p->>'aiMonthly')::integer,0)-coalesce(used,0)),'catalog',settings.plans);
end $$;
grant execute on function public.commercial_entitlement(uuid) to authenticated,service_role;
revoke all on function public.commercial_entitlement(uuid) from public,anon;

create function public.guard_commercial_write() returns trigger language plpgsql security definer set search_path='' as $$
declare u uuid;e jsonb;k text;cap integer;
begin
 if not (select enabled from public.commercial_settings where id=true) then return new;end if;
 if tg_table_name='user_preferences' then u=new.user_id;
 elsif tg_table_name='user_profiles' then return new;
 else u=new.user_id;end if;
 e=public.commercial_entitlement(u);
 -- Existing data remains readable/exportable/deletable. Paid cloud mutations require trusted access.
 if not coalesce((e->'limits'->>'cloud')::boolean,false) then raise exception 'Cloud editing requires Pro or Premium. Existing data can still be exported or deleted.';end if;
 k=case tg_table_name when 'job_applications' then 'applications' when 'favorite_companies' then 'favorites' when 'roadmap_milestones' then 'milestones' end;
 if tg_op='INSERT' and k is not null then
  if tg_table_name='job_applications' then if exists(select 1 from public.job_applications where user_id=u and local_id=new.local_id) then return new;end if;end if;
  if tg_table_name='favorite_companies' then if exists(select 1 from public.favorite_companies where user_id=u and client_id=new.client_id) then return new;end if;end if;
  if tg_table_name='roadmap_milestones' then if exists(select 1 from public.roadmap_milestones where user_id=u and client_id=new.client_id) then return new;end if;end if;
  cap=coalesce((e->'limits'->>k)::integer,0);
  -- Per-owner locking serializes concurrent direct inserts as well as RPC writes.
  perform pg_advisory_xact_lock(hashtextextended(u::text,51));
  if tg_table_name='job_applications' and (select count(*) from public.job_applications where user_id=u)>=cap then raise exception 'Application plan limit reached';end if;
  if tg_table_name='favorite_companies' and (select count(*) from public.favorite_companies where user_id=u)>=cap then raise exception 'Company plan limit reached';end if;
  if tg_table_name='roadmap_milestones' and (select count(*) from public.roadmap_milestones where user_id=u)>=cap then raise exception 'Roadmap plan limit reached';end if;
 end if;
 return new;
end $$;
do $$ declare t text;begin foreach t in array array['job_applications','favorite_companies','career_goals','roadmap_milestones','tasks','roadmap_progress','user_preferences','ai_planning_history'] loop execute format('create trigger commercial_write_guard before insert or update on public.%I for each row execute function public.guard_commercial_write()',t);end loop;end $$;
-- Metadata preferences/profile remain writable for free accounts without opening application mutations.
drop trigger commercial_write_guard on public.user_preferences;

create function public.reserve_billing_operation(operation_id uuid,owner_id uuid,operation text,target_plan text) returns jsonb language plpgsql security definer set search_path='' as $$
declare previous public.billing_operations;
begin
 if auth.role() is distinct from 'service_role' then raise exception 'Service only';end if;
 perform pg_advisory_xact_lock(hashtextextended(owner_id::text,52));
 select * into previous from public.billing_operations where id=operation_id;
 if found then
  if previous.user_id<>owner_id or previous.action<>operation or previous.plan is distinct from target_plan then raise exception 'Request identity mismatch';end if;
  if previous.state='complete' then return jsonb_build_object('cached',true,'result',previous.result);end if;
  raise exception 'This operation is pending or uncertain. Check the billing portal or contact support before retrying.';
 end if;
 if exists(select 1 from public.billing_operations where user_id=owner_id and (state in('pending','uncertain') or created_at>now()-interval '1 minute')) then raise exception 'Another billing operation needs reconciliation or rate-limit recovery';end if;
 insert into public.billing_operations(id,user_id,action,plan) values(operation_id,owner_id,operation,target_plan);
 return jsonb_build_object('cached',false);
end $$;
revoke all on function public.reserve_billing_operation(uuid,uuid,text,text) from public,anon,authenticated;grant execute on function public.reserve_billing_operation(uuid,uuid,text,text) to service_role;

create function public.apply_paddle_snapshot(event jsonb,snapshot jsonb) returns boolean language plpgsql security definer set search_path='' as $$
declare old public.billing_subscriptions;u uuid;inserted integer;
begin
 if auth.role() is distinct from 'service_role' then raise exception 'Service only';end if;
 insert into public.billing_events(event_id,event_type,occurred_at,environment,subscription_id,details) values(event->>'id',event->>'type',(event->>'occurredAt')::timestamptz,event->>'environment',snapshot->>'id',jsonb_build_object('reason',event->>'reason')) on conflict do nothing;
 get diagnostics inserted=row_count;if inserted=0 then return false;end if;
 if event->>'environment' is distinct from (select environment from public.commercial_settings where id=true) then raise exception 'Billing environment mismatch';end if;
 if snapshot is null then update public.billing_events set status='ignored' where event_id=event->>'id';return true;end if;
 select user_id into u from public.billing_customers where customer_id=snapshot->>'customerId' and environment=event->>'environment';
 if u is null then update public.billing_events set status='quarantined',details='{"reason":"Unknown or deleted customer"}' where event_id=event->>'id';return true;end if;
 perform pg_advisory_xact_lock(hashtextextended(u::text,53));
 select * into old from public.billing_subscriptions where subscription_id=snapshot->>'id' for update;
 if old.customer_id is not null and old.customer_id<>snapshot->>'customerId' then raise exception 'Customer identity mismatch';end if;
 if old.provider_updated_at is not null and old.provider_updated_at>=(snapshot->>'updatedAt')::timestamptz then update public.billing_events set status='stale' where event_id=event->>'id';return true;end if;
 insert into public.billing_subscriptions(subscription_id,user_id,customer_id,environment,plan,status,period_start,period_end,cancel_at,unit_amount,currency,provider_updated_at)
 values(snapshot->>'id',u,snapshot->>'customerId',event->>'environment',snapshot->>'plan',snapshot->>'status',(snapshot->>'periodStart')::timestamptz,(snapshot->>'periodEnd')::timestamptz,(snapshot->>'cancelAt')::timestamptz,(snapshot->>'unitAmount')::integer,snapshot->>'currency',(snapshot->>'updatedAt')::timestamptz)
 on conflict(subscription_id) do update set plan=excluded.plan,status=excluded.status,period_start=excluded.period_start,period_end=excluded.period_end,cancel_at=excluded.cancel_at,unit_amount=excluded.unit_amount,currency=excluded.currency,provider_updated_at=excluded.provider_updated_at,updated_at=now();
 insert into public.billing_history(event_id,subscription_id,old_status,new_status,old_plan,new_plan,effective_at) values(event->>'id',snapshot->>'id',old.status,snapshot->>'status',old.plan,snapshot->>'plan',(snapshot->>'updatedAt')::timestamptz);
 update public.billing_events set status='processed' where event_id=event->>'id';return true;
end $$;
revoke all on function public.apply_paddle_snapshot(jsonb,jsonb) from public,anon,authenticated;grant execute on function public.apply_paddle_snapshot(jsonb,jsonb) to service_role;

-- Add monthly subscription credits to the existing atomic daily/platform attempt budget.
alter function public.reserve_ai_usage(uuid) rename to reserve_ai_usage_v4;
create function public.reserve_ai_usage(owner_id uuid) returns integer language plpgsql security definer set search_path='' as $$
declare e jsonb;used integer;cap integer;remaining integer;
begin
 if auth.role() is distinct from 'service_role' then raise exception 'Service only';end if;
 e=public.commercial_entitlement(owner_id);
 if (e->>'enabled')::boolean then
  cap=coalesce((e->'limits'->>'aiMonthly')::integer,0);
  if cap=0 then raise exception 'AI coaching requires an eligible paid plan';end if;
  insert into public.ai_monthly_usage(user_id,month) values(owner_id,date_trunc('month',now())::date) on conflict do nothing;
  select requests into used from public.ai_monthly_usage where user_id=owner_id and month=date_trunc('month',now())::date for update;
  if used>=cap then raise exception 'Monthly AI credit limit reached';end if;
  update public.ai_monthly_usage set requests=requests+1 where user_id=owner_id and month=date_trunc('month',now())::date;
 end if;
 remaining=public.reserve_ai_usage_v4(owner_id);return remaining;
end $$;
revoke all on function public.reserve_ai_usage(uuid),public.reserve_ai_usage_v4(uuid) from public,anon,authenticated;grant execute on function public.reserve_ai_usage(uuid),public.reserve_ai_usage_v4(uuid) to service_role;
-- Prevent bypassing the monthly wrapper through the old function name.
revoke execute on function public.reserve_ai_usage_v4(uuid) from service_role;

create function public.prevent_active_billing_deletion() returns trigger language plpgsql security definer set search_path='' as $$
begin
 if exists(select 1 from public.billing_subscriptions where user_id=old.id and status in('active','trialing','past_due','paused')) then raise exception 'Cancel the subscription immediately in Billing and wait for provider confirmation before deleting the account.';end if;return old;
end $$;
create trigger launchpad_paid_delete_guard before delete on auth.users for each row execute function public.prevent_active_billing_deletion();

create function public.protect_billing_environment() returns trigger language plpgsql set search_path='' as $$begin
 if new.environment<>old.environment and exists(select 1 from public.billing_customers) then raise exception 'Use separate sandbox and production Supabase projects; billing environment cannot change after customer creation';end if;return new;
end $$;
create trigger protect_environment before update on public.commercial_settings for each row execute function public.protect_billing_environment();

create function public.record_commercial_ai_cost(owner_id uuid,request_id uuid,input_tokens bigint,output_tokens bigint,model_name text) returns void language plpgsql security definer set search_path='' as $$
declare s public.commercial_settings;amount numeric;
begin
 if auth.role() is distinct from 'service_role' then raise exception 'Service only';end if;
 if input_tokens<0 or output_tokens<0 or input_tokens>200000 or output_tokens>200000 then raise exception 'Invalid token report';end if;
 select * into s from public.commercial_settings where id=true;
 if s.ai_input_usd_per_million is not null and s.ai_output_usd_per_million is not null then amount=(input_tokens*s.ai_input_usd_per_million+output_tokens*s.ai_output_usd_per_million)/1000000;end if;
 insert into public.ai_token_usage(request_id,user_id,input_tokens,output_tokens,estimated_usd,model) values(request_id,owner_id,input_tokens,output_tokens,amount,left(model_name,100)) on conflict do nothing;
end $$;
revoke all on function public.record_commercial_ai_cost(uuid,uuid,bigint,bigint,text) from public,anon,authenticated;grant execute on function public.record_commercial_ai_cost(uuid,uuid,bigint,bigint,text) to service_role;
create function public.commercial_metrics() returns jsonb language plpgsql security definer set search_path='' as $$
declare cutoff timestamptz=date_trunc('month',now());env text;base_count integer;lost_count integer;result jsonb;
begin
 if auth.role() is distinct from 'service_role' then raise exception 'Service only';end if;
 select environment into env from public.commercial_settings where id=true;
 with last_state as(select distinct on(h.subscription_id) h.subscription_id,h.new_status from public.billing_history h join public.billing_subscriptions s using(subscription_id) where s.environment=env and h.effective_at<cutoff order by h.subscription_id,h.effective_at desc)
 select count(*),count(*) filter(where exists(select 1 from public.billing_history h where h.subscription_id=last_state.subscription_id and h.new_status='canceled' and h.effective_at>=cutoff)) into base_count,lost_count from last_state where new_status='active';
 select jsonb_build_object(
 'environment',env,'currency','USD','registeredAccounts',(select count(*) from auth.users),
 'activeFreeObserved30d',(select count(*) from public.commercial_activity a where a.last_seen_at>now()-interval '30 days' and public.commercial_entitlement(a.user_id)->>'plan'='free'),
 'activeSubscribers',(select count(*) from public.billing_subscriptions where environment=env and status='active' and period_end>now()),
 'contractMrrCents',(select coalesce(sum(unit_amount),0) from public.billing_subscriptions where environment=env and status='active' and period_end>now()),
 'cancellationsThisMonth',(select count(*) from public.billing_events where environment=env and event_type='subscription.canceled' and occurred_at>=cutoff),
 'paymentFailuresThisMonth',(select count(*) from public.billing_events where environment=env and event_type='transaction.payment_failed' and occurred_at>=cutoff),
 'upgradesThisMonth',(select count(*) from public.billing_history where old_plan='pro' and new_plan='premium' and effective_at>=cutoff),
 'churnPercent',case when base_count>0 then round(100.0*lost_count/base_count,2) else null end,
 'churnBaselineSubscriptions',base_count,
 'aiAttemptsThisMonth',(select coalesce(sum(requests),0) from public.ai_monthly_usage where month=cutoff::date),
 'aiTokenReportsThisMonth',(select count(*) from public.ai_token_usage where created_at>=cutoff),
 'estimatedAiUsd',(select case when count(*)=0 or count(*) filter(where estimated_usd is null)>0 then null else sum(estimated_usd) end from public.ai_token_usage where created_at>=cutoff),
 'earlyAccessOptIns',(select count(*) from public.early_access),
 'consentedPricingAccountsThisMonth',(select count(distinct user_id) from public.conversion_events where day>=cutoff::date),
 'checkoutOperationsThisMonth',(select count(*) from public.billing_operations where action='checkout' and state='complete' and created_at>=cutoff),
 'uncertainOperations',(select count(*) from public.billing_operations where state in('pending','uncertain')),
 'usageContributionMarginPercent',null,
 'notes','MRR is monthly contracted USD before tax/discounts, not cash revenue. Legacy grants are excluded. Sandbox figures are test data. Churn needs a prior-month baseline. AI costs require configured rates and complete reports. Gross margin is unavailable until hosting, provider fees and other operating costs are reconciled.'
 ) into result;return result;
end $$;
revoke all on function public.commercial_metrics() from public,anon,authenticated;grant execute on function public.commercial_metrics() to service_role;

-- Free accounts may edit profile/preferences without rewriting frozen cloud collections.
alter function public.commit_workspace(jsonb,bigint,uuid) rename to commit_workspace_v4;
create function public.commit_workspace(payload jsonb,expected_revision bigint,expected_owner uuid) returns bigint language plpgsql security invoker set search_path='' as $$
declare e jsonb;current_data jsonb;k text;r bigint;u uuid=auth.uid();
begin
 if not public.launchpad_confirmed() then raise exception 'Confirmed authentication required';end if;
 if expected_owner is distinct from u then raise exception 'Account changed before saving';end if;
 e=public.commercial_entitlement(u);
 if not (e->>'enabled')::boolean or coalesce((e->'limits'->>'cloud')::boolean,false) then return public.commit_workspace_v4(payload,expected_revision,expected_owner);end if;
 if jsonb_typeof(payload) is distinct from 'object' or octet_length(payload::text)>2000000 or jsonb_typeof(payload->'profile') is distinct from 'object' or jsonb_typeof(payload->'preferences') is distinct from 'object' then raise exception 'Invalid settings';end if;
 insert into public.user_preferences(user_id) values(u) on conflict do nothing;
 select revision into r from public.user_preferences where user_id=u for update;
 if expected_revision is distinct from r then raise exception 'Workspace changed in another tab' using errcode='40001';end if;
 current_data=public.load_workspace();
 foreach k in array array['applications','completed','companies','goals','milestones','tasks'] loop
  if payload->k is distinct from current_data->k then raise exception 'Cloud editing requires Pro or Premium. Export or delete existing records freely.';end if;
 end loop;
 update public.user_profiles set display_name=left(coalesce(payload->'profile'->>'display_name',''),100),age_band=nullif(payload->'profile'->>'age_band',''),detail=payload->'profile' where id=u;
 update public.user_preferences set data=payload->'preferences',revision=revision+1 where user_id=u returning revision into r;
 return r;
end $$;
revoke all on function public.commit_workspace(jsonb,bigint,uuid) from public,anon;grant execute on function public.commit_workspace(jsonb,bigint,uuid) to authenticated;

create table public.operating_costs(month date primary key,hosting_usd numeric not null check(hosting_usd>=0),email_usd numeric not null check(email_usd>=0),payment_fees_usd numeric not null check(payment_fees_usd>=0),other_usd numeric not null check(other_usd>=0),source_notes text not null check(char_length(source_notes) between 1 and 1000));
alter table public.operating_costs enable row level security;alter table public.operating_costs force row level security;revoke all on public.operating_costs from public,anon,authenticated;grant all on public.operating_costs to service_role;
alter function public.commercial_metrics() rename to commercial_metrics_base;
create function public.commercial_metrics() returns jsonb language plpgsql security definer set search_path='' as $$
declare r jsonb;c numeric;a numeric;m numeric;
begin
 if auth.role() is distinct from 'service_role' then raise exception 'Service only';end if;
 r=public.commercial_metrics_base();
 select hosting_usd+email_usd+payment_fees_usd+other_usd into c from public.operating_costs where month=date_trunc('month',now())::date;
 a=case when (r->>'aiAttemptsThisMonth')::integer=0 then 0 else (r->>'estimatedAiUsd')::numeric end;
 m=(r->>'contractMrrCents')::numeric/100;
 return r||jsonb_build_object('operatingCostsUsd',c,'usageContributionMarginPercent',case when m>0 and c is not null and a is not null and (r->>'aiTokenReportsThisMonth')::integer>=(r->>'aiAttemptsThisMonth')::integer then round(100*(m-c-a)/m,2) else null end,'marginBasis','Current contracted MRR versus operator-entered monthly costs and observed estimated AI usage. Directional estimate, not accounting profit or reconciled revenue.');
end $$;
revoke all on function public.commercial_metrics(),public.commercial_metrics_base() from public,anon,authenticated;grant execute on function public.commercial_metrics() to service_role;
