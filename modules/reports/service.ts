import 'server-only'
import { createClient } from '@/lib/supabase/server'
import { normalizeJoined } from '@/lib/supabase/relations'
import { fetchAllRows } from '@/lib/supabase/fetch-all'
import { studentFromRow, paymentFromRow, withoutMoney } from '@/lib/server-data'
import { getCurrentProfile } from '@/lib/auth/current-profile'
import { can } from '@/lib/auth/permissions'
import type { Student, Payment } from '@/lib/types'

/** Share of the maximum score needed to pass an assessment. */
export const PASS_MARK = 0.4

/** Every student the caller can see. Staff never receive fees, paid amounts or paid status. */
export async function getAllStudents(): Promise<Student[]> {
  const [{ role }, supabase] = await Promise.all([getCurrentProfile(), createClient()])
  const rows = await fetchAllRows<Record<string, unknown>>((from, to) =>
    supabase.from('students').select('*').order('register_id', { ascending: true }).range(from, to),
  )
  const students = rows.map(studentFromRow)
  return can(role, 'payments', 'read') ? students : students.map(withoutMoney)
}

/** Every payment that counts (cancelled invoices are left out). Admin only through RLS. */
export async function getAllPayments(): Promise<Payment[]> {
  const supabase = await createClient()
  const rows = await fetchAllRows<Record<string, unknown>>((from, to) =>
    supabase
      .from('payments')
      .select(
        `
          id, student_id, student_register_id, method, amount, invoice, payment_date,
          transaction_id, custom_note, payment_type, instance_number, gst_rate, cgst, sgst,
          gst_inclusive, taxable_value, grand_total, cancelled_at,
          students!payments_student_id_fkey ( id, name, course )
        `,
      )
      .is('cancelled_at', null)
      .order('payment_date', { ascending: false })
      .order('id', { ascending: false })
      .range(from, to),
  )
  return rows.map((row) => {
    const student = normalizeJoined(row.students as Record<string, unknown> | Record<string, unknown>[] | null)
    return paymentFromRow({ ...row, student_name: student?.name })
  })
}

export type AttendanceReportItem = {
  id: string
  sessionDate: string
  status: 'Present' | 'Absent' | 'Exempt' | 'Late' | 'Excused'
  studentId: string
  studentName: string
  studentRegisterId: number
  courseId: string
  courseName: string
}

export type AssessmentReportItem = {
  id: string
  title: string
  courseId: string
  courseName: string
  maxScore: number
  assessmentDate: string
  resultsCount: number
  avgScore: number
  passCount: number
  failCount: number
}

export type AcademicReportData = {
  attendanceRecords: AttendanceReportItem[]
  assessmentRecords: AssessmentReportItem[]
}

type AttendanceRow = {
  id: string
  session_date: string
  status: string
  course_id: string
  student_id: string
  students: unknown
  courses: unknown
}
type AssessmentRow = {
  id: string
  title: string
  max_score: number
  assessment_date: string
  course_id: string
  courses: unknown
}
type ResultRow = { id: string; assessment_id: string; score: number }

/**
 * Attendance and assessment data for the reports. Every row is read (in pages), so long date
 * ranges are complete; optional bounds keep the payload to the period being viewed.
 */
export async function getStaffAcademicReportData(
  range: { startDate?: string; endDate?: string } = {},
): Promise<AcademicReportData> {
  const supabase = await createClient()

  const [attendanceRows, assessmentRows, resultRows] = await Promise.all([
    fetchAllRows<AttendanceRow>((from, to) => {
      let query = supabase
        .from('attendance')
        .select('id, session_date, status, course_id, student_id, students(register_id, name), courses(name)')
      if (range.startDate) query = query.gte('session_date', range.startDate)
      if (range.endDate) query = query.lte('session_date', range.endDate)
      return query.order('session_date', { ascending: false }).order('id', { ascending: false }).range(from, to)
    }),
    fetchAllRows<AssessmentRow>((from, to) => {
      let query = supabase.from('assessments').select('id, title, max_score, assessment_date, course_id, courses(name)')
      if (range.startDate) query = query.gte('assessment_date', range.startDate)
      if (range.endDate) query = query.lte('assessment_date', range.endDate)
      return query.order('assessment_date', { ascending: false }).order('id', { ascending: false }).range(from, to)
    }),
    fetchAllRows<ResultRow>((from, to) =>
      supabase.from('assessment_results').select('id, assessment_id, score').order('id').range(from, to),
    ),
  ])

  const resultsByAssessment = new Map<string, number[]>()
  for (const res of resultRows) {
    const aId = String(res.assessment_id)
    const list = resultsByAssessment.get(aId) || []
    list.push(Number(res.score))
    resultsByAssessment.set(aId, list)
  }

  const assessmentRecords: AssessmentReportItem[] = assessmentRows.map((row) => {
    const course = normalizeJoined(row.courses as { name?: string } | { name?: string }[] | null)
    const scores = resultsByAssessment.get(String(row.id)) || []
    const resultsCount = scores.length
    const avgScore = resultsCount > 0 ? Math.round(scores.reduce((a, b) => a + b, 0) / resultsCount) : 0
    const passThreshold = Number(row.max_score) * PASS_MARK
    const passCount = scores.filter((s) => s >= passThreshold).length
    return {
      id: String(row.id),
      title: String(row.title),
      courseId: String(row.course_id),
      courseName: String(course?.name ?? 'Course'),
      maxScore: Number(row.max_score),
      assessmentDate: String(row.assessment_date),
      resultsCount,
      avgScore,
      passCount,
      failCount: resultsCount - passCount,
    }
  })

  const attendanceRecords: AttendanceReportItem[] = attendanceRows.map((row) => {
    const student = normalizeJoined(
      row.students as { register_id?: number; name?: string } | { register_id?: number; name?: string }[] | null,
    )
    const course = normalizeJoined(row.courses as { name?: string } | { name?: string }[] | null)
    return {
      id: String(row.id),
      sessionDate: String(row.session_date),
      status: (row.status === 'Excused' ? 'Exempt' : row.status) as AttendanceReportItem['status'],
      studentId: String(row.student_id),
      studentName: String(student?.name ?? 'Unknown'),
      studentRegisterId: Number(student?.register_id ?? 0),
      courseId: String(row.course_id),
      courseName: String(course?.name ?? 'Course'),
    }
  })

  return { attendanceRecords, assessmentRecords }
}
