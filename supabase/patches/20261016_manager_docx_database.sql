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

-- Experiment safety: leave the legacy JSON save RPC grants unchanged. Git branches
-- do NOT isolate Supabase schema. The main branch can keep using its old Manager UI
-- during this test. A future production migration can revoke them separately.
