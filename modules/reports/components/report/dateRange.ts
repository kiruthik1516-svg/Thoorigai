import { useState } from 'react'

/** Inclusive report window as local calendar dates (YYYY-MM-DD). */
export type ReportDateRange = { start: string; end: string }

export type ReportRangePreset = '7d' | '30d' | 'month' | 'ytd'

export const REPORT_RANGE_PRESETS: ReadonlyArray<{ id: ReportRangePreset; label: string; title: string }> = [
  { id: '7d', label: '7d', title: 'Last 7 days' },
  { id: '30d', label: '30d', title: 'Last 30 days' },
  { id: 'month', label: 'This month', title: 'Current month to date' },
  { id: 'ytd', label: 'YTD', title: 'Year to date' },
]

/** Local calendar date; toISOString() would shift to the previous day before 05:30 IST. */
export function localIsoDate(date: Date): string {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

export function presetRange(preset: ReportRangePreset, now: Date = new Date()): ReportDateRange {
  const end = localIsoDate(now)
  switch (preset) {
    case '7d':
    case '30d': {
      const start = new Date(now)
      start.setDate(start.getDate() - (preset === '7d' ? 7 : 30))
      return { start: localIsoDate(start), end }
    }
    case 'month':
      return { start: localIsoDate(new Date(now.getFullYear(), now.getMonth(), 1)), end }
    case 'ytd':
      return { start: `${now.getFullYear()}-01-01`, end }
  }
}

/** The preset that produces exactly this range today, if any. */
export function matchingPreset(range: ReportDateRange, now: Date = new Date()): ReportRangePreset | null {
  for (const { id } of REPORT_RANGE_PRESETS) {
    const candidate = presetRange(id, now)
    if (candidate.start === range.start && candidate.end === range.end) return id
  }
  return null
}

/** Report date range state; defaults to the current month. */
export function useReportDateRange(initial: ReportRangePreset = 'month') {
  const [range, setRange] = useState<ReportDateRange>(() => presetRange(initial))
  return { range, setRange }
}
