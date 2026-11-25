/** Returns the Indian financial year label (start year–end year) for an ISO date. */
export function financialYearFor(date: Date | string): string {
  const value = typeof date === 'string' ? new Date(`${date}T00:00:00.000Z`) : date
  if (Number.isNaN(value.getTime())) throw new RangeError('Invalid date.')
  const year = value.getUTCFullYear()
  const startYear = value.getUTCMonth() < 3 || (value.getUTCMonth() === 2 && value.getUTCDate() <= 31) ? year - 1 : year
  return `${startYear}-${String(startYear + 1).slice(-2)}`
}

const INDIA_DATE = new Intl.DateTimeFormat('en-CA', {
  timeZone: 'Asia/Kolkata',
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
})

/** YYYY-MM-DD of an instant on the academy's (India) calendar, wherever the code runs. */
export function isoDateInIndia(date: Date): string {
  return INDIA_DATE.format(date)
}

/** Today's date (YYYY-MM-DD) in India. Servers run on UTC, so `toISOString()` is a day behind until 05:30 IST. */
export function indiaToday(now: Date = new Date()): string {
  return isoDateInIndia(now)
}

/** Adds whole days to a YYYY-MM-DD date without any time-zone shift. */
export function addDaysIso(isoDate: string, days: number): string {
  const date = new Date(`${isoDate}T00:00:00.000Z`)
  date.setUTCDate(date.getUTCDate() + days)
  return date.toISOString().slice(0, 10)
}

/** True for a real calendar date written as YYYY-MM-DD (rejects 2026-02-31). */
export function isIsoDate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false
  const parsed = new Date(`${value}T00:00:00.000Z`)
  return Number.isFinite(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value
}
