-- Regression tests for 20261119100000_enforce_course_assignments (F-28).
begin;
select plan(14);

insert into auth.users (id, email, raw_app_meta_data, raw_user_meta_data, aud, role)
values
  ('00000000-0000-4000-8000-0000000000f1', 'ca-admin@example.test', '{"role":"admin"}', '{"full_name":"CA Admin"}', 'authenticated', 'authenticated'),
  ('00000000-0000-4000-8000-0000000000f2', 'ca-staff@example.test', '{"role":"staff"}', '{"full_name":"CA Staff"}', 'authenticated', 'authenticated'),
  ('00000000-0000-4000-8000-0000000000f3', 'ca-idle@example.test', '{"role":"staff"}', '{"full_name":"CA Idle"}', 'authenticated', 'authenticated');

insert into public.courses (id, name, fee) values ('ca-a', 'CA Course A', 100000), ('ca-b', 'CA Course B', 100000);
insert into public.course_trainers (course_id, trainer_id) values ('ca-a', '00000000-0000-4000-8000-0000000000f2');
insert into public.students (name, phone, course, batch, total, paid)
values ('CA Student A', '9000000401', 'ca course a', 'B1', 100000, 0),
       ('CA Student B', '9000000402', 'CA Course B', 'B1', 100000, 0);
insert into public.assessments (course_id, title, max_score, assessment_date)
values ('ca-a', 'CA Quiz A', 10, current_date), ('ca-b', 'CA Quiz B', 10, current_date);

-- ── Assigned staff ────────────────────────────────────────────────────────
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-0000000000f2","role":"authenticated"}', true);

select results_eq($$ select name from public.students where name like 'CA Student%' order by name $$,
  $$ values ('CA Student A'::text) $$, 'staff see only students in their assigned courses');
select results_eq($$ select title from public.assessments where title like 'CA Quiz%' $$,
  $$ values ('CA Quiz A'::text) $$, 'staff see only assessments for their assigned courses');
select results_eq($$ select id from public.courses where id like 'ca-%' $$,
  $$ values ('ca-a'::text) $$, 'staff see only their assigned courses');
select lives_ok($$ insert into public.attendance (student_id, course_id, session_date, status, marked_by)
  select id, 'ca-a', current_date, 'Present', '00000000-0000-4000-8000-0000000000f2' from public.students where name = 'CA Student A' $$,
  'staff mark attendance in an assigned course');
select throws_ok($$ insert into public.attendance (student_id, course_id, session_date, status, marked_by)
  values (gen_random_uuid(), 'ca-b', current_date, 'Present', '00000000-0000-4000-8000-0000000000f2') $$,
  '42501', null, 'staff cannot mark attendance in an unassigned course');
select lives_ok($$ select public.create_student_with_payment(
  '{"name":"CA Enrol A","phone":"9","course":"CA Course A","batch":"B","total":"1000"}'::jsonb, 0, current_date, 'ca-code-0001') $$,
  'staff enrol into an assigned course');
select throws_ok($$ select public.create_student_with_payment(
  '{"name":"CA Enrol B","phone":"9","course":"CA Course B","batch":"B","total":"1000"}'::jsonb, 0, current_date, 'ca-code-0002') $$,
  '42501', 'You are not assigned to this course', 'staff cannot enrol into an unassigned course');
select throws_ok($$ insert into public.courses (id, name, fee) values ('ca-c', 'CA Course C', 1) $$,
  '42501', null, 'staff cannot create courses');
update public.courses set fee = 1 where id = 'ca-a';
select is((select fee from public.courses where id = 'ca-a'), 100000::bigint, 'staff cannot edit courses');
select is((select count(*)::int from public.certificates where course_name = 'CA Course B'), 0,
  'staff do not see certificates of other courses');

-- ── Unassigned staff ──────────────────────────────────────────────────────
select set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-0000000000f3","role":"authenticated"}', true);
select is((select count(*)::int from public.students where name like 'CA %'), 0,
  'staff with no assignments see no students');
select is(public.can_access_course('ca-a'), false, 'unassigned staff have no course access');

-- ── Admin ─────────────────────────────────────────────────────────────────
select set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-0000000000f1","role":"authenticated"}', true);
select is((select count(*)::int from public.students where name like 'CA Student%'), 2, 'admins see every student');
select is((select count(*)::int from public.assessments where title like 'CA Quiz%'), 2, 'admins see every assessment');
reset role;

select * from finish();
rollback;
