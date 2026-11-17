-- ══════════════════════════════════════════════════════════════════════════
-- 01_create_profiles.sql
-- Base profiles table with zero-trust default role and auto-sync trigger
-- ══════════════════════════════════════════════════════════════════════════

-- 1. Create profiles table
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  role text not null default 'pending',
  full_name text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Index for role-based queries
create index if not exists profiles_role_idx on public.profiles (role);

-- 2. Trigger function to synchronize auth.users -> public.profiles
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_role text;
  v_raw_role text;
begin
  -- Role is ONLY extracted from trusted app_metadata (never user_metadata)
  v_raw_role := new.raw_app_meta_data->>'role';

  if v_raw_role is not null and trim(v_raw_role) <> '' and v_raw_role <> 'pending' then
    v_role := v_raw_role;
  else
    v_role := 'pending';
  end if;

  insert into public.profiles (id, role, full_name, metadata)
  values (
    new.id,
    v_role,
    coalesce(new.raw_user_meta_data->>'full_name', ''),
    coalesce(new.raw_user_meta_data - 'full_name', '{}'::jsonb)
  )
  on conflict (id) do update set
    full_name = coalesce(excluded.full_name, public.profiles.full_name),
    role = case
      when public.profiles.role = 'pending' and v_role <> 'pending' then v_role
      else public.profiles.role
    end,
    updated_at = now();

  return new;
end;
$$;

-- Secure function permissions
alter function public.handle_new_user() security definer;
alter function public.handle_new_user() set search_path = '';
revoke all on function public.handle_new_user() from public, anon, authenticated;
grant execute on function public.handle_new_user() to supabase_auth_admin;

-- 3. Attach trigger to auth.users
drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- 4. Enable Row Level Security (RLS)
alter table public.profiles enable row level security;

-- Policies:
-- Self read: authenticated users can read their own profile
create policy "Users can read own profile"
  on public.profiles for select
  using (auth.uid() = id);

-- Self update: authenticated users can update their own display name / metadata
create policy "Users can update own basic profile"
  on public.profiles for update
  using (auth.uid() = id)
  with check (
    auth.uid() = id
    -- Prevent users from escalating their own role via direct update
    and role = (select p.role from public.profiles p where p.id = auth.uid())
  );

-- Admin read: admins can read all profiles
create policy "Admins can view all profiles"
  on public.profiles for select
  using (
    exists (
      select 1 from public.profiles
      where id = auth.uid() and role = 'admin'
    )
  );
