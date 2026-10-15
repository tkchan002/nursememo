-- Apply ONCE to the EXISTING Night Memo Supabase project (SQL Editor).
-- Safe to rerun. Does not delete or alter data, bypass RLS for browser users,
-- or change your Data API automatic-exposure setting.
begin;
grant select on table public.wards to service_role;
grant select, insert on table public.user_access to service_role;
grant insert on table public.audit_log to service_role;
commit;

-- Read-only permission verification (expected: all true).
select
  has_table_privilege('service_role','public.wards','SELECT') as wards_read,
  has_table_privilege('service_role','public.user_access','SELECT') as accounts_read,
  has_table_privilege('service_role','public.user_access','INSERT') as accounts_create,
  has_table_privilege('service_role','public.audit_log','INSERT') as audit_insert;
