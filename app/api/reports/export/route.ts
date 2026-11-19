import { z } from 'zod'
import { withApi } from '@/lib/http/handler'
import { rolesFor } from '@/lib/auth/permissions'
import { getDashboardSummaryForPeriod } from '@/modules/dashboard/service'
import { paiseToRupees } from '@/lib/money'
import { money } from '@/lib/formatters'
import { toCsv } from '@/lib/csv'

const date = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/)
  .refine((value) => {
    const parsed = new Date(`${value}T00:00:00.000Z`)
    return Number.isFinite(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value
  }, 'Enter a valid calendar date.')
const querySchema = z
  .object({ startDate: date, endDate: date })
  .refine(({ startDate, endDate }) => startDate <= endDate, {
    message: 'Start date must be on or before end date.',
    path: ['startDate'],
  })

export const GET = withApi({ roles: rolesFor('reports', 'export'), query: querySchema }, async ({ query }) => {
  const summary = await getDashboardSummaryForPeriod(query.startDate, query.endDate)
  const rows: (string | number)[][] = [
    ['Report', 'Value'],
    ['Start date', query.startDate],
    ['End date', query.endDate],
    ['Students enrolled in range', summary.studentCount],
    ['Payments received in range', money(paiseToRupees(summary.revenuePaise))],
    ['Outstanding fees for students enrolled in range', money(paiseToRupees(summary.outstandingPaise))],
    ['Eligible students enrolled in range', summary.eligibleCount],
    ...summary.courseMix.map((item) => [`Course: ${item.course}`, item.studentCount]),
  ]
  // F-44: a small summary built in one pass (docs called it "streamed"); every cell is neutralised.
  const csv = `${toCsv(rows)}\r\n`
  return new Response(csv, {
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="thoorigai-report-${query.startDate}-to-${query.endDate}.csv"`,
      'Cache-Control': 'private, no-store',
    },
  })
})
