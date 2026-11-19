/**
 * Students store their course by name. Compare names the same way the database does
 * (lower(btrim(name)), see 20261118150000_course_integrity) and never by substring (F-20):
 * the old `includes` check let an empty course name match every student.
 */
export function normalizeCourseName(value: string | null | undefined): string {
  return (value ?? '').trim().toLowerCase()
}

export function sameCourse(
  studentCourse: string | null | undefined,
  course: { id?: string | null; name?: string | null },
): boolean {
  const student = normalizeCourseName(studentCourse)
  if (!student) return false
  return student === normalizeCourseName(course.name) || student === normalizeCourseName(course.id)
}
