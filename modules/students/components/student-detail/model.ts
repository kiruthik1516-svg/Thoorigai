export type AttendanceStatus = 'Present' | 'Absent' | 'Exempt' | 'Late' | 'Excused'
export type AttendanceRecord = { id: string; sessionDate: string; status: AttendanceStatus }
export type AssessmentRecord = {
  id: string
  title: string
  date: string
  score: number
  maxScore: number
  remarks?: string | null
  gradedAt?: string | null
}

const isExempt = (status?: AttendanceStatus) => status === 'Exempt' || status === 'Excused'

export function getMonday(d: Date): Date {
  const date = new Date(d.getFullYear(), d.getMonth(), d.getDate())
  const day = date.getDay()
  date.setDate(date.getDate() - day + (day === 0 ? -6 : 1))
  return date
}

export function formatDateIso(d: Date): string {
  const year = d.getFullYear()
  const month = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

export function formatShortDate(d: Date): string {
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

export function formatFullDate(d: Date): string {
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

export function studentInitials(name: string) {
  return name
    .split(' ')
    .map((w) => w[0])
    .slice(0, 2)
    .join('')
    .toUpperCase()
}

/** Exempt and excused sessions do not count against the attendance rate. */
export function attendanceSummary(attendance: AttendanceRecord[]) {
  const totalSessions = attendance.length
  const presentSessions = attendance.filter((a) => a.status === 'Present').length
  const absentSessions = attendance.filter((a) => a.status === 'Absent').length
  const exemptSessions = attendance.filter((a) => isExempt(a.status)).length
  const countableSessions = totalSessions - exemptSessions
  const attendanceRate =
    countableSessions > 0 ? Math.round((presentSessions / countableSessions) * 100) : totalSessions > 0 ? 100 : 0
  return { totalSessions, presentSessions, absentSessions, exemptSessions, attendanceRate }
}

const DAY_NAMES = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']

/** The Monday-to-Sunday week `weekOffset` weeks from the current one, with each day's record. */
export function attendanceWeek(attendance: AttendanceRecord[], weekOffset: number, now = new Date()) {
  const target = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  target.setDate(target.getDate() + weekOffset * 7)
  const monday = getMonday(target)
  const todayIso = formatDateIso(now)

  const weekDays = DAY_NAMES.map((dayName, i) => {
    const current = new Date(monday.getFullYear(), monday.getMonth(), monday.getDate() + i)
    const dateStr = formatDateIso(current)
    return {
      dateStr,
      dayName,
      dayNumber: current.getDate(),
      isToday: dateStr === todayIso,
      isFuture: dateStr > todayIso,
      record: attendance.find((a) => a.sessionDate === dateStr),
    }
  })

  const sunday = new Date(monday.getFullYear(), monday.getMonth(), monday.getDate() + 6)
  const logged = weekDays.map((d) => d.record).filter((r): r is AttendanceRecord => Boolean(r))
  return {
    weekDays,
    weekRangeLabel: `${formatShortDate(monday)} – ${formatFullDate(sunday)}`,
    isCurrentWeek: weekOffset === 0,
    weekSummary: {
      total: logged.length,
      present: logged.filter((r) => r.status === 'Present').length,
      absent: logged.filter((r) => r.status === 'Absent').length,
      exempt: logged.filter((r) => isExempt(r.status)).length,
    },
  }
}

const percentOf = (a: AssessmentRecord) => (a.score / (a.maxScore || 100)) * 100

export function assessmentSummary(assessments: AssessmentRecord[]) {
  const totalEvaluations = assessments.length
  return {
    totalEvaluations,
    avgScore:
      totalEvaluations > 0
        ? Math.round(assessments.reduce((acc, curr) => acc + percentOf(curr), 0) / totalEvaluations)
        : 0,
    passedEvaluations: assessments.filter((a) => percentOf(a) >= 50).length,
  }
}
