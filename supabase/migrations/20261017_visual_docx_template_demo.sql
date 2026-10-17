-- One-time visual DOCX template setup for the Nurse Memo demo.
-- Run in Supabase SQL Editor AFTER the existing Nurse Memo schema has been
-- installed. This discards only the previous numeric DOCX template settings.
-- Ward, Manager reports, accounts, and unrelated tables are untouched.
-- Do not run this script to preserve a previously published visual template.
begin;
drop table if exists public.night_memo_docx_layout cascade;
drop function if exists public.night_memo_docx_layout_version();
drop table if exists public.night_memo_visual_templates cascade;

-- The editable Night Memo DOCX master is managed by Maintenance and read by Manager.
-- Only template metadata can be queried by the application directly. The stored
-- DOCX can only be read/written through role-checked RPC functions.
create table public.night_memo_visual_templates (
 id integer primary key default 1 check (id=1),
 template_docx bytea,
 has_template boolean not null default false,
 version integer not null default 1 check (version > 0),
 updated_at timestamptz not null default now(),
 updated_by uuid references auth.users(id) on delete set null,
 constraint night_memo_visual_docx_valid check (
   (template_docx is null and not has_template) or
   (template_docx is not null and has_template and
    octet_length(template_docx) between 100 and 3145728 and
    substring(template_docx from 1 for 2) = decode('504b','hex'))
 )
);
insert into public.night_memo_visual_templates(id,version) values (1,1);

create or replace function public.night_memo_visual_template_version()
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
revoke all on function public.night_memo_visual_template_version() from public,anon,authenticated;
create trigger trg_night_memo_visual_template_version
 before update on public.night_memo_visual_templates for each row
 execute function public.night_memo_visual_template_version();

alter table public.night_memo_visual_templates enable row level security;
create policy visual_template_metadata_read on public.night_memo_visual_templates
 for select to authenticated using (public.app_role() in ('manager','maintenance'));
revoke all on public.night_memo_visual_templates from public,anon,authenticated;
grant select(id,version,has_template) on public.night_memo_visual_templates to authenticated;

create or replace function public.read_night_memo_visual_template()
returns text language plpgsql security definer set search_path = public,pg_temp as $$
declare v_bytes bytea;
begin
 if auth.uid() is null or public.app_role() not in ('manager','maintenance') then
   raise exception 'Not permitted to read template' using errcode='42501';
 end if;
 select template_docx into v_bytes from public.night_memo_visual_templates where id=1;
 return case when v_bytes is null then null else encode(v_bytes,'base64') end;
end;$$;

create or replace function public.publish_night_memo_visual_template(
 p_docx_base64 text, p_expected_version integer
) returns integer language plpgsql security definer set search_path = public,pg_temp as $$
declare v_bytes bytea; v_version integer;
begin
 if auth.uid() is null or public.app_role() <> 'maintenance' then
   raise exception 'Maintenance role required' using errcode='42501';
 end if;
 if p_docx_base64 is null or length(p_docx_base64)>4200000 then
   raise exception 'DOCX template too large' using errcode='22023';
 end if;
 v_bytes:=decode(p_docx_base64,'base64');
 if octet_length(v_bytes)<100 or octet_length(v_bytes)>3145728
   or substring(v_bytes from 1 for 2)<>decode('504b','hex') then
   raise exception 'DOCX template must be a valid ZIP document up to 3 MiB' using errcode='22023';
 end if;
 update public.night_memo_visual_templates
    set template_docx=v_bytes,has_template=true
  where id=1 and version=p_expected_version
  returning version into v_version;
 if v_version is null then
   raise exception 'Template changed in another session. Reload before publishing.' using errcode='40001';
 end if;
 return v_version;
end;$$;
revoke all on function public.read_night_memo_visual_template() from public,anon,authenticated;
revoke all on function public.publish_night_memo_visual_template(text,integer) from public,anon,authenticated;
grant execute on function public.read_night_memo_visual_template() to authenticated;
grant execute on function public.publish_night_memo_visual_template(text,integer) to authenticated;

commit;
