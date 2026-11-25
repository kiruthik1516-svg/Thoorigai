-- Regression tests for 20261124120000_data_flow_fixes.
begin;
select plan(49);

insert into auth.users (id, email, raw_app_meta_data, raw_user_meta_data, aud, role)
values
  ('00000000-0000-4000-8000-0000000000e1', 'df-admin@example.test', '{"role":"admin"}', '{"full_name":"DF Admin"}', 'authenticated', 'authenticated'),
  ('00000000-0000-4000-8000-0000000000e2', 'df-staff@example.test', '{"role":"staff"}', '{"full_name":"DF Staff"}', 'authenticated', 'authenticated'),
  ('00000000-0000-4000-8000-0000000000e3', 'df-pending@example.test', '{"role":"pending"}', '{"full_name":"DF Pending"}', 'authenticated', 'authenticated');
insert into public.profiles (id, role, full_name) values
  ('00000000-0000-4000-8000-0000000000e1', 'admin', 'DF Admin'),
  ('00000000-0000-4000-8000-0000000000e2', 'staff', 'DF Staff'),
  ('00000000-0000-4000-8000-0000000000e3', 'pending', 'DF Pending')
on conflict (id) do update set role = excluded.role, full_name = excluded.full_name;

insert into public.courses (id, name, fee, gst_inclusive)
values ('df-a', 'DF Course A', 100000, false), ('df-b', 'DF Course B', 200000, false);
insert into public.course_trainers (course_id, trainer_id) values ('df-a', '00000000-0000-4000-8000-0000000000e2');
insert into public.gst_settings (id, rate, enabled) values ('default', 18, true)
on conflict (id) do update set rate = 18, enabled = true;

-- ── Enrolment ─────────────────────────────────────────────────────────────
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-0000000000e2","role":"authenticated"}', true);
select lives_ok($$ select public.create_student_with_payment(
  '{"name":"DF Staff Enrol","phone":"9","course":"df course a","batch":"B","total":"1"}'::jsonb, 0, null, 'df-code-0001') $$,
  'staff enrol a student');
reset role;
select results_eq($$ select total, course from public.students where name = 'DF Staff Enrol' $$,
  $$ values (100000::bigint, 'DF Course A'::text) $$, 'staff enrolment uses the course fee and stored course name');

set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-0000000000e1","role":"authenticated"}', true);
select throws_ok($$ select public.create_student_with_payment(
  '{"name":"X","phone":"9","course":"No Such Course","batch":"B","total":"1000"}'::jsonb, 0, null, 'df-code-0002') $$,
  'P0002', 'COURSE_NOT_FOUND', 'enrolment into an unknown course is rejected');
select throws_ok($$ select public.create_student_with_payment(
  '{"name":"X","phone":"9","course":"DF Course A","batch":"B","total":"0"}'::jsonb, 0, null, 'df-code-0003') $$,
  '22023', 'FEE_REQUIRED', 'a zero fee is rejected');
select lives_ok($$ select public.create_student_with_payment(
  '{"name":"DF Paid","phone":"9","course":"DF Course A","batch":"B","total":"100000"}'::jsonb, 0, null, 'df-code-0004') $$,
  'admin enrols a student');

-- ── Payments: GST stays with the first invoice, dates, cancellation ──────
select lives_ok($$ select public.record_payment_idempotent('df-code-0005', md5('df-code-0005') || md5('df-code-0005'), (select register_id from public.students where name = 'DF Paid'),
  40000, 'Cash', null, null, null, null, 'df-code-0005') $$, 'admin records a first payment');
reset role;
update public.courses set gst_inclusive = true where id = 'df-a';
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-0000000000e1","role":"authenticated"}', true);
select lives_ok($$ select public.record_payment_idempotent('df-code-0006', md5('df-code-0006') || md5('df-code-0006'), (select register_id from public.students where name = 'DF Paid'),
  10000, 'UPI', null, null, null, null, 'df-code-0006') $$, 'admin records a second payment after the course flag changed');
select throws_ok($$ select public.record_payment_idempotent('df-code-0007', md5('df-code-0007') || md5('df-code-0007'), (select register_id from public.students where name = 'DF Paid'),
  1000, 'UPI', public.india_today() + 1, null, null, null, 'df-code-0007') $$,
  '22023', 'PAYMENT_DATE_IN_FUTURE', 'future payment dates are rejected');
reset role;
select is((select count(distinct gst_inclusive)::int from public.payments p join public.students s on s.id = p.student_id where s.name = 'DF Paid'),
  1, 'all of one student''s invoices keep the same GST treatment');
select ok((select bool_and(invoice like 'TAI/' || to_char(public.india_today(), 'YYYY') || '/INV%') from public.payments p join public.students s on s.id = p.student_id where s.name = 'DF Paid'),
  'invoice numbers use the India-time year');
select is((select paid from public.students where name = 'DF Paid'), 50000::bigint, 'paid sums both payments');

set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-0000000000e2","role":"authenticated"}', true);
select throws_ok($$ select public.admin_cancel_payment('RCPT-x', 'wrong entry') $$, '42501', null,
  'staff cannot cancel payments');
select set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-0000000000e1","role":"authenticated"}', true);
select throws_ok($$ select public.admin_cancel_payment(
  (select p.id from public.payments p join public.students s on s.id = p.student_id where s.name = 'DF Paid' and p.amount = 10000), 'x') $$,
  '22023', 'CANCEL_REASON_REQUIRED', 'a cancellation needs a reason');
select lives_ok($$ select public.admin_cancel_payment(
  (select p.id from public.payments p join public.students s on s.id = p.student_id where s.name = 'DF Paid' and p.amount = 10000), 'Entered twice') $$,
  'admin cancels a payment');
select throws_ok($$ select public.admin_cancel_payment(
  (select p.id from public.payments p join public.students s on s.id = p.student_id where s.name = 'DF Paid' and p.amount = 10000), 'Entered twice') $$,
  'P0001', 'PAYMENT_ALREADY_CANCELLED', 'a payment is cancelled only once');
reset role;
select is((select paid from public.students where name = 'DF Paid'), 40000::bigint, 'a cancelled payment stops counting toward paid');
select is((select d.status from public.verifiable_documents d join public.payments p on p.id = d.reference_id where p.amount = 10000 and p.cancel_reason = 'Entered twice'),
  'revoked', 'the cancelled invoice''s verification code is revoked');
select is((select count(*)::int from public.payments p join public.students s on s.id = p.student_id where s.name = 'DF Paid'),
  2, 'the cancelled invoice stays on record');

-- ── Fee changes ───────────────────────────────────────────────────────────
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-0000000000e2","role":"authenticated"}', true);
select throws_ok($$ update public.students set total = 1 where name = 'DF Staff Enrol' $$, '42501', null,
  'staff cannot change a fee');
select lives_ok($$ update public.students set phone = '9000000999' where name = 'DF Staff Enrol' $$,
  'staff edit profile fields of their students');
select set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-0000000000e1","role":"authenticated"}', true);
select throws_ok($$ update public.students set total = 30000 where name = 'DF Paid' $$, '23514', 'FEE_BELOW_PAID',
  'a fee cannot drop below what was paid');
select lives_ok($$ update public.students set total = 90000 where name = 'DF Paid' $$, 'admin changes a fee');
select throws_ok($$ update public.students set course = 'Nope' where name = 'DF Paid' $$, 'P0002', 'COURSE_NOT_FOUND',
  'students can only move to an existing course');
select throws_ok($$ delete from public.students where name = 'DF Paid' $$, '23503', null,
  'students with invoices cannot be deleted');
select lives_ok($$ delete from public.students where name = 'DF Staff Enrol' $$, 'admin deletes a student with no invoices');
reset role;

-- ── Certificates ──────────────────────────────────────────────────────────
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-0000000000e1","role":"authenticated"}', true);
select throws_ok($$ select public.issue_certificate((select register_id from public.students where name = 'DF Paid'),
  null, null, null, null, null, null, null, 'df-cert-0001') $$, 'P0001', 'FEES_OUTSTANDING',
  'a certificate needs the fee fully paid');
select lives_ok($$ select public.record_payment_idempotent('df-code-0008', md5('df-code-0008') || md5('df-code-0008'), (select register_id from public.students where name = 'DF Paid'),
  50000, 'Cash', null, null, null, null, 'df-code-0008') $$, 'admin records the final payment');
select lives_ok($$ select public.issue_certificate((select register_id from public.students where name = 'DF Paid'),
  null, null, null, array['SQL'], null, null, null, 'df-cert-0002') $$, 'admin issues a certificate');
select throws_ok($$ select public.issue_certificate((select register_id from public.students where name = 'DF Paid'),
  null, null, null, null, null, null, null, 'df-cert-0003') $$, '23505', 'CERTIFICATE_EXISTS',
  'a second certificate for the same course is rejected');
select lives_ok($$ select public.admin_revoke_certificate(
  (select id from public.certificates where student_name = 'DF Paid'), 'Issued in error') $$, 'admin revokes a certificate');
select lives_ok($$ select public.issue_certificate((select register_id from public.students where name = 'DF Paid'),
  null, null, null, null, null, null, null, 'df-cert-0004') $$, 'a replacement can be issued after revoking');
reset role;
select ok((select bool_and(certificate_id ~ ('^TAI-' || to_char(public.india_today(), 'YYYY') || '-\d{4,}$')) from public.certificates where student_name = 'DF Paid'),
  'certificate numbers come from the database');
select is((select string_agg(d.status || ':' || (c.revoked_at is not null)::text, ',' order by d.status) from public.certificates c join public.verifiable_documents d on d.reference_id = c.id::text where c.student_name = 'DF Paid'),
  'active:false,revoked:true', 'each certificate has a verification record; the revoked one is invalid');

-- ── Attendance ────────────────────────────────────────────────────────────
insert into public.students (name, phone, course, batch, total, paid)
values ('DF Attendee', '9000000998', 'DF Course A', 'B', 100000, 0);
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-0000000000e2","role":"authenticated"}', true);
select throws_ok($$ insert into public.attendance (student_id, course_id, session_date, status)
  select id, 'df-a', public.india_today() + 1, 'Present' from public.students where name = 'DF Attendee' $$,
  '22023', 'ATTENDANCE_DATE_IN_FUTURE', 'attendance cannot be marked for a future date');
select lives_ok($$ insert into public.attendance (student_id, course_id, session_date, status)
  select s.id, 'df-a', public.india_today() - d.n, d.status
    from public.students s, (values (1, 'Present'), (2, 'Late'), (3, 'Absent'), (4, 'Exempt'), (5, 'Absent')) as d(n, status)
   where s.name = 'DF Attendee' $$, 'staff mark attendance');
select lives_ok($$ delete from public.attendance where session_date = public.india_today() - 5
  and student_id = (select id from public.students where name = 'DF Attendee') $$, 'staff clear a mark');
select results_eq($$ select sessions, present_sessions, attendance_percent from public.attendance_summary
  where student_name = 'DF Attendee' $$, $$ values (3, 2, 66.7::numeric) $$,
  'Late counts as attended and Exempt is left out of the percentage');
reset role;

-- ── Re-grading ────────────────────────────────────────────────────────────
insert into public.assessments (course_id, title, max_score, assessment_date) values ('df-a', 'DF Quiz', 10, public.india_today());
insert into public.assessment_results (assessment_id, student_id, score, graded_at)
select a.id, s.id, 5, now() - interval '2 days' from public.assessments a, public.students s
 where a.title = 'DF Quiz' and s.name = 'DF Attendee';
update public.assessment_results set score = 7 where assessment_id = (select id from public.assessments where title = 'DF Quiz');
select ok((select graded_at > now() - interval '1 minute' from public.assessment_results
  where assessment_id = (select id from public.assessments where title = 'DF Quiz')), 're-grading updates graded_at');
select throws_ok($$ insert into public.assessments (course_id, title, max_score, assessment_date) values ('df-a', 'Zero', 0, current_date) $$,
  '23514', null, 'assessments need a maximum score above zero');

-- ── Notifications and names ───────────────────────────────────────────────
insert into public.notifications (recipient_role, title, message) values ('all', 'DF Broadcast', 'm');
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-0000000000e3","role":"authenticated"}', true);
select is((select count(*)::int from public.notifications where title = 'DF Broadcast'), 0, 'pending accounts read no notifications');
select is((select count(*)::int from public.profile_display_names(array['00000000-0000-4000-8000-0000000000e1'::uuid])), 0,
  'pending accounts cannot look up names');
select set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-0000000000e2","role":"authenticated"}', true);
select is((select count(*)::int from public.notifications where title = 'DF Broadcast'), 1, 'staff read broadcast notifications');
select is((select full_name from public.profile_display_names(array['00000000-0000-4000-8000-0000000000e1'::uuid])), 'DF Admin',
  'staff see the name of the admin who marked or graded');

-- ── Storage uploads are tied to an accessible course folder ──────────────
select lives_ok($$ insert into storage.objects (bucket_id, name) values ('course-materials', 'df-a/notes.pdf') $$,
  'staff upload into an assigned course folder');
select throws_ok($$ insert into storage.objects (bucket_id, name) values ('course-materials', 'df-b/notes.pdf') $$,
  '42501', null, 'staff cannot upload into another course folder');
reset role;

-- ── Audit log ─────────────────────────────────────────────────────────────
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-0000000000e1","role":"authenticated"}', true);
select set_config('request.headers', '{"x-request-id":"req-df-1"}', true);
update public.students set city = 'Madurai' where name = 'DF Attendee';
reset role;
select results_eq($$ select changed_by, request_id from public.audit_log where table_name = 'students' and request_id = 'req-df-1' $$,
  $$ values ('00000000-0000-4000-8000-0000000000e1'::uuid, 'req-df-1'::text) $$, 'audit rows keep the actor and request id');
select set_config('request.jwt.claims', '{"role":"service_role"}', true);
select set_config('request.headers', '{"x-request-id":"req-df-2","x-actor-id":"00000000-0000-4000-8000-0000000000e1"}', true);
insert into public.notifications (recipient_role, title, message) values ('admin', 'DF Server', 'm');
select set_config('request.headers', '{"x-request-id":"req-df-3","x-actor-id":"00000000-0000-4000-8000-00000000dead"}', true);
insert into public.notifications (recipient_role, title, message) values ('admin', 'DF Server 2', 'm');
select results_eq($$ select request_id, changed_by from public.audit_log where request_id in ('req-df-2', 'req-df-3') order by request_id $$,
  $$ values ('req-df-2'::text, '00000000-0000-4000-8000-0000000000e1'::uuid), ('req-df-3'::text, null::uuid) $$,
  'server writes record the acting user; unknown ids are dropped instead of failing');

-- ── Privileges ────────────────────────────────────────────────────────────
select ok(not has_table_privilege('anon', 'public.students', 'SELECT')
  and not has_table_privilege('anon', 'public.profiles', 'INSERT')
  and not has_table_privilege('anon', 'public.audit_log', 'TRUNCATE'), 'anon holds no table privileges');
select ok(not has_table_privilege('authenticated', 'public.audit_log', 'TRUNCATE')
  and not has_table_privilege('authenticated', 'public.attendance', 'TRUNCATE'), 'signed-in users cannot truncate tables');

select * from finish();
rollback;
