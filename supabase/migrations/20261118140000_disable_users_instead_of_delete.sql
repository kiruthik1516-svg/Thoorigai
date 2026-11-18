-- ══════════════════════════════════════════════════════════════════════════
-- Migration: disable user accounts instead of deleting them (F-12, F-32)
--
-- F-12  DELETE /api/admin/users nulled audit_log.changed_by with the service role (bypassing the
--       immutable-audit policy) and then hard-deleted the auth user, erasing who did what.
--       Accounts are now disabled: role drops to 'pending' (every role check denies at once),
--       disabled_at/disabled_by are recorded, and the route bans the auth user. Audit rows are
--       never touched.
-- F-32  The last-admin rule ran in the route with a separate count query (racy). Disabling goes
--       through admin_change_profile_role, which takes the role-change advisory lock.
-- ══════════════════════════════════════════════════════════════════════════

alter table public.profiles add column if not exists disabled_at timestamptz;
alter table public.profiles add column if not exists disabled_by uuid;

comment on column public.profiles.disabled_at is 'Set when an admin disables the account (F-12). Disabled accounts are banned in auth and hold role pending.';

create or replace function public.admin_set_user_disabled(p_user_id uuid, p_disabled boolean)
returns void
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_actor uuid := (select auth.uid());
  v_was timestamptz;
begin
  if v_actor is null then
    raise exception using errcode = '42501', message = 'Authentication is required';
  end if;
  if p_user_id = v_actor then
    raise exception using errcode = '22023', message = 'You cannot disable your own account';
  end if;
  if not exists (select 1 from public.profiles where id = v_actor and role = 'admin' and disabled_at is null) then
    raise exception using errcode = '42501', message = 'Admin access is required';
  end if;

  select disabled_at into v_was from public.profiles where id = p_user_id;
  if not found then
    raise exception using errcode = 'P0002', message = 'Profile not found';
  end if;

  if p_disabled then
    -- Takes the role-change lock and enforces "at least one admin must remain".
    perform public.admin_change_profile_role(p_user_id, 'pending');
    update public.profiles
       set disabled_at = coalesce(disabled_at, now()), disabled_by = coalesce(disabled_by, v_actor)
     where id = p_user_id;
  else
    update public.profiles set disabled_at = null, disabled_by = null where id = p_user_id;
  end if;

  if (v_was is null) = p_disabled then
    insert into public.audit_log (table_name, record_id, action, changed_by, old_values, new_values)
    values (
      'profiles', p_user_id, 'update', v_actor,
      pg_catalog.jsonb_build_object('disabled', v_was is not null),
      pg_catalog.jsonb_build_object('disabled', p_disabled)
    );
  end if;
end $function$;

revoke all on function public.admin_set_user_disabled(uuid, boolean) from public, anon;
grant execute on function public.admin_set_user_disabled(uuid, boolean) to authenticated;
