-- ══════════════════════════════════════════════════════════════════════════
-- 05_rls_helpers.sql
-- Reusable SQL helper functions to make writing RLS policies clean & fast
-- ══════════════════════════════════════════════════════════════════════════

-- Returns current user's profile role (stable, fast, security definer)
create or replace function public.auth_user_role()
returns text
language sql
stable
security definer
set search_path = ''
as $$
  select role from public.profiles where id = (select auth.uid());
$$;

-- Returns true if current user is an admin
create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.profiles
    where id = (select auth.uid()) and role = 'admin'
  );
$$;

-- Returns true if current user has any of the specified roles
create or replace function public.has_role(variadic allowed_roles text[])
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.profiles
    where id = (select auth.uid()) and role = any(allowed_roles)
  );
$$;

revoke all on function public.auth_user_role() from public;
grant execute on function public.auth_user_role() to authenticated;

revoke all on function public.is_admin() from public;
grant execute on function public.is_admin() to authenticated;

revoke all on function public.has_role(variadic text[]) from public;
grant execute on function public.has_role(variadic text[]) to authenticated;
