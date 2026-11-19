import { describe, expect, it } from 'vitest'
import {
  assessmentKpis,
  bulkScoreEntries,
  filterRoster,
  formatDate,
  getInitials,
  gradeDistribution,
  resultsCsv,
  scoresByStudent,
  type Assessment,
  type AssessmentResult,
} from './model'

const result = (studentId: number, score: number, overrides: Partial<AssessmentResult> = {}): AssessmentResult => ({
  id: `r${studentId}`,
  studentId,
  studentName: `Student ${studentId}`,
  score,
  remarks: null,
  gradedBy: null,
  gradedAt: '2026-11-19',
  ...overrides,
})

const roster = [
  { id: 'a', register_id: 1001, name: 'Kavya Srinivasan' },
  { id: 'b', register_id: 1002, name: 'Arjun Prakash' },
  { id: 'c', register_id: 1003, name: 'Meena Lakshmi' },
]

describe('formatting helpers', () => {
  it('formats plain dates without a timezone shift and builds initials', () => {
    expect(formatDate('2026-09-01')).toBe('Sep 1, 2026')
    expect(formatDate('not a date')).toBe('not a date')
    expect(getInitials('Kavya  Srinivasan')).toBe('KS')
    expect(getInitials('Arjun')).toBe('AR')
    expect(getInitials('')).toBe('ST')
  })
})

describe('assessmentKpis', () => {
  it('counts assessments, linked forms and distinct courses', () => {
    const assessments = [
      { id: '1', courseId: 'c1', formUrl: 'https://forms.example' },
      { id: '2', courseId: 'c1', formUrl: null },
      { id: '3', courseId: 'c2' },
    ] as Assessment[]
    expect(assessmentKpis(assessments)).toEqual({ total: 3, withGoogleForms: 1, uniqueCourses: 2 })
  })
})

describe('filterRoster', () => {
  const results = [result(1001, 20)]

  it('splits graded and unmarked students by register id', () => {
    expect(filterRoster(roster, results, 'graded', '').map((s) => s.register_id)).toEqual([1001])
    expect(filterRoster(roster, results, 'unmarked', '').map((s) => s.register_id)).toEqual([1002, 1003])
  })

  it('searches by name or register id', () => {
    expect(filterRoster(roster, results, 'all', 'meena').map((s) => s.register_id)).toEqual([1003])
    expect(filterRoster(roster, results, 'all', '1002').map((s) => s.name)).toEqual(['Arjun Prakash'])
  })
})

describe('score inputs', () => {
  it('maps saved results to inputs and skips blank inputs when saving', () => {
    expect(scoresByStudent([result(1001, 18.5)])).toEqual({ '1001': '18.5' })
    expect(bulkScoreEntries({ '1001': '18.5', '1002': ' ', '1003': '0' })).toEqual([
      { studentId: 1001, score: 18.5 },
      { studentId: 1003, score: 0 },
    ])
  })
})

describe('gradeDistribution', () => {
  it('buckets percentages and reports the class average', () => {
    const summary = gradeDistribution([result(1, 10), result(2, 15), result(3, 21), result(4, 30)], 30)
    expect(summary.bands.map((band) => band.count)).toEqual([1, 1, 1, 1])
    expect(summary).toMatchObject({ gradedCount: 4, averageScore: '19.0', averagePercent: '63.3', maxCount: 1 })
  })

  it('handles an empty result set', () => {
    expect(gradeDistribution([], 30)).toMatchObject({ gradedCount: 0, averageScore: '0', averagePercent: '0.0' })
  })
})

describe('resultsCsv', () => {
  it('neutralizes formula-like names and remarks (F-44)', () => {
    const csv = resultsCsv([result(1001, 15, { studentName: '=HYPERLINK("x")', remarks: '+1' })], 30)
    const [header, row] = csv.split('\n')
    expect(header).toBe('Student ID,Student Name,Score,Max Score,Percentage,Remarks,Graded At')
    expect(row).toContain(`"'=HYPERLINK(""x"")"`)
    expect(row).toContain('50.0%')
  })
})
