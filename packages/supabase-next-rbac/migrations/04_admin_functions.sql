-- ══════════════════════════════════════════════════════════════════════════
-- 04_admin_functions.sql
-- Atomic, concurrent-safe role modification with self-demotion prevention
-- ══════════════════════════════════════════════════════════════════════════

create or replace function public.admin_change_profile_role(p_user_id uuid, p_role text)
returns void
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_actor uuid := (select auth.uid());
  v_old_role text;
begin
  if v_actor is null then
    raise exception using errcode = '42501', message = 'Authentication is required.';
  end if;

  if p_role is null or trim(p_role) = '' then
    raise exception using errcode = '22023', message = 'Role must not be empty.';
  end if;

  -- Prevent self role change (prevents accidental lockout)
  if p_user_id = v_actor then
    raise exception using errcode = '22023', message = 'You cannot change your own role.';
  end if;

  -- Acquire transaction-level advisory lock to serialize concurrent admin changes
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtext('admin-profile-role-change'));

  -- Verify calling actor is an active administrator
  if not exists (select 1 from public.profiles where id = v_actor and role = 'admin') then
    raise exception using errcode = '42501', message = 'Administrator access is required.';
  end if;

  -- Lock and read target profile
  select role into v_old_role from public.profiles where id = p_user_id for update;
  if not found then
    raise exception using errcode = 'P0002', message = 'Target profile was not found.';
  end if;

  -- Idempotent check
  if v_old_role = p_role then
    return;
  end if;

  -- Ensure at least one administrator remains
  if v_old_role = 'admin' and p_role <> 'admin'
    and (select count(*) from public.profiles where role = 'admin') <= 1 then
    raise exception using errcode = '23514', message = 'At least one active admin account must remain.';
  end if;

  -- Apply change
  update public.profiles set role = p_role, updated_at = now() where id = p_user_id;

  -- Record audit event
  insert into public.audit_log (table_name, record_id, action, changed_by, old_values, new_values)
  values (
    'profiles',
    p_user_id,
    'update_role',
    v_actor,
    pg_catalog.jsonb_build_object('role', v_old_role),
    pg_catalog.jsonb_build_object('role', p_role)
  );
end;
$function$;

alter function public.admin_change_profile_role(uuid, text) security definer;
alter function public.admin_change_profile_role(uuid, text) set search_path = '';
revoke all on function public.admin_change_profile_role(uuid, text) from public, anon;
grant execute on function public.admin_change_profile_role(uuid, text) to authenticated;
