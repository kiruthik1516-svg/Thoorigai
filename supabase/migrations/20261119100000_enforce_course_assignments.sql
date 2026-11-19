-- ══════════════════════════════════════════════════════════════════════════
-- Migration: trainer assignments scope staff access (F-28)
--
-- Decision 2026-11-19: course_trainers now restricts staff. Every policy below previously began
-- with "role in (admin, staff) OR assigned", so assignments granted nothing (and several still
-- named the removed 'trainer' role). Now:
--   admins  see and manage everything (disabled accounts excluded)
--   staff   see and work on students, attendance, assessments, results, materials and
--           certificates only for courses they are assigned to; they can no longer create or
--           edit courses or certificates (matches lib/auth/permissions.ts)
-- IMPORTANT: assign staff to courses (Settings > Trainers) before or right after deploying,
-- otherwise staff accounts see no students.
-- Policies are changed with ALTER POLICY so no policy is dropped.
-- ══════════════════════════════════════════════════════════════════════════

-- ── Helpers (definer: no RLS recursion, one lookup per call) ──────────────
create or replace function public.can_access_course(p_course_id text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $function$
  select exists (
    select 1 from public.profiles p
     where p.id = (select auth.uid())
       and p.disabled_at is null
       and (
         p.role = 'admin'
         or (p.role = 'staff' and exists (
           select 1 from public.course_trainers ct where ct.trainer_id = p.id and ct.course_id = p_course_id
         ))
       )
  )
$function$;

create or replace function public.can_access_course_name(p_course_name text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $function$
  select exists (
    select 1 from public.profiles p
     where p.id = (select auth.uid())
       and p.disabled_at is null
       and (
         p.role = 'admin'
         or (p.role = 'staff' and exists (
           select 1
             from public.course_trainers ct
             join public.courses c on c.id = ct.course_id
            where ct.trainer_id = p.id
              and lower(btrim(c.name)) = lower(btrim(p_course_name))
         ))
       )
  )
$function$;

create or replace function public.can_access_assessment(p_assessment_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $function$
  select exists (
    select 1 from public.assessments a
     where a.id = p_assessment_id and public.can_access_course(a.course_id)
  )
$function$;

create or replace function public.can_access_material_object(p_object_name text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $function$
  select (select public.is_current_user_admin())
      or exists (
        select 1 from public.course_materials m
         where m.storage_path = p_object_name and public.can_access_course(m.course_id)
      )
$function$;

revoke all on function public.can_access_course(text) from public, anon;
revoke all on function public.can_access_course_name(text) from public, anon;
revoke all on function public.can_access_assessment(uuid) from public, anon;
revoke all on function public.can_access_material_object(text) from public, anon;
grant execute on function public.can_access_course(text) to authenticated;
grant execute on function public.can_access_course_name(text) to authenticated;
grant execute on function public.can_access_assessment(uuid) to authenticated;
grant execute on function public.can_access_material_object(text) to authenticated;

-- ── students ──────────────────────────────────────────────────────────────
alter policy "Students select policy" on public.students to authenticated
  using ((select public.can_access_course_name(course)));
alter policy "Students insert policy" on public.students to authenticated
  with check ((select public.can_access_course_name(course)));
alter policy "Students update policy" on public.students to authenticated
  using ((select public.can_access_course_name(course)))
  with check ((select public.can_access_course_name(course)));
alter policy "Students delete policy" on public.students to authenticated
  using ((select public.is_current_user_admin()));

-- ── attendance ────────────────────────────────────────────────────────────
alter policy attendance_read_assigned on public.attendance
  using ((select public.can_access_course(course_id)));
alter policy attendance_insert_assigned on public.attendance
  with check ((select public.can_access_course(course_id)));
alter policy attendance_update_assigned on public.attendance
  using ((select public.can_access_course(course_id)))
  with check ((select public.can_access_course(course_id)));

-- ── assessments and results ───────────────────────────────────────────────
alter policy assessments_read_assigned on public.assessments
  using ((select public.can_access_course(course_id)));
alter policy assessments_insert_assigned on public.assessments
  with check ((select public.can_access_course(course_id)));
alter policy assessments_update_assigned on public.assessments
  using ((select public.can_access_course(course_id)))
  with check ((select public.can_access_course(course_id)));
alter policy assessments_delete_assigned on public.assessments
  using ((select public.can_access_course(course_id)));

alter policy results_read_assigned on public.assessment_results
  using ((select public.can_access_assessment(assessment_id)));
alter policy results_insert_assigned on public.assessment_results
  with check ((select public.can_access_assessment(assessment_id)));
alter policy results_update_assigned on public.assessment_results
  using ((select public.can_access_assessment(assessment_id)))
  with check ((select public.can_access_assessment(assessment_id)));
alter policy results_delete_assigned on public.assessment_results
  using ((select public.can_access_assessment(assessment_id)));

-- ── course materials (rows and storage objects) ───────────────────────────
alter policy materials_read_assigned on public.course_materials
  using ((select public.can_access_course(course_id)));
alter policy materials_insert_assigned on public.course_materials
  with check ((select public.can_access_course(course_id)));
alter policy materials_update_assigned on public.course_materials
  using ((select public.can_access_course(course_id)))
  with check ((select public.can_access_course(course_id)));
alter policy materials_delete_assigned on public.course_materials
  using ((select public.can_access_course(course_id)));

-- Uploads happen before the metadata row exists, so any active admin/staff may upload; reading
-- and removing an object requires access to the course its metadata row belongs to.
alter policy "Course roles can upload materials" on storage.objects
  with check (
    bucket_id = 'course-materials'
    and exists (
      select 1 from public.profiles p
       where p.id = (select auth.uid()) and p.role in ('admin', 'staff') and p.disabled_at is null
    )
  );
alter policy "Course roles can read materials" on storage.objects
  using (bucket_id = 'course-materials' and (select public.can_access_material_object(name)));
alter policy "Course roles can delete materials" on storage.objects
  using (bucket_id = 'course-materials' and (select public.can_access_material_object(name)));

-- ── certificates: admins manage; staff read their courses' certificates ───
alter policy "Certificates select policy" on public.certificates to authenticated
  using ((select public.can_access_course_name(course_name)));
alter policy "Certificates insert policy" on public.certificates to authenticated
  with check ((select public.is_current_user_admin()));
alter policy "Certificates update policy" on public.certificates to authenticated
  using ((select public.is_current_user_admin()))
  with check ((select public.is_current_user_admin()));
alter policy "Certificates delete policy" on public.certificates to authenticated
  using ((select public.is_current_user_admin()));

-- ── courses: admins manage; staff see the courses they are assigned to ────
alter policy "Courses select policy" on public.courses to authenticated
  using ((select public.can_access_course(id)));
alter policy "Courses insert policy" on public.courses to authenticated
  with check ((select public.is_current_user_admin()));
alter policy "Courses update policy" on public.courses to authenticated
  using ((select public.is_current_user_admin()))
  with check ((select public.is_current_user_admin()));
alter policy "Courses delete policy" on public.courses to authenticated
  using ((select public.is_current_user_admin()));

-- ── Enrolment RPC runs as definer, so it checks the assignment itself ─────
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
  select p.role into v_role from public.profiles p where p.id = (select auth.uid()) and p.disabled_at is null;
  if (select auth.uid()) is null or v_role is null or v_role not in ('admin', 'staff') then
    raise exception 'Not authorized to create students' using errcode = '42501';
  end if;
  if v_role = 'staff' and not public.can_access_course_name(p_student->>'course') then
    raise exception 'You are not assigned to this course' using errcode = '42501';
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
