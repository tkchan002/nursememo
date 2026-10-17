-- Clean pre-production beta baseline. Run ONCE in a NEW Supabase project.
-- Do not use this file as a migration for an existing database.
-- The existing beta records are not converted or preserved.
begin;


-- Night Memo Supabase schema
-- Run this first in the Supabase SQL editor.

create extension if not exists pgcrypto;

create table if not exists public.wards (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  phone text not null,
  fax text not null,
  empty_bed_gender_mode text not null default 'male' check (empty_bed_gender_mode in ('male','female','mixed','none')),
  single_double_reporting_enabled boolean not null default false,
  display_order integer not null default 0,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create unique index if not exists wards_name_lower_uq on public.wards(lower(name));

create table if not exists public.ward_operating_periods (
  id uuid primary key default gen_random_uuid(),
  ward_id uuid not null references public.wards(id) on delete restrict,
  start_date date not null,
  end_date date,
  note text,
  created_at timestamptz not null default now(),
  check (end_date is null or end_date >= start_date)
);
create index if not exists ward_operating_periods_ward_idx on public.ward_operating_periods(ward_id,start_date desc);

create table if not exists public.ward_capacity_history (
  id uuid primary key default gen_random_uuid(),
  ward_id uuid not null references public.wards(id) on delete restrict,
  effective_from date not null,
  effective_to date,
  bed_capacity integer not null check (bed_capacity >= 0),
  note text,
  created_at timestamptz not null default now(),
  check (effective_to is null or effective_to >= effective_from)
);
create index if not exists ward_capacity_history_ward_idx on public.ward_capacity_history(ward_id,effective_from desc);

create table if not exists public.user_access (
  auth_user_id uuid primary key references auth.users(id) on delete cascade,
  login_id text not null,
  display_name text,
  role text not null check (role in ('ward','manager','maintenance')),
  ward_id uuid references public.wards(id) on delete restrict,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check ((role='ward' and ward_id is not null) or (role<>'ward'))
);
create unique index if not exists user_access_login_lower_uq on public.user_access(lower(login_id));
create unique index if not exists user_access_one_ward_account_uq on public.user_access(ward_id) where role='ward';

create table if not exists public.ward_staff (
  id uuid primary key default gen_random_uuid(),
  ward_id uuid not null references public.wards(id) on delete restrict,
  role text not null,
  name text not null,
  appointment_date date,
  active boolean not null default true,
  display_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists ward_staff_ward_idx on public.ward_staff(ward_id,active,display_order,name);

create table if not exists public.form_versions (
  version integer primary key,
  effective_from date not null,
  effective_to date,
  status text not null default 'published' check (status in ('draft','published','retired')),
  schema_snapshot jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  check (effective_to is null or effective_to >= effective_from)
);

create table if not exists public.report_items (
  id uuid primary key default gen_random_uuid(),
  key text not null unique,
  section text not null,
  label text not null,
  input_type text not null check (input_type in ('dropdown','checkbox','bed_chooser','free_text','number','bed_or_count')),
  options jsonb not null default '[]'::jsonb,
  sort_order integer not null default 0,
  active boolean not null default true,
  effective_from date not null default current_date,
  effective_to date,
  builtin boolean not null default false,
  manager_slot text,
  config jsonb not null default '{"storage":"dynamicItems"}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (effective_to is null or effective_to >= effective_from)
);

create table if not exists public.ward_reports (
  id uuid primary key default gen_random_uuid(),
  ward_id uuid not null references public.wards(id) on delete restrict,
  report_date date not null,
  report_type text not null check (report_type in ('pm','night')),
  payload jsonb not null default '{}'::jsonb,
  bed_capacity_snapshot integer,
  form_version integer not null default 1 references public.form_versions(version) on delete restrict,
  report_item_snapshot jsonb not null default '[]'::jsonb,
  submitted_at timestamptz not null default now(),
  revision integer not null default 1 check (revision > 0),
  created_by uuid references auth.users(id) on delete set null,
  updated_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (ward_id, report_date, report_type)
);
create index if not exists ward_reports_date_idx on public.ward_reports(report_date,ward_id);
create index if not exists ward_reports_ward_date_idx on public.ward_reports(ward_id,report_date desc);

create table if not exists public.audit_log (
  id uuid primary key default gen_random_uuid(),
  occurred_at timestamptz not null default now(),
  actor_user_id uuid references auth.users(id) on delete set null,
  action text not null,
  entity_type text,
  entity_id text,
  details jsonb not null default '{}'::jsonb
);
create index if not exists audit_log_time_idx on public.audit_log(occurred_at desc);

-- Never trust browser-supplied attribution. A service-role Edge Function may
-- submit an explicit actor ID only after it has checked permissions itself.
create or replace function public.assign_audit_actor() returns trigger
language plpgsql security definer set search_path=public,pg_temp as $$
begin
  if auth.role() is distinct from 'service_role' then
    new.actor_user_id := auth.uid();
  end if;
  if new.actor_user_id is null then raise exception 'Audit actor required' using errcode = '42501'; end if;
  return new;
end $$;
create trigger trg_audit_actor before insert on public.audit_log
for each row execute function public.assign_audit_actor();


-- Updated-at helper
create or replace function public.touch_updated_at() returns trigger
language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;$$;

drop trigger if exists trg_wards_touch on public.wards;
create trigger trg_wards_touch before update on public.wards for each row execute function public.touch_updated_at();
drop trigger if exists trg_user_access_touch on public.user_access;
create trigger trg_user_access_touch before update on public.user_access for each row execute function public.touch_updated_at();
drop trigger if exists trg_ward_staff_touch on public.ward_staff;
create trigger trg_ward_staff_touch before update on public.ward_staff for each row execute function public.touch_updated_at();
drop trigger if exists trg_report_items_touch on public.report_items;
create trigger trg_report_items_touch before update on public.report_items for each row execute function public.touch_updated_at();

create or replace function public.set_report_actor() returns trigger
language plpgsql security definer set search_path=public as $$
begin
  if tg_op='INSERT' then
    new.created_by = auth.uid();
  end if;
  if tg_op='UPDATE' then new.created_by = old.created_by; end if;
  new.updated_by = auth.uid();
  new.updated_at = now();
  return new;
end;$$;
drop trigger if exists trg_report_actor on public.ward_reports;
create trigger trg_report_actor before insert or update on public.ward_reports for each row execute function public.set_report_actor();

-- Access helper functions. SECURITY DEFINER lets policies check user_access without recursive RLS.
create or replace function public.app_access_active() returns boolean
language sql stable security definer set search_path=public as $$
  select coalesce((select active from public.user_access where auth_user_id=auth.uid()),false);
$$;
create or replace function public.app_role() returns text
language sql stable security definer set search_path=public as $$
  select role from public.user_access where auth_user_id=auth.uid() and active=true;
$$;
create or replace function public.app_ward_id() returns uuid
language sql stable security definer set search_path=public as $$
  select ward_id from public.user_access where auth_user_id=auth.uid() and active=true;
$$;

create or replace function public.ward_operational_on(p_ward_id uuid,p_date date) returns boolean
language sql stable security definer set search_path=public as $$
  select exists(
    select 1 from public.ward_operating_periods p
    where p.ward_id=p_ward_id and p.start_date<=p_date and (p.end_date is null or p.end_date>=p_date)
  );
$$;

-- Capacity change is effective-dated and closes the previous capacity interval.
create or replace function public.add_ward_capacity(
  p_ward_id uuid,
  p_effective_from date,
  p_bed_capacity integer,
  p_note text default null
) returns void
language plpgsql security definer set search_path=public as $$
declare
  prev_id uuid;
begin
  if public.app_role() <> 'maintenance' then
    raise exception 'maintenance role required';
  end if;
  if p_bed_capacity < 0 then raise exception 'bed capacity must be >= 0'; end if;

  select id into prev_id
  from public.ward_capacity_history
  where ward_id=p_ward_id
    and effective_from < p_effective_from
    and (effective_to is null or effective_to >= p_effective_from)
  order by effective_from desc limit 1;

  if prev_id is not null then
    update public.ward_capacity_history
      set effective_to = p_effective_from - 1
      where id=prev_id;
  end if;

  insert into public.ward_capacity_history(ward_id,effective_from,effective_to,bed_capacity,note)
  values(p_ward_id,p_effective_from,null,p_bed_capacity,p_note);
end;$$;

-- Row Level Security
alter table public.wards enable row level security;
alter table public.ward_operating_periods enable row level security;
alter table public.ward_capacity_history enable row level security;
alter table public.user_access enable row level security;
alter table public.ward_staff enable row level security;
alter table public.form_versions enable row level security;
alter table public.report_items enable row level security;
alter table public.ward_reports enable row level security;
alter table public.audit_log enable row level security;

-- Read configuration to any active Night Memo account.
drop policy if exists wards_read on public.wards;
create policy wards_read on public.wards for select to authenticated using (public.app_access_active());
drop policy if exists periods_read on public.ward_operating_periods;
create policy periods_read on public.ward_operating_periods for select to authenticated using (public.app_access_active());
drop policy if exists capacity_read on public.ward_capacity_history;
create policy capacity_read on public.ward_capacity_history for select to authenticated using (public.app_access_active());
drop policy if exists forms_read on public.form_versions;
create policy forms_read on public.form_versions for select to authenticated using (public.app_access_active());
drop policy if exists items_read on public.report_items;
create policy items_read on public.report_items for select to authenticated using (public.app_access_active());

-- Maintenance controls configuration.
drop policy if exists wards_maint_insert on public.wards;
create policy wards_maint_insert on public.wards for insert to authenticated with check (public.app_role()='maintenance');
drop policy if exists wards_maint_update on public.wards;
create policy wards_maint_update on public.wards for update to authenticated using (public.app_role()='maintenance') with check (public.app_role()='maintenance');
drop policy if exists periods_maint_all on public.ward_operating_periods;
create policy periods_maint_all on public.ward_operating_periods for all to authenticated using (public.app_role()='maintenance') with check (public.app_role()='maintenance');
drop policy if exists capacity_maint_readwrite on public.ward_capacity_history;
create policy capacity_maint_readwrite on public.ward_capacity_history for all to authenticated using (public.app_role()='maintenance') with check (public.app_role()='maintenance');
drop policy if exists forms_maint_all on public.form_versions;
create policy forms_maint_all on public.form_versions for all to authenticated using (public.app_role()='maintenance') with check (public.app_role()='maintenance');
drop policy if exists items_maint_all on public.report_items;
create policy items_maint_all on public.report_items for all to authenticated using (public.app_role()='maintenance') with check (public.app_role()='maintenance');

-- User access: self can read own mapping; maintenance can list all. Mutations are done by Edge Function/service role.
drop policy if exists access_self_or_maint_read on public.user_access;
create policy access_self_or_maint_read on public.user_access for select to authenticated using (auth_user_id=auth.uid() or public.app_role()='maintenance');

-- Ward staff: ward account sees/edits only its own colleagues. Manager and maintenance may read all; maintenance may edit all.
drop policy if exists staff_read on public.ward_staff;
create policy staff_read on public.ward_staff for select to authenticated using (ward_id=public.app_ward_id() or public.app_role() in ('manager','maintenance'));
drop policy if exists staff_insert on public.ward_staff;
create policy staff_insert on public.ward_staff for insert to authenticated with check (ward_id=public.app_ward_id() or public.app_role()='maintenance');
drop policy if exists staff_update on public.ward_staff;
create policy staff_update on public.ward_staff for update to authenticated using (ward_id=public.app_ward_id() or public.app_role()='maintenance') with check (ward_id=public.app_ward_id() or public.app_role()='maintenance');

-- Clinical reports: ward reads/writes only its own ward; manager reads all full reports. Maintenance does not get report access by default.
drop policy if exists reports_read on public.ward_reports;
create policy reports_read on public.ward_reports for select to authenticated using (ward_id=public.app_ward_id() or public.app_role()='manager');
drop policy if exists reports_insert on public.ward_reports;
create policy reports_insert on public.ward_reports for insert to authenticated with check (public.app_role()='ward' and ward_id=public.app_ward_id() and public.ward_operational_on(ward_id,report_date));
drop policy if exists reports_update on public.ward_reports;
create policy reports_update on public.ward_reports for update to authenticated using (public.app_role()='ward' and ward_id=public.app_ward_id()) with check (public.app_role()='ward' and ward_id=public.app_ward_id() and public.ward_operational_on(ward_id,report_date));

-- Audit log is visible to maintenance. Maintenance UI may write configuration audit rows; Edge Function writes account actions with service role.
drop policy if exists audit_maint_read on public.audit_log;
create policy audit_maint_read on public.audit_log for select to authenticated using (public.app_role()='maintenance');
drop policy if exists audit_maint_insert on public.audit_log;
create policy audit_maint_insert on public.audit_log for insert to authenticated with check (public.app_role()='maintenance');

-- Privileged server-side setup and Maintenance account administration.
-- New Supabase projects may disable automatic grants to Data API roles.
-- BYPASSRLS on service_role does not bypass missing SQL table privileges.
-- Keep these grants narrow and never grant them to anon.
grant select on table public.wards to service_role;
grant select, insert on table public.user_access to service_role;
grant insert on table public.audit_log to service_role;

-- Minimum grants for authenticated users; RLS still decides row access.
grant select on public.wards,public.ward_operating_periods,public.ward_capacity_history,public.user_access,public.ward_staff,public.form_versions,public.report_items,public.audit_log to authenticated;
grant insert,update on public.wards,public.ward_operating_periods,public.ward_capacity_history,public.ward_staff,public.form_versions,public.report_items,public.audit_log to authenticated;
grant execute on function public.add_ward_capacity(uuid,date,integer,text) to authenticated;

revoke insert, update, delete on public.ward_reports from authenticated;

grant select on public.ward_reports to authenticated;



-- Current report indices
create index if not exists ward_reports_type_date_idx on public.ward_reports(report_date,report_type,ward_id);
create index if not exists ward_reports_submitted_idx on public.ward_reports(ward_id,submitted_at desc);



-- Current PM/Night draft and immutable submission revisions.
create table public.ward_cycle_drafts (
  ward_id uuid not null references public.wards(id) on delete cascade,
  report_date date not null,
  report_type text not null check (report_type in ('pm','night')),
  payload jsonb not null default '{}'::jsonb,
  bed_capacity_snapshot integer,
  form_version integer not null default 1 references public.form_versions(version),
  report_item_snapshot jsonb not null default '[]'::jsonb,
  saved_by uuid not null references auth.users(id),
  revision integer not null default 1 check (revision > 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (ward_id,report_date,report_type)
);
create table public.ward_cycle_revisions (
  id bigint generated always as identity primary key,
  report_id uuid not null references public.ward_reports(id) on delete cascade,
  revision_number integer not null,
  saved_by uuid not null references auth.users(id),
  saved_at timestamptz not null default now(),
  record jsonb not null,
  unique(report_id,revision_number)
);
alter table public.ward_cycle_drafts enable row level security;
alter table public.ward_cycle_revisions enable row level security;
revoke all on public.ward_cycle_drafts,public.ward_cycle_revisions from public,anon,authenticated;

-- Manager working document and immutable Save/Print history.
create table public.manager_memos (
 id uuid primary key default gen_random_uuid(),
 reporting_date date not null unique,
 document jsonb not null default '{}'::jsonb,
 source_snapshot jsonb not null default '[]'::jsonb,
 status text not null default 'draft',
 revision integer not null default 0,
 created_by uuid references auth.users(id),
 updated_by uuid references auth.users(id),
 finalized_by uuid references auth.users(id),
 finalized_at timestamptz,
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now()
);
create table public.manager_memo_revisions (
 id uuid primary key default gen_random_uuid(),
 memo_id uuid not null references public.manager_memos(id) on delete cascade,
 revision_number integer not null,
 revision_type text not null check (revision_type in ('draft','final')),
 reason text not null default 'save',
 document jsonb not null,
 source_snapshot jsonb not null default '[]'::jsonb,
 created_at timestamptz not null default now(),
 created_by uuid default auth.uid(),
 created_by_label text,
 unique(memo_id,revision_number)
);
create index manager_memo_revisions_memo_created_idx on public.manager_memo_revisions(memo_id,created_at desc);
create table public.manager_memo_recovery_snapshots (
 id uuid primary key default gen_random_uuid(),
 memo_id uuid not null references public.manager_memos(id) on delete cascade,
 reporting_date date not null,
 reason text not null default 'safety_checkpoint',
 document jsonb not null,
 source_snapshot jsonb not null default '[]'::jsonb,
 working_revision integer not null,
 created_at timestamptz not null default now(),
 created_by uuid default auth.uid(),
 created_by_label text
);
create index manager_memo_recovery_snapshots_memo_created_idx on public.manager_memo_recovery_snapshots(memo_id,created_at desc);
create index manager_memo_recovery_snapshots_date_created_idx on public.manager_memo_recovery_snapshots(reporting_date desc,created_at desc);
alter table public.manager_memos enable row level security;
alter table public.manager_memo_revisions enable row level security;
alter table public.manager_memo_recovery_snapshots enable row level security;
create policy manager_memos_select_manager on public.manager_memos for select to authenticated using (public.app_role()='manager');
create policy manager_revisions_select_manager on public.manager_memo_revisions for select to authenticated using (public.app_role()='manager');
create policy manager_checkpoints_select_manager on public.manager_memo_recovery_snapshots for select to authenticated using (public.app_role()='manager');
revoke all on public.manager_memos,public.manager_memo_revisions,public.manager_memo_recovery_snapshots from public,anon,authenticated;
grant select on public.manager_memos,public.manager_memo_revisions,public.manager_memo_recovery_snapshots to authenticated;

-- A4 landscape DOCX layout is managed in Maintenance and read by Manager.
-- The additive version of this change is in migrations/20261017_docx_layout_settings.sql.
-- Additive migration for deployed Nurse Memo databases (Supabase SQL Editor).
-- Does not delete or alter existing memo, archive, Ward or HTML print data.

create table if not exists public.night_memo_docx_layout (
 id integer primary key default 1 check (id=1),
 layout jsonb not null,
 version integer not null default 1 check (version>0),
 updated_at timestamptz not null default now(),
 updated_by uuid references auth.users(id) on delete set null
);
insert into public.night_memo_docx_layout(id,layout,version)
values(1,'{"marginMm":12,"bodyFontPt":9,"tableFontPt":8,"titleFontPt":16,"sectionFontPt":10,"cellPaddingMm":1,"headerLeftPercent":60,"signatureWidthPercent":43}'::jsonb,1)
on conflict(id) do nothing;
create or replace function public.night_memo_docx_layout_version()
returns trigger language plpgsql security definer set search_path=public,pg_temp as $$
begin
 if public.app_role() is distinct from 'maintenance' then
   raise exception 'Maintenance role required' using errcode='42501';
 end if;
 new.version := old.version + 1;
 new.updated_at := now();
 new.updated_by := auth.uid();
 return new;
end;$$;
revoke all on function public.night_memo_docx_layout_version() from public,anon,authenticated;
drop trigger if exists trg_night_memo_docx_layout_version on public.night_memo_docx_layout;
create trigger trg_night_memo_docx_layout_version before update on public.night_memo_docx_layout
 for each row execute function public.night_memo_docx_layout_version();
alter table public.night_memo_docx_layout enable row level security;
drop policy if exists docx_layout_read on public.night_memo_docx_layout;
drop policy if exists docx_layout_maintenance_update on public.night_memo_docx_layout;
create policy docx_layout_read on public.night_memo_docx_layout for select to authenticated
 using(public.app_role() in ('manager','maintenance'));
create policy docx_layout_maintenance_update on public.night_memo_docx_layout for update to authenticated
 using(public.app_role()='maintenance') with check(public.app_role()='maintenance');
revoke all on public.night_memo_docx_layout from public,anon,authenticated;
grant select on public.night_memo_docx_layout to authenticated;
grant update(layout) on public.night_memo_docx_layout to authenticated;


-- Night staffing snapshots are current operational data, not old report compatibility.
create table public.night_roster_snapshots (
 ward_id uuid not null references public.wards(id),
 reporting_date date not null,
 report_type text not null check(report_type in ('pm','night')),
 nurses jsonb not null default '[]'::jsonb,
 source_kind text not null,
 updated_at timestamptz not null default now(),
 primary key(ward_id,reporting_date,report_type)
);
alter table public.night_roster_snapshots enable row level security;
create policy roster_read_manager on public.night_roster_snapshots for select to authenticated using(public.app_role()='manager');
grant select on public.night_roster_snapshots to authenticated;
create index night_roster_recent_idx on public.night_roster_snapshots(updated_at desc);

-- Generated test data is tracked only for convenient beta cleanup.
create table public.demo_data_batches (
 id uuid primary key default gen_random_uuid(),
 generated_at timestamptz not null default now(),
 generated_by uuid not null,
 scenario text not null,
 seed bigint,
 description text,
 source_format text not null default 'night-memo-pm-night-v1',
 report_count integer not null default 0
);
create table public.demo_data_reports (
 batch_id uuid not null references public.demo_data_batches(id) on delete cascade,
 report_id uuid not null references public.ward_reports(id) on delete cascade,
 primary key(batch_id,report_id)
);
alter table public.demo_data_batches enable row level security;
alter table public.demo_data_reports enable row level security;
revoke all on public.demo_data_batches,public.demo_data_reports from public,anon,authenticated;



create or replace function public.resolve_form_version_for_date(
  p_report_date date
)
returns integer
language plpgsql
stable
security invoker
set search_path = public, pg_temp
as $$
declare
  v_version integer;
begin
  if p_report_date is null then
    raise exception 'report_date is required to resolve form version';
  end if;

  select fv.version
    into v_version
  from public.form_versions fv
  where fv.effective_from <= p_report_date
    and (fv.effective_to is null or fv.effective_to >= p_report_date)
    and fv.status in ('published', 'retired')
  order by
    case when fv.status = 'published' then 0 else 1 end,
    fv.effective_from desc,
    fv.version desc
  limit 1;

  if v_version is null then
    raise exception 'No published/retired form version is effective on %', p_report_date
      using hint = 'Create or correct a form_versions row whose effective date range covers this report date.';
  end if;

  return v_version;
end;
$$;


create or replace function public.assign_effective_form_version()
returns trigger
language plpgsql
security invoker
set search_path = public, pg_temp
as $$
begin
  new.form_version := public.resolve_form_version_for_date(new.report_date);
  return new;
end;
$$;


create trigger trg_ward_reports_form_version before insert or update of report_date,form_version on public.ward_reports for each row execute function public.assign_effective_form_version();



create or replace function public.assign_ward_display_order()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
begin
  if new.display_order is null or new.display_order <= 0 or new.display_order = 999 then
    perform pg_advisory_xact_lock(92411, 1);
    select coalesce(max(display_order), 0) + 1
      into new.display_order
      from public.wards;
  end if;
  return new;
end;
$$;


create or replace function public.assign_report_item_sort_order()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
begin
  if new.sort_order is null or new.sort_order <= 0 or new.sort_order = 999 then
    perform pg_advisory_xact_lock(92411, 2);
    select coalesce(max(sort_order), 0) + 1
      into new.sort_order
      from public.report_items;
  end if;
  return new;
end;
$$;


create or replace function public.reorder_wards(p_order uuid[])
returns void
language plpgsql
security invoker
set search_path = public, pg_temp
as $$
declare
  v_total integer;
  v_unique integer;
begin
  if public.app_role() <> 'maintenance' then
    raise exception 'maintenance role required';
  end if;

  select count(*) into v_total from public.wards;
  select count(distinct id) into v_unique from unnest(coalesce(p_order, '{}'::uuid[])) as ids(id);

  if cardinality(coalesce(p_order, '{}'::uuid[])) <> v_total or v_unique <> v_total then
    raise exception 'ward order must contain every ward exactly once';
  end if;

  if exists (
    select 1
    from unnest(p_order) as requested(id)
    left join public.wards w on w.id = requested.id
    where w.id is null
  ) then
    raise exception 'ward order contains an unknown ward';
  end if;

  update public.wards w
  set display_order = requested.position::integer
  from unnest(p_order) with ordinality as requested(id, position)
  where w.id = requested.id;
end;
$$;


create or replace function public.reorder_report_items(p_order uuid[])
returns void
language plpgsql
security invoker
set search_path = public, pg_temp
as $$
declare
  v_total integer;
  v_unique integer;
begin
  if public.app_role() <> 'maintenance' then
    raise exception 'maintenance role required';
  end if;

  select count(*) into v_total from public.report_items;
  select count(distinct id) into v_unique from unnest(coalesce(p_order, '{}'::uuid[])) as ids(id);

  if cardinality(coalesce(p_order, '{}'::uuid[])) <> v_total or v_unique <> v_total then
    raise exception 'report item order must contain every report item exactly once';
  end if;

  if exists (
    select 1
    from unnest(p_order) as requested(id)
    left join public.report_items i on i.id = requested.id
    where i.id is null
  ) then
    raise exception 'report item order contains an unknown report item';
  end if;

  update public.report_items i
  set sort_order = requested.position::integer
  from unnest(p_order) with ordinality as requested(id, position)
  where i.id = requested.id;
end;
$$;


create trigger trg_wards_assign_display_order before insert on public.wards for each row execute function public.assign_ward_display_order();
create trigger trg_report_items_assign_sort_order before insert on public.report_items for each row execute function public.assign_report_item_sort_order();
grant execute on function public.reorder_wards(uuid[]),public.reorder_report_items(uuid[]) to authenticated;



create or replace function public.get_maintenance_wards_snapshot()
returns jsonb
language sql
stable
security invoker
set search_path = public
as $$
  select jsonb_build_object(
    'wards', coalesce((
      select jsonb_agg(to_jsonb(w) order by w.display_order, w.name)
      from public.wards w
    ), '[]'::jsonb),
    'periods', coalesce((
      select jsonb_agg(to_jsonb(p) order by p.start_date desc)
      from public.ward_operating_periods p
    ), '[]'::jsonb)
  );
$$;

grant execute on function public.get_maintenance_wards_snapshot() to authenticated;



create or replace function public.save_manager_memo_recovery(
  p_reporting_date date,
  p_document jsonb,
  p_source_snapshot jsonb,
  p_expected_revision integer default 0
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_uid uuid := auth.uid();
  v_memo public.manager_memos%rowtype;
begin
  if v_uid is null or not exists (
    select 1 from public.user_access ua
    where ua.auth_user_id = v_uid
      and ua.role = 'manager'
      and ua.active = true
  ) then
    raise exception 'MANAGER_ACCESS_REQUIRED';
  end if;

  select * into v_memo
  from public.manager_memos
  where reporting_date = p_reporting_date
  for update;

  if not found then
    if coalesce(p_expected_revision, 0) <> 0 then
      raise exception 'MANAGER_MEMO_CONFLICT';
    end if;

    insert into public.manager_memos (
      id, reporting_date, document, source_snapshot, status, revision,
      created_by, updated_by, created_at, updated_at, finalized_at
    ) values (
      gen_random_uuid(), p_reporting_date,
      coalesce(p_document, '{}'::jsonb),
      coalesce(p_source_snapshot, '[]'::jsonb),
      'draft', 1,
      v_uid, v_uid, now(), now(), null
    ) returning * into v_memo;
  else
    if coalesce(v_memo.revision, 0) <> coalesce(p_expected_revision, 0) then
      raise exception 'MANAGER_MEMO_CONFLICT';
    end if;

    update public.manager_memos
    set document = coalesce(p_document, '{}'::jsonb),
        source_snapshot = coalesce(p_source_snapshot, '[]'::jsonb),
        status = 'draft',
        revision = coalesce(revision, 0) + 1,
        updated_by = v_uid,
        updated_at = now()
    where id = v_memo.id
    returning * into v_memo;
  end if;

  return to_jsonb(v_memo);
end;
$$;


create or replace function public.save_manager_memo_revision(
  p_reporting_date date,
  p_document jsonb,
  p_source_snapshot jsonb,
  p_expected_revision integer,
  p_revision_type text,
  p_reason text default null,
  p_actor_label text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_uid uuid := auth.uid();
  v_memo public.manager_memos%rowtype;
  v_revision public.manager_memo_revisions%rowtype;
  v_next_number integer;
  v_type text := lower(coalesce(p_revision_type, ''));
begin
  if v_uid is null or not exists (
    select 1 from public.user_access ua
    where ua.auth_user_id = v_uid
      and ua.role = 'manager'
      and ua.active = true
  ) then
    raise exception 'MANAGER_ACCESS_REQUIRED';
  end if;

  if v_type not in ('draft', 'final') then
    raise exception 'INVALID_MANAGER_MEMO_REVISION_TYPE';
  end if;

  select * into v_memo
  from public.manager_memos
  where reporting_date = p_reporting_date
  for update;

  if not found then
    if coalesce(p_expected_revision, 0) <> 0 then
      raise exception 'MANAGER_MEMO_CONFLICT';
    end if;

    insert into public.manager_memos (
      id, reporting_date, document, source_snapshot, status, revision,
      created_by, updated_by, finalized_by, finalized_at,
      created_at, updated_at
    ) values (
      gen_random_uuid(), p_reporting_date,
      coalesce(p_document, '{}'::jsonb),
      coalesce(p_source_snapshot, '[]'::jsonb),
      'draft', 1,
      v_uid, v_uid,
      case when v_type = 'final' then v_uid else null end,
      case when v_type = 'final' then now() else null end,
      now(), now()
    ) returning * into v_memo;
  else
    if coalesce(v_memo.revision, 0) <> coalesce(p_expected_revision, 0) then
      raise exception 'MANAGER_MEMO_CONFLICT';
    end if;

    update public.manager_memos
    set document = coalesce(p_document, '{}'::jsonb),
        source_snapshot = coalesce(p_source_snapshot, '[]'::jsonb),
        status = 'draft',
        revision = coalesce(revision, 0) + 1,
        updated_by = v_uid,
        updated_at = now(),
        finalized_by = case when v_type = 'final' then v_uid else finalized_by end,
        finalized_at = case when v_type = 'final' then now() else finalized_at end
    where id = v_memo.id
    returning * into v_memo;
  end if;

  select coalesce(max(revision_number), 0) + 1
    into v_next_number
  from public.manager_memo_revisions
  where memo_id = v_memo.id;

  insert into public.manager_memo_revisions (
    memo_id, revision_number, revision_type, reason,
    document, source_snapshot, created_at, created_by, created_by_label
  ) values (
    v_memo.id,
    v_next_number,
    v_type,
    coalesce(nullif(p_reason, ''), case when v_type = 'final' then 'print' else 'save' end),
    coalesce(p_document, '{}'::jsonb),
    coalesce(p_source_snapshot, '[]'::jsonb),
    now(), v_uid, nullif(trim(coalesce(p_actor_label, '')), '')
  ) returning * into v_revision;

  return jsonb_build_object(
    'memo', to_jsonb(v_memo),
    'revision', to_jsonb(v_revision)
  );
end;
$$;


create or replace function public.list_manager_memo_revisions(p_reporting_date date)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_uid uuid := auth.uid();
  v_result jsonb;
begin
  if v_uid is null or not exists (
    select 1 from public.user_access ua
    where ua.auth_user_id = v_uid
      and ua.role = 'manager'
      and ua.active = true
  ) then
    raise exception 'MANAGER_ACCESS_REQUIRED';
  end if;

  select coalesce(jsonb_agg(to_jsonb(x) order by x.revision_number desc), '[]'::jsonb)
  into v_result
  from (
    select r.*
    from public.manager_memo_revisions r
    join public.manager_memos m on m.id = r.memo_id
    where m.reporting_date = p_reporting_date
  ) x;

  return v_result;
end;
$$;


create or replace function public.get_manager_memo_revision(p_revision_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_uid uuid := auth.uid();
  v_revision public.manager_memo_revisions%rowtype;
begin
  if v_uid is null or not exists (
    select 1 from public.user_access ua
    where ua.auth_user_id = v_uid
      and ua.role = 'manager'
      and ua.active = true
  ) then
    raise exception 'MANAGER_ACCESS_REQUIRED';
  end if;

  select r.* into v_revision
  from public.manager_memo_revisions r
  join public.manager_memos m on m.id = r.memo_id
  where r.id = p_revision_id;

  if not found then return null; end if;
  return to_jsonb(v_revision);
end;
$$;


create or replace function public.list_manager_memo_archive()
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_uid uuid := auth.uid();
  v_result jsonb;
begin
  if v_uid is null or not exists (
    select 1 from public.user_access ua
    where ua.auth_user_id = v_uid
      and ua.role = 'manager'
      and ua.active = true
  ) then
    raise exception 'MANAGER_ACCESS_REQUIRED';
  end if;

  select coalesce(jsonb_agg(to_jsonb(x) order by x.reporting_date desc), '[]'::jsonb)
  into v_result
  from (
    select
      m.id as memo_id,
      m.reporting_date,
      m.updated_at as recovery_updated_at,
      m.revision as working_revision,
      (select count(*)::integer from public.manager_memo_revisions r where r.memo_id = m.id) as revision_count,
      exists(select 1 from public.manager_memo_revisions r where r.memo_id = m.id and r.revision_type = 'draft') as has_draft,
      exists(select 1 from public.manager_memo_revisions r where r.memo_id = m.id and r.revision_type = 'final') as has_final,
      latest.id as latest_revision_id,
      latest.revision_number as latest_revision_number,
      latest.revision_type as latest_revision_type,
      latest.created_at as latest_revision_created_at,
      latest.created_by_label as latest_revision_created_by_label,
      coalesce(final_rev.id, latest.id) as preferred_revision_id,
      coalesce(final_rev.revision_number, latest.revision_number) as preferred_revision_number,
      coalesce(final_rev.revision_type, latest.revision_type) as preferred_revision_type,
      coalesce(final_rev.created_at, latest.created_at) as preferred_revision_created_at
    from public.manager_memos m
    left join lateral (
      select r.*
      from public.manager_memo_revisions r
      where r.memo_id = m.id
      order by r.revision_number desc
      limit 1
    ) latest on true
    left join lateral (
      select r.*
      from public.manager_memo_revisions r
      where r.memo_id = m.id and r.revision_type = 'final'
      order by r.revision_number desc
      limit 1
    ) final_rev on true
  ) x;

  return v_result;
end;
$$;


create or replace function public.checkpoint_manager_memo(
  p_reporting_date date,
  p_reason text default 'safety_checkpoint',
  p_actor_label text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_uid uuid := auth.uid();
  v_memo public.manager_memos%rowtype;
  v_snapshot public.manager_memo_recovery_snapshots%rowtype;
begin
  if v_uid is null or not exists (
    select 1 from public.user_access ua
    where ua.auth_user_id = v_uid
      and ua.role = 'manager'
      and ua.active = true
  ) then
    raise exception 'MANAGER_ACCESS_REQUIRED';
  end if;

  select * into v_memo
  from public.manager_memos
  where reporting_date = p_reporting_date
  for update;

  if not found then return null; end if;

  insert into public.manager_memo_recovery_snapshots (
    memo_id, reporting_date, reason, document, source_snapshot,
    working_revision, created_at, created_by, created_by_label
  ) values (
    v_memo.id,
    v_memo.reporting_date,
    coalesce(nullif(trim(p_reason), ''), 'safety_checkpoint'),
    v_memo.document,
    coalesce(v_memo.source_snapshot, '[]'::jsonb),
    coalesce(v_memo.revision, 0),
    now(), v_uid, nullif(trim(coalesce(p_actor_label, '')), '')
  ) returning * into v_snapshot;

  delete from public.manager_memo_recovery_snapshots old
  where old.memo_id = v_memo.id
    and old.id in (
      select id
      from public.manager_memo_recovery_snapshots
      where memo_id = v_memo.id
      order by created_at desc, id desc
      offset 10
    );

  return to_jsonb(v_snapshot);
end;
$$;


create or replace function public.list_manager_memo_checkpoints(p_reporting_date date)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_uid uuid := auth.uid();
  v_result jsonb;
begin
  if v_uid is null or not exists (
    select 1 from public.user_access ua
    where ua.auth_user_id = v_uid
      and ua.role = 'manager'
      and ua.active = true
  ) then
    raise exception 'MANAGER_ACCESS_REQUIRED';
  end if;

  select coalesce(jsonb_agg(to_jsonb(x) order by x.created_at desc), '[]'::jsonb)
  into v_result
  from (
    select s.*
    from public.manager_memo_recovery_snapshots s
    where s.reporting_date = p_reporting_date
  ) x;

  return v_result;
end;
$$;


create or replace function public.get_manager_memo_checkpoint(p_checkpoint_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_uid uuid := auth.uid();
  v_snapshot public.manager_memo_recovery_snapshots%rowtype;
begin
  if v_uid is null or not exists (
    select 1 from public.user_access ua
    where ua.auth_user_id = v_uid
      and ua.role = 'manager'
      and ua.active = true
  ) then
    raise exception 'MANAGER_ACCESS_REQUIRED';
  end if;

  select * into v_snapshot
  from public.manager_memo_recovery_snapshots
  where id = p_checkpoint_id;

  if not found then return null; end if;
  return to_jsonb(v_snapshot);
end;
$$;

revoke all on function public.save_manager_memo_recovery(date, jsonb, jsonb, integer) from public;

revoke all on function public.save_manager_memo_revision(date, jsonb, jsonb, integer, text, text, text) from public;

revoke all on function public.list_manager_memo_revisions(date) from public;

revoke all on function public.get_manager_memo_revision(uuid) from public;

revoke all on function public.list_manager_memo_archive() from public;

revoke all on function public.checkpoint_manager_memo(date, text, text) from public;

revoke all on function public.list_manager_memo_checkpoints(date) from public;

revoke all on function public.get_manager_memo_checkpoint(uuid) from public;

grant execute on function public.save_manager_memo_recovery(date, jsonb, jsonb, integer) to authenticated;

grant execute on function public.save_manager_memo_revision(date, jsonb, jsonb, integer, text, text, text) to authenticated;

grant execute on function public.list_manager_memo_revisions(date) to authenticated;

grant execute on function public.get_manager_memo_revision(uuid) to authenticated;

grant execute on function public.list_manager_memo_archive() to authenticated;

grant execute on function public.checkpoint_manager_memo(date, text, text) to authenticated;

grant execute on function public.list_manager_memo_checkpoints(date) to authenticated;

grant execute on function public.get_manager_memo_checkpoint(uuid) to authenticated;


create or replace function public.assert_ward_cycle_access(p_ward_id uuid, p_date date, p_type text)
returns void language plpgsql security definer set search_path = public, pg_temp as $$
begin
  if p_ward_id is null or p_date is null or p_type not in ('pm', 'night') or p_type is null then
    raise exception 'Valid ward, reporting date and PM/Night type required';
  end if;
  if auth.uid() is null or not exists (
    select 1 from public.user_access a
    where a.auth_user_id = auth.uid() and a.active and a.role = 'ward' and a.ward_id = p_ward_id
  ) then
    raise exception 'Ward access denied' using errcode = '42501';
  end if;
  if not exists (
    select 1 from public.ward_operating_periods op
    where op.ward_id = p_ward_id and op.start_date <= p_date
      and (op.end_date is null or op.end_date >= p_date)
  ) then
    raise exception 'Ward is not operational for the reporting date';
  end if;
end $$;


create or replace function public.submit_ward_cycle_report(p_row jsonb)
returns jsonb language plpgsql security definer set search_path = public, pg_temp as $$
declare
  v_ward uuid := nullif(p_row->>'ward_id','')::uuid;
  v_date date := nullif(p_row->>'report_date','')::date;
  v_type text := p_row->>'report_type';
  v_form integer;
  v_result public.ward_reports%rowtype;
  v_existing public.ward_reports%rowtype;
  v_draft public.ward_cycle_drafts%rowtype;
  v_expected_report integer;
  v_expected_draft integer;
begin
  perform public.assert_ward_cycle_access(v_ward, v_date, v_type);
  if not (p_row ? 'expected_report_revision' and p_row ? 'expected_draft_revision') then
    raise exception 'Expected report and draft revisions are required' using errcode='22023';
  end if;
  v_expected_report := (p_row->>'expected_report_revision')::integer;
  v_expected_draft := (p_row->>'expected_draft_revision')::integer;
  if v_expected_report is null or v_expected_draft is null or v_expected_report < 0 or v_expected_draft < 0 then
    raise exception 'Revisions must not be negative' using errcode='22023';
  end if;
  if jsonb_typeof(p_row->'payload') is distinct from 'object' or
     jsonb_typeof(p_row->'report_item_snapshot') is distinct from 'array' then
    raise exception 'Invalid report payload or snapshot' using errcode='22023';
  end if;
  -- Save, submit and draft-deletion operations use the same lock.
  perform pg_advisory_xact_lock(hashtextextended(v_ward::text || ':' || v_date::text || ':' || v_type, 0));
  select * into v_existing from public.ward_reports
    where ward_id=v_ward and report_date=v_date and report_type=v_type for update;
  if coalesce(v_existing.revision,0) <> v_expected_report then
    raise exception 'REPORT_CONFLICT: This memo was submitted from another session. Copy your unsaved changes and reload.' using errcode='P0001';
  end if;
  select * into v_draft from public.ward_cycle_drafts
    where ward_id=v_ward and report_date=v_date and report_type=v_type for update;
  if coalesce(v_draft.revision,0) <> v_expected_draft then
    raise exception 'REPORT_CONFLICT: This draft changed in another session. Copy your unsaved changes and reload.' using errcode='P0001';
  end if;
  v_form := public.resolve_form_version_for_date(v_date);
  insert into public.ward_reports (
    ward_id, report_date, report_type, payload, bed_capacity_snapshot,
    form_version, report_item_snapshot, submitted_at, revision
  ) values (
    v_ward, v_date, v_type, p_row->'payload',
    nullif(p_row->>'bed_capacity_snapshot','')::integer, v_form,
    p_row->'report_item_snapshot', now(), v_expected_report+1
  ) on conflict (ward_id, report_date, report_type)
    do update set payload = excluded.payload,
      bed_capacity_snapshot = excluded.bed_capacity_snapshot,
      form_version = excluded.form_version,
      report_item_snapshot = excluded.report_item_snapshot,
      submitted_at = now(), revision = excluded.revision
  returning * into v_result;
  insert into public.ward_cycle_revisions(report_id, revision_number, saved_by, record)
    values (v_result.id, v_result.revision, auth.uid(), to_jsonb(v_result));
  delete from public.ward_cycle_drafts
    where ward_id=v_ward and report_date=v_date and report_type=v_type;
  return to_jsonb(v_result);
end $$;

create or replace function public.get_ward_cycle_draft(p_ward_id uuid, p_report_date date, p_report_type text)
returns jsonb language plpgsql security definer set search_path = public, pg_temp as $$
declare v_data jsonb;
begin
  perform public.assert_ward_cycle_access(p_ward_id, p_report_date, p_report_type);
  select to_jsonb(d) into v_data from public.ward_cycle_drafts d
  where d.ward_id = p_ward_id and d.report_date = p_report_date and d.report_type = p_report_type;
  return v_data;
end $$;


create or replace function public.save_ward_cycle_draft(p_row jsonb)
returns jsonb language plpgsql security definer set search_path = public, pg_temp as $$
declare
  v_ward uuid := nullif(p_row->>'ward_id','')::uuid;
  v_date date := nullif(p_row->>'report_date','')::date;
  v_type text := p_row->>'report_type';
  v_result public.ward_cycle_drafts%rowtype;
  v_report public.ward_reports%rowtype;
  v_expected_draft integer;
  v_expected_report integer;
begin
  perform public.assert_ward_cycle_access(v_ward, v_date, v_type);
  if not (p_row ? 'expected_report_revision' and p_row ? 'expected_draft_revision') then
    raise exception 'Expected report and draft revisions are required' using errcode='22023';
  end if;
  v_expected_report := (p_row->>'expected_report_revision')::integer;
  v_expected_draft := (p_row->>'expected_draft_revision')::integer;
  if v_expected_report is null or v_expected_draft is null or v_expected_report < 0 or v_expected_draft < 0 then
    raise exception 'Revisions must not be negative' using errcode='22023';
  end if;
  if jsonb_typeof(p_row->'payload') is distinct from 'object' or
     jsonb_typeof(p_row->'report_item_snapshot') is distinct from 'array' then
    raise exception 'Invalid report payload or snapshot' using errcode='22023';
  end if;
  perform pg_advisory_xact_lock(hashtextextended(v_ward::text || ':' || v_date::text || ':' || v_type, 0));
  select * into v_report from public.ward_reports
    where ward_id=v_ward and report_date=v_date and report_type=v_type for update;
  if coalesce(v_report.revision,0) <> v_expected_report then
    raise exception 'REPORT_CONFLICT: The submitted memo changed elsewhere. Copy edits and reload.' using errcode='P0001';
  end if;
  select * into v_result from public.ward_cycle_drafts
    where ward_id=v_ward and report_date=v_date and report_type=v_type for update;
  if coalesce(v_result.revision,0) <> v_expected_draft then
    raise exception 'REPORT_CONFLICT: The draft changed elsewhere. Copy edits and reload.' using errcode='P0001';
  end if;
  insert into public.ward_cycle_drafts (
    ward_id, report_date, report_type, payload, bed_capacity_snapshot,
    form_version, report_item_snapshot, saved_by, revision
  ) values (
    v_ward, v_date, v_type, p_row->'payload',
    nullif(p_row->>'bed_capacity_snapshot','')::integer,
    public.resolve_form_version_for_date(v_date),p_row->'report_item_snapshot',auth.uid(),v_expected_draft+1
  ) on conflict (ward_id, report_date, report_type) do update set
    payload = excluded.payload, bed_capacity_snapshot = excluded.bed_capacity_snapshot,
    form_version = excluded.form_version, report_item_snapshot = excluded.report_item_snapshot,
    saved_by = auth.uid(),revision=excluded.revision,updated_at = now()
  returning * into v_result;
  return to_jsonb(v_result);
end $$;

create or replace function public.delete_ward_cycle_draft(p_ward_id uuid, p_report_date date, p_report_type text, p_expected_revision integer)
returns boolean language plpgsql security definer set search_path=public,pg_temp as $$
declare v_revision integer;
begin
  perform public.assert_ward_cycle_access(p_ward_id, p_report_date, p_report_type);
  perform pg_advisory_xact_lock(hashtextextended(p_ward_id::text || ':' || p_report_date::text || ':' || p_report_type, 0));
  select revision into v_revision from public.ward_cycle_drafts
    where ward_id=p_ward_id and report_date=p_report_date and report_type=p_report_type for update;
  if coalesce(v_revision,0) is distinct from p_expected_revision then
    raise exception 'REPORT_CONFLICT: Draft changed elsewhere' using errcode='P0001';
  end if;
  delete from public.ward_cycle_drafts where ward_id=p_ward_id and report_date=p_report_date and report_type=p_report_type;
  return true;
end $$;

revoke all on function public.assert_ward_cycle_access(uuid,date,text) from public,anon,authenticated;
revoke all on function public.submit_ward_cycle_report(jsonb),public.get_ward_cycle_draft(uuid,date,text),public.save_ward_cycle_draft(jsonb),public.delete_ward_cycle_draft(uuid,date,text,integer) from public,anon;
grant execute on function public.submit_ward_cycle_report(jsonb),public.get_ward_cycle_draft(uuid,date,text),public.save_ward_cycle_draft(jsonb),public.delete_ward_cycle_draft(uuid,date,text,integer) to authenticated;





-- Update Night Staffing snapshot when a Ward saves a draft or submits a report.
create or replace function public.record_current_night_roster()
returns trigger language plpgsql security definer set search_path=public,pg_temp as $$
begin
 insert into public.night_roster_snapshots(ward_id,reporting_date,report_type,nurses,source_kind,updated_at)
 values(new.ward_id,new.report_date,new.report_type,
   case when jsonb_typeof(new.payload->'nurses')='array' then new.payload->'nurses' else '[]'::jsonb end,
   TG_TABLE_NAME,now())
 on conflict(ward_id,reporting_date,report_type) do update set nurses=excluded.nurses,source_kind=excluded.source_kind,updated_at=now();
 return new;
end;$$;
create trigger trg_cycle_draft_night_roster after insert or update on public.ward_cycle_drafts for each row execute function public.record_current_night_roster();
create trigger trg_cycle_submit_night_roster after insert or update on public.ward_reports for each row execute function public.record_current_night_roster();



create or replace function public.import_generated_demo_batch(
  p_bundle jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_user_id uuid := auth.uid();
  v_batch_id uuid;
  v_report jsonb;
  v_ward_id uuid;
  v_ward_name text;
  v_report_date date;
  v_submitted_at timestamptz;
  v_payload jsonb;
  v_capacity integer;
  v_form_version integer;
  v_snapshot jsonb;
  v_report_id uuid;
  v_type text;
  v_count integer := 0;
  v_description text := coalesce(p_bundle->>'description', '');
  v_scenario text := coalesce(p_bundle->>'scenario', 'typical');
  v_seed bigint;
begin
  if v_user_id is null then
    raise exception 'Authentication required';
  end if;

  if not exists (
    select 1
    from public.user_access ua
    where ua.auth_user_id = v_user_id
      and ua.role = 'maintenance'
      and ua.active = true
  ) then
    raise exception 'Maintenance access required';
  end if;

  if coalesce(p_bundle->>'format', '') <> 'night-memo-pm-night-v1' then
    raise exception 'Unsupported generated demo format';
  end if;

  if jsonb_typeof(p_bundle->'reports') <> 'array'
     or jsonb_array_length(p_bundle->'reports') = 0 then
    raise exception 'Generated demo bundle must contain at least one report';
  end if;

  if jsonb_array_length(p_bundle->'reports') > 500 then
    raise exception 'Generated demo batch is limited to 500 reports';
  end if;

  begin
    v_seed := nullif(p_bundle->>'seed', '')::bigint;
  exception when others then
    v_seed := null;
  end;

  insert into public.demo_data_batches (
    generated_by,
    scenario,
    seed,
    description,
    source_format,
    report_count
  ) values (
    v_user_id,
    nullif(trim(v_scenario), ''),
    v_seed,
    nullif(trim(v_description), ''),
    'night-memo-pm-night-v1',
    0
  )
  returning id into v_batch_id;

  for v_report in
    select value from jsonb_array_elements(p_bundle->'reports')
  loop
    v_type := v_report->>'report_type';
    if v_type not in ('pm','night') or v_type is null then raise exception 'Generated report must specify PM or Night'; end if;
    v_ward_name := trim(coalesce(v_report->>'ward_name', ''));
    if v_ward_name = '' then
      raise exception 'Every generated report requires ward_name';
    end if;

    select w.id
      into v_ward_id
    from public.wards w
    where lower(w.name) = lower(v_ward_name)
    limit 1;

    if v_ward_id is null then
      raise exception 'Unknown ward name: %', v_ward_name;
    end if;

    begin
      v_report_date := (v_report->>'report_date')::date;
      if nullif(v_report->>'submitted_minutes_ago', '') is not null then
        v_submitted_at := now() - make_interval(
          mins => greatest(0, (v_report->>'submitted_minutes_ago')::integer)
        );
      else
        v_submitted_at := (v_report->>'submitted_at')::timestamptz;
      end if;
    exception when others then
      raise exception 'Invalid report_date or submission time for ward %', v_ward_name;
    end;

    if v_report_date is null or v_submitted_at is null then
      raise exception 'report_date and a submission time are required for ward %', v_ward_name;
    end if;

    if not exists (
      select 1
      from public.ward_operating_periods op
      where op.ward_id = v_ward_id
        and op.start_date <= v_report_date
        and (op.end_date is null or op.end_date >= v_report_date)
    ) then
      raise exception 'Ward % is not operational on %', v_ward_name, v_report_date;
    end if;
    v_form_version := public.resolve_form_version_for_date(v_report_date);

    v_payload := coalesce(v_report->'payload', '{}'::jsonb);
    if jsonb_typeof(v_payload) <> 'object' then
      raise exception 'payload must be a JSON object for ward %', v_ward_name;
    end if;

    select c.bed_capacity
      into v_capacity
    from public.ward_capacity_history c
    where c.ward_id = v_ward_id
      and c.effective_from <= v_report_date
      and (c.effective_to is null or c.effective_to >= v_report_date)
    order by c.effective_from desc
    limit 1;

    v_capacity := coalesce(v_capacity, 0);

    select coalesce(
      jsonb_agg(
        jsonb_build_object(
          'id', i.id,
          'key', i.key,
          'label', i.label,
          'section', i.section,
          'input_type', i.input_type,
          'options', coalesce(to_jsonb(i.options), '[]'::jsonb),
          'sort_order', i.sort_order,
          'builtin', coalesce(i.builtin, false),
          'config', to_jsonb(i.config)
        ) order by i.sort_order
      ),
      '[]'::jsonb
    )
      into v_snapshot
    from public.report_items i
    where (i.effective_from is null or i.effective_from <= v_report_date)
      and (i.effective_to is null or i.effective_to >= v_report_date)
      and coalesce(i.active, true) = true;

    insert into public.ward_reports (
      ward_id,
      report_date,
      report_type,
      payload,
      bed_capacity_snapshot,
      form_version,
      report_item_snapshot,
      submitted_at,
      created_at,
      updated_at
    ) values (
      v_ward_id,
      v_report_date,
      v_type,
      v_payload,
      v_capacity,
      v_form_version,
      v_snapshot,
      v_submitted_at,
      v_submitted_at,
      v_submitted_at
    )
    on conflict(ward_id,report_date,report_type) do nothing
    returning id into v_report_id;
    if v_report_id is null then
      raise exception 'A PM/Night report already exists for ward % on %; clear the existing test batch first',v_ward_name,v_report_date;
    end if;

    insert into public.demo_data_reports (batch_id, report_id)
    values (v_batch_id, v_report_id);

    v_count := v_count + 1;
  end loop;

  update public.demo_data_batches
  set report_count = v_count
  where id = v_batch_id;

  return jsonb_build_object(
    'batch_id', v_batch_id,
    'report_count', v_count,
    'scenario', v_scenario
  );
exception
  when others then
    raise;
end;
$$;


create or replace function public.list_generated_demo_batches()
returns table (
  id uuid,
  generated_at timestamptz,
  generated_by uuid,
  scenario text,
  seed bigint,
  description text,
  report_count integer
)
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null or not exists (
    select 1
    from public.user_access ua
    where ua.auth_user_id = auth.uid()
      and ua.role = 'maintenance'
      and ua.active = true
  ) then
    raise exception 'Maintenance access required';
  end if;

  return query
  select b.id, b.generated_at, b.generated_by, b.scenario, b.seed, b.description, b.report_count
  from public.demo_data_batches b
  order by b.generated_at desc;
end;
$$;


create or replace function public.delete_generated_demo_batch(
  p_batch_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_deleted integer := 0;
begin
  if auth.uid() is null or not exists (
    select 1
    from public.user_access ua
    where ua.auth_user_id = auth.uid()
      and ua.role = 'maintenance'
      and ua.active = true
  ) then
    raise exception 'Maintenance access required';
  end if;

  if not exists (select 1 from public.demo_data_batches where id = p_batch_id) then
    raise exception 'Generated demo batch not found';
  end if;

  with deleted as (
    delete from public.ward_reports r
    using public.demo_data_reports l
    where l.batch_id = p_batch_id
      and l.report_id = r.id
    returning r.id
  )
  select count(*) into v_deleted from deleted;

  delete from public.demo_data_batches where id = p_batch_id;

  return jsonb_build_object(
    'batch_id', p_batch_id,
    'deleted_reports', v_deleted
  );
end;
$$;


revoke all on function public.import_generated_demo_batch(jsonb),public.list_generated_demo_batches(),public.delete_generated_demo_batch(uuid) from public,anon;
grant execute on function public.import_generated_demo_batch(jsonb),public.list_generated_demo_batches(),public.delete_generated_demo_batch(uuid) to authenticated;


-- Capacity intervals cannot overlap for the same ward. This is a fresh-db constraint.
create extension if not exists btree_gist;
create unique index ward_capacity_unique_effective_start on public.ward_capacity_history (ward_id,effective_from);
alter table public.ward_capacity_history add constraint ward_capacity_no_overlap exclude using gist
  (ward_id with =, daterange(effective_from, effective_to + 1, '[)') with &&);
create or replace function public.save_ward_configuration(
  p_ward_id uuid,
  p_name text,
  p_phone text,
  p_fax text,
  p_gender_mode text,
  p_single_double boolean,
  p_bed_capacity integer,
  p_expected_capacity integer,
  p_expected_updated_at timestamptz,
  p_effective_date date
) returns void
language plpgsql security definer set search_path = public
as $$
declare
  v_ward public.wards%rowtype;
  v_current public.ward_capacity_history%rowtype;
  v_first public.ward_capacity_history%rowtype;
  v_today date := (now() at time zone 'Asia/Hong_Kong')::date;
  v_change_date date;
  v_scheduled boolean := false;
  v_settings_changed boolean;
begin
  if public.app_role() is distinct from 'maintenance' then
    raise exception 'Maintenance role required';
  end if;
  if p_effective_date is distinct from v_today then
    raise exception 'The reporting date has changed. Reload Edit Ward and try again.';
  end if;
  if p_bed_capacity is null or p_bed_capacity not between 0 and 500
    or p_expected_capacity is null or p_expected_capacity not between 0 and 500 then
    raise exception 'Bed capacity must be a whole number between 0 and 500.';
  end if;
  if nullif(btrim(p_name), '') is null or p_gender_mode not in ('male','female','mixed','none')
    or p_gender_mode is null or p_single_double is null
    or coalesce(p_phone,'') !~ '^[0-9]{1,4}$'
    or coalesce(p_fax,'') !~ '^[0-9]{1,4}$' then
    raise exception 'Invalid ward configuration.';
  end if;

  -- The RPC writes its own detailed audit records in this transaction.
  perform set_config('nightmemo.audit_explicit', 'true', true);
  -- One lock serializes edits of this Ward by multiple administrators.
  select * into v_ward from public.wards where id = p_ward_id for update;
  if not found then raise exception 'Ward not found.'; end if;
  if p_expected_updated_at is not null
     and v_ward.updated_at is distinct from p_expected_updated_at then
    raise exception 'Ward settings were changed by another administrator. Reload Edit Ward.';
  end if;

  -- Protect all current/future history for this ward during this transaction.
  perform 1 from public.ward_capacity_history where ward_id = p_ward_id for update;
  select * into v_current
    from public.ward_capacity_history
   where ward_id = p_ward_id and effective_from <= v_today
     and (effective_to is null or effective_to >= v_today)
   order by effective_from desc limit 1;

  if not found then
    select * into v_first
      from public.ward_capacity_history
     where ward_id = p_ward_id order by effective_from asc limit 1;
    if v_first.id is not null and v_first.effective_from > v_today then
      v_current := v_first;
      v_scheduled := true;
    else
      raise exception 'No bed capacity is configured for today. Review this ward''s capacity history.';
    end if;
  end if;
  if v_current.bed_capacity is distinct from p_expected_capacity then
    raise exception 'Bed capacity was changed by another administrator. Reload Edit Ward.';
  end if;

  v_settings_changed := v_ward.name is distinct from btrim(p_name)
    or v_ward.phone is distinct from p_phone
    or v_ward.fax is distinct from p_fax
    or v_ward.empty_bed_gender_mode is distinct from p_gender_mode
    or v_ward.single_double_reporting_enabled is distinct from p_single_double;

  if v_settings_changed then
    update public.wards set
      name = btrim(p_name), phone = p_phone, fax = p_fax,
      empty_bed_gender_mode = p_gender_mode,
      single_double_reporting_enabled = p_single_double
    where id = p_ward_id;

    insert into public.audit_log(actor_user_id, action, entity_type, entity_id, details)
    values (auth.uid(), 'ward.configuration.update', 'ward', p_ward_id::text,
      jsonb_build_object(
        'old_name', v_ward.name, 'new_name', btrim(p_name),
        'old_phone', v_ward.phone, 'new_phone', p_phone,
        'old_fax', v_ward.fax, 'new_fax', p_fax,
        'old_gender_mode', v_ward.empty_bed_gender_mode, 'new_gender_mode', p_gender_mode,
        'old_single_double', v_ward.single_double_reporting_enabled, 'new_single_double', p_single_double
      ));
  end if;

  if v_current.bed_capacity is distinct from p_bed_capacity then
    if v_scheduled or v_current.effective_from = v_today then
      -- Same-day revisions update the current record; never insert a duplicate.
      update public.ward_capacity_history
      set bed_capacity = p_bed_capacity, note = 'Updated in Edit Ward'
      where id = v_current.id;
      v_change_date := v_current.effective_from;
    else
      update public.ward_capacity_history
      set effective_to = v_today - 1
      where id = v_current.id;
      insert into public.ward_capacity_history
        (ward_id, effective_from, effective_to, bed_capacity, note)
      values (p_ward_id, v_today,
        v_current.effective_to,
        p_bed_capacity, 'Updated in Edit Ward');
      v_change_date := v_today;
    end if;

    insert into public.audit_log(actor_user_id, action, entity_type, entity_id, details)
    values (auth.uid(), 'ward.capacity.change', 'ward', p_ward_id::text,
      jsonb_build_object('previous', v_current.bed_capacity,
        'new', p_bed_capacity, 'effective_from', v_change_date));
  end if;
end;
$$;

revoke all on function public.save_ward_configuration(uuid,text,text,text,text,boolean,integer,integer,timestamptz,date) from public;
grant execute on function public.save_ward_configuration(uuid,text,text,text,text,boolean,integer,integer,timestamptz,date) to authenticated;


-- Atomic creation of ward + initial operating period + capacity + audit.
create or replace function public.create_ward(p_config jsonb)
returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
declare
 v_ward public.wards%rowtype;
 v_name text := btrim(p_config->>'name');
 v_phone text := p_config->>'phone';
 v_fax text := p_config->>'fax';
 v_gender text := p_config->>'empty_bed_gender_mode';
 v_start date := (p_config->>'start_date')::date;
 v_end date := nullif(p_config->>'end_date','')::date;
 v_capacity integer := (p_config->>'bed_capacity')::integer;
begin
 if public.app_role() is distinct from 'maintenance' then
   raise exception 'Maintenance access required' using errcode='42501';
 end if;
 if v_name is null or v_name = '' or length(v_name) > 80 or
    coalesce(v_phone,'') !~ '^[0-9]{1,4}$' or coalesce(v_fax,'') !~ '^[0-9]{1,4}$' or
    v_gender is null or v_gender not in ('male','female','mixed','none') or
    v_start is null or (v_end is not null and v_end < v_start) or
    v_capacity is null or v_capacity < 0 or v_capacity > 500 then
   raise exception 'Invalid Ward configuration' using errcode='22023';
 end if;
 -- Serialize Ward ordering, so new Wards appear after existing ones.
 perform pg_advisory_xact_lock(753991,2);
 perform set_config('nightmemo.audit_explicit', 'true', true);
 insert into public.wards (name,phone,fax,empty_bed_gender_mode,single_double_reporting_enabled,display_order)
 values (v_name,v_phone,v_fax,v_gender,coalesce((p_config->>'single_double_reporting_enabled')::boolean,false),
         coalesce((select max(display_order) from public.wards),0)+1)
 returning * into v_ward;
 insert into public.ward_operating_periods(ward_id,start_date,end_date,note)
 values(v_ward.id,v_start,v_end,coalesce(nullif(p_config->>'note',''),'Ward opened'));
 insert into public.ward_capacity_history(ward_id,effective_from,bed_capacity,note)
 values(v_ward.id,v_start,v_capacity,'Initial capacity');
 insert into public.audit_log(actor_user_id,action,entity_type,entity_id,details)
 values(auth.uid(),'ward.create','ward',v_ward.id::text,jsonb_build_object('name',v_name,'capacity',v_capacity));
 return to_jsonb(v_ward);
end $$;
revoke all on function public.create_ward(jsonb) from public,anon;
grant execute on function public.create_ward(jsonb) to authenticated;
-- Untrusted roles must never call privileged/internal helper functions directly.
revoke all on function public.app_role(),public.app_ward_id(),public.app_access_active(),public.ward_operational_on(uuid,date) from public,anon;
-- These helpers are referenced by RLS expressions and must remain executable by authenticated.
grant execute on function public.app_role(),public.app_ward_id(),public.app_access_active(),public.ward_operational_on(uuid,date) to authenticated;
revoke all on function public.resolve_form_version_for_date(date) from public,anon;
revoke all on function public.assign_audit_actor() from public,anon;


-- Account access writes and their audit records are committed atomically.
-- Auth credentials are managed only by the Edge Function and are never stored here.
-- Only service_role can call this RPC, AND it must name an active Maintenance
-- actor. Advisory locking protects the last active Maintenance account.
create or replace function public.admin_write_user_access(p_actor uuid, p_action text, p_account jsonb)
returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
declare
  v_row public.user_access%rowtype;
  v_old public.user_access%rowtype;
  v_target uuid := (p_account->>'auth_user_id')::uuid;
  v_role text;
  v_ward uuid;
  v_active boolean;
begin
  if auth.role() is distinct from 'service_role' then
    raise exception 'Service role required' using errcode='42501';
  end if;
  -- Serialize all account authorization and writes BEFORE checking actor access.
  perform pg_advisory_xact_lock(753991,1);
  if not exists (select 1 from public.user_access
      where auth_user_id=p_actor and role='maintenance' and active) then
    raise exception 'Authorized Maintenance actor required' using errcode='42501';
  end if;
  if p_action not in ('create','rename_login','update_access') or p_action is null then
    raise exception 'Unsupported account write' using errcode='22023';
  end if;
  if p_action='create' then
    v_role:=p_account->>'role';
    v_ward:=nullif(p_account->>'ward_id','')::uuid;
    if v_role not in ('ward','manager','maintenance') or v_role is null or
       (v_role='ward' and v_ward is null) or (v_role<>'ward' and v_ward is not null) then
      raise exception 'Invalid account role/ward' using errcode='22023';
    end if;
    insert into public.user_access(auth_user_id,login_id,display_name,role,ward_id,active)
    values(v_target,p_account->>'login_id',p_account->>'display_name',v_role,v_ward,true)
    returning * into v_row;
  else
    select * into v_old from public.user_access where auth_user_id=v_target for update;
    if not found then raise exception 'Account not found'; end if;
    if p_action='rename_login' then
      update public.user_access
        set login_id=p_account->>'login_id',display_name=p_account->>'display_name'
        where auth_user_id=v_target returning * into v_row;
    else
      v_role:=p_account->>'role';
      v_ward:=nullif(p_account->>'ward_id','')::uuid;
      v_active:=(p_account->>'active')::boolean;
      if v_role not in ('ward','manager','maintenance') or v_role is null or v_active is null or
         (v_role='ward' and v_ward is null) or (v_role<>'ward' and v_ward is not null) then
        raise exception 'Invalid account role/ward' using errcode='22023';
      end if;
      if v_target=p_actor and (v_role <> 'maintenance' or v_active = false) then
        raise exception 'Cannot remove your own Maintenance access' using errcode='22023';
      end if;
      if v_old.role='maintenance' and v_old.active and (v_role<>'maintenance' or v_active=false)
        and (select count(*) from public.user_access where role='maintenance' and active) <= 1 then
        raise exception 'Cannot remove the last active Maintenance account' using errcode='22023';
      end if;
      update public.user_access
        set role=v_role,ward_id=v_ward,active=v_active,display_name=p_account->>'display_name'
        where auth_user_id=v_target returning * into v_row;
    end if;
  end if;
  insert into public.audit_log(actor_user_id,action,entity_type,entity_id,details)
  values(p_actor,'account.'||p_action,'user_access',v_target::text,
    jsonb_build_object('old_role',v_old.role,'new_role',v_row.role,'old_active',v_old.active,'new_active',v_row.active));
  return to_jsonb(v_row);
end $$;
revoke all on function public.admin_write_user_access(uuid,text,jsonb) from public,anon,authenticated;
grant execute on function public.admin_write_user_access(uuid,text,jsonb) to service_role;


-- Transactional audit for direct configuration mutations. Security-definer
-- trigger is necessary for Ward staff actions (Ward users have no audit_log
-- insert privileges). Explicitly audited RPCs suppress duplicate log entries.
create or replace function public.audit_configuration_mutation()
returns trigger language plpgsql security definer set search_path=public,pg_temp as $$
declare
  v_before jsonb;
  v_after jsonb;
  v_entity text;
begin
  -- SQL Editor initialization and service/background jobs have no JWT actor.
  if auth.uid() is null or current_setting('nightmemo.audit_explicit', true) = 'true' then
    return null;
  end if;
  if tg_op <> 'INSERT' then v_before := to_jsonb(old); end if;
  if tg_op <> 'DELETE' then v_after := to_jsonb(new); end if;
  v_entity := coalesce(v_after->>'id',v_before->>'id',v_after->>'ward_id',v_before->>'ward_id');
  insert into public.audit_log(actor_user_id,action,entity_type,entity_id,details)
  values(auth.uid(),'db.'||tg_table_name||'.'||lower(tg_op),tg_table_name,v_entity,
    jsonb_build_object('before',v_before,'after',v_after));
  return null;
end $$;
revoke all on function public.audit_configuration_mutation() from public,anon,authenticated;
create trigger trg_wards_config_audit after insert or update or delete on public.wards
  for each row execute function public.audit_configuration_mutation();
create trigger trg_period_config_audit after insert or update or delete on public.ward_operating_periods
  for each row execute function public.audit_configuration_mutation();
create trigger trg_capacity_config_audit after insert or update or delete on public.ward_capacity_history
  for each row execute function public.audit_configuration_mutation();
create trigger trg_items_config_audit after insert or update or delete on public.report_items
  for each row execute function public.audit_configuration_mutation();
create trigger trg_staff_config_audit after insert or update or delete on public.ward_staff
  for each row execute function public.audit_configuration_mutation();


commit;
-- Experimental branch: run ONCE in Supabase SQL Editor before deploying frontend.
-- Keep the existing manager_memos and manager_memo_revisions tables/RPCs.
-- Store DOCX bytes as bytea and leave immutable UUID references inside their JSONB document fields.
create table if not exists public.manager_memo_docx_documents (
  id uuid primary key default gen_random_uuid(),
  data bytea not null,
  byte_count integer generated always as (octet_length(data)) stored,
  created_at timestamptz not null default now(),
  created_by uuid not null default auth.uid(),
  constraint manager_docx_size_limit check (octet_length(data) between 100 and 3145728),
  constraint manager_docx_zip_magic check (substring(data from 1 for 2) = decode('504b','hex'))
);
create index if not exists manager_docx_created_idx on public.manager_memo_docx_documents(created_at);
alter table public.manager_memo_docx_documents enable row level security;
revoke all on public.manager_memo_docx_documents from public, anon, authenticated;

-- Atomic binary upload + manager recovery revision check, in one PostgreSQL transaction.
create or replace function public.save_manager_memo_recovery_docx(
  p_reporting_date date,
  p_docx_base64 text,
  p_source_snapshot jsonb,
  p_expected_revision integer default 0
) returns jsonb language plpgsql security definer set search_path = public, pg_temp as $$
declare
  v_uid uuid := auth.uid();
  v_binary bytea;
  v_id uuid;
  v_meta jsonb;
begin
  if v_uid is null or not exists (select 1 from public.user_access where auth_user_id=v_uid and role='manager' and active=true) then
    raise exception 'MANAGER_ACCESS_REQUIRED';
  end if;
  if length(coalesce(p_docx_base64,'')) > 4200000 then raise exception 'DOCX_TOO_LARGE'; end if;
  v_binary := decode(p_docx_base64,'base64');
  if octet_length(v_binary) not between 100 and 3145728 or substring(v_binary from 1 for 2) <> decode('504b','hex') then
    raise exception 'INVALID_DOCX';
  end if;
  insert into public.manager_memo_docx_documents(data,created_by) values (v_binary,v_uid) returning id into v_id;
  v_meta := jsonb_build_object('version',5,'format','docx','document_id',v_id,'size_bytes',octet_length(v_binary));
  return public.save_manager_memo_recovery(p_reporting_date,v_meta,p_source_snapshot,p_expected_revision);
end;
$$;

create or replace function public.save_manager_memo_revision_docx(
  p_reporting_date date,
  p_docx_base64 text,
  p_source_snapshot jsonb,
  p_expected_revision integer,
  p_revision_type text,
  p_reason text default null,
  p_actor_label text default null
) returns jsonb language plpgsql security definer set search_path = public, pg_temp as $$
declare
  v_uid uuid := auth.uid();
  v_binary bytea;
  v_id uuid;
  v_meta jsonb;
begin
  if v_uid is null or not exists (select 1 from public.user_access where auth_user_id=v_uid and role='manager' and active=true) then
    raise exception 'MANAGER_ACCESS_REQUIRED';
  end if;
  if length(coalesce(p_docx_base64,'')) > 4200000 then raise exception 'DOCX_TOO_LARGE'; end if;
  v_binary := decode(p_docx_base64,'base64');
  if octet_length(v_binary) not between 100 and 3145728 or substring(v_binary from 1 for 2) <> decode('504b','hex') then
    raise exception 'INVALID_DOCX';
  end if;
  insert into public.manager_memo_docx_documents(data,created_by) values (v_binary,v_uid) returning id into v_id;
  v_meta := jsonb_build_object('version',5,'format','docx','document_id',v_id,'size_bytes',octet_length(v_binary));
  return public.save_manager_memo_revision(p_reporting_date,v_meta,p_source_snapshot,p_expected_revision,p_revision_type,p_reason,p_actor_label);
end;
$$;

create or replace function public.read_manager_memo_docx(p_document_id uuid)
returns text language plpgsql security definer set search_path = public, pg_temp as $$
declare v_data bytea;
begin
  if auth.uid() is null or not exists (select 1 from public.user_access where auth_user_id=auth.uid() and role='manager' and active=true) then
    raise exception 'MANAGER_ACCESS_REQUIRED';
  end if;
  -- Reject guessing any doc not currently reachable through authorized Manager data.
  if not exists (
    select 1 from public.manager_memos m where m.document->>'document_id'=p_document_id::text
    union all select 1 from public.manager_memo_revisions r where r.document->>'document_id'=p_document_id::text
    union all select 1 from public.manager_memo_recovery_snapshots s where s.document->>'document_id'=p_document_id::text
  ) then raise exception 'DOCX_NOT_REFERENCED'; end if;
  select data into v_data from public.manager_memo_docx_documents where id=p_document_id;
  if not found then raise exception 'DOCX_NOT_FOUND'; end if;
  return encode(v_data,'base64');
end;
$$;

revoke all on function public.save_manager_memo_recovery_docx(date,text,jsonb,integer) from public;
revoke all on function public.save_manager_memo_revision_docx(date,text,jsonb,integer,text,text,text) from public;
revoke all on function public.read_manager_memo_docx(uuid) from public;
grant execute on function public.save_manager_memo_recovery_docx(date,text,jsonb,integer) to authenticated;
grant execute on function public.save_manager_memo_revision_docx(date,text,jsonb,integer,text,text,text) to authenticated;
grant execute on function public.read_manager_memo_docx(uuid) to authenticated;

-- Experiment safety: leave legacy JSON save RPC grants unchanged.
