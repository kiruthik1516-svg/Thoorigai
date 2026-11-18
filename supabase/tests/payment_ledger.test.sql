-- Regression tests for 20261118120000_payment_ledger_source_of_truth (F-06).
begin;
select plan(12);

insert into auth.users (id, email, raw_app_meta_data, raw_user_meta_data, aud, role)
values ('00000000-0000-4000-8000-0000000000c1', 'ledger-admin@example.test', '{"role":"admin"}', '{"full_name":"Ledger Admin"}', 'authenticated', 'authenticated');

-- ── Inserts ───────────────────────────────────────────────────────────────
select lives_ok(
  $$ insert into public.students (name, phone, course, batch, total, paid)
     values ('Ledger Student', '9000000101', 'Ledger Course', 'L1', 100000, 0) $$,
  'students can be created with paid = 0'
);
select throws_ok(
  $$ insert into public.students (name, phone, course, batch, total, paid)
     values ('Prepaid Student', '9000000102', 'Ledger Course', 'L1', 100000, 50000) $$,
  '42501', null, 'students cannot be created with a paid amount'
);

-- ── Payments drive paid and status ────────────────────────────────────────
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-0000000000c1","role":"authenticated"}', true);

select lives_ok(
  $$ select public.record_payment_idempotent(
       'ledger-1', repeat('c', 64), (select register_id from public.students where name = 'Ledger Student'),
       40000, 'Cash', current_date, null, null, 18, 3600, 3600, 'ledger-code-0001') $$,
  'admin records a first payment'
);
reset role;

select is((select paid from public.students where name = 'Ledger Student'), 40000::bigint,
  'paid equals the ledger after the first payment');
select is((select status from public.students where name = 'Ledger Student'), 'Pending',
  'status stays Pending while a balance remains');

-- ── Direct writes are rejected, even for the table owner ─────────────────
select throws_ok(
  $$ update public.students set paid = total where name = 'Ledger Student' $$,
  '42501', null, 'paid cannot be updated directly, even by postgres'
);
update public.students set status = 'Fully Paid' where name = 'Ledger Student';
select is((select status from public.students where name = 'Ledger Student'), 'Pending',
  'a direct status update is re-derived from paid and total');

-- ── Overpayment and completion ────────────────────────────────────────────
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-0000000000c1","role":"authenticated"}', true);
select throws_ok(
  $$ select public.record_payment_idempotent(
       'ledger-2', repeat('d', 64), (select register_id from public.students where name = 'Ledger Student'),
       60001, 'Cash', current_date, null, null, 18, 0, 0, 'ledger-code-0002') $$,
  'P0001', 'PAYMENT_EXCEEDS_BALANCE', 'payments beyond the balance are rejected'
);
select lives_ok(
  $$ select public.record_payment_idempotent(
       'ledger-3', repeat('e', 64), (select register_id from public.students where name = 'Ledger Student'),
       60000, 'UPI', current_date, null, null, 18, 5400, 5400, 'ledger-code-0003') $$,
  'admin records the final payment'
);
reset role;

select is((select status from public.students where name = 'Ledger Student'), 'Fully Paid',
  'status becomes Fully Paid when the ledger covers the total');

-- ── Removing a payment recomputes the balance ─────────────────────────────
delete from public.verifiable_documents where verification_code = 'ledger-code-0003';
delete from public.payments where amount = 60000
  and student_id = (select id from public.students where name = 'Ledger Student');
select is((select paid from public.students where name = 'Ledger Student'), 40000::bigint,
  'deleting a payment recomputes paid from the ledger');

select is((select count(*)::int from public.student_ledger_mismatches), 0,
  'reconciliation view is empty');

select * from finish();
rollback;
