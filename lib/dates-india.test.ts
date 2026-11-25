import { describe, expect, it } from 'vitest'
import { addDaysIso, indiaToday, isIsoDate, isoDateInIndia } from './dates'

describe('India dates', () => {
  it('uses the India calendar date, not UTC', () => {
    // 20:00 UTC on 24 Nov is 01:30 on 25 Nov in India.
    expect(isoDateInIndia(new Date('2026-11-24T20:00:00Z'))).toBe('2026-11-25')
    expect(indiaToday(new Date('2026-12-31T19:00:00Z'))).toBe('2027-01-01')
  })

  it('adds days without a time-zone shift', () => {
    expect(addDaysIso('2026-12-31', 1)).toBe('2027-01-01')
    expect(addDaysIso('2026-03-01', -1)).toBe('2026-02-28')
  })

  it('accepts only real calendar dates', () => {
    expect(isIsoDate('2026-02-28')).toBe(true)
    expect(isIsoDate('2026-02-31')).toBe(false)
    expect(isIsoDate('31/03/2026')).toBe(false)
  })
})
