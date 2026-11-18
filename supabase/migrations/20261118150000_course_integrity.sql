-- ══════════════════════════════════════════════════════════════════════════
-- Migration: course create/update/delete integrity (F-15)
--
-- F-15  POST /api/courses upserted with id = 'CRS-' + last 4 digits of Date.now() (repeats every
--       10 s) or any client id, so a create could silently overwrite another course. Deleting a
--       course cascaded to attendance, assessments, results, materials and trainer links while
--       students kept only the course name. The route now inserts with a random id; these
--       database rules hold for every caller:
--       - course names are unique (case/space-insensitive), since students reference the name
--       - a course with dependent records cannot be deleted (the error lists what depends on it)
--       - renaming a course renames it on enrolled students, so name-based links (GST treatment
--         in record_payment, attendance, assessments) keep working
-- ══════════════════════════════════════════════════════════════════════════

create unique index if not exists courses_name_normalized_key on public.courses (lower(btrim(name)));

create or replace function public.tg__courses__guard_delete()
returns trigger
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_students bigint;
  v_attendance bigint;
  v_assessments bigint;
  v_materials bigint;
  v_trainers bigint;
begin
  select count(*) into v_students from public.students s where lower(btrim(s.course)) = lower(btrim(OLD.name));
  select count(*) into v_attendance from public.attendance a where a.course_id = OLD.id;
  select count(*) into v_assessments from public.assessments a where a.course_id = OLD.id;
  select count(*) into v_materials from public.course_materials m where m.course_id = OLD.id;
  select count(*) into v_trainers from public.course_trainers t where t.course_id = OLD.id;

  if v_students + v_attendance + v_assessments + v_materials + v_trainers > 0 then
    raise exception using
      errcode = '23503',
      message = pg_catalog.format(
        'Course "%s" is still in use: %s students, %s attendance records, %s assessments, %s materials, %s trainer assignments. Move or remove them first.',
        OLD.name, v_students, v_attendance, v_assessments, v_materials, v_trainers
      );
  end if;
  return OLD;
end $function$;

revoke all on function public.tg__courses__guard_delete() from public, anon, authenticated;

create or replace trigger _100_guard_delete
  before delete on public.courses
  for each row execute function public.tg__courses__guard_delete();

create or replace function public.tg__courses__rename_on_students()
returns trigger
language plpgsql
security definer
set search_path = ''
as $function$
begin
  if lower(btrim(NEW.name)) is distinct from lower(btrim(OLD.name)) then
    update public.students
       set course = NEW.name
     where lower(btrim(course)) = lower(btrim(OLD.name));
  end if;
  return null;
end $function$;

revoke all on function public.tg__courses__rename_on_students() from public, anon, authenticated;

create or replace trigger _900_rename_on_students
  after update of name on public.courses
  for each row execute function public.tg__courses__rename_on_students();
