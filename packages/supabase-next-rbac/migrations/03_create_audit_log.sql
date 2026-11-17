-- ══════════════════════════════════════════════════════════════════════════
-- 03_create_audit_log.sql
-- Immutable audit log for security-critical operations and role transitions
-- ══════════════════════════════════════════════════════════════════════════

create table if not exists public.audit_log (
  id uuid primary key default gen_random_uuid(),
  table_name text not null,
  record_id uuid,
  action text not null,
  changed_by uuid references auth.users(id) on delete set null,
  old_values jsonb,
  new_values jsonb,
  created_at timestamptz not null default now()
);

create index if not exists audit_log_created_at_idx on public.audit_log (created_at desc);
create index if not exists audit_log_record_idx on public.audit_log (table_name, record_id);
create index if not exists audit_log_changed_by_idx on public.audit_log (changed_by);

-- Enable RLS
alter table public.audit_log enable row level security;

-- Policies: only admins can view audit records. Nobody can update or delete them.
create policy "Admins can view audit logs"
  on public.audit_log for select
  using (
    exists (
      select 1 from public.profiles
      where profiles.id = auth.uid() and profiles.role = 'admin'
    )
  );
