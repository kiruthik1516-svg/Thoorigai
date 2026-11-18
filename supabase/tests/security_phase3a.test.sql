-- Regression tests for 20261118140000_disable_users_instead_of_delete (F-12, F-32)
-- and 20261118150000_course_integrity (F-15).
begin;
select plan(13);

insert into auth.users (id, email, raw_app_meta_data, raw_user_meta_data, aud, role)
values
  ('00000000-0000-4000-8000-0000000000e1', 'p3-admin@example.test', '{"role":"admin"}', '{"full_name":"P3 Admin"}', 'authenticated', 'authenticated'),
  ('00000000-0000-4000-8000-0000000000e2', 'p3-staff@example.test', '{"role":"staff"}', '{"full_name":"P3 Staff"}', 'authenticated', 'authenticated');

insert into public.audit_log (table_name, record_id, action, changed_by, new_values)
values ('students', gen_random_uuid(), 'insert', '00000000-0000-4000-8000-0000000000e2', '{"probe":true}');

-- ── F-12: disable instead of delete ───────────────────────────────────────
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-0000000000e2","role":"authenticated"}', true);
select throws_ok(
  $$ select public.admin_set_user_disabled('00000000-0000-4000-8000-0000000000e1', true) $$,
  '42501', null, 'staff cannot disable accounts');

select set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-0000000000e1","role":"authenticated"}', true);
select throws_ok(
  $$ select public.admin_set_user_disabled('00000000-0000-4000-8000-0000000000e1', true) $$,
  '22023', null, 'admins cannot disable their own account');
select lives_ok(
  $$ select public.admin_set_user_disabled('00000000-0000-4000-8000-0000000000e2', true) $$,
  'an admin disables a staff account');
reset role;

select results_eq(
  $$ select role, disabled_at is not null, disabled_by from public.profiles where id = '00000000-0000-4000-8000-0000000000e2' $$,
  $$ values ('pending'::text, true, '00000000-0000-4000-8000-0000000000e1'::uuid) $$,
  'a disabled account drops to pending and records who disabled it');
select is(
  (select count(*)::int from public.audit_log where changed_by = '00000000-0000-4000-8000-0000000000e2' and new_values = '{"probe":true}'),
  1, 'the disabled user''s audit history keeps its attribution');
select ok(
  exists (select 1 from public.audit_log where record_id = '00000000-0000-4000-8000-0000000000e2'
          and changed_by = '00000000-0000-4000-8000-0000000000e1' and new_values = '{"disabled": true}'),
  'disabling is itself audited');

set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-0000000000e1","role":"authenticated"}', true);
select lives_ok(
  $$ select public.admin_set_user_disabled('00000000-0000-4000-8000-0000000000e2', false) $$,
  'an admin re-enables the account');
reset role;
select is(
  (select disabled_at from public.profiles where id = '00000000-0000-4000-8000-0000000000e2'), null,
  're-enabling clears disabled_at');

-- ── F-15: course integrity ────────────────────────────────────────────────
insert into public.courses (id, name, fee) values ('p3-c1', 'P3 Course', 100000), ('p3-c2', 'P3 Empty Course', 100000);
insert into public.students (name, phone, course, batch, total, paid)
values ('P3 Student', '9000000301', 'p3 course ', 'B1', 100000, 0);

select throws_ok(
  $$ insert into public.courses (id, name, fee) values ('p3-c3', '  p3 COURSE', 100000) $$,
  '23505', null, 'course names are unique regardless of case and spacing');
select throws_ok(
  $$ delete from public.courses where id = 'p3-c1' $$,
  '23503', null, 'a course with enrolled students cannot be deleted');
select lives_ok(
  $$ delete from public.courses where id = 'p3-c2' $$,
  'a course with no dependents can be deleted');

update public.courses set name = 'P3 Course Renamed' where id = 'p3-c1';
select is((select course from public.students where name = 'P3 Student'), 'P3 Course Renamed',
  'renaming a course renames it on enrolled students');
select is((select count(*)::int from public.courses where id = 'p3-c1'), 1, 'the course still exists');

select * from finish();
rollback;
