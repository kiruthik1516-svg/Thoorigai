-- ══════════════════════════════════════════════════════════════════════════
-- Migration: Re-sync students_register_id_seq with existing rows
--
-- Seed data (202609180003, see review finding F-41) inserted students with explicit register_id
-- values without advancing the sequence. On 2026-11-18 production had register_id up to 1051 while
-- the sequence was at 1048, so every new enrolment failed with 23505 (duplicate register_id) until
-- the sequence caught up. setval is idempotent and never moves the sequence backwards here.
-- ══════════════════════════════════════════════════════════════════════════

select pg_catalog.setval(
  'public.students_register_id_seq',
  greatest(
    (select coalesce(max(register_id), 0) from public.students),
    (select last_value from public.students_register_id_seq)
  )
);
