-- Launchpad 4.0 additive migration. Apply after 202610270001_launchpad.sql.
begin;
alter table public.job_applications drop constraint job_applications_status_check;
alter table public.job_applications add constraint job_applications_status_check check(status in ('Saved','Applied','Interview','Offer','Hired','Rejected','Withdrawn'));
alter table public.job_applications add column detail jsonb not null default '{}' check(jsonb_typeof(detail)='object');
alter table public.user_profiles add column detail jsonb not null default '{}' check(jsonb_typeof(detail)='object');
alter table public.user_profiles add column age_band text check(age_band in ('16-17','18+'));
alter table public.tasks add column client_id text;
update public.tasks set client_id=id::text where client_id is null;
alter table public.tasks alter column client_id set not null;
alter table public.tasks add unique(user_id,client_id);
alter table public.tasks add column detail jsonb not null default '{}' check(jsonb_typeof(detail)='object');
create table public.user_preferences(user_id uuid primary key default auth.uid() references auth.users(id) on delete cascade,data jsonb not null default '{}' check(jsonb_typeof(data)='object'),revision bigint not null default 0);
create table public.favorite_companies(id uuid primary key default gen_random_uuid(),user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,client_id text not null check(char_length(client_id) between 1 and 200),data jsonb not null check(jsonb_typeof(data)='object' and octet_length(data::text)<=50000),created_at timestamptz not null default now(),unique(user_id,client_id));
create index favorite_companies_owner on public.favorite_companies(user_id,created_at);
create table public.career_goals(id uuid primary key default gen_random_uuid(),user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,client_id text not null check(char_length(client_id) between 1 and 200),data jsonb not null check(jsonb_typeof(data)='object' and octet_length(data::text)<=50000),created_at timestamptz not null default now(),unique(user_id,client_id));
create index career_goals_owner on public.career_goals(user_id,created_at);
create table public.roadmap_milestones(id uuid primary key default gen_random_uuid(),user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,client_id text not null check(char_length(client_id) between 1 and 200),data jsonb not null check(jsonb_typeof(data)='object' and octet_length(data::text)<=50000),created_at timestamptz not null default now(),unique(user_id,client_id));
create index roadmap_milestones_owner on public.roadmap_milestones(user_id,created_at);
create table public.ai_planning_history(id uuid primary key default gen_random_uuid(),user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,client_id text not null check(char_length(client_id) between 1 and 200),data jsonb not null check(jsonb_typeof(data)='object' and octet_length(data::text)<=50000),created_at timestamptz not null default now(),unique(user_id,client_id));
create index ai_planning_history_owner on public.ai_planning_history(user_id,created_at);
create table public.notifications(id uuid primary key default gen_random_uuid(),user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,client_id text not null check(char_length(client_id) between 1 and 200),data jsonb not null check(jsonb_typeof(data)='object' and octet_length(data::text)<=50000),created_at timestamptz not null default now(),unique(user_id,client_id));
create index notifications_owner on public.notifications(user_id,created_at);
create table public.feedback(id uuid primary key default gen_random_uuid(),user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,client_id text not null check(char_length(client_id) between 1 and 200),data jsonb not null check(jsonb_typeof(data)='object' and octet_length(data::text)<=50000),created_at timestamptz not null default now(),unique(user_id,client_id));
create index feedback_owner on public.feedback(user_id,created_at);
alter table public.user_preferences enable row level security;alter table public.user_preferences force row level security;
revoke all on public.user_preferences from public,anon,authenticated;
grant select,insert,update,delete on public.user_preferences to authenticated;
create policy user_preferences_own on public.user_preferences for all to authenticated using(user_id=(select auth.uid()) and (select public.launchpad_confirmed())) with check(user_id=(select auth.uid()) and (select public.launchpad_confirmed()));
alter table public.favorite_companies enable row level security;alter table public.favorite_companies force row level security;
revoke all on public.favorite_companies from public,anon,authenticated;
grant select,insert,update,delete on public.favorite_companies to authenticated;
create policy favorite_companies_own on public.favorite_companies for all to authenticated using(user_id=(select auth.uid()) and (select public.launchpad_confirmed())) with check(user_id=(select auth.uid()) and (select public.launchpad_confirmed()));
alter table public.career_goals enable row level security;alter table public.career_goals force row level security;
revoke all on public.career_goals from public,anon,authenticated;
grant select,insert,update,delete on public.career_goals to authenticated;
create policy career_goals_own on public.career_goals for all to authenticated using(user_id=(select auth.uid()) and (select public.launchpad_confirmed())) with check(user_id=(select auth.uid()) and (select public.launchpad_confirmed()));
alter table public.roadmap_milestones enable row level security;alter table public.roadmap_milestones force row level security;
revoke all on public.roadmap_milestones from public,anon,authenticated;
grant select,insert,update,delete on public.roadmap_milestones to authenticated;
create policy roadmap_milestones_own on public.roadmap_milestones for all to authenticated using(user_id=(select auth.uid()) and (select public.launchpad_confirmed())) with check(user_id=(select auth.uid()) and (select public.launchpad_confirmed()));
alter table public.ai_planning_history enable row level security;alter table public.ai_planning_history force row level security;
revoke all on public.ai_planning_history from public,anon,authenticated;
grant select,insert,update,delete on public.ai_planning_history to authenticated;
create policy ai_planning_history_own on public.ai_planning_history for all to authenticated using(user_id=(select auth.uid()) and (select public.launchpad_confirmed())) with check(user_id=(select auth.uid()) and (select public.launchpad_confirmed()));
alter table public.notifications enable row level security;alter table public.notifications force row level security;
revoke all on public.notifications from public,anon,authenticated;
grant select,insert,update,delete on public.notifications to authenticated;
create policy notifications_own on public.notifications for all to authenticated using(user_id=(select auth.uid()) and (select public.launchpad_confirmed())) with check(user_id=(select auth.uid()) and (select public.launchpad_confirmed()));
alter table public.feedback enable row level security;alter table public.feedback force row level security;
revoke all on public.feedback from public,anon,authenticated;
grant select,insert,update,delete on public.feedback to authenticated;
create policy feedback_own on public.feedback for all to authenticated using(user_id=(select auth.uid()) and (select public.launchpad_confirmed())) with check(user_id=(select auth.uid()) and (select public.launchpad_confirmed()));

alter table public.favorite_companies add constraint company_name_valid check(data ? 'name' and jsonb_typeof(data->'name')='string' and char_length(btrim(data->>'name')) between 1 and 80);
alter table public.career_goals add constraint goal_title_valid check(data ? 'title' and jsonb_typeof(data->'title')='string' and char_length(btrim(data->>'title')) between 1 and 160);
alter table public.roadmap_milestones add constraint milestone_title_valid check(data ? 'title' and jsonb_typeof(data->'title')='string' and char_length(btrim(data->>'title')) between 1 and 200);
alter table public.feedback add constraint feedback_message_valid check(data ? 'message' and jsonb_typeof(data->'message')='string' and char_length(btrim(data->>'message')) between 1 and 3000);

-- Backend-only budgets and shared provider cache. No browser grants or policies.
create table public.service_usage(user_id uuid not null references auth.users(id) on delete cascade,service text not null,day date not null default current_date,requests integer not null default 0,primary key(user_id,service,day));
create table public.ai_global_usage(day date primary key default current_date,requests integer not null default 0);
alter table public.ai_global_usage enable row level security;alter table public.ai_global_usage force row level security;revoke all on public.ai_global_usage from public,anon,authenticated;grant all on public.ai_global_usage to service_role;
create table public.provider_cache(provider text primary key,payload jsonb,fetched_at timestamptz,lease_until timestamptz,day date not null default current_date,requests integer not null default 0);
alter table public.service_usage enable row level security;alter table public.service_usage force row level security;
alter table public.provider_cache enable row level security;alter table public.provider_cache force row level security;
revoke all on public.service_usage,public.provider_cache from public,anon,authenticated;
grant all on public.service_usage,public.provider_cache to service_role;
grant all on public.job_applications,public.tasks,public.roadmap_progress,public.user_profiles,public.user_preferences,public.favorite_companies,public.career_goals,public.roadmap_milestones,public.ai_planning_history,public.notifications,public.feedback to service_role;

create function public.load_workspace() returns jsonb language plpgsql security invoker set search_path='' as $$
declare u uuid=auth.uid();result jsonb;
begin
 if not public.launchpad_confirmed() then raise exception 'Confirmed authentication required';end if;
 result=jsonb_build_object(
 'applications',coalesce((select jsonb_agg(a.detail||jsonb_build_object('id',coalesce(a.local_id,a.id::text),'company',a.company,'role',a.role,'country',a.country,'status',a.status,'deadline',coalesce(a.deadline::text,''),'url',a.url,'notes',a.notes,'createdAt',a.created_at)) from public.job_applications a where user_id=u),'[]'::jsonb),
 'completed',coalesce((select jsonb_agg(milestone_key::integer) from public.roadmap_progress where user_id=u and completed and milestone_key~'^[0-5]$'),'[]'::jsonb),
 'companies',coalesce((select jsonb_agg(data||jsonb_build_object('id',client_id)) from public.favorite_companies where user_id=u),'[]'::jsonb),
 'goals',coalesce((select jsonb_agg(data||jsonb_build_object('id',client_id)) from public.career_goals where user_id=u),'[]'::jsonb),
 'milestones',coalesce((select jsonb_agg(data||jsonb_build_object('id',client_id)) from public.roadmap_milestones where user_id=u),'[]'::jsonb),
 'tasks',coalesce((select jsonb_agg(detail||jsonb_build_object('id',client_id,'title',title,'notes',description,'completed',completed,'dueDate',coalesce(due_date::text,''))) from public.tasks where user_id=u),'[]'::jsonb),
 'profile',coalesce((select detail||jsonb_build_object('display_name',display_name,'age_band',coalesce(age_band,'')) from public.user_profiles where id=u),'{}'::jsonb),
 'preferences',coalesce((select data from public.user_preferences where user_id=u),'{}'::jsonb),
 'revision',coalesce((select revision from public.user_preferences where user_id=u),0),
 'aiHistory',coalesce((select jsonb_agg(data||jsonb_build_object('id',client_id)) from(select data,client_id from public.ai_planning_history where user_id=u order by created_at desc limit 20) h),'[]'::jsonb),
 'notifications',coalesce((select jsonb_agg(data||jsonb_build_object('id',client_id)) from(select data,client_id from public.notifications where user_id=u order by created_at desc limit 100) n),'[]'::jsonb));
 return result;
end $$;

create function public.commit_workspace(payload jsonb,expected_revision bigint,expected_owner uuid) returns bigint language plpgsql security invoker set search_path='' as $$
declare u uuid=auth.uid();current_revision bigint;a jsonb;t text;k text;item jsonb;next_revision bigint;
begin
 if not public.launchpad_confirmed() then raise exception 'Confirmed authentication required';end if;
 if expected_owner is distinct from u then raise exception 'Account changed. Reload before saving.';end if;
 if jsonb_typeof(payload) is distinct from 'object' or octet_length(payload::text)>2000000 then raise exception 'Invalid workspace';end if;
 foreach k in array array['applications','completed','companies','goals','milestones','tasks'] loop
  if jsonb_typeof(payload->k) is distinct from 'array' then raise exception 'Invalid collection';end if;
  if jsonb_array_length(payload->k)>1000 then raise exception 'Collection limit exceeded';end if;
 end loop;
 if jsonb_typeof(payload->'profile') is distinct from 'object' or jsonb_typeof(payload->'preferences') is distinct from 'object' then raise exception 'Invalid settings';end if;
 perform set_config('launchpad.workspace_commit','on',true);
 insert into public.user_preferences(user_id) values(u) on conflict(user_id) do nothing;
 select revision into current_revision from public.user_preferences where user_id=u for update;
 if expected_revision is null or expected_revision<>current_revision then raise exception 'Workspace changed in another tab. Reload before saving.' using errcode='40001';end if;
 for a in select value from jsonb_array_elements(payload->'applications') loop
  if nullif(a->>'id','') is null then raise exception 'Application ID required';end if;
  insert into public.job_applications(user_id,local_id,company,role,country,status,deadline,url,notes,created_at,detail)
  values(u,a->>'id',a->>'company',a->>'role',a->>'country',a->>'status',nullif(a->>'deadline','')::date,coalesce(a->>'url',''),coalesce(a->>'notes',''),coalesce(nullif(a->>'createdAt','')::timestamptz,now()),a)
  on conflict(user_id,local_id) do update set company=excluded.company,role=excluded.role,country=excluded.country,status=excluded.status,deadline=excluded.deadline,url=excluded.url,notes=excluded.notes,detail=excluded.detail;
 end loop;
 for a in select value from jsonb_array_elements(payload->'tasks') loop
  if nullif(a->>'id','') is null then raise exception 'Task ID required';end if;
  insert into public.tasks(user_id,client_id,title,description,completed,due_date,detail)
  values(u,a->>'id',a->>'title',coalesce(a->>'notes',''),coalesce((a->>'completed')::boolean,false),nullif(a->>'dueDate','')::date,a)
  on conflict(user_id,client_id) do update set title=excluded.title,description=excluded.description,completed=excluded.completed,due_date=excluded.due_date,detail=excluded.detail,application_id=null;
 end loop;
 delete from public.tasks where user_id=u and client_id not in(select value->>'id' from jsonb_array_elements(payload->'tasks'));
 delete from public.job_applications where user_id=u and coalesce(local_id,id::text) not in(select value->>'id' from jsonb_array_elements(payload->'applications'));
 for t,k in select * from(values('favorite_companies','companies'),('career_goals','goals'),('roadmap_milestones','milestones')) as collections(table_name,json_key) loop
  for item in select value from jsonb_array_elements(payload->k) loop
   if nullif(item->>'id','') is null then raise exception 'Item ID required';end if;
   execute format('insert into public.%I(user_id,client_id,data) values($1,$2,$3) on conflict(user_id,client_id) do update set data=excluded.data',t) using u,item->>'id',item;
  end loop;
  execute format('delete from public.%I where user_id=$1 and client_id not in(select value->>''id'' from jsonb_array_elements($2))',t) using u,payload->k;
 end loop;
 delete from public.roadmap_progress where user_id=u;
 for a in select value from jsonb_array_elements(payload->'completed') loop
  if a::text !~ '^[0-5]$' then raise exception 'Invalid legacy milestone';end if;
  insert into public.roadmap_progress(user_id,milestone_key,completed) values(u,a::text,true) on conflict(user_id,milestone_key) do nothing;
 end loop;
 insert into public.user_profiles(id) values(u) on conflict(id) do nothing;
 update public.user_profiles set display_name=coalesce(payload->'profile'->>'display_name',''),age_band=nullif(payload->'profile'->>'age_band',''),detail=payload->'profile' where id=u;
 next_revision=current_revision+1;
 update public.user_preferences set data=payload->'preferences',revision=next_revision where user_id=u;
 perform set_config('launchpad.workspace_commit','off',true);
 return next_revision;
end $$;

create function public.launchpad_merge_items(existing jsonb,incoming jsonb) returns jsonb language sql immutable set search_path='' as $$
 select coalesce(jsonb_agg(item),'[]'::jsonb) from(select distinct on(item->>'id') item from jsonb_array_elements(existing||incoming) with ordinality as e(item,ord) order by item->>'id',ord) q;
$$;
create function public.import_guest_workspace(guest jsonb,expected_user uuid) returns bigint language plpgsql security invoker set search_path='' as $$
declare current_data jsonb;merged jsonb;k text;
begin
 if expected_user is distinct from auth.uid() then raise exception 'Account changed. Confirm the import again.';end if;
 current_data=public.load_workspace();merged=current_data;
 foreach k in array array['applications','companies','goals','milestones','tasks'] loop
  if jsonb_typeof(guest->k) is distinct from 'array' then raise exception 'Invalid import';end if;
  merged=jsonb_set(merged,array[k],public.launchpad_merge_items(current_data->k,guest->k));
 end loop;
 merged=jsonb_set(merged,'{completed}',(select coalesce(jsonb_agg(value),'[]'::jsonb) from(select distinct value from jsonb_array_elements((current_data->'completed')||(guest->'completed'))) x));
 return public.commit_workspace(merged,(current_data->>'revision')::bigint,auth.uid());
end $$;
revoke all on function public.load_workspace(),public.commit_workspace(jsonb,bigint,uuid),public.import_guest_workspace(jsonb,uuid),public.launchpad_merge_items(jsonb,jsonb) from public,anon;
grant execute on function public.load_workspace(),public.commit_workspace(jsonb,bigint,uuid),public.import_guest_workspace(jsonb,uuid),public.launchpad_merge_items(jsonb,jsonb) to authenticated;

-- Legacy/direct owned writes must invalidate v4 snapshots too, preventing stale replacement.
create function public.launchpad_touch_revision() returns trigger language plpgsql security definer set search_path='' as $$
declare u uuid;
begin
 if current_setting('launchpad.workspace_commit',true)='on' then return coalesce(new,old);end if;
 if tg_table_name='user_profiles' then u=coalesce(new.id,old.id);else u=coalesce(new.user_id,old.user_id);end if;
 if exists(select 1 from auth.users where id=u) then
 insert into public.user_preferences(user_id,revision) values(u,1) on conflict(user_id) do update set revision=public.user_preferences.revision+1;
 end if;
 return coalesce(new,old);
end $$;
revoke all on function public.launchpad_touch_revision() from public,anon,authenticated;
create trigger workspace_application_revision after insert or update or delete on public.job_applications for each row execute function public.launchpad_touch_revision();
create trigger workspace_task_revision after insert or update or delete on public.tasks for each row execute function public.launchpad_touch_revision();
create trigger workspace_profile_revision after insert or update or delete on public.user_profiles for each row execute function public.launchpad_touch_revision();
create trigger workspace_company_revision after insert or update or delete on public.favorite_companies for each row execute function public.launchpad_touch_revision();
create trigger workspace_goal_revision after insert or update or delete on public.career_goals for each row execute function public.launchpad_touch_revision();
create trigger workspace_milestone_revision after insert or update or delete on public.roadmap_milestones for each row execute function public.launchpad_touch_revision();
create trigger workspace_legacy_roadmap_revision after insert or update or delete on public.roadmap_progress for each row execute function public.launchpad_touch_revision();

-- Only a server service role may reserve cost budgets. A failed provider call still consumes one attempt.
create function public.reserve_ai_usage(owner_id uuid) returns integer language plpgsql security definer set search_path='' as $$
declare n integer;
begin
 if not exists(select 1 from auth.users where id=owner_id and email_confirmed_at is not null) or not exists(select 1 from public.user_profiles where id=owner_id and age_band in('16-17','18+')) then raise exception 'Complete age-appropriate onboarding first';end if;
 insert into public.ai_global_usage(day,requests) values(current_date,1) on conflict(day) do update set requests=public.ai_global_usage.requests+1 where public.ai_global_usage.requests<100 returning requests into n;
 if n is null then raise exception 'Daily platform AI capacity reached';end if;
 insert into public.service_usage(user_id,service,day,requests) values(owner_id,'ai',current_date,1)
 on conflict(user_id,service,day) do update set requests=public.service_usage.requests+1 where public.service_usage.requests<10 returning requests into n;
 if n is null then raise exception 'Daily AI limit reached';end if;return n;
end $$;
create function public.reserve_job_refresh() returns boolean language plpgsql security definer set search_path='' as $$
declare result boolean;
begin
 insert into public.provider_cache(provider) values('remotive') on conflict do nothing;
 update public.provider_cache set day=current_date,requests=case when day=current_date then requests+1 else 1 end,lease_until=now()+interval '1 minute'
 where provider='remotive' and (lease_until is null or lease_until<now()) and (fetched_at is null or fetched_at<now()-interval '6 hours') and (day<>current_date or requests<4) returning true into result;
 return coalesce(result,false);
end $$;
revoke all on function public.reserve_ai_usage(uuid),public.reserve_job_refresh() from public,anon,authenticated;
grant execute on function public.reserve_ai_usage(uuid),public.reserve_job_refresh() to service_role;

-- Server-only daily email outbox: at most one digest per user/day, at most three attempts.
create table public.reminder_outbox(id uuid primary key default gen_random_uuid(),user_id uuid not null references auth.users(id) on delete cascade,day date not null default current_date,payload jsonb not null,status text not null default 'pending' check(status in('pending','processing','sent','failed')),attempts integer not null default 0,next_attempt_at timestamptz not null default now(),unique(user_id,day));
alter table public.reminder_outbox enable row level security;alter table public.reminder_outbox force row level security;
revoke all on public.reminder_outbox from public,anon,authenticated;grant all on public.reminder_outbox to service_role;
create function public.claim_reminder_emails() returns setof public.reminder_outbox language sql security definer set search_path='' as $$
 update public.reminder_outbox o set status='processing',attempts=o.attempts+1,next_attempt_at=now()+interval '15 minutes'
 where o.id in(select id from public.reminder_outbox where status in('pending','processing') and attempts<3 and next_attempt_at<=now() and day>=current_date-1 order by next_attempt_at limit 25 for update skip locked) returning o.*;
$$;
revoke all on function public.claim_reminder_emails() from public,anon,authenticated;grant execute on function public.claim_reminder_emails() to service_role;

-- Optional Before User Created hook: enable explicitly in Auth → Hooks. No exact birth date is collected.
create function public.launchpad_before_user_created(event jsonb) returns jsonb language plpgsql set search_path='' as $$
begin
 if coalesce(event->'user'->'user_metadata'->>'age_band','') not in('16-17','18+') or event->'user'->'user_metadata'->>'terms_accepted' is distinct from 'true' then
 return jsonb_build_object('error',jsonb_build_object('http_code',400,'message','You must be at least 16 and accept the Terms and Privacy Policy to create an account.'));
 end if;return '{}'::jsonb;
end $$;
revoke all on function public.launchpad_before_user_created(jsonb) from public,anon,authenticated;
-- Grant to supabase_auth_admin when that managed role exists (not needed by local test harness).
do $$begin if exists(select 1 from pg_roles where rolname='supabase_auth_admin') then grant usage on schema public to supabase_auth_admin;grant execute on function public.launchpad_before_user_created(jsonb) to supabase_auth_admin;end if;end$$;
commit;
