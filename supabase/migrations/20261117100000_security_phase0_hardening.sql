-- ══════════════════════════════════════════════════════════════════════════
-- Migration: Phase 0 security hardening (review of 2026-11-17)
--
-- 1. Self-service privilege escalation via profiles.role (found while fixing F-01/F-17).
--    is_current_user_admin() and check_profile_role_unchanged() are SECURITY DEFINER and tested
--    `current_user in ('postgres', ...)`. Inside a SECURITY DEFINER function current_user is the
--    function owner, so both checks were always true: any authenticated user (including a
--    self-registered 'pending' account) could set their own role to 'admin', and every
--    authenticated user could read every profile through profiles_admin_read.
-- 2. Column-level privileges on profiles so role can only change through definer functions or
--    the service role.
-- 3. F-02: public_verify_document uses exact equality on verification_code only. No ILIKE, no
--    lookup by certificate id or invoice number, revocation always enforced.
-- 4. F-09 / F-17: redeem_invite_code is service-role only and now consumes the invite and
--    upgrades the profile role in one transaction.
-- ══════════════════════════════════════════════════════════════════════════

-- 1a. Admin check: service role (via request JWT) or an admin profile. No current_user test.
create or replace function public.is_current_user_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $function$
  select
    coalesce((select auth.jwt() ->> 'role') = 'service_role', false)
    or exists (
      select 1 from public.profiles
      where id = (select auth.uid()) and role = 'admin'
    );
$function$;

revoke all on function public.is_current_user_admin() from public, anon;
grant execute on function public.is_current_user_admin() to authenticated, service_role;

-- 1b. Role-change guard. Requests carrying the service-role JWT and sessions with no end-user
--     identity (migrations, SQL editor, auth triggers) are allowed; any end user needs admin.
create or replace function public.check_profile_role_unchanged()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if old.role is not distinct from new.role then
    return new;
  end if;

  if coalesce((select auth.jwt() ->> 'role') = 'service_role', false) then
    return new;
  end if;

  if (select auth.uid()) is null then
    return new;
  end if;

  if not (select public.is_current_user_admin()) then
    raise exception 'Non-admin users cannot modify their role' using errcode = '42501';
  end if;

  return new;
end;
$$;

revoke all on function public.check_profile_role_unchanged() from public, anon, authenticated;

-- 2. Column-level privileges. Profile creation happens in handle_new_user() (definer) or with the
--    service role; role changes go through admin_change_profile_role() (definer) or the service role.
revoke insert, update on public.profiles from authenticated;
grant update (full_name, contact_details, metadata) on public.profiles to authenticated;

-- 3. Public verification: exact match only.
create or replace function public.public_verify_document(p_code text)
returns table (
  status text,
  document_type text,
  student_name text,
  course_name text,
  issue_date date,
  invoice_number text
)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_document record;
  v_student_name text;
  v_course_name text;
  v_issue_date date;
  v_invoice text;
  v_code text := btrim(coalesce(p_code, ''));
begin
  -- Codes are URL-safe base64 (A-Z a-z 0-9 _ -). Reject anything else before touching tables.
  if v_code !~ '^[A-Za-z0-9_-]{6,128}$' then
    return query select 'Invalid'::text, null::text, null::text, null::text, null::date, null::text;
    return;
  end if;

  select vd.doc_type, vd.reference_id, vd.status, vd.revoked_at
    into v_document
  from public.verifiable_documents as vd
  where vd.verification_code = v_code;

  if not found or v_document.status <> 'active' or v_document.revoked_at is not null then
    return query select 'Invalid'::text, null::text, null::text, null::text, null::date, null::text;
    return;
  end if;

  if v_document.doc_type = 'certificate' then
    select c.student_name, c.course_name, c.issue_date
      into v_student_name, v_course_name, v_issue_date
    from public.certificates as c
    where c.id::text = v_document.reference_id;
  elsif v_document.doc_type = 'invoice' then
    select s.name, s.course, p.payment_date, p.invoice
      into v_student_name, v_course_name, v_issue_date, v_invoice
    from public.payments as p
    join public.students as s on s.id = p.student_id
    where p.id::text = v_document.reference_id;
  end if;

  if v_issue_date is null then
    return query select 'Invalid'::text, null::text, null::text, null::text, null::date, null::text;
    return;
  end if;

  return query select
    'Valid'::text,
    v_document.doc_type,
    case when v_student_name is null then null else left(v_student_name, 1) || '…' end,
    v_course_name,
    v_issue_date,
    v_invoice;
end;
$$;

revoke all on function public.public_verify_document(text) from public, anon, authenticated;
grant execute on function public.public_verify_document(text) to anon, authenticated;

-- 4. Atomic invite redemption: consume the code and upgrade the profile in one transaction.
create or replace function public.redeem_invite_code(
  p_code text,
  p_user_id uuid,
  p_email text
)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_invite record;
  v_auth_email text;
  v_current_role text;
begin
  if p_code is null or btrim(p_code) = '' then
    raise exception using errcode = '22023', message = 'Invite code is required.';
  end if;

  select u.email into v_auth_email from auth.users as u where u.id = p_user_id;
  if v_auth_email is null or lower(btrim(v_auth_email)) <> lower(btrim(coalesce(p_email, ''))) then
    raise exception using errcode = '22023', message = 'Invite code cannot be applied to this account.';
  end if;

  select * into v_invite
  from public.invite_codes
  where upper(btrim(code)) = upper(btrim(p_code))
  for update;

  if not found then
    raise exception using errcode = 'P0002', message = 'Invalid invite code.';
  end if;
  if v_invite.is_used then
    raise exception using errcode = '22023', message = 'This invite code has already been redeemed.';
  end if;
  if v_invite.expires_at < now() then
    raise exception using errcode = '22023', message = 'This invite code has expired.';
  end if;
  if v_invite.recipient_email is not null and btrim(v_invite.recipient_email) <> ''
     and lower(btrim(v_invite.recipient_email)) <> lower(btrim(v_auth_email)) then
    raise exception using errcode = '22023', message = 'This invite code is reserved for a different email address.';
  end if;

  select role into v_current_role from public.profiles where id = p_user_id for update;
  if not found then
    raise exception using errcode = 'P0002', message = 'Profile not found.';
  end if;

  update public.invite_codes
  set is_used = true,
      used_by_user_id = p_user_id,
      used_at = now()
  where id = v_invite.id;

  -- Upgrade only: pending -> staff/admin, staff -> admin. Never downgrade an existing admin.
  if v_current_role = 'pending' or (v_current_role = 'staff' and v_invite.role = 'admin') then
    update public.profiles set role = v_invite.role where id = p_user_id;
    return v_invite.role;
  end if;

  return v_current_role;
end;
$$;

revoke all on function public.redeem_invite_code(text, uuid, text) from public, anon, authenticated;
grant execute on function public.redeem_invite_code(text, uuid, text) to service_role;

-- 5. Trigger-only functions are not RPC endpoints (Supabase advisor 0028/0029). Firing a trigger does not
--    require EXECUTE for the session role, so revoking it only closes /rest/v1/rpc/<name>.
revoke all on function public.audit_log_trigger_function() from public, anon, authenticated;

-- 6. F-37 and advisor 0011: pin search_path. Every body below uses schema-qualified names or pg_catalog
--    built-ins only (checked against the live definitions on 2026-11-17).
alter function public.audit_log_trigger_function() set search_path = '';
alter function public.tg__set_updated_at() set search_path = '';
alter function public.tg__students__derive_status() set search_path = '';
alter function public.generate_payment_id() set search_path = '';
alter function public.generate_invoice_number() set search_path = '';
alter function public.validate_assessment_score() set search_path = '';
