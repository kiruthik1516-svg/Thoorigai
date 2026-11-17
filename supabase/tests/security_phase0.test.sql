-- Regression tests for migration 20261117100000_security_phase0_hardening.
begin;
select plan(16);

-- Fixtures: one pending user, one staff user, one admin user.
insert into auth.users (id, email, raw_app_meta_data, raw_user_meta_data, aud, role)
values
  ('00000000-0000-4000-8000-0000000000a1', 'pending@example.test', '{"role":"pending"}', '{"full_name":"Pending"}', 'authenticated', 'authenticated'),
  ('00000000-0000-4000-8000-0000000000a2', 'staff@example.test',   '{"role":"staff"}',   '{"full_name":"Staff"}',   'authenticated', 'authenticated'),
  ('00000000-0000-4000-8000-0000000000a3', 'admin@example.test',   '{"role":"admin"}',   '{"full_name":"Admin"}',   'authenticated', 'authenticated');

insert into public.verifiable_documents (doc_type, reference_id, verification_code, status, revoked_at)
values ('certificate', gen_random_uuid()::text, 'phase0-revoked-code', 'revoked', now());

insert into public.invite_codes (code, role, expires_at)
values ('STAFF-TEST-0001', 'staff', now() + interval '1 day');

-- ── Privilege escalation through profiles.role ────────────────────────────
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-0000000000a1","role":"authenticated"}', true);

select ok(not public.is_current_user_admin(), 'a pending user is not treated as admin');

select throws_ok(
  $$ update public.profiles set role = 'admin' where id = '00000000-0000-4000-8000-0000000000a1' $$,
  '42501',
  null,
  'a pending user cannot set their own role'
);

select lives_ok(
  $$ update public.profiles set full_name = 'Renamed' where id = '00000000-0000-4000-8000-0000000000a1' $$,
  'a user can still update their own name'
);

select is(
  (select count(*)::int from public.profiles where id <> '00000000-0000-4000-8000-0000000000a1'),
  0,
  'a non-admin cannot read other profiles'
);

select throws_ok(
  $$ insert into public.profiles (id, role, full_name) values (gen_random_uuid(), 'admin', 'x') $$,
  '42501',
  null,
  'authenticated users cannot insert profiles directly'
);

-- Staff user
select set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-0000000000a2","role":"authenticated"}', true);
select ok(not public.is_current_user_admin(), 'a staff user is not treated as admin');
select throws_ok(
  $$ update public.profiles set role = 'admin' where id = '00000000-0000-4000-8000-0000000000a2' $$,
  '42501',
  null,
  'a staff user cannot promote themselves'
);

-- Admin user
select set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-0000000000a3","role":"authenticated"}', true);
select ok(public.is_current_user_admin(), 'an admin profile is recognised');
select lives_ok(
  $$ update public.profiles set full_name = 'Edited by admin' where id = '00000000-0000-4000-8000-0000000000a2' $$,
  'an admin can edit another profile without policy recursion (20261117110000)'
);
select is(
  (select full_name from public.profiles where id = '00000000-0000-4000-8000-0000000000a2'),
  'Edited by admin',
  'the admin edit was applied'
);

-- ── Invite redemption is not callable by end users ────────────────────────
reset role;
select ok(
  not has_function_privilege('anon', 'public.redeem_invite_code(text, uuid, text)', 'EXECUTE'),
  'anon cannot execute redeem_invite_code'
);
select ok(
  not has_function_privilege('authenticated', 'public.redeem_invite_code(text, uuid, text)', 'EXECUTE'),
  'authenticated cannot execute redeem_invite_code'
);

select is(
  public.redeem_invite_code('staff-test-0001', '00000000-0000-4000-8000-0000000000a1', 'pending@example.test'),
  'staff',
  'redeeming an invite upgrades a pending profile'
);
select is(
  (select role from public.profiles where id = '00000000-0000-4000-8000-0000000000a1'),
  'staff',
  'the profile role was changed in the same transaction'
);

-- ── Public verification: no wildcards, revocation enforced ───────────────
select is(
  (select status from public.public_verify_document(repeat('_', 10))),
  'Invalid',
  'underscore wildcards do not match any document'
);
select is(
  (select status from public.public_verify_document('phase0-revoked-code')),
  'Invalid',
  'a revoked document is Invalid'
);

select * from finish();
rollback;
