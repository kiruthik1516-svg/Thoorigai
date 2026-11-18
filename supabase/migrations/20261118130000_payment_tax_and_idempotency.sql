-- ══════════════════════════════════════════════════════════════════════════
-- Migration: server-side GST, per-course tax treatment, payment metadata, idempotent enrolment
--
-- F-07  Decision 2026-11-18: GST follows each course's gst_inclusive flag. payments.amount is the
--       amount counted against the student's fee (balances stay in fee terms):
--         exclusive: taxable = amount,        invoice total = amount + cgst + sgst
--         inclusive: taxable = amount - gst,  invoice total = amount
--       The flag is stored on each payment so later course or settings changes never alter an
--       issued invoice.
-- F-08  Tax is computed here from gst_settings (rate, enabled) and the course flag. Client-sent
--       rate/cgst/sgst are ignored. Rounding matches lib/money/gst.ts (half-up, CGST gets the odd
--       paisa).
-- F-16  payment_type and instance_number are written inside the payment transaction (the old
--       follow-up UPDATE was denied by grants and failed silently). Ordinals are correct (21st).
-- F-19  create_student_with_payment_idempotent adds an idempotency key to enrolment.
--
-- The previous record_payment / record_payment_idempotent signatures stay as thin wrappers so the
-- currently deployed app keeps working until the new build is live. Drop them in a later cleanup.
-- ══════════════════════════════════════════════════════════════════════════

-- ── Payment tax columns ───────────────────────────────────────────────────
alter table public.payments add column if not exists gst_inclusive boolean not null default false;

alter table public.payments
  alter column grand_total set expression as (
    case when gst_inclusive then amount else amount + cgst + sgst end
  );

alter table public.payments
  add column if not exists taxable_value bigint generated always as (
    case when gst_inclusive then amount - cgst - sgst else amount end
  ) stored;

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'payments_inclusive_tax_within_amount') then
    alter table public.payments add constraint payments_inclusive_tax_within_amount
      check (not gst_inclusive or cgst + sgst < amount);
  end if;
end $$;

comment on column public.payments.amount is
  'Paise counted against the student fee. Exclusive: the taxable value. Inclusive: the gross incl. GST.';
comment on column public.payments.gst_inclusive is 'Whether the course fee included GST when this payment was recorded.';
comment on column public.payments.taxable_value is 'Taxable value in paise (amount minus GST when inclusive).';
comment on column public.payments.grand_total is 'Invoice total in paise (amount when inclusive, amount plus GST otherwise).';

-- ── Tax and label helpers ─────────────────────────────────────────────────
create or replace function public.compute_payment_tax(p_amount bigint, p_rate numeric, p_inclusive boolean)
returns table (cgst bigint, sgst bigint)
language plpgsql
immutable
set search_path = ''
as $function$
declare
  v_bp bigint;
  v_gst bigint;
begin
  if p_amount is null or p_amount < 0 then raise exception 'Invalid amount' using errcode = '22023'; end if;
  if p_rate is null or p_rate < 0 or p_rate > 100 then raise exception 'Invalid GST rate' using errcode = '22023'; end if;
  v_bp := round(p_rate * 100)::bigint;
  if v_bp = 0 then
    v_gst := 0;
  elsif p_inclusive then
    v_gst := p_amount - (p_amount * 10000 + (10000 + v_bp) / 2) / (10000 + v_bp);
  else
    v_gst := (p_amount * v_bp + 5000) / 10000;
  end if;
  cgst := v_gst - v_gst / 2;
  sgst := v_gst / 2;
  return next;
end $function$;

revoke all on function public.compute_payment_tax(bigint, numeric, boolean) from public, anon, authenticated;

create or replace function public.ordinal_label(p_n integer)
returns text
language sql
immutable
set search_path = ''
as $function$
  select p_n::text || case
    when p_n % 100 between 11 and 13 then 'th'
    when p_n % 10 = 1 then 'st'
    when p_n % 10 = 2 then 'nd'
    when p_n % 10 = 3 then 'rd'
    else 'th' end
$function$;

-- ── Idempotency helpers (internal) ────────────────────────────────────────
create or replace function public.idempotency_begin(p_actor uuid, p_key text, p_hash text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_existing public.idempotency_keys%rowtype;
begin
  if p_key is null or length(p_key) not between 1 and 200 then
    raise exception 'Invalid idempotency key' using errcode = '22023';
  end if;
  if p_hash !~ '^[0-9a-f]{64}$' then raise exception 'Invalid request hash' using errcode = '22023'; end if;

  perform pg_advisory_xact_lock(hashtextextended(p_actor::text || ':' || p_key, 0));
  with expired_keys as (
    select ctid from public.idempotency_keys where expires_at <= now()
    order by expires_at limit 100 for update skip locked
  )
  delete from public.idempotency_keys where ctid in (select ctid from expired_keys);
  delete from public.idempotency_keys
   where actor_id = p_actor and idempotency_key = p_key and expires_at <= now();

  select * into v_existing from public.idempotency_keys
   where actor_id = p_actor and idempotency_key = p_key for update;
  if found then
    if v_existing.request_hash <> p_hash then
      raise exception 'IDEMPOTENCY_KEY_REUSED' using errcode = 'P0001';
    end if;
    if v_existing.response is not null then return v_existing.response; end if;
    raise exception 'IDEMPOTENCY_REQUEST_INCOMPLETE' using errcode = 'P0001';
  end if;

  insert into public.idempotency_keys (actor_id, idempotency_key, request_hash) values (p_actor, p_key, p_hash);
  return null;
end $function$;

create or replace function public.idempotency_finish(p_actor uuid, p_key text, p_response jsonb)
returns void
language sql
security definer
set search_path = ''
as $function$
  update public.idempotency_keys set response = p_response
   where actor_id = p_actor and idempotency_key = p_key;
$function$;

revoke all on function public.idempotency_begin(uuid, text, text) from public, anon, authenticated;
revoke all on function public.idempotency_finish(uuid, text, jsonb) from public, anon, authenticated;

-- ── record_payment: server-side tax, type and instance ────────────────────
create or replace function public.record_payment(
  p_student_register_id integer, p_amount bigint, p_method text, p_payment_date date,
  p_transaction_id text, p_custom_note text, p_payment_type text, p_verification_code text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_student public.students%rowtype;
  v_payment public.payments%rowtype;
  v_rate numeric := 0;
  v_inclusive boolean := false;
  v_cgst bigint;
  v_sgst bigint;
  v_instance integer;
  v_type text := nullif(btrim(p_payment_type), '');
begin
  if (select auth.uid()) is null or not exists (
    select 1 from public.profiles p where p.id = (select auth.uid()) and p.role = 'admin'
  ) then raise exception 'Only admins can record payments' using errcode = '42501'; end if;
  if p_amount is null or p_amount <= 0 then
    raise exception 'Payment amounts must be positive' using errcode = '22023';
  end if;
  if v_type is not null and length(v_type) > 100 then
    raise exception 'Payment type is too long' using errcode = '22023';
  end if;

  -- Row lock serialises concurrent payments for the same student.
  select * into v_student from public.students
   where register_id = p_student_register_id for update;
  if not found then raise exception 'STUDENT_NOT_FOUND' using errcode = 'P0002'; end if;
  if p_amount > v_student.total - v_student.paid then
    raise exception 'PAYMENT_EXCEEDS_BALANCE' using errcode = 'P0001';
  end if;

  select case when g.enabled then g.rate else 0 end into v_rate
    from public.gst_settings g where g.id = 'default';
  v_rate := coalesce(v_rate, 0);
  select c.gst_inclusive into v_inclusive
    from public.courses c
   where lower(btrim(c.name)) = lower(btrim(v_student.course))
   order by c.id
   limit 1;
  v_inclusive := coalesce(v_inclusive, false);
  select t.cgst, t.sgst into v_cgst, v_sgst from public.compute_payment_tax(p_amount, v_rate, v_inclusive) t;

  select count(*)::integer + 1 into v_instance from public.payments p where p.student_id = v_student.id;
  v_type := coalesce(v_type, public.ordinal_label(v_instance) || ' Part Fees Payment');

  perform set_config('app.atomic_payment_rpc', 'on', true);
  insert into public.payments (
    student_id, student_register_id, method, amount, payment_date, transaction_id, custom_note,
    gst_rate, cgst, sgst, gst_inclusive, payment_type, instance_number
  ) values (
    v_student.id, v_student.register_id, p_method, p_amount, p_payment_date, p_transaction_id, p_custom_note,
    v_rate, v_cgst, v_sgst, v_inclusive, v_type, v_instance
  ) returning * into v_payment;

  -- paid and status were updated by _900_sync_student_paid.
  select * into v_student from public.students where id = v_student.id;

  insert into public.verifiable_documents (doc_type, reference_id, verification_code, status)
  values ('invoice', v_payment.id, p_verification_code, 'active');

  return jsonb_build_object('payment', to_jsonb(v_payment), 'student', to_jsonb(v_student),
    'verification_code', p_verification_code);
end $function$;

revoke all on function public.record_payment(integer, bigint, text, date, text, text, text, text)
  from public, anon, authenticated;

create or replace function public.record_payment_idempotent(
  p_idempotency_key text, p_request_hash text, p_student_register_id integer, p_amount bigint,
  p_method text, p_payment_date date, p_transaction_id text, p_custom_note text,
  p_payment_type text, p_verification_code text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_actor uuid := (select auth.uid());
  v_response jsonb;
begin
  if v_actor is null or not exists (
    select 1 from public.profiles p where p.id = v_actor and p.role = 'admin'
  ) then raise exception 'Only admins can record payments' using errcode = '42501'; end if;

  v_response := public.idempotency_begin(v_actor, p_idempotency_key, p_request_hash);
  if v_response is not null then return v_response; end if;

  v_response := public.record_payment(
    p_student_register_id, p_amount, p_method, p_payment_date, p_transaction_id,
    p_custom_note, p_payment_type, p_verification_code
  );
  perform public.idempotency_finish(v_actor, p_idempotency_key, v_response);
  return v_response;
end $function$;

revoke all on function public.record_payment_idempotent(text, text, integer, bigint, text, date, text, text, text, text)
  from public, anon;
grant execute on function public.record_payment_idempotent(text, text, integer, bigint, text, date, text, text, text, text)
  to authenticated;

-- ── Deprecated signatures: same behaviour, client tax ignored ─────────────
create or replace function public.record_payment(
  p_student_register_id integer, p_amount bigint, p_method text, p_payment_date date,
  p_transaction_id text, p_custom_note text, p_gst_rate numeric, p_cgst bigint, p_sgst bigint,
  p_verification_code text
)
returns jsonb
language sql
security definer
set search_path = ''
as $function$
  select public.record_payment(
    p_student_register_id, p_amount, p_method, p_payment_date, p_transaction_id,
    p_custom_note, null::text, p_verification_code
  )
$function$;

revoke all on function public.record_payment(integer, bigint, text, date, text, text, numeric, bigint, bigint, text)
  from public, anon, authenticated;

create or replace function public.record_payment_idempotent(
  p_idempotency_key text, p_request_hash text, p_student_register_id integer, p_amount bigint,
  p_method text, p_payment_date date, p_transaction_id text, p_custom_note text, p_gst_rate numeric,
  p_cgst bigint, p_sgst bigint, p_verification_code text
)
returns jsonb
language sql
security definer
set search_path = ''
as $function$
  select public.record_payment_idempotent(
    p_idempotency_key, p_request_hash, p_student_register_id, p_amount, p_method, p_payment_date,
    p_transaction_id, p_custom_note, null::text, p_verification_code
  )
$function$;

comment on function public.record_payment_idempotent(text, text, integer, bigint, text, date, text, text, numeric, bigint, bigint, text)
  is 'Deprecated 2026-11-18: client tax arguments are ignored. Remove after the app stops calling it.';

-- ── Enrolment: server-side tax for the initial payment ────────────────────
create or replace function public.create_student_with_payment(
  p_student jsonb, p_initial_payment_amount bigint, p_initial_payment_date date, p_verification_code text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_student public.students%rowtype;
  v_payment jsonb := null;
  v_role text;
begin
  select p.role into v_role from public.profiles p where p.id = (select auth.uid());
  if (select auth.uid()) is null or v_role is null or v_role not in ('admin', 'staff') then
    raise exception 'Not authorized to create students' using errcode = '42501';
  end if;
  if p_initial_payment_amount is null or p_initial_payment_amount < 0 then
    raise exception 'Invalid initial payment' using errcode = '22023';
  end if;
  if p_initial_payment_amount > 0 and v_role <> 'admin' then
    raise exception 'Only admins can record payments' using errcode = '42501';
  end if;

  insert into public.students (
    name, phone, course, batch, total, paid, status, gender, dob, alt_phone,
    marital_status, email, country, state, city, area, lead_source, comments, knowledge_tags
  ) values (
    p_student->>'name', p_student->>'phone', p_student->>'course', p_student->>'batch',
    (p_student->>'total')::bigint, 0, 'Pending', nullif(p_student->>'gender',''),
    nullif(p_student->>'dob','')::date, nullif(p_student->>'alt_phone',''),
    nullif(p_student->>'marital_status',''), nullif(p_student->>'email',''),
    nullif(p_student->>'country',''), nullif(p_student->>'state',''),
    nullif(p_student->>'city',''), nullif(p_student->>'area',''),
    nullif(p_student->>'lead_source',''), nullif(p_student->>'comments',''),
    coalesce(array(select jsonb_array_elements_text(coalesce(p_student->'knowledge_tags','[]'::jsonb))), array[]::text[])
  ) returning * into v_student;

  if p_initial_payment_amount > 0 then
    if p_initial_payment_amount > v_student.total then
      raise exception 'INITIAL_PAYMENT_EXCEEDS_TOTAL' using errcode = 'P0001';
    end if;
    v_payment := public.record_payment(
      v_student.register_id, p_initial_payment_amount, 'Initial Payment',
      p_initial_payment_date, null, null, null::text, p_verification_code
    );
    select * into v_student from public.students where id = v_student.id;
  end if;

  return jsonb_build_object('student', to_jsonb(v_student), 'initial_payment', v_payment);
end $function$;

create or replace function public.create_student_with_payment_idempotent(
  p_idempotency_key text, p_request_hash text, p_student jsonb,
  p_initial_payment_amount bigint, p_initial_payment_date date, p_verification_code text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_actor uuid := (select auth.uid());
  v_response jsonb;
begin
  if v_actor is null then raise exception 'Not authorized to create students' using errcode = '42501'; end if;
  v_response := public.idempotency_begin(v_actor, p_idempotency_key, p_request_hash);
  if v_response is not null then return v_response; end if;
  v_response := public.create_student_with_payment(
    p_student, p_initial_payment_amount, p_initial_payment_date, p_verification_code
  );
  perform public.idempotency_finish(v_actor, p_idempotency_key, v_response);
  return v_response;
end $function$;

revoke all on function public.create_student_with_payment_idempotent(text, text, jsonb, bigint, date, text) from public, anon;
grant execute on function public.create_student_with_payment_idempotent(text, text, jsonb, bigint, date, text) to authenticated;

-- ── Backfill missing payment metadata (no-op on the wiped production data) ─
with numbered as (
  select id, row_number() over (partition by student_id order by payment_date, created_at, id)::integer as n
    from public.payments
)
update public.payments p
   set instance_number = coalesce(p.instance_number, numbered.n),
       payment_type = coalesce(p.payment_type, public.ordinal_label(numbered.n) || ' Part Fees Payment')
  from numbered
 where numbered.id = p.id
   and (p.payment_type is null or p.instance_number is null);

-- ── F-18: dashboard revenue from the ledger, GST reported separately ──────
-- students.paid equals the ledger by construction since 20261118120000, but read the ledger
-- directly so the Dashboard and Reports use the same source. anon no longer executes it.
create or replace function public.get_dashboard_summary()
returns jsonb
language sql
stable
set search_path = ''
as $function$
  select pg_catalog.jsonb_build_object(
    'studentCount', (select count(*) from public.students),
    'revenuePaise', (select coalesce(sum(amount), 0) from public.payments),
    'gstCollectedPaise', (select coalesce(sum(cgst + sgst), 0) from public.payments),
    'outstandingPaise', (select coalesce(sum(total - paid), 0) from public.students),
    'eligibleCount', (select count(*) from public.students where paid >= total),
    'monthlyRevenuePaise', (
      select coalesce(sum(amount), 0) from public.payments
      where payment_date >= date_trunc('month', current_date)::date
    ),
    'courseMix', (
      select coalesce(pg_catalog.jsonb_agg(
        pg_catalog.jsonb_build_object('course', course, 'studentCount', student_count)
        order by student_count desc, course
      ), '[]'::jsonb)
      from (select course, count(*) as student_count from public.students group by course) as course_totals
    )
  );
$function$;

revoke all on function public.get_dashboard_summary() from public, anon;
grant execute on function public.get_dashboard_summary() to authenticated;
