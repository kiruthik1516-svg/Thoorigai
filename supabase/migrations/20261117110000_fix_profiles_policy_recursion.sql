-- ══════════════════════════════════════════════════════════════════════════
-- Migration: Fix profiles policy recursion and legacy verification references
--
-- 1. "Admins can update profiles" and "Admins can manage profiles" query public.profiles from
--    inside a public.profiles policy. Postgres rejects that with 42P17 "infinite recursion
--    detected in policy", so every UPDATE on profiles from an end-user session failed,
--    including /api/user/settings and the non-role fields of PATCH /api/admin/users.
--    Replace them with policies that call the SECURITY DEFINER helper is_current_user_admin()
--    (fixed in 20261117100000), which reads profiles without re-entering RLS.
--    INSERT is no longer granted to authenticated (20261117100000), so the insert policy is dropped.
-- 2. Two legacy invoice rows in verifiable_documents store the invoice number as reference_id
--    instead of the payment id. The exact-match public_verify_document (20261117100000) only
--    joins on payment id, so those documents stopped verifying. Point them at the payment id.
-- ══════════════════════════════════════════════════════════════════════════

drop policy if exists "Admins can update profiles" on public.profiles;
drop policy if exists "Admins can manage profiles" on public.profiles;
drop policy if exists profiles_admin_update on public.profiles;

create policy profiles_admin_update on public.profiles
  for update to authenticated
  using ((select public.is_current_user_admin()))
  with check ((select public.is_current_user_admin()));

update public.verifiable_documents as vd
set reference_id = p.id::text
from public.payments as p
where vd.doc_type = 'invoice'
  and vd.reference_id = p.invoice
  and not exists (select 1 from public.payments as p2 where p2.id::text = vd.reference_id);
