-- ADDITIVE Nurse Memo application-login upgrade for the EXISTING Supabase project.
-- No AUTH password, email, UUID, ward, document or existing data is reset.
-- DEMO ONLY: initial Nurse Memo passwords equal the lowercase current account IDs.
-- Run ONCE in SQL Editor, BEFORE deploying the updated user-login/admin-users functions.
-- Re-running preserves passwords already set in Maintenance.
begin;
set local search_path=pg_catalog,extensions,public;
create extension if not exists pgcrypto;

create table if not exists public.app_login_credentials (
  auth_user_id uuid primary key references public.user_access(auth_user_id) on delete cascade,
  password_hash text not null,
  failed_attempts int not null default 0,
  locked_until timestamptz,
  updated_at timestamptz not null default now()
);
revoke all on table public.app_login_credentials from public, anon, authenticated;
grant select,insert,update,delete on public.app_login_credentials to service_role;
alter table public.app_login_credentials enable row level security;

-- Seed EXISTING synthetic accounts. Only rows without a password hash are inserted.
-- This is an intentional test-account credential initialization, NOT a Supabase Auth reset.
insert into public.app_login_credentials(auth_user_id,password_hash)
select auth_user_id,crypt(lower(login_id), gen_salt('bf',10))
from public.user_access
on conflict(auth_user_id) do nothing;

create or replace function public.app_login_verify(p_login_id text, p_password text)
returns uuid language plpgsql security definer
set search_path=pg_catalog,extensions,public,pg_temp as $$
declare v_row record;
begin
  if auth.role() is distinct from 'service_role' then
    raise exception 'Service role required' using errcode='42501';
  end if;
  if p_login_id is null or length(p_login_id) > 32 or p_password is null
    or length(p_password) > 128 then return null; end if;
  select a.auth_user_id,c.password_hash,c.failed_attempts,c.locked_until
    into v_row from public.user_access a
    join public.app_login_credentials c on c.auth_user_id=a.auth_user_id
    where lower(a.login_id)=lower(trim(p_login_id)) and a.active
    for update of c;
  if not found then return null; end if;
  if v_row.locked_until is not null and v_row.locked_until > now() then return null; end if;
  if crypt(p_password,v_row.password_hash)=v_row.password_hash then
    update public.app_login_credentials set failed_attempts=0,locked_until=null
    where auth_user_id=v_row.auth_user_id;
    return v_row.auth_user_id;
  end if;
  update public.app_login_credentials set
    failed_attempts=case when v_row.failed_attempts>=4 then 0 else v_row.failed_attempts+1 end,
    locked_until=case when v_row.failed_attempts>=4 then now()+interval '5 minutes' else null end
    where auth_user_id=v_row.auth_user_id;
  return null;
end $$;
revoke all on function public.app_login_verify(text,text) from public,anon,authenticated;
grant execute on function public.app_login_verify(text,text) to service_role;

create or replace function public.app_login_set_password(p_actor uuid,p_user_id uuid,p_password text)
returns boolean language plpgsql security definer
set search_path=pg_catalog,extensions,public,pg_temp as $$
begin
  if auth.role() is distinct from 'service_role' then
    raise exception 'Service role required' using errcode='42501';
  end if;
  if p_actor is null then
    -- Limited bootstrap case: the account must have no application password yet.
    if exists(select 1 from public.app_login_credentials where auth_user_id=p_user_id) then
      raise exception 'Initial password already exists' using errcode='23505';
    end if;
  elsif not exists (select 1 from public.user_access
      where auth_user_id=p_actor and role='maintenance' and active) then
    raise exception 'Maintenance access required' using errcode='42501';
  end if;
  if not exists(select 1 from public.user_access where auth_user_id=p_user_id) then
    raise exception 'Account not found' using errcode='23503';
  end if;
  if p_password is null or length(p_password)<2 or length(p_password)>128 then
    raise exception 'Password must contain 2 to 128 characters' using errcode='22023';
  end if;
  insert into public.app_login_credentials(auth_user_id,password_hash,failed_attempts,locked_until,updated_at)
    values(p_user_id,crypt(p_password,gen_salt('bf',10)),0,null,now())
    on conflict(auth_user_id) do update
      set password_hash=excluded.password_hash,failed_attempts=0,
          locked_until=null,updated_at=now();
  if p_actor is not null then
    insert into public.audit_log(actor_user_id,action,entity_type,entity_id,details)
    values(p_actor,'account.app_password_changed','user_access',p_user_id::text,'{}'::jsonb);
  end if;
  return true;
end $$;
revoke all on function public.app_login_set_password(uuid,uuid,text) from public,anon,authenticated;
grant execute on function public.app_login_set_password(uuid,uuid,text) to service_role;

-- Atomic app-account edit: no Supabase Auth email/password writes.
create or replace function public.app_update_account(p_actor uuid,p_target uuid,p_changes jsonb)
returns jsonb language plpgsql security definer
set search_path=pg_catalog,public,pg_temp as $$
declare v_old public.user_access%rowtype; v_new public.user_access%rowtype;
  v_login text; v_display text; v_role text; v_ward uuid; v_active boolean;
begin
  if auth.role() is distinct from 'service_role' then
    raise exception 'Service role required' using errcode='42501';
  end if;
  perform pg_advisory_xact_lock(753991,1);
  if not exists(select 1 from public.user_access where auth_user_id=p_actor and role='maintenance' and active) then
    raise exception 'Maintenance access required' using errcode='42501';
  end if;
  if p_changes is null or jsonb_typeof(p_changes)<>'object'
    or exists (select 1 from jsonb_object_keys(p_changes) as j(k)
      where k not in ('login_id','display_name','role','ward_id','active')) then
    raise exception 'Invalid account changes' using errcode='22023';
  end if;
  select * into v_old from public.user_access where auth_user_id=p_target for update;
  if not found then raise exception 'Account not found' using errcode='23503'; end if;
  v_login := coalesce(p_changes->>'login_id',v_old.login_id);
  v_display := case when p_changes ? 'display_name' then p_changes->>'display_name' else v_old.display_name end;
  v_role := coalesce(p_changes->>'role',v_old.role);
  v_ward := case when p_changes ? 'ward_id' then nullif(p_changes->>'ward_id','')::uuid else v_old.ward_id end;
  v_active := case when p_changes ? 'active' then (p_changes->>'active')::boolean else v_old.active end;
  if v_login !~ '^[A-Za-z][A-Za-z0-9_-]{1,31}$' or
     v_role not in ('ward','patrol','maintenance') or v_active is null or
     (v_role='ward' and v_ward is null) or (v_role<>'ward' and v_ward is not null) then
    raise exception 'Invalid account fields' using errcode='22023';
  end if;
  if p_target=p_actor and (v_role<>'maintenance' or not v_active) then
    raise exception 'Cannot remove own Maintenance access' using errcode='22023';
  end if;
  if v_old.role='maintenance' and v_old.active and (v_role<>'maintenance' or not v_active)
    and (select count(*) from public.user_access where role='maintenance' and active)<=1 then
    raise exception 'Cannot disable the last Maintenance account' using errcode='22023';
  end if;
  update public.user_access set login_id=v_login,display_name=v_display,
    role=v_role,ward_id=v_ward,active=v_active,updated_at=now()
    where auth_user_id=p_target returning * into v_new;
  insert into public.audit_log(actor_user_id,action,entity_type,entity_id,details)
    values(p_actor,'account.update_account','user_access',p_target::text,
      jsonb_build_object('changed_fields',(select jsonb_agg(k) from jsonb_object_keys(p_changes) k)));
  return to_jsonb(v_new);
end $$;
revoke all on function public.app_update_account(uuid,uuid,jsonb) from public,anon,authenticated;
grant execute on function public.app_update_account(uuid,uuid,jsonb) to service_role;
commit;
