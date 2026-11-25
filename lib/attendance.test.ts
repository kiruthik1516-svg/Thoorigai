import { describe, expect, it } from 'vitest'
import { attendancePercent, isLowAttendance, tallyAttendance } from './attendance'

describe('attendance rule', () => {
  it('counts Late as attended and leaves Exempt/Excused out', () => {
    const tally = tallyAttendance(['Present', 'Late', 'Absent', 'Exempt', 'Excused'])
    expect(tally).toEqual({ counted: 3, attended: 2 })
    expect(attendancePercent(tally)).toBe(67)
  })

  it('has no percentage until a session counts', () => {
    expect(attendancePercent(tallyAttendance(['Exempt']))).toBeNull()
    expect(isLowAttendance(tallyAttendance(['Exempt']))).toBe(false)
  })

  it('flags attendance below 75%', () => {
    expect(isLowAttendance({ counted: 4, attended: 3 })).toBe(false)
    expect(isLowAttendance({ counted: 4, attended: 2 })).toBe(true)
  })
})
