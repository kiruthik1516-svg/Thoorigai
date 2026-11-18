-- ══════════════════════════════════════════════════════════════════════════
-- Migration: payments ledger is the single source of truth for student balances (F-06)
--
-- Decision 2026-11-18: students.paid and students.status are derived from public.payments and
-- can no longer be written directly by anyone (including the service role). Before this,
-- record_payment incremented students.paid by hand, seed data set paid with no payments behind
-- it, and duplicate payments were never reflected, so every student in production disagreed
-- with their own ledger. Production test data was wiped the same day (backup kept in schema
-- backup_20261118), so the one-time recompute below changes no live balances.
--
--   payments  ──AFTER INSERT/UPDATE/DELETE──▶  students.paid = sum(payments.amount)
--   students  ──BEFORE INSERT/UPDATE──▶ reject paid changes not made by the ledger sync
--                                       status always derived from paid vs total
-- ══════════════════════════════════════════════════════════════════════════

-- The ledger sum runs on every payment write; the FK column had no index.
create index if not exists payments_student_id_idx on public.payments (student_id);

-- ── Guard: paid only changes through the ledger sync ──────────────────────
create or replace function public.tg__students__guard_ledger_paid()
returns trigger
language plpgsql
set search_path = ''
as $function$
begin
  if coalesce(current_setting('app.ledger_sync', true), '') = 'on' then
    return NEW;
  end if;
  if TG_OP = 'INSERT' and NEW.paid <> 0 then
    raise exception 'students.paid is derived from payments; insert students with paid = 0'
      using errcode = '42501';
  end if;
  if TG_OP = 'UPDATE' and NEW.paid is distinct from OLD.paid then
    raise exception 'students.paid is derived from payments; record or remove a payment instead'
      using errcode = '42501';
  end if;
  return NEW;
end $function$;

revoke all on function public.tg__students__guard_ledger_paid() from public, anon, authenticated;

create or replace trigger _100_guard_ledger_paid
  before insert or update on public.students
  for each row execute function public.tg__students__guard_ledger_paid();

-- Status was only re-derived when total or paid changed, so a direct status update stuck.
-- Derive it on every insert and update.
create or replace trigger _300_derive_status
  before insert or update on public.students
  for each row execute function public.tg__students__derive_status();

-- ── Ledger sync ───────────────────────────────────────────────────────────
create or replace function public.sync_student_paid_from_ledger(p_student_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $function$
begin
  if p_student_id is null then return; end if;
  perform set_config('app.ledger_sync', 'on', true);
  update public.students s
     set paid = l.total_paid
    from (
      select coalesce(sum(p.amount), 0)::bigint as total_paid
        from public.payments p
       where p.student_id = p_student_id
    ) l
   where s.id = p_student_id
     and s.paid is distinct from l.total_paid;
  perform set_config('app.ledger_sync', 'off', true);
end $function$;

revoke all on function public.sync_student_paid_from_ledger(uuid) from public, anon, authenticated;

create or replace function public.tg__payments__sync_student_paid()
returns trigger
language plpgsql
security definer
set search_path = ''
as $function$
begin
  if TG_OP in ('UPDATE', 'DELETE') then
    perform public.sync_student_paid_from_ledger(OLD.student_id);
  end if;
  if TG_OP in ('INSERT', 'UPDATE') and (TG_OP = 'INSERT' or NEW.student_id is distinct from OLD.student_id) then
    perform public.sync_student_paid_from_ledger(NEW.student_id);
  end if;
  return null;
end $function$;

revoke all on function public.tg__payments__sync_student_paid() from public, anon, authenticated;

create or replace trigger _900_sync_student_paid
  after insert or delete or update of amount, student_id on public.payments
  for each row execute function public.tg__payments__sync_student_paid();

-- ── record_payment no longer touches students.paid ────────────────────────
create or replace function public.record_payment(
  p_student_register_id integer, p_amount bigint, p_method text, p_payment_date date,
  p_transaction_id text, p_custom_note text, p_gst_rate numeric, p_cgst bigint, p_sgst bigint,
  p_verification_code text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_student public.students%rowtype;
  v_payment public.payments%rowtype;
begin
  if (select auth.uid()) is null or not exists (
    select 1 from public.profiles p where p.id = (select auth.uid()) and p.role = 'admin'
  ) then raise exception 'Only admins can record payments' using errcode = '42501'; end if;
  if p_amount <= 0 or p_cgst < 0 or p_sgst < 0 then
    raise exception 'Payment amounts must be positive' using errcode = '22023';
  end if;

  -- Row lock serialises concurrent payments for the same student before the balance check.
  select * into v_student from public.students
   where register_id = p_student_register_id for update;
  if not found then raise exception 'STUDENT_NOT_FOUND' using errcode = 'P0002'; end if;
  if p_amount > v_student.total - v_student.paid then
    raise exception 'PAYMENT_EXCEEDS_BALANCE' using errcode = 'P0001';
  end if;

  perform set_config('app.atomic_payment_rpc', 'on', true);
  insert into public.payments (
    student_id, student_register_id, method, amount, payment_date,
    transaction_id, custom_note, gst_rate, cgst, sgst
  ) values (
    v_student.id, v_student.register_id, p_method, p_amount, p_payment_date,
    p_transaction_id, p_custom_note, p_gst_rate, p_cgst, p_sgst
  ) returning * into v_payment;

  -- paid and status were updated by _900_sync_student_paid.
  select * into v_student from public.students where id = v_student.id;

  insert into public.verifiable_documents (doc_type, reference_id, verification_code, status)
  values ('invoice', v_payment.id, p_verification_code, 'active');

  return jsonb_build_object('payment', to_jsonb(v_payment), 'student', to_jsonb(v_student),
    'verification_code', p_verification_code);
end $function$;

revoke all on function public.record_payment(integer, bigint, text, date, text, text, numeric, bigint, bigint, text)
  from public, anon, authenticated;

-- ── Reconciliation: must always be empty ──────────────────────────────────
create or replace view public.student_ledger_mismatches
with (security_invoker = true) as
select s.id, s.register_id, s.total, s.paid, s.status,
       coalesce(l.ledger_paid, 0)::bigint as ledger_paid
  from public.students s
  left join (
    select student_id, sum(amount) as ledger_paid from public.payments group by student_id
  ) l on l.student_id = s.id
 where s.paid <> coalesce(l.ledger_paid, 0)
    or s.status <> case when s.paid >= s.total then 'Fully Paid' else 'Pending' end;

revoke all on public.student_ledger_mismatches from public, anon, authenticated;
comment on view public.student_ledger_mismatches is
  'F-06 reconciliation: students whose paid/status disagree with the payments ledger. Must be empty.';

-- ── One-time recompute so every environment starts consistent ─────────────
-- (Seed data in 202609180003 set paid without payments; production was wiped beforehand.)
do $$
declare r record;
begin
  for r in select id from public.students loop
    perform public.sync_student_paid_from_ledger(r.id);
  end loop;
end $$;
