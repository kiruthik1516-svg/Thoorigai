import { describe, expect, it } from 'vitest'
import { localIsoDate, matchingPreset, presetRange } from './dateRange'

// 24 Nov 2026, 10:00 local time
const now = new Date(2026, 10, 24, 10, 0, 0)

describe('report date presets', () => {
  it('defaults the current month to the 1st through today', () => {
    expect(presetRange('month', now)).toEqual({ start: '2026-11-01', end: '2026-11-24' })
  })

  it('builds the rolling and year-to-date windows', () => {
    expect(presetRange('7d', now)).toEqual({ start: '2026-11-17', end: '2026-11-24' })
    expect(presetRange('30d', now)).toEqual({ start: '2026-10-25', end: '2026-11-24' })
    expect(presetRange('ytd', now)).toEqual({ start: '2026-01-01', end: '2026-11-24' })
  })

  it('handles the first day of a month and of a year', () => {
    expect(presetRange('month', new Date(2026, 11, 1, 9))).toEqual({ start: '2026-12-01', end: '2026-12-01' })
    expect(presetRange('7d', new Date(2027, 0, 3, 9))).toEqual({ start: '2026-12-27', end: '2027-01-03' })
  })

  it('uses the local calendar date, not UTC', () => {
    // Just after midnight local time is still the previous day in UTC for zones east of UTC (e.g. IST).
    expect(localIsoDate(new Date(2026, 10, 24, 0, 15))).toBe('2026-11-24')
  })

  it('reports which preset a range matches', () => {
    expect(matchingPreset({ start: '2026-11-01', end: '2026-11-24' }, now)).toBe('month')
    expect(matchingPreset({ start: '2026-10-25', end: '2026-11-24' }, now)).toBe('30d')
    expect(matchingPreset({ start: '2026-11-02', end: '2026-11-24' }, now)).toBeNull()
  })
})
