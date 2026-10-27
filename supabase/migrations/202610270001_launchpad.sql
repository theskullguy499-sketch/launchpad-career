-- Run once in the Supabase SQL editor, or apply with the Supabase CLI.
-- Transactional and additive: no existing guest data is read, changed or deleted.
begin;

create table public.user_profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text not null default '' check (char_length(display_name) <= 100),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create table public.job_applications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  local_id text check (char_length(local_id) between 1 and 200),
  company text not null check (char_length(btrim(company)) between 1 and 80),
  role text not null check (char_length(btrim(role)) between 1 and 100),
  country text not null check (char_length(btrim(country)) between 1 and 60),
  status text not null default 'Saved' check (status in ('Saved','Applied','Interview','Offer','Rejected')),
  deadline date,
  url text not null default '' check (char_length(url) <= 2000 and (url = '' or url ~* '^https?://')),
  notes text not null default '' check (char_length(notes) <= 700),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, user_id),
  unique (user_id, local_id)
);
create table public.tasks (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  application_id uuid,
  title text not null check (char_length(btrim(title)) between 1 and 200),
  description text not null default '' check (char_length(description) <= 5000),
  completed boolean not null default false,
  due_date date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  -- Composite key prevents linking a task to another user's application.
  foreign key (application_id, user_id) references public.job_applications(id, user_id) on delete cascade
);
create table public.roadmap_progress (
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  milestone_key text not null check (char_length(btrim(milestone_key)) between 1 and 100),
  completed boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (user_id, milestone_key)
);
create index job_applications_owner on public.job_applications(user_id, created_at);
create index tasks_owner on public.tasks(user_id, due_date);

create function public.launchpad_updated_at() returns trigger language plpgsql
set search_path = '' as $$ begin new.updated_at := now();return new;end $$;
create trigger profiles_updated before update on public.user_profiles for each row execute function public.launchpad_updated_at();
create trigger applications_updated before update on public.job_applications for each row execute function public.launchpad_updated_at();
create trigger tasks_updated before update on public.tasks for each row execute function public.launchpad_updated_at();
create trigger roadmap_updated before update on public.roadmap_progress for each row execute function public.launchpad_updated_at();

create function public.launchpad_new_user() returns trigger language plpgsql security definer
set search_path = '' as $$
begin
  insert into public.user_profiles(id) values (new.id) on conflict (id) do nothing;
  return new;
end $$;
revoke all on function public.launchpad_new_user() from public, anon, authenticated;
create trigger launchpad_profile_after_signup after insert on auth.users for each row execute function public.launchpad_new_user();
-- Preserve existing accounts and profiles; never copy untrusted metadata into privileges.
insert into public.user_profiles(id) select id from auth.users on conflict (id) do nothing;

-- Auth server confirmation is checked by database policies as well as by the UI.
create function public.launchpad_confirmed() returns boolean language sql stable security definer
set search_path = '' as $$
  select exists(select 1 from auth.users where id = (select auth.uid()) and email_confirmed_at is not null);
$$;
revoke all on function public.launchpad_confirmed() from public, anon;
grant execute on function public.launchpad_confirmed() to authenticated;

alter table public.user_profiles enable row level security;
alter table public.user_profiles force row level security;
alter table public.job_applications enable row level security;
alter table public.job_applications force row level security;
alter table public.tasks enable row level security;
alter table public.tasks force row level security;
alter table public.roadmap_progress enable row level security;
alter table public.roadmap_progress force row level security;
revoke all on public.user_profiles, public.job_applications, public.tasks, public.roadmap_progress from public, anon, authenticated;
grant select, insert, update, delete on public.user_profiles, public.job_applications, public.tasks, public.roadmap_progress to authenticated;

create policy profiles_own on public.user_profiles for all to authenticated
using (id = (select auth.uid()) and (select public.launchpad_confirmed()))
with check (id = (select auth.uid()) and (select public.launchpad_confirmed()));
create policy applications_own on public.job_applications for all to authenticated
using (user_id = (select auth.uid()) and (select public.launchpad_confirmed()))
with check (user_id = (select auth.uid()) and (select public.launchpad_confirmed()));
create policy tasks_own on public.tasks for all to authenticated
using (user_id = (select auth.uid()) and (select public.launchpad_confirmed()))
with check (user_id = (select auth.uid()) and (select public.launchpad_confirmed()));
create policy roadmap_own on public.roadmap_progress for all to authenticated
using (user_id = (select auth.uid()) and (select public.launchpad_confirmed()))
with check (user_id = (select auth.uid()) and (select public.launchpad_confirmed()));

-- An explicit, idempotent copy, in one transaction. Existing cloud rows win conflicts.
create function public.import_guest_backup(backup jsonb) returns void language plpgsql security invoker
set search_path = '' as $$
declare a jsonb; m jsonb;
begin
  if not public.launchpad_confirmed() then raise exception 'Confirmed authentication required';end if;
  if backup->>'app' is distinct from 'launchpad' or backup->>'formatVersion' is distinct from '1'
    or jsonb_typeof(backup->'applications') is distinct from 'array'
    or jsonb_typeof(backup->'completed') is distinct from 'array' then raise exception 'Invalid backup';end if;
  if jsonb_array_length(backup->'applications') > 1000 or octet_length(backup::text) > 2000000 then raise exception 'Backup too large';end if;
  for a in select value from jsonb_array_elements(backup->'applications') loop
    if jsonb_typeof(a) is distinct from 'object' or nullif(a->>'id','') is null then raise exception 'Invalid application';end if;
    insert into public.job_applications(user_id,local_id,company,role,country,status,deadline,url,notes,created_at)
    values(auth.uid(),a->>'id',a->>'company',a->>'role',a->>'country',coalesce(a->>'status','Saved'),nullif(a->>'deadline','')::date,coalesce(a->>'url',''),coalesce(a->>'notes',''),coalesce(nullif(a->>'createdAt','')::timestamptz,now()))
    on conflict(user_id,local_id) do nothing;
  end loop;
  for m in select value from jsonb_array_elements(backup->'completed') loop
    if jsonb_typeof(m) is distinct from 'number' or m::text !~ '^[0-5]$' then raise exception 'Invalid milestone';end if;
    insert into public.roadmap_progress(user_id,milestone_key,completed) values(auth.uid(),m::text,true)
    on conflict(user_id,milestone_key) do nothing;
  end loop;
end $$;
revoke all on function public.import_guest_backup(jsonb) from public, anon;
grant execute on function public.import_guest_backup(jsonb) to authenticated;
commit;
