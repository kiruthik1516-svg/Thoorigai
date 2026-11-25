/**
 * One definition of attendance for every screen, matching the attendance_summary views:
 * Present and Late count as attended; Exempt (and the older Excused) sessions are left out of
 * the percentage entirely.
 */
export const LOW_ATTENDANCE_PERCENT = 75

export function isExemptStatus(status: string | null | undefined): boolean {
  return status === 'Exempt' || status === 'Excused'
}

export function isAttendedStatus(status: string | null | undefined): boolean {
  return status === 'Present' || status === 'Late'
}

export type AttendanceTally = { counted: number; attended: number }

export function tallyAttendance(statuses: Iterable<string | null | undefined>): AttendanceTally {
  let counted = 0
  let attended = 0
  for (const status of statuses) {
    if (isExemptStatus(status)) continue
    counted += 1
    if (isAttendedStatus(status)) attended += 1
  }
  return { counted, attended }
}

/** Whole-number percentage, or null when no session counts yet. */
export function attendancePercent({ counted, attended }: AttendanceTally): number | null {
  return counted > 0 ? Math.round((attended / counted) * 100) : null
}

export function isLowAttendance(tally: AttendanceTally): boolean {
  const percent = attendancePercent(tally)
  return percent !== null && percent < LOW_ATTENDANCE_PERCENT
}
