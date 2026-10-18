-- Run ONCE in the existing Supabase project's SQL Editor before deploying the updated Ward UI.
-- Safe to rerun. No existing memo data or account tables are changed.
-- Do not re-run schema.sql on an existing project.

-- Read-only, ward-scoped draft history. Returns metadata only (never clinical payloads).
-- Requires a signed-in Ward account associated with the requested ward.
create or replace function public.list_ward_cycle_drafts(p_ward_id uuid, p_limit integer default 30)
returns jsonb language plpgsql security definer set search_path = public, pg_temp as $$
declare v_history jsonb;
begin
  if p_ward_id is null or auth.uid() is null or not exists (
    select 1 from public.user_access a
    where a.auth_user_id = auth.uid() and a.active and a.role = 'ward'
      and a.ward_id = p_ward_id
  ) then
    raise exception 'Ward access denied' using errcode = '42501';
  end if;
  select coalesce(jsonb_agg(to_jsonb(d) order by d.updated_at desc, d.report_date desc, d.report_type), '[]'::jsonb)
    into v_history from (
      select ward_id, report_date, report_type, revision, updated_at, created_at
      from public.ward_cycle_drafts
      where ward_id = p_ward_id
      order by updated_at desc, report_date desc, report_type
      limit least(greatest(coalesce(p_limit, 30), 1), 100)
    ) d;
  return v_history;
end $$;
revoke all on function public.list_ward_cycle_drafts(uuid,integer) from public,anon;
grant execute on function public.list_ward_cycle_drafts(uuid,integer) to authenticated;
