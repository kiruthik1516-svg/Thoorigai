-- Data-flow fixes from the 2026-11-24 review.
-- Every date that means "today" for the academy uses India time, not the server's UTC date.

create or replace function public.india_today()
returns date
language sql
stable
set search_path = ''
as $$ select (pg_catalog.now() at time zone 'Asia/Kolkata')::date $$;
grant execute on function public.india_today() to authenticated, service_role;

-- ---------------------------------------------------------------------------
-- 1. Audit log: keep the API request id (dropped by 20261003121800) and record who acted for
--    server-side writes. The service key is only held by the server, so for service-role writes
--    the x-actor-id header it sends is trusted; for everyone else the JWT subject is used.
-- ---------------------------------------------------------------------------
create or replace function public.audit_log_trigger_function()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_claims jsonb;
  v_headers jsonb;
  v_actor uuid;
  v_request_id text;
begin
  begin
    v_claims := nullif(current_setting('request.jwt.claims', true), '')::jsonb;
  exception when others then
    v_claims := null;
  end;
  begin
    v_headers := nullif(current_setting('request.headers', true), '')::jsonb;
  exception when others then
    v_headers := null;
  end;

  v_request_id := left(nullif(v_headers ->> 'x-request-id', ''), 128);
  begin
    if v_claims ->> 'role' = 'service_role' then
      v_actor := nullif(v_headers ->> 'x-actor-id', '')::uuid;
    else
      v_actor := nullif(v_claims ->> 'sub', '')::uuid;
    end if;
  exception when others then
    v_actor := null;
  end;
  -- changed_by references profiles; never let an unknown id break the write being audited.
  if v_actor is not null and not exists (select 1 from public.profiles p where p.id = v_actor) then
    v_actor := null;
  end if;

  insert into public.audit_log (table_name, record_id, action, changed_by, old_values, new_values, request_id)
  values (
    tg_table_name,
    case when tg_op = 'DELETE' then old.id::text else new.id::text end,
    lower(tg_op),
    v_actor,
    case when tg_op = 'INSERT' then null else to_jsonb(old) end,
    case when tg_op = 'DELETE' then null else to_jsonb(new) end,
    v_request_id
  );
  return null;
end
$$;

-- ---------------------------------------------------------------------------
-- 2. Table privileges. RLS guards rows, but TRUNCATE ignores RLS and the anonymous role needs no
--    table access at all (public verification goes through public_verify_document()).
-- ---------------------------------------------------------------------------
do $$
declare
  t record;
begin
  for t in
    select c.relname, c.relkind
      from pg_catalog.pg_class c
      join pg_catalog.pg_namespace n on n.oid = c.relnamespace
     where n.nspname = 'public' and c.relkind in ('r', 'v', 'm')
  loop
    execute format('revoke all on table public.%I from anon', t.relname);
    execute format('revoke truncate, trigger, references on table public.%I from authenticated', t.relname);
    if t.relkind <> 'r' then
      execute format('revoke insert, update, delete on table public.%I from authenticated', t.relname);
    end if;
  end loop;
end
$$;
alter default privileges in schema public revoke all on tables from anon;

-- Stale GST policies: staff could insert (no grant made it unreachable) and a removed role lingered.
drop policy if exists "GST settings insert policy" on public.gst_settings;
drop policy if exists "GST settings select policy" on public.gst_settings;
create policy "GST settings select policy" on public.gst_settings
  for select to authenticated
  using (exists (
    select 1 from public.profiles p
     where p.id = (select auth.uid()) and p.role in ('admin', 'staff') and p.disabled_at is null
  ));

-- ---------------------------------------------------------------------------
-- 3. Invoice numbers take the year from India time (TAI/YYYY/INVnnnnnn, unchanged series).
-- ---------------------------------------------------------------------------
create or replace function public.generate_invoice_number()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.invoice := 'TAI/' || to_char(public.india_today(), 'YYYY') || '/INV'
    || lpad(nextval('public.invoice_seq')::text, 6, '0');
  return new;
end
$$;

-- ---------------------------------------------------------------------------
-- 4. Cancelled payments stay in the invoice series but stop counting toward the student's paid
--    amount, revenue and reports. Their verification code is revoked.
-- ---------------------------------------------------------------------------
alter table public.payments
  add column cancelled_at timestamptz,
  add column cancelled_by uuid references public.profiles(id) on delete set null,
  add column cancel_reason text;
alter table public.payments
  add constraint payments_cancel_reason_required
  check (cancelled_at is null or length(btrim(coalesce(cancel_reason, ''))) between 3 and 500);
create index payments_active_student_idx on public.payments (student_id) where cancelled_at is null;

create or replace function public.sync_student_paid_from_ledger(p_student_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if p_student_id is null then return; end if;
  perform set_config('app.ledger_sync', 'on', true);
  update public.students s
     set paid = l.total_paid
    from (
      select coalesce(sum(p.amount), 0)::bigint as total_paid
        from public.payments p
       where p.student_id = p_student_id and p.cancelled_at is null
    ) l
   where s.id = p_student_id
     and s.paid is distinct from l.total_paid;
  perform set_config('app.ledger_sync', 'off', true);
end
$$;

drop trigger if exists _900_sync_student_paid on public.payments;
create trigger _900_sync_student_paid
  after insert or delete or update of amount, student_id, cancelled_at on public.payments
  for each row execute function public.tg__payments__sync_student_paid();

create or replace function public.admin_cancel_payment(p_payment_id text, p_reason text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor uuid := (select auth.uid());
  v_reason text := btrim(coalesce(p_reason, ''));
  v_student_id uuid;
  v_payment public.payments%rowtype;
begin
  if v_actor is null or not exists (
    select 1 from public.profiles p where p.id = v_actor and p.role = 'admin' and p.disabled_at is null
  ) then
    raise exception 'Only admins can cancel payments' using errcode = '42501';
  end if;
  if length(v_reason) < 3 or length(v_reason) > 500 then
    raise exception 'CANCEL_REASON_REQUIRED' using errcode = '22023';
  end if;

  select p.student_id into v_student_id from public.payments p where p.id = p_payment_id;
  if not found then raise exception 'PAYMENT_NOT_FOUND' using errcode = 'P0002'; end if;
  -- Same lock order as record_payment: the student row first.
  perform 1 from public.students s where s.id = v_student_id for update;
  select * into v_payment from public.payments p where p.id = p_payment_id for update;
  if v_payment.cancelled_at is not null then
    raise exception 'PAYMENT_ALREADY_CANCELLED' using errcode = 'P0001';
  end if;

  update public.payments
     set cancelled_at = now(), cancelled_by = v_actor, cancel_reason = v_reason
   where id = p_payment_id
  returning * into v_payment;

  update public.verifiable_documents
     set status = 'revoked', revoked_at = coalesce(revoked_at, now())
   where doc_type = 'invoice' and reference_id = p_payment_id;

  return jsonb_build_object('payment', to_jsonb(v_payment));
end
$$;
revoke all on function public.admin_cancel_payment(text, text) from public, anon;
grant execute on function public.admin_cancel_payment(text, text) to authenticated;

-- ---------------------------------------------------------------------------
-- 5. record_payment: later instalments keep the GST treatment of the student's first invoice
--    (changing a course's GST flag no longer splits one student's invoices), dates are India
--    dates and may not be in the future, and disabled admins cannot record.
-- ---------------------------------------------------------------------------
create or replace function public.record_payment(
  p_student_register_id integer, p_amount bigint, p_method text, p_payment_date date,
  p_transaction_id text, p_custom_note text, p_payment_type text, p_verification_code text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_student public.students%rowtype;
  v_payment public.payments%rowtype;
  v_rate numeric := 0;
  v_inclusive boolean;
  v_cgst bigint;
  v_sgst bigint;
  v_instance integer;
  v_type text := nullif(btrim(p_payment_type), '');
  v_date date := coalesce(p_payment_date, public.india_today());
begin
  if (select auth.uid()) is null or not exists (
    select 1 from public.profiles p
     where p.id = (select auth.uid()) and p.role = 'admin' and p.disabled_at is null
  ) then raise exception 'Only admins can record payments' using errcode = '42501'; end if;
  if p_amount is null or p_amount <= 0 then
    raise exception 'Payment amounts must be positive' using errcode = '22023';
  end if;
  if v_date > public.india_today() then
    raise exception 'PAYMENT_DATE_IN_FUTURE' using errcode = '22023';
  end if;
  if v_type is not null and length(v_type) > 100 then
    raise exception 'Payment type is too long' using errcode = '22023';
  end if;

  -- Row lock serialises concurrent payments (and cancellations) for the same student.
  select * into v_student from public.students
   where register_id = p_student_register_id for update;
  if not found then raise exception 'STUDENT_NOT_FOUND' using errcode = 'P0002'; end if;
  if p_amount > v_student.total - v_student.paid then
    raise exception 'PAYMENT_EXCEEDS_BALANCE' using errcode = 'P0001';
  end if;

  select case when g.enabled then g.rate else 0 end into v_rate
    from public.gst_settings g where g.id = 'default';
  v_rate := coalesce(v_rate, 0);

  select p.gst_inclusive into v_inclusive
    from public.payments p
   where p.student_id = v_student.id and p.cancelled_at is null
   order by p.created_at, p.id
   limit 1;
  if v_inclusive is null then
    select c.gst_inclusive into v_inclusive
      from public.courses c
     where lower(btrim(c.name)) = lower(btrim(v_student.course))
     order by c.id
     limit 1;
  end if;
  v_inclusive := coalesce(v_inclusive, false);
  select t.cgst, t.sgst into v_cgst, v_sgst from public.compute_payment_tax(p_amount, v_rate, v_inclusive) t;

  select count(*)::integer + 1 into v_instance
    from public.payments p where p.student_id = v_student.id and p.cancelled_at is null;
  v_type := coalesce(v_type, public.ordinal_label(v_instance) || ' Part Fees Payment');

  perform set_config('app.atomic_payment_rpc', 'on', true);
  insert into public.payments (
    student_id, student_register_id, method, amount, payment_date, transaction_id, custom_note,
    gst_rate, cgst, sgst, gst_inclusive, payment_type, instance_number
  ) values (
    v_student.id, v_student.register_id, p_method, p_amount, v_date, p_transaction_id, p_custom_note,
    v_rate, v_cgst, v_sgst, v_inclusive, v_type, v_instance
  ) returning * into v_payment;

  select * into v_student from public.students where id = v_student.id;

  insert into public.verifiable_documents (doc_type, reference_id, verification_code, status)
  values ('invoice', v_payment.id, p_verification_code, 'active');

  return jsonb_build_object('payment', to_jsonb(v_payment), 'student', to_jsonb(v_student),
    'verification_code', p_verification_code);
end
$$;

-- ---------------------------------------------------------------------------
-- 6. Enrolment: the course must exist, its stored name is used, the fee must be above zero and
--    staff always enrol at the course fee (they do not see or set fees).
-- ---------------------------------------------------------------------------
create or replace function public.create_student_with_payment(
  p_student jsonb, p_initial_payment_amount bigint, p_initial_payment_date date, p_verification_code text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_student public.students%rowtype;
  v_payment jsonb := null;
  v_role text;
  v_course_name text;
  v_course_fee bigint;
  v_total bigint;
begin
  select p.role into v_role from public.profiles p where p.id = (select auth.uid()) and p.disabled_at is null;
  if (select auth.uid()) is null or v_role is null or v_role not in ('admin', 'staff') then
    raise exception 'Not authorized to create students' using errcode = '42501';
  end if;

  select c.name, c.fee into v_course_name, v_course_fee
    from public.courses c
   where lower(btrim(c.name)) = lower(btrim(coalesce(p_student->>'course', '')))
   order by c.id
   limit 1;
  if v_course_name is null then
    raise exception 'COURSE_NOT_FOUND' using errcode = 'P0002';
  end if;
  if v_role = 'staff' and not public.can_access_course_name(v_course_name) then
    raise exception 'You are not assigned to this course' using errcode = '42501';
  end if;

  if v_role = 'staff' then
    v_total := v_course_fee;
  else
    begin
      v_total := nullif(p_student->>'total', '')::bigint;
    exception when others then
      v_total := null;
    end;
  end if;
  if v_total is null or v_total <= 0 then
    raise exception 'FEE_REQUIRED' using errcode = '22023';
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
    p_student->>'name', p_student->>'phone', v_course_name, p_student->>'batch',
    v_total, 0, 'Pending', nullif(p_student->>'gender',''),
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
      coalesce(p_initial_payment_date, public.india_today()), null, null, null::text, p_verification_code
    );
    select * into v_student from public.students where id = v_student.id;
  end if;

  return jsonb_build_object('student', to_jsonb(v_student), 'initial_payment', v_payment);
end
$$;

-- ---------------------------------------------------------------------------
-- 7. Editing and removing students. Staff may edit profile fields of students in their courses
--    (RLS); only admins change the fee or delete. Payments and certificates block deletion
--    (ON DELETE RESTRICT), so issued invoices are never lost.
-- ---------------------------------------------------------------------------
grant update (total) on public.students to authenticated;
grant delete on public.students to authenticated;

create or replace function public.tg__students__guard_changes()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_course text;
begin
  if new.total is distinct from old.total then
    if not (select public.is_current_user_admin()) then
      raise exception 'Only admins can change a student''s fee' using errcode = '42501';
    end if;
    if new.total <= 0 then
      raise exception 'FEE_REQUIRED' using errcode = '22023';
    end if;
    if new.total < new.paid then
      raise exception 'FEE_BELOW_PAID' using errcode = '23514';
    end if;
  end if;
  if new.course is distinct from old.course then
    select c.name into v_course from public.courses c
     where lower(btrim(c.name)) = lower(btrim(coalesce(new.course, '')))
     order by c.id limit 1;
    if v_course is null then
      raise exception 'COURSE_NOT_FOUND' using errcode = 'P0002';
    end if;
    new.course := v_course;
  end if;
  return new;
end
$$;
create trigger _150_guard_changes
  before update on public.students
  for each row execute function public.tg__students__guard_changes();

-- ---------------------------------------------------------------------------
-- 8. Notifications: only active admin/staff accounts read them. Enrolment notices go to admins
--    (the app also sends one to each trainer of the course) instead of every account.
-- ---------------------------------------------------------------------------
drop policy if exists "Users can view accessible notifications" on public.notifications;
create policy "Users can view accessible notifications" on public.notifications
  for select to authenticated
  using (exists (
    select 1 from public.profiles p
     where p.id = (select auth.uid())
       and p.disabled_at is null
       and p.role in ('admin', 'staff')
       and (notifications.user_id = p.id
            or (notifications.user_id is null and notifications.recipient_role in ('all', p.role)))
  ));
update public.notifications
   set recipient_role = 'admin'
 where recipient_role = 'all' and user_id is null and entity_type = 'student';

-- ---------------------------------------------------------------------------
-- 9. Re-grading updates graded_at.
-- ---------------------------------------------------------------------------
create or replace function public.tg__assessment_results__touch_graded_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.score is distinct from old.score or new.remarks is distinct from old.remarks then
    new.graded_at := now();
  end if;
  return new;
end
$$;
create trigger _200_touch_graded_at
  before update on public.assessment_results
  for each row execute function public.tg__assessment_results__touch_graded_at();

alter table public.assessments
  add constraint assessments_max_score_positive check (max_score > 0) not valid;
alter table public.assessments validate constraint assessments_max_score_positive;

-- ---------------------------------------------------------------------------
-- 10. Attendance: no future dates; marks can be cleared by whoever may mark them.
-- ---------------------------------------------------------------------------
create or replace function public.tg__attendance__guard_date()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.session_date > public.india_today() then
    raise exception 'ATTENDANCE_DATE_IN_FUTURE' using errcode = '22023';
  end if;
  return new;
end
$$;
create trigger _100_guard_date
  before insert or update of session_date on public.attendance
  for each row execute function public.tg__attendance__guard_date();

grant delete on public.attendance to authenticated;
drop policy if exists attendance_delete_assigned on public.attendance;
create policy attendance_delete_assigned on public.attendance
  for delete to authenticated
  using ((select public.can_access_course(attendance.course_id)));

-- One definition of attendance everywhere: Late counts as attended; Exempt/Excused sessions are
-- left out of the percentage. "sessions" is the number of counted sessions.
create or replace view public.attendance_summary with (security_invoker = true) as
select a.course_id,
       c.name as course_name,
       a.student_id,
       s.register_id,
       s.name as student_name,
       (count(*) filter (where a.status not in ('Exempt', 'Excused')))::integer as sessions,
       (count(*) filter (where a.status in ('Present', 'Late')))::integer as present_sessions,
       round(100.0 * (count(*) filter (where a.status in ('Present', 'Late')))::numeric
             / nullif(count(*) filter (where a.status not in ('Exempt', 'Excused')), 0)::numeric, 1)
         as attendance_percent
  from public.attendance a
  join public.students s on s.id = a.student_id
  join public.courses c on c.id = a.course_id
 group by a.course_id, c.name, a.student_id, s.register_id, s.name;

create or replace view public.attendance_course_summary with (security_invoker = true) as
select a.course_id,
       c.name as course_name,
       (count(distinct a.student_id))::integer as students,
       (count(*) filter (where a.status not in ('Exempt', 'Excused')))::integer as sessions,
       (count(*) filter (where a.status in ('Present', 'Late')))::integer as present_sessions,
       round(100.0 * (count(*) filter (where a.status in ('Present', 'Late')))::numeric
             / nullif(count(*) filter (where a.status not in ('Exempt', 'Excused')), 0)::numeric, 1)
         as attendance_percent
  from public.attendance a
  join public.courses c on c.id = a.course_id
 group by a.course_id, c.name;

-- ---------------------------------------------------------------------------
-- 11. Certificates are issued in one transaction with their verification record, numbered by
--     the database, once per student and course, and only when the fee is fully paid.
--     Revoking keeps the record and invalidates its QR code.
-- ---------------------------------------------------------------------------
create sequence if not exists public.certificate_seq;
alter table public.certificates
  add column revoked_at timestamptz,
  add column revoked_by uuid references public.profiles(id) on delete set null,
  add column revoke_reason text;

create or replace function public.issue_certificate(
  p_student_register_id integer,
  p_issue_date date,
  p_start_date date,
  p_end_date date,
  p_skills text[],
  p_director_name text,
  p_trainer_name text,
  p_custom_note text,
  p_verification_code text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_student public.students%rowtype;
  v_certificate public.certificates%rowtype;
  v_issue date := coalesce(p_issue_date, public.india_today());
begin
  if (select auth.uid()) is null or not exists (
    select 1 from public.profiles p
     where p.id = (select auth.uid()) and p.role = 'admin' and p.disabled_at is null
  ) then raise exception 'Only admins can issue certificates' using errcode = '42501'; end if;
  if p_start_date is not null and p_end_date is not null and p_start_date > p_end_date then
    raise exception 'CERTIFICATE_DATES_INVALID' using errcode = '22023';
  end if;
  if v_issue > public.india_today() then
    raise exception 'CERTIFICATE_DATES_INVALID' using errcode = '22023';
  end if;

  select * into v_student from public.students where register_id = p_student_register_id for update;
  if not found then raise exception 'STUDENT_NOT_FOUND' using errcode = 'P0002'; end if;
  if v_student.total <= 0 or v_student.paid < v_student.total then
    raise exception 'FEES_OUTSTANDING' using errcode = 'P0001';
  end if;
  if exists (
    select 1 from public.certificates c
     where c.student_id = v_student.id
       and lower(btrim(c.course_name)) = lower(btrim(v_student.course))
       and c.revoked_at is null
  ) then
    raise exception 'CERTIFICATE_EXISTS' using errcode = '23505';
  end if;

  insert into public.certificates (
    certificate_id, student_id, student_register_id, course_name, student_name,
    start_date, end_date, issue_date, skills, director_name, trainer_name, custom_note
  ) values (
    'TAI-' || to_char(v_issue, 'YYYY') || '-' || lpad(nextval('public.certificate_seq')::text, 4, '0'),
    v_student.id, v_student.register_id, v_student.course, v_student.name,
    p_start_date, p_end_date, v_issue, coalesce(p_skills, array[]::text[]),
    nullif(btrim(p_director_name), ''), nullif(btrim(p_trainer_name), ''), nullif(btrim(p_custom_note), '')
  ) returning * into v_certificate;

  insert into public.verifiable_documents (doc_type, reference_id, verification_code, status)
  values ('certificate', v_certificate.id::text, p_verification_code, 'active');

  return jsonb_build_object('certificate', to_jsonb(v_certificate), 'verification_code', p_verification_code);
end
$$;
revoke all on function public.issue_certificate(integer, date, date, date, text[], text, text, text, text) from public, anon;
grant execute on function public.issue_certificate(integer, date, date, date, text[], text, text, text, text) to authenticated;

-- Existing certificate numbers were random 4-digit values; start the sequence above them.
select setval('public.certificate_seq', greatest(
  (select coalesce(max(nullif(substring(certificate_id from '^TAI-\d{4}-(\d+)$'), '')::bigint), 0) from public.certificates),
  1), true);

create or replace function public.admin_revoke_certificate(p_certificate_uuid uuid, p_reason text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor uuid := (select auth.uid());
  v_reason text := btrim(coalesce(p_reason, ''));
begin
  if v_actor is null or not exists (
    select 1 from public.profiles p where p.id = v_actor and p.role = 'admin' and p.disabled_at is null
  ) then raise exception 'Only admins can revoke certificates' using errcode = '42501'; end if;
  if length(v_reason) < 3 or length(v_reason) > 500 then
    raise exception 'REVOKE_REASON_REQUIRED' using errcode = '22023';
  end if;
  update public.certificates
     set revoked_at = now(), revoked_by = v_actor, revoke_reason = v_reason
   where id = p_certificate_uuid and revoked_at is null;
  if not found then
    raise exception 'CERTIFICATE_NOT_FOUND' using errcode = 'P0002';
  end if;
  update public.verifiable_documents
     set status = 'revoked', revoked_at = coalesce(revoked_at, now())
   where doc_type = 'certificate' and reference_id = p_certificate_uuid::text;
end
$$;
revoke all on function public.admin_revoke_certificate(uuid, text) from public, anon;
grant execute on function public.admin_revoke_certificate(uuid, text) to authenticated;

-- A renamed course no longer hides older certificates from the trainers of that course.
drop policy if exists "Certificates select policy" on public.certificates;
create policy "Certificates select policy" on public.certificates
  for select to authenticated
  using (
    (select public.can_access_course_name(certificates.course_name))
    or exists (
      select 1 from public.students s
       where s.id = certificates.student_id and (select public.can_access_course_name(s.course))
    )
  );

-- ---------------------------------------------------------------------------
-- 12. Names of the people who marked, graded or created records. Staff can only read their own
--     profile row, so these lookups return just id, name and role.
-- ---------------------------------------------------------------------------
create or replace function public.profile_display_names(p_ids uuid[])
returns table (id uuid, full_name text, role text)
language sql
stable
security definer
set search_path = ''
as $$
  select p.id, p.full_name, p.role
    from public.profiles p
   where p.id = any (p_ids)
     and exists (
       select 1 from public.profiles me
        where me.id = (select auth.uid()) and me.role in ('admin', 'staff') and me.disabled_at is null
     )
$$;
revoke all on function public.profile_display_names(uuid[]) from public, anon;
grant execute on function public.profile_display_names(uuid[]) to authenticated;

-- ---------------------------------------------------------------------------
-- 13. Material uploads must sit under a folder named after a course the uploader may access.
-- ---------------------------------------------------------------------------
drop policy if exists "Course roles can upload materials" on storage.objects;
create policy "Course roles can upload materials" on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'course-materials'
    and (select public.can_access_course(split_part(name, '/', 1)))
  );

-- ---------------------------------------------------------------------------
-- 14. Dashboard totals leave out cancelled payments and use the India calendar month.
-- ---------------------------------------------------------------------------
create or replace function public.get_dashboard_summary()
returns jsonb
language sql
stable
set search_path = ''
as $$
  select pg_catalog.jsonb_build_object(
    'studentCount', (select count(*) from public.students),
    'revenuePaise', (select coalesce(sum(amount), 0) from public.payments where cancelled_at is null),
    'gstCollectedPaise', (select coalesce(sum(cgst + sgst), 0) from public.payments where cancelled_at is null),
    'outstandingPaise', (select coalesce(sum(total - paid), 0) from public.students),
    'eligibleCount', (select count(*) from public.students where total > 0 and paid >= total),
    'monthlyRevenuePaise', (
      select coalesce(sum(amount), 0) from public.payments
       where cancelled_at is null
         and payment_date >= date_trunc('month', public.india_today())::date
    ),
    'courseMix', (
      select coalesce(pg_catalog.jsonb_agg(
        pg_catalog.jsonb_build_object('course', course, 'studentCount', student_count)
        order by student_count desc, course
      ), '[]'::jsonb)
      from (select course, count(*) as student_count from public.students group by course) as course_totals
    )
  );
$$;

create or replace function public.get_dashboard_summary_for_period(p_start_date date, p_end_date date)
returns jsonb
language sql
stable
set search_path = ''
as $$
  with enrolled as (
    select * from public.students
     where (created_at at time zone 'Asia/Kolkata')::date between p_start_date and p_end_date
  )
  select pg_catalog.jsonb_build_object(
    'studentCount', (select count(*) from enrolled),
    'revenuePaise', (
      select coalesce(sum(amount), 0) from public.payments
       where cancelled_at is null and payment_date between p_start_date and p_end_date
    ),
    'gstCollectedPaise', (
      select coalesce(sum(cgst + sgst), 0) from public.payments
       where cancelled_at is null and payment_date between p_start_date and p_end_date
    ),
    'outstandingPaise', (select coalesce(sum(total - paid), 0) from enrolled),
    'eligibleCount', (select count(*) from enrolled where total > 0 and paid >= total),
    'monthlyRevenuePaise', (
      select coalesce(sum(amount), 0) from public.payments
       where cancelled_at is null and payment_date between p_start_date and p_end_date
    ),
    'courseMix', (
      select coalesce(pg_catalog.jsonb_agg(
        pg_catalog.jsonb_build_object('course', course, 'studentCount', student_count)
        order by student_count desc, course
      ), '[]'::jsonb)
      from (select course, count(*) as student_count from enrolled group by course) as course_totals
    )
  );
$$;

notify pgrst, 'reload schema';
