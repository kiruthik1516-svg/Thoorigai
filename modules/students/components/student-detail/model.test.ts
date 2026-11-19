import { describe, expect, it } from 'vitest'
import {
  assessmentSummary,
  attendanceSummary,
  attendanceWeek,
  formatDateIso,
  getMonday,
  studentInitials,
  type AttendanceRecord,
} from './model'

const record = (sessionDate: string, status: AttendanceRecord['status']): AttendanceRecord => ({
  id: sessionDate,
  sessionDate,
  status,
})

describe('date helpers', () => {
  it('finds the Monday of a week, treating Sunday as the end of the week', () => {
    expect(formatDateIso(getMonday(new Date(2026, 10, 19)))).toBe('2026-11-16') // Thursday
    expect(formatDateIso(getMonday(new Date(2026, 10, 22)))).toBe('2026-11-16') // Sunday
    expect(formatDateIso(getMonday(new Date(2026, 10, 16)))).toBe('2026-11-16') // Monday
  })

  it('builds initials from the first two words', () => {
    expect(studentInitials('kavya srinivasan raman')).toBe('KS')
    expect(studentInitials('Arjun')).toBe('A')
  })
})

describe('attendanceSummary', () => {
  it('excludes exempt and excused sessions from the rate', () => {
    const summary = attendanceSummary([
      record('2026-11-16', 'Present'),
      record('2026-11-17', 'Absent'),
      record('2026-11-18', 'Exempt'),
      record('2026-11-19', 'Excused'),
      record('2026-11-20', 'Late'),
    ])
    expect(summary).toEqual({
      totalSessions: 5,
      presentSessions: 1,
      absentSessions: 1,
      exemptSessions: 2,
      attendanceRate: 33,
    })
  })

  it('reports 100% when every session is exempt and 0% with no sessions', () => {
    expect(attendanceSummary([record('2026-11-16', 'Exempt')]).attendanceRate).toBe(100)
    expect(attendanceSummary([]).attendanceRate).toBe(0)
  })
})

describe('attendanceWeek', () => {
  const now = new Date(2026, 10, 19, 15, 30) // Thursday 19 Nov 2026
  const attendance = [record('2026-11-16', 'Present'), record('2026-11-18', 'Excused'), record('2026-11-10', 'Absent')]

  it('lays out the current week with today, future days and records', () => {
    const week = attendanceWeek(attendance, 0, now)
    expect(week.weekDays.map((d) => d.dateStr)).toEqual([
      '2026-11-16',
      '2026-11-17',
      '2026-11-18',
      '2026-11-19',
      '2026-11-20',
      '2026-11-21',
      '2026-11-22',
    ])
    expect(week.weekDays[3]).toMatchObject({ dayName: 'Thu', isToday: true, isFuture: false })
    expect(week.weekDays[4].isFuture).toBe(true)
    expect(week.weekSummary).toEqual({ total: 2, present: 1, absent: 0, exempt: 1 })
    expect(week.isCurrentWeek).toBe(true)
  })

  it('moves back across a month boundary', () => {
    const week = attendanceWeek(attendance, -3, now)
    expect(week.weekDays[0].dateStr).toBe('2026-10-26')
    expect(week.weekDays[6].dateStr).toBe('2026-11-01')
    expect(week.isCurrentWeek).toBe(false)
    expect(attendanceWeek(attendance, -1, now).weekSummary.absent).toBe(1)
  })
})

describe('assessmentSummary', () => {
  it('averages percentages and counts passes at 50%', () => {
    const summary = assessmentSummary([
      { id: '1', title: 'A', date: '2026-11-01', score: 15, maxScore: 30 },
      { id: '2', title: 'B', date: '2026-11-08', score: 20, maxScore: 25 },
      { id: '3', title: 'C', date: '2026-11-15', score: 4, maxScore: 10 },
    ])
    expect(summary).toEqual({ totalEvaluations: 3, avgScore: 57, passedEvaluations: 2 })
    expect(assessmentSummary([])).toEqual({ totalEvaluations: 0, avgScore: 0, passedEvaluations: 0 })
  })
})
