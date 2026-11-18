-- Regression tests for 20261118130000_payment_tax_and_idempotency (F-07, F-08, F-16, F-19).
begin;
select plan(20);

insert into auth.users (id, email, raw_app_meta_data, raw_user_meta_data, aud, role)
values
  ('00000000-0000-4000-8000-0000000000d1', 'tax-admin@example.test', '{"role":"admin"}', '{"full_name":"Tax Admin"}', 'authenticated', 'authenticated'),
  ('00000000-0000-4000-8000-0000000000d2', 'tax-staff@example.test', '{"role":"staff"}', '{"full_name":"Tax Staff"}', 'authenticated', 'authenticated');

insert into public.courses (id, name, fee, gst_inclusive)
values ('tax-excl', 'Tax Exclusive Course', 4200000, false), ('tax-incl', 'Tax Inclusive Course', 3600000, true);
insert into public.gst_settings (id, rate, enabled) values ('default', 18, true)
on conflict (id) do update set rate = 18, enabled = true;

insert into public.students (name, phone, course, batch, total, paid)
values ('Tax Excl Student', '9000000201', 'Tax Exclusive Course', 'T1', 4200000, 0),
       ('Tax Incl Student', '9000000202', 'tax inclusive course ', 'T1', 3600000, 0);

-- ── Tax maths matches lib/money/gst.ts ────────────────────────────────────
select results_eq($$ select cgst, sgst from public.compute_payment_tax(4200000, 18, false) $$,
  $$ values (378000::bigint, 378000::bigint) $$, 'exclusive: 18% on top, split evenly');
select results_eq($$ select cgst, sgst from public.compute_payment_tax(3600000, 18, true) $$,
  $$ values (274577::bigint, 274576::bigint) $$, 'inclusive: tax extracted, CGST takes the odd paisa');
select results_eq($$ select cgst, sgst from public.compute_payment_tax(100000, 0, false) $$,
  $$ values (0::bigint, 0::bigint) $$, 'zero rate gives zero tax');
select is(public.ordinal_label(21) || ',' || public.ordinal_label(11) || ',' || public.ordinal_label(2) || ',' || public.ordinal_label(112),
  '21st,11th,2nd,112th', 'ordinals are correct');

-- ── Payments as admin ─────────────────────────────────────────────────────
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-0000000000d1","role":"authenticated"}', true);

select lives_ok(
  $$ select public.record_payment_idempotent('tax-1', repeat('1', 64),
       (select register_id from public.students where name = 'Tax Excl Student'),
       1000000, 'UPI', current_date, null, null, null, 'tax-code-0001') $$,
  'admin records an exclusive-course payment');
select lives_ok(
  $$ select public.record_payment_idempotent('tax-2', repeat('2', 64),
       (select register_id from public.students where name = 'Tax Excl Student'),
       500000, 'Cash', current_date, null, null, 'Registration Fees', 'tax-code-0002') $$,
  'admin records a second payment with an explicit type');
select lives_ok(
  $$ select public.record_payment_idempotent('tax-3', repeat('3', 64),
       (select register_id from public.students where name = 'Tax Incl Student'),
       3600000, 'Card', current_date, null, null, null, 'tax-code-0003') $$,
  'admin records an inclusive-course payment (course name matched case- and space-insensitively)');
select lives_ok(
  $$ select public.record_payment_idempotent('tax-4', repeat('4', 64),
       (select register_id from public.students where name = 'Tax Excl Student'),
       100000, 'UPI', current_date, null, null, 0::numeric, 999999::bigint, 999999::bigint, 'tax-code-0004') $$,
  'deprecated signature still works');
reset role;

select results_eq(
  $$ select cgst, sgst, gst_rate, gst_inclusive, taxable_value, grand_total, payment_type, instance_number
       from public.payments where amount = 1000000 $$,
  $$ values (90000::bigint, 90000::bigint, 18::numeric, false, 1000000::bigint, 1180000::bigint, '1st Part Fees Payment', 1) $$,
  'F-07/F-08/F-16: exclusive payment stores server tax, total = amount + GST, type and instance');
select results_eq(
  $$ select payment_type, instance_number from public.payments where amount = 500000 $$,
  $$ values ('Registration Fees', 2) $$,
  'an explicit payment type is kept and the instance number still increments');
select results_eq(
  $$ select cgst, sgst, gst_inclusive, taxable_value, grand_total from public.payments where amount = 3600000 $$,
  $$ values (274577::bigint, 274576::bigint, true, 3050847::bigint, 3600000::bigint) $$,
  'F-07: inclusive payment total equals the amount and taxable value excludes GST');
select results_eq(
  $$ select cgst, sgst, gst_rate, payment_type from public.payments where amount = 100000 $$,
  $$ values (9000::bigint, 9000::bigint, 18::numeric, '3rd Part Fees Payment') $$,
  'F-08: client-sent rate and tax are ignored by the deprecated signature');
select is((select paid from public.students where name = 'Tax Incl Student'), 3600000::bigint,
  'inclusive payments count their full amount against the fee');
select throws_ok(
  $$ insert into public.payments (student_id, student_register_id, method, amount, payment_date, cgst, sgst, gst_inclusive)
     select id, register_id, 'x', 100, current_date, 60, 40, true from public.students where name = 'Tax Excl Student' $$,
  '23514', null, 'inclusive tax cannot reach the amount');

update public.gst_settings set enabled = false where id = 'default';
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-0000000000d1","role":"authenticated"}', true);
select lives_ok(
  $$ select public.record_payment_idempotent('tax-5', repeat('5', 64),
       (select register_id from public.students where name = 'Tax Excl Student'),
       200000, 'UPI', current_date, null, null, null, 'tax-code-0005') $$,
  'payment recorded while GST is disabled');
reset role;
select results_eq($$ select cgst, sgst, gst_rate from public.payments where amount = 200000 $$,
  $$ values (0::bigint, 0::bigint, 0::numeric) $$, 'disabled GST records no tax');

-- ── Idempotent enrolment (F-19) ───────────────────────────────────────────
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-0000000000d1","role":"authenticated"}', true);
select is(
  (select public.create_student_with_payment_idempotent('enrol-1', repeat('a', 64),
     '{"name":"Idem Student","phone":"9","course":"C","batch":"B","total":"1000"}'::jsonb, 0, current_date, 'tax-code-0006')->'student'->>'register_id'),
  (select public.create_student_with_payment_idempotent('enrol-1', repeat('a', 64),
     '{"name":"Idem Student","phone":"9","course":"C","batch":"B","total":"1000"}'::jsonb, 0, current_date, 'tax-code-0006')->'student'->>'register_id'),
  'replaying an enrolment returns the original student');
select throws_ok(
  $$ select public.create_student_with_payment_idempotent('enrol-1', repeat('b', 64),
       '{"name":"Other","phone":"9","course":"C","batch":"B","total":"1000"}'::jsonb, 0, current_date, 'tax-code-0007') $$,
  'P0001', 'IDEMPOTENCY_KEY_REUSED', 'reusing an enrolment key for a different request is rejected');
reset role;
select is((select count(*)::int from public.students where name = 'Idem Student'), 1, 'only one student was created');

set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-0000000000d2","role":"authenticated"}', true);
select throws_ok(
  $$ select public.create_student_with_payment_idempotent('enrol-2', repeat('c', 64),
       '{"name":"Staff Paid","phone":"9","course":"C","batch":"B","total":"1000"}'::jsonb, 500, current_date, 'tax-code-0008') $$,
  '42501', null, 'staff still cannot take an initial payment');
reset role;

select * from finish();
rollback;
