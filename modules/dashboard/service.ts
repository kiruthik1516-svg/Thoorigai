import 'server-only'
import { createClient } from '@/lib/supabase/server'
import { InternalError } from '@/lib/http/errors'
import type { DashboardSummary } from '@/modules/dashboard/types'
import { listPayments } from '@/lib/server-data'
import { indiaToday } from '@/lib/dates'
import { fetchAllRows } from '@/lib/supabase/fetch-all'
import { attendancePercent, isLowAttendance, tallyAttendance } from '@/lib/attendance'

function safeInteger(value: unknown): number {
  const parsed = Number(value)
  if (!Number.isSafeInteger(parsed) || parsed < 0) throw new InternalError('Dashboard summary returned invalid totals.')
  return parsed
}

export async function getDashboardSummary(): Promise<DashboardSummary> {
  const supabase = await createClient()
  const { data, error } = await supabase.rpc('get_dashboard_summary')
  if (error) throw new InternalError('Unable to load dashboard summary.')
  if (!data || typeof data !== 'object') throw new InternalError('Dashboard summary is unavailable.')
  const summary = data as Record<string, unknown>
  const courseMix = Array.isArray(summary.courseMix)
    ? summary.courseMix.map((entry) => {
        if (!entry || typeof entry !== 'object') throw new InternalError('Dashboard course mix is invalid.')
        const row = entry as Record<string, unknown>
        return { course: String(row.course), studentCount: safeInteger(row.studentCount) }
      })
    : []
  return {
    studentCount: safeInteger(summary.studentCount),
    revenuePaise: safeInteger(summary.revenuePaise),
    gstCollectedPaise: summary.gstCollectedPaise === undefined ? undefined : safeInteger(summary.gstCollectedPaise),
    outstandingPaise: safeInteger(summary.outstandingPaise),
    eligibleCount: safeInteger(summary.eligibleCount),
    monthlyRevenuePaise: safeInteger(summary.monthlyRevenuePaise),
    courseMix,
  }
}

export async function getDashboardSummaryForPeriod(startDate: string, endDate: string): Promise<DashboardSummary> {
  const supabase = await createClient()
  const { data, error } = await supabase.rpc('get_dashboard_summary_for_period', {
    p_start_date: startDate,
    p_end_date: endDate,
  })
  if (error) throw new InternalError('Unable to load the date-range report.')
  if (!data || typeof data !== 'object') throw new InternalError('Date-range report is unavailable.')
  const summary = data as Record<string, unknown>
  const courseMix = Array.isArray(summary.courseMix)
    ? summary.courseMix.map((entry) => {
        if (!entry || typeof entry !== 'object') throw new InternalError('Report course mix is invalid.')
        const row = entry as Record<string, unknown>
        return { course: String(row.course), studentCount: safeInteger(row.studentCount) }
      })
    : []
  return {
    studentCount: safeInteger(summary.studentCount),
    revenuePaise: safeInteger(summary.revenuePaise),
    gstCollectedPaise: summary.gstCollectedPaise === undefined ? undefined : safeInteger(summary.gstCollectedPaise),
    outstandingPaise: safeInteger(summary.outstandingPaise),
    eligibleCount: safeInteger(summary.eligibleCount),
    monthlyRevenuePaise: safeInteger(summary.monthlyRevenuePaise),
    courseMix,
  }
}

export async function getRecentPayments() {
  const supabase = await createClient()
  return listPayments(supabase, { page: 1, pageSize: 5 })
}

export type StaffDashboardData = {
  totalStudents: number
  activeStudents: number
  todayAttendance: {
    totalMarked: number
    present: number
    absent: number
    rate: number
  }
  materialsCount: number
  assessmentCount: number
  recentAssessments: Array<{
    id: string
    title: string
    courseId: string
    courseName: string
    maxScore: number
    assessmentDate: string
  }>
  lowAttendanceStudents: Array<{
    id: string
    registerId: number
    name: string
    course: string
    phone: string | null
    totalSessions: number
    presentSessions: number
    rate: number
  }>
  categoryMix: Array<{
    id: string
    name: string
    duration: string
    courseNames: string[]
    studentCount: number
  }>
}

export async function getStaffDashboardData(): Promise<StaffDashboardData> {
  const supabase = await createClient()
  const today = indiaToday()

  type StudentRow = { id: string; register_id: number; name: string; course: string; phone: string | null }
  type SummaryRow = { student_id: string | null; sessions: number | null; present_sessions: number | null }
  const check = <T extends { error: unknown }>(result: T): T => {
    if (result.error) throw result.error
    return result
  }

  // Unpaged selects stop at the API row cap (1000), so students and attendance totals are read in
  // pages; attendance comes pre-aggregated from attendance_summary (one row per student and course).
  const [students, summaryRows, todayResult, assessmentResult, materialsResult, categoriesResult, coursesResult] =
    await Promise.all([
      fetchAllRows<StudentRow>((from, to) =>
        supabase.from('students').select('id, register_id, name, course, phone').order('register_id').range(from, to),
      ),
      fetchAllRows<SummaryRow>((from, to) =>
        supabase
          .from('attendance_summary')
          .select('student_id, sessions, present_sessions')
          .order('student_id')
          .order('course_id')
          .range(from, to),
      ),
      supabase.from('attendance').select('id, status, course_id, student_id').eq('session_date', today).then(check),
      supabase
        .from('assessments')
        .select('id, title, course_id, max_score, assessment_date, courses(name)', { count: 'exact' })
        .order('assessment_date', { ascending: false })
        .order('id', { ascending: false })
        .limit(6)
        .then(check),
      supabase.from('course_materials').select('*', { count: 'exact', head: true }).then(check),
      supabase.from('course_categories').select('id, name, duration').order('name').then(check),
      supabase.from('courses').select('id, name, duration, category_id').then(check),
    ])
  const todayAttendance = todayResult.data ?? []
  const assessments = assessmentResult.data ?? []
  const assessmentCount = assessmentResult.count
  const materialsCount = materialsResult.count
  const categoriesData = categoriesResult.data
  const coursesData = coursesResult.data
  const studentCount = students.length

  const studentAttendanceMap = new Map<string, { total: number; present: number }>()
  for (const row of summaryRows) {
    const sId = String(row.student_id)
    const current = studentAttendanceMap.get(sId) || { total: 0, present: 0 }
    current.total += Number(row.sessions)
    current.present += Number(row.present_sessions)
    studentAttendanceMap.set(sId, current)
  }

  const lowAttendanceStudents = students
    .map((s) => {
      const stats = studentAttendanceMap.get(String(s.id))
      const rate = attendancePercent({ counted: stats?.total ?? 0, attended: stats?.present ?? 0 })
      return {
        id: String(s.id),
        registerId: Number(s.register_id),
        name: String(s.name),
        course: String(s.course),
        phone: s.phone ? String(s.phone) : null,
        totalSessions: stats?.total ?? 0,
        presentSessions: stats?.present ?? 0,
        rate: rate ?? 100,
      }
    })
    .filter((s) => isLowAttendance({ counted: s.totalSessions, attended: s.presentSessions }))
    .sort((a, b) => a.rate - b.rate)
    .slice(0, 10)

  // Today: Late counts as present and Exempt is left out, as everywhere else.
  const todayTally = tallyAttendance(todayAttendance.map((a) => a.status))
  const todayPresent = todayTally.attended
  const todayAbsent = todayTally.counted - todayTally.attended
  const todayTotal = todayTally.counted
  const todayRate = attendancePercent(todayTally) ?? 0

  const mappedAssessments = (assessments ?? []).map((a) => ({
    id: String(a.id),
    title: String(a.title),
    courseId: String(a.course_id),
    courseName: String(a.courses?.name ?? 'Course'),
    maxScore: Number(a.max_score),
    assessmentDate: String(a.assessment_date),
  }))

  const fallbackCategories = [
    { id: 'c0000000-0000-0000-0000-000000000001', name: 'Essential', duration: '6 weeks' },
    { id: 'c0000000-0000-0000-0000-000000000002', name: 'Elite', duration: '12 weeks' },
    { id: 'c0000000-0000-0000-0000-000000000003', name: 'Internship', duration: '3 Months' },
  ]

  const categoryRows: Array<{ id: string; name: string; duration: string | null }> =
    categoriesData && categoriesData.length > 0 ? categoriesData : fallbackCategories
  const catList = categoryRows.map((c) => ({
    id: String(c.id),
    name: String(c.name),
    duration: String(c.duration),
  }))

  const courseList = (coursesData ?? []).map((c) => ({
    id: String(c.id),
    name: String(c.name),
    duration: String(c.duration || ''),
    categoryId: c.category_id ? String(c.category_id) : null,
  }))

  const courseToCatMap = new Map<string, { id: string; name: string }>()
  for (const c of courseList) {
    const cat = catList.find((item) => item.id === c.categoryId)
    if (cat) {
      courseToCatMap.set(c.name.toLowerCase().trim(), { id: cat.id, name: cat.name })
    }
  }

  const categoryMix = catList.map((cat) => {
    const isInternship = cat.name.toLowerCase().includes('internship')
    const isElite = cat.name.toLowerCase().includes('elite')

    const catCourses = courseList.filter((c) => {
      if (c.categoryId === cat.id) return true
      if (isInternship && c.name.toLowerCase().includes('internship')) return true
      if (!c.categoryId && isElite && (c.duration.includes('month') || c.duration.includes('12'))) return true
      return false
    })
    const catCourseNames = Array.from(new Set(catCourses.map((c) => c.name)))

    const count = students.filter((s) => {
      if (!s.course) return false
      const sCourse = String(s.course).trim().toLowerCase()
      if (catCourseNames.some((cn) => cn.trim().toLowerCase() === sCourse)) return true
      const mapped = courseToCatMap.get(sCourse)
      if (mapped && mapped.id === cat.id) return true
      if (isInternship && sCourse.includes('internship')) return true
      if (
        !mapped &&
        isElite &&
        (sCourse.includes('professional') || sCourse.includes('crash') || sCourse.includes('slash'))
      )
        return true
      return false
    }).length

    students.forEach((s) => {
      if (!s.course) return
      const sCourse = String(s.course).trim()
      const sCourseLower = sCourse.toLowerCase()
      if (isInternship && sCourseLower.includes('internship') && !catCourseNames.includes(sCourse)) {
        catCourseNames.push(sCourse)
      } else if (
        isElite &&
        (sCourseLower.includes('professional') || sCourseLower.includes('crash') || sCourseLower.includes('slash')) &&
        !catCourseNames.includes(sCourse)
      ) {
        catCourseNames.push(sCourse)
      }
    })

    return {
      id: cat.id,
      name: cat.name,
      duration: cat.duration,
      courseNames: catCourseNames,
      studentCount: count,
    }
  })

  return {
    totalStudents: studentCount,
    activeStudents: students.length,
    todayAttendance: {
      totalMarked: todayTotal,
      present: todayPresent,
      absent: todayAbsent,
      rate: todayRate,
    },
    materialsCount: materialsCount ?? 0,
    assessmentCount: assessmentCount ?? 0,
    recentAssessments: mappedAssessments,
    lowAttendanceStudents,
    categoryMix,
  }
}
