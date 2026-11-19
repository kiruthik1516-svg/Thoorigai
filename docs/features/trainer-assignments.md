# Trainer assignment flow

1. An admin opens **Settings → Trainer assignments**.
2. Select a course and a staff member, then choose **Assign trainer**. Existing assignments are idempotent. Database triggers record assignment and unassignment in the audit log.
3. Choose **Unassign** on an assignment and confirm.

Assignments control what staff can reach (migration `20261119100000_enforce_course_assignments`). A staff member sees and works on students, attendance, assessments and results, course materials and certificates only for the courses they are assigned to, can enrol students only into those courses, and sees only those courses in pickers. A staff member with no assignments sees no student records. Admins see everything.

Row-level security enforces this through `can_access_course`, `can_access_course_name`, `can_access_assessment` and `can_access_material_object`; `supabase/tests/course_assignments.test.sql` covers it.
