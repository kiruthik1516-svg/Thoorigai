-- ══════════════════════════════════════════════════════════════════════════
-- Migration: Phase 1 database permissions (review of 2026-11-17)
--
-- F-03  Payments are admin-only (decision 2026-11-18, matches lib/auth/permissions.ts).
--       Staff could SELECT every payment and call record_payment_idempotent /
--       create_student_with_payment with an initial payment directly with their JWT.
-- F-04  authenticated had table-wide UPDATE on students, so staff could set paid = total and
--       make a student certificate-eligible with no payment behind it. Money columns are now
--       only written by the SECURITY DEFINER payment functions.
-- F-10  Any authenticated user could insert notifications with an arbitrary link. Notifications
--       are now written only by server code with the service role, and links must be internal.
-- Also: anon/authenticated held every privilege on notifications and verifiable_documents
--       (RLS was the only barrier). Grants are reduced to what the app uses.
-- ══════════════════════════════════════════════════════════════════════════

-- ── F-03: payments ─────────────────────────────────────────────────────────
drop policy if exists "Payments select policy" on public.payments;
drop policy if exists "Payments insert policy" on public.payments;
drop policy if exists "Payments update policy" on public.payments;
drop policy if exists "Payments delete policy" on public.payments;
drop policy if exists payments_select_admin on public.payments;

-- authenticated only holds SELECT on payments; writes happen in the definer functions below.
create policy payments_select_admin on public.payments
  for select to authenticated
  using ((select public.is_current_user_admin()));

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

  update public.students
     set paid = paid + p_amount,
         status = case when paid + p_amount >= total then 'Fully Paid' else 'Pending' end,
         updated_at = now()
   where id = v_student.id
   returning * into v_student;

  insert into public.verifiable_documents (doc_type, reference_id, verification_code, status)
  values ('invoice', v_payment.id, p_verification_code, 'active');

  return jsonb_build_object('payment', to_jsonb(v_payment), 'student', to_jsonb(v_student),
    'verification_code', p_verification_code);
end $function$;

revoke all on function public.record_payment(integer, bigint, text, date, text, text, numeric, bigint, bigint, text)
  from public, anon, authenticated;

create or replace function public.record_payment_idempotent(
  p_idempotency_key text, p_request_hash text, p_student_register_id integer, p_amount bigint,
  p_method text, p_payment_date date, p_transaction_id text, p_custom_note text, p_gst_rate numeric,
  p_cgst bigint, p_sgst bigint, p_verification_code text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_actor uuid := (select auth.uid());
  v_existing public.idempotency_keys%rowtype;
  v_response jsonb;
begin
  if v_actor is null or not exists (
    select 1 from public.profiles p where p.id = v_actor and p.role = 'admin'
  ) then raise exception 'Only admins can record payments' using errcode = '42501'; end if;
  if p_idempotency_key is null or length(p_idempotency_key) not between 1 and 200 then
    raise exception 'Invalid idempotency key' using errcode = '22023';
  end if;
  if p_request_hash !~ '^[0-9a-f]{64}$' then raise exception 'Invalid request hash' using errcode = '22023'; end if;

  perform pg_advisory_xact_lock(hashtextextended(v_actor::text || ':' || p_idempotency_key, 0));
  with expired_keys as (
    select ctid from public.idempotency_keys where expires_at <= now()
    order by expires_at limit 100 for update skip locked
  )
  delete from public.idempotency_keys where ctid in (select ctid from expired_keys);
  delete from public.idempotency_keys
   where actor_id = v_actor and idempotency_key = p_idempotency_key and expires_at <= now();

  select * into v_existing from public.idempotency_keys
   where actor_id = v_actor and idempotency_key = p_idempotency_key for update;
  if found then
    if v_existing.request_hash <> p_request_hash then
      raise exception 'IDEMPOTENCY_KEY_REUSED' using errcode = 'P0001';
    end if;
    if v_existing.response is not null then return v_existing.response; end if;
    raise exception 'IDEMPOTENCY_REQUEST_INCOMPLETE' using errcode = 'P0001';
  end if;

  insert into public.idempotency_keys (actor_id, idempotency_key, request_hash)
  values (v_actor, p_idempotency_key, p_request_hash);
  v_response := public.record_payment(
    p_student_register_id, p_amount, p_method, p_payment_date, p_transaction_id,
    p_custom_note, p_gst_rate, p_cgst, p_sgst, p_verification_code
  );
  update public.idempotency_keys set response = v_response
   where actor_id = v_actor and idempotency_key = p_idempotency_key;
  return v_response;
end $function$;

revoke all on function public.record_payment_idempotent(text, text, integer, bigint, text, date, text, text, numeric, bigint, bigint, text)
  from public, anon;
grant execute on function public.record_payment_idempotent(text, text, integer, bigint, text, date, text, text, numeric, bigint, bigint, text)
  to authenticated;

-- Staff may still enrol students (fee total set, no payment). An initial payment requires admin.
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
  if p_initial_payment_amount < 0 then raise exception 'Invalid initial payment' using errcode = '22023'; end if;
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
    -- GST handling is unchanged here; F-08 (Phase 2) moves tax computation to gst_settings.
    v_payment := public.record_payment(
      v_student.register_id, p_initial_payment_amount, 'Initial Payment',
      p_initial_payment_date, null, null, 18,
      round(p_initial_payment_amount * 0.09)::bigint,
      round(p_initial_payment_amount * 0.09)::bigint,
      p_verification_code
    );
    select * into v_student from public.students where id = v_student.id;
  end if;

  return jsonb_build_object('student', to_jsonb(v_student), 'initial_payment', v_payment);
end $function$;

revoke all on function public.create_student_with_payment(jsonb, bigint, date, text) from public, anon;
grant execute on function public.create_student_with_payment(jsonb, bigint, date, text) to authenticated;

-- ── F-04: students money columns ──────────────────────────────────────────
-- No app code updates students directly; total/paid/status change only inside the definer
-- functions above. Keep descriptive columns editable for a future edit-student feature.
revoke update on public.students from authenticated;
grant update (
  name, course, batch, phone, gender, dob, alt_phone, marital_status, email,
  country, state, city, area, lead_source, comments, knowledge_tags
) on public.students to authenticated;

-- ── Verification documents: admin-only through the table, public lookups via the RPC ──
revoke all on public.verifiable_documents from anon;
revoke update, delete, truncate, references, trigger on public.verifiable_documents from authenticated;

drop policy if exists "Allow insert for authenticated users" on public.verifiable_documents;
drop policy if exists "Staff can view document verification codes" on public.verifiable_documents;
drop policy if exists verifiable_documents_admin_insert on public.verifiable_documents;
drop policy if exists verifiable_documents_admin_select on public.verifiable_documents;

create policy verifiable_documents_admin_select on public.verifiable_documents
  for select to authenticated
  using ((select public.is_current_user_admin()));
create policy verifiable_documents_admin_insert on public.verifiable_documents
  for insert to authenticated
  with check ((select public.is_current_user_admin()));

-- ── F-10: notifications ───────────────────────────────────────────────────
drop policy if exists "Authenticated can insert notifications" on public.notifications;

revoke all on public.notifications from anon;
revoke insert, update, delete, truncate, references, trigger on public.notifications from authenticated;

alter table public.notifications drop constraint if exists notifications_link_internal;
alter table public.notifications add constraint notifications_link_internal
  check (link is null or link = '/' or link ~ '^/[A-Za-z0-9_?=&.%-][A-Za-z0-9/_?=&.%-]*$');

revoke all on public.notification_reads from anon;
revoke truncate, references, trigger on public.notification_reads from authenticated;

-- markNotificationRead upserts; ON CONFLICT DO UPDATE needs an UPDATE policy on the user's own rows.
drop policy if exists "Users can update own read markers" on public.notification_reads;
create policy "Users can update own read markers" on public.notification_reads
  for update to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));
