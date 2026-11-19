-- Regression tests for migration 20261118100000_phase1_permissions (F-03, F-04, F-10), run as staff.
begin;
select plan(13);

insert into auth.users (id, email, raw_app_meta_data, raw_user_meta_data, aud, role)
values
  ('00000000-0000-4000-8000-0000000000b2', 'p1-staff@example.test', '{"role":"staff"}', '{"full_name":"Staff"}', 'authenticated', 'authenticated'),
  ('00000000-0000-4000-8000-0000000000b3', 'p1-admin@example.test', '{"role":"admin"}', '{"full_name":"Admin"}', 'authenticated', 'authenticated');

insert into public.students (name, phone, course, batch, total, paid, status)
values ('Phase1 Student', '9000000001', 'Phase1 Course', 'B1', 100000, 0, 'Pending');

-- F-28: staff enrol only into courses they are assigned to.
insert into public.courses (id, name, fee) values ('p1-c', 'C', 1000);
insert into public.course_trainers (course_id, trainer_id) values ('p1-c', '00000000-0000-4000-8000-0000000000b2');

-- ── As staff ──────────────────────────────────────────────────────────────
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-0000000000b2","role":"authenticated"}', true);

select is((select count(*)::int from public.payments), 0, 'F-03: staff cannot read payments');
select is((select count(*)::int from public.verifiable_documents), 0, 'staff cannot read verification codes');

select throws_ok(
  $$ select public.record_payment_idempotent(
       'k1', repeat('a', 64), (select register_id from public.students where name = 'Phase1 Student'),
       1000, 'Cash', current_date, null, null, null, 'p1-code-0001') $$,
  '42501', null, 'F-03: staff cannot record a payment'
);

select throws_ok(
  $$ select public.create_student_with_payment(
       '{"name":"S","phone":"9","course":"C","batch":"B","total":"1000"}'::jsonb, 500, current_date, 'p1-code-0002') $$,
  '42501', null, 'F-03: staff cannot take an initial payment at enrolment'
);

select lives_ok(
  $$ select public.create_student_with_payment(
       '{"name":"Staff Enrolled","phone":"9","course":"C","batch":"B","total":"1000"}'::jsonb, 0, current_date, 'p1-code-0003') $$,
  'staff can still enrol a student without a payment'
);

select throws_ok(
  $$ update public.students set paid = total where name = 'Phase1 Student' $$,
  '42501', null, 'F-04: staff cannot change paid'
);
select throws_ok(
  $$ update public.students set status = 'Fully Paid' where name = 'Phase1 Student' $$,
  '42501', null, 'F-04: staff cannot change status'
);
select lives_ok(
  $$ update public.students set comments = 'called back' where name = 'Phase1 Student' $$,
  'staff can still edit descriptive student fields'
);

select throws_ok(
  $$ insert into public.notifications (recipient_role, title, message, link)
     values ('all', 't', 'm', 'https://evil.example') $$,
  '42501', null, 'F-10: end users cannot insert notifications'
);

-- ── As admin ──────────────────────────────────────────────────────────────
select set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-0000000000b3","role":"authenticated"}', true);

select lives_ok(
  $$ select public.record_payment_idempotent(
       'k2', repeat('b', 64), (select register_id from public.students where name = 'Phase1 Student'),
       1000, 'Cash', current_date, null, null, null, 'p1-code-0004') $$,
  'admin can record a payment'
);
select ok((select count(*) from public.payments) > 0, 'admin can read payments');

-- ── Constraints and grants ────────────────────────────────────────────────
reset role;
select throws_ok(
  $$ insert into public.notifications (recipient_role, title, message, link) values ('all', 't', 'm', '//evil.example') $$,
  '23514', null, 'F-10: notification links must be internal paths'
);
select ok(
  not has_table_privilege('anon', 'public.notifications', 'SELECT')
  and not has_table_privilege('anon', 'public.verifiable_documents', 'SELECT'),
  'anon holds no privileges on notifications or verifiable_documents'
);

select * from finish();
rollback;
