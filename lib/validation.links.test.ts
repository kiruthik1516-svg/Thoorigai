import { describe, expect, it } from 'vitest'
import { assessmentSchema, safeFormUrl, safeSheetUrl } from './validation'

const base = { courseId: 'c1', title: 'Quiz', maxScore: 10, assessmentDate: '2026-11-19' }

describe('assessment links (F-35)', () => {
  it('accepts https Google Forms and Sheets links and treats empty as no link', () => {
    const parsed = assessmentSchema.parse({
      ...base,
      formUrl: 'https://docs.google.com/forms/d/e/abc/viewform',
      sheetUrl: '',
    })
    expect(parsed.formUrl).toBe('https://docs.google.com/forms/d/e/abc/viewform')
    expect(parsed.sheetUrl).toBeNull()
    expect(assessmentSchema.safeParse({ ...base, formUrl: 'https://forms.gle/abc' }).success).toBe(true)
  })

  it.each([
    'http://docs.google.com/forms/x',
    'javascript:alert(1)',
    'https://evil.example/forms',
    'https://docs.google.com.evil.example/x',
    'https://user:pass@docs.google.com/forms/x',
  ])('rejects %s', (formUrl) => {
    expect(assessmentSchema.safeParse({ ...base, formUrl }).success).toBe(false)
  })

  it('drops stored links that are no longer allowed', () => {
    expect(safeFormUrl('javascript:alert(1)')).toBeNull()
    expect(safeSheetUrl('https://forms.gle/abc')).toBeNull()
    expect(safeSheetUrl('https://docs.google.com/spreadsheets/d/x')).toBe('https://docs.google.com/spreadsheets/d/x')
  })
})
