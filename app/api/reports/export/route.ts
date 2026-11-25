import { z } from 'zod'
import { withApi } from '@/lib/http/handler'
import { rolesFor } from '@/lib/auth/permissions'
import { isIsoDate } from '@/lib/dates'
import { toCsv } from '@/lib/csv'
import { attendancePercent, tallyAttendance } from '@/lib/attendance'
import { getStaffAcademicReportData, PASS_MARK } from '@/modules/reports/service'

const date = z.string().refine(isIsoDate, 'Enter a valid calendar date.')
const querySchema = z
  .object({ startDate: date, endDate: date })
  .refine(({ startDate, endDate }) => startDate <= endDate, {
    message: 'Start date must be on or before end date.',
    path: ['startDate'],
  })

/**
 * Academic CSV for the Staff & Academic report: attendance and assessments in the range, for the
 * courses the caller can see. It holds no money, so staff and admins get the same shape; the
 * financial CSV is built on the Financial tab from the same numbers shown there.
 */
export const GET = withApi({ roles: rolesFor('reports', 'export'), query: querySchema }, async ({ query }) => {
  const data = await getStaffAcademicReportData({ startDate: query.startDate, endDate: query.endDate })

  const byCourse = new Map<string, { students: Set<string>; statuses: string[] }>()
  for (const record of data.attendanceRecords) {
    const entry = byCourse.get(record.courseName) ?? { students: new Set<string>(), statuses: [] }
    entry.students.add(record.studentId)
    entry.statuses.push(record.status)
    byCourse.set(record.courseName, entry)
  }
  const overall = tallyAttendance(data.attendanceRecords.map((r) => r.status))

  const rows: (string | number)[][] = [
    ['Report', 'Value'],
    ['Start date', query.startDate],
    ['End date', query.endDate],
    ['Attendance marks', data.attendanceRecords.length],
    ['Attendance rate (Late counts, Exempt left out)', `${attendancePercent(overall) ?? 0}%`],
    ['Assessments', data.assessmentRecords.length],
    ['Pass mark', `${Math.round(PASS_MARK * 100)}%`],
    [],
    ['Course', 'Students marked', 'Sessions counted', 'Attended', 'Attendance %'],
    ...[...byCourse.entries()]
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([course, entry]) => {
        const tally = tallyAttendance(entry.statuses)
        return [course, entry.students.size, tally.counted, tally.attended, `${attendancePercent(tally) ?? 0}%`]
      }),
    [],
    ['Assessment', 'Course', 'Date', 'Max score', 'Graded', 'Average', 'Passed', 'Failed'],
    ...data.assessmentRecords.map((a) => [
      a.title,
      a.courseName,
      a.assessmentDate,
      a.maxScore,
      a.resultsCount,
      a.avgScore,
      a.passCount,
      a.failCount,
    ]),
  ]
  const csv = `${toCsv(rows)}\r\n`
  return new Response(csv, {
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="thoorigai-academic-report-${query.startDate}-to-${query.endDate}.csv"`,
      'Cache-Control': 'private, no-store',
    },
  })
})
