-- Additive migration for deployed Nurse Memo databases (Supabase SQL Editor).
-- Does not delete or alter existing memo, archive, Ward or HTML print data.
begin;
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
commit;
