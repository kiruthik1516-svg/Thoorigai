import type { ChartConfig } from '@/components/ui/chart'
import type { Course, CourseCategory, Payment, Student } from '@/lib/types'
import { paiseToRupees, rupeesToPaise } from '@/lib/money'

const MONTHS: Record<string, number> = {
  jan: 0,
  feb: 1,
  mar: 2,
  apr: 3,
  may: 4,
  jun: 5,
  jul: 6,
  aug: 7,
  sep: 8,
  oct: 9,
  nov: 10,
  dec: 11,
}

const PAYMENT_METHOD_FILLS = ['var(--g1)', 'var(--g2)', 'var(--g3)', 'var(--g1b)', 'var(--g2b)', 'var(--g5)']

/** Parses '15 Sep 2026', '2026-09-18', '14-Sep-2026' and similar; unknown values become the epoch. */
export function parseDate(dateString?: string): Date {
  if (!dateString) return new Date(0)
  const direct = new Date(dateString)
  if (!isNaN(direct.getTime()) && !dateString.includes(' ') && !dateString.includes('-')) {
    return direct
  }
  if (dateString.length === 10 && /^\d{4}-\d{2}-\d{2}$/.test(dateString)) {
    return direct
  }
  const parts = dateString.replace(/[-/]/g, ' ').trim().split(/\s+/)
  if (parts.length === 3) {
    const monthIndex = MONTHS[parts[1].toLowerCase().slice(0, 3)]
    if (monthIndex !== undefined) {
      return new Date(parseInt(parts[2], 10), monthIndex, parseInt(parts[0], 10))
    }
    if (parts[0].length === 4) {
      return new Date(parseInt(parts[0], 10), parseInt(parts[1], 10) - 1, parseInt(parts[2], 10))
    }
  }
  return isNaN(direct.getTime()) ? new Date(0) : direct
}

function countBy<T>(items: T[], key: (item: T) => string, weight: (item: T) => number = () => 1) {
  return items.reduce<Record<string, number>>((acc, item) => {
    const k = key(item)
    acc[k] = (acc[k] ?? 0) + weight(item)
    return acc
  }, {})
}

const percent = (part: number, whole: number) => (whole > 0 ? Math.round((part / whole) * 100) : 0)

export type ReportMetricsInput = {
  students: Student[]
  payments: Payment[]
  categories: CourseCategory[]
  courses: Course[]
  /** YYYY-MM-DD, inclusive. */
  startDate: string
  /** YYYY-MM-DD, inclusive. */
  endDate: string
}

export function computeReportMetrics({
  students,
  payments,
  categories,
  courses,
  startDate,
  endDate,
}: ReportMetricsInput) {
  const start = new Date(`${startDate}T00:00:00`)
  const end = new Date(`${endDate}T23:59:59.999`)
  const paymentDate = (p: Payment) => parseDate(p.paymentDate || p.date)

  // Revenue and method totals use the selected period; balances are as of the end date.
  const periodPayments = payments.filter((p) => {
    const date = paymentDate(p)
    return date >= start && date <= end
  })
  const paidPerStudent = payments
    .filter((p) => paymentDate(p) <= end)
    .reduce<Record<number, number>>((map, p) => {
      map[p.studentId] = (map[p.studentId] || 0) + p.amount
      return map
    }, {})
  const paidAsOfEnd = (s: Student) => paidPerStudent[s.registerId] ?? s.paid ?? 0

  const courseCategory = new Map<string, { id: string; name: string }>()
  courses.forEach((c) => {
    if (c.categoryId && c.categoryName) {
      courseCategory.set(c.name.trim().toLowerCase(), { id: c.categoryId, name: c.categoryName })
    }
  })
  const categoryStats = categories.map((category) => {
    const members = students.filter((s) => courseCategory.get(s.course.trim().toLowerCase())?.id === category.id)
    const totalFees = members.reduce((sum, s) => sum + s.total, 0)
    const collected = members.reduce((sum, s) => sum + paidAsOfEnd(s), 0)
    return {
      ...category,
      studentCount: members.length,
      totalFees,
      collected,
      outstanding: Math.max(0, totalFees - collected),
      collectionRate: percent(collected, totalFees),
      enrollmentShare: percent(members.length, students.length),
    }
  })

  const revenue = periodPayments.reduce((sum, p) => sum + p.amount, 0)
  // F-18: GST is reported separately from fee revenue (summed in paise to avoid float drift).
  const gstCollected = paiseToRupees(
    periodPayments.reduce((sum, p) => sum + rupeesToPaise(p.cgst ?? 0) + rupeesToPaise(p.sgst ?? 0), 0),
  )
  const totalFees = students.reduce((sum, s) => sum + s.total, 0)
  const totalPaid = students.reduce((sum, s) => sum + paidAsOfEnd(s), 0)
  const outstanding = students.reduce((sum, s) => sum + Math.max(0, s.total - paidAsOfEnd(s)), 0)

  const methodTotals = countBy(
    periodPayments,
    (p) => p.method,
    (p) => p.amount,
  )
  const methodCounts = countBy(periodPayments, (p) => p.method)
  const paymentChartData = Object.entries(methodTotals)
    .sort((a, b) => b[1] - a[1])
    .map(([method, amount], index) => ({
      key: method.toLowerCase().replace(/[^a-z0-9]/g, '_'),
      method,
      amount,
      count: methodCounts[method] || 1,
      fill: PAYMENT_METHOD_FILLS[index % PAYMENT_METHOD_FILLS.length],
    }))
  const paymentChartConfig: ChartConfig = { amount: { label: 'Revenue (₹)' } }
  paymentChartData.forEach((item) => {
    paymentChartConfig[item.key] = { label: item.method, color: item.fill }
  })

  const acquisitionChannels = Object.entries(countBy(students, (s) => s.studentSource || 'Direct Walk-in'))
    .sort((a, b) => b[1] - a[1])
    .map(([channel, count]) => ({ channel, students: count, sharePct: percent(count, students.length) }))

  const velocity = Object.entries(
    countBy(
      periodPayments,
      (p) => p.date,
      (p) => p.amount,
    ),
  )
    .sort((a, b) => parseDate(a[0]).getTime() - parseDate(b[0]).getTime())
    .map(([date, amount]) => {
      const parts = date.split(' ')
      return { date: parts.length >= 2 ? `${parts[0]} ${parts[1]}` : date, fullDate: date, amount }
    })

  const femaleStudents = students.filter((s) => s.gender === 'Female')
  const maleStudents = students.filter((s) => s.gender === 'Male')
  const otherStudents = students.filter((s) => s.gender !== 'Female' && s.gender !== 'Male')

  return {
    periodPayments,
    categoryStats,
    revenue,
    gstCollected,
    totalFees,
    totalPaid,
    outstanding,
    collectionRate: percent(totalPaid, totalFees),
    averageFee: students.length > 0 ? Math.round(totalFees / students.length) : 0,
    fullyPaid: students.filter((s) => s.status === 'Fully Paid').length,
    pending: students.filter((s) => s.status === 'Pending').length,
    courseCounts: countBy(students, (s) => s.course),
    paymentChartData,
    paymentChartConfig,
    acquisitionChannels,
    velocity,
    gender: {
      femaleStudents,
      maleStudents,
      otherStudents,
      femalePct: percent(femaleStudents.length, students.length),
      malePct: percent(maleStudents.length, students.length),
      otherPct: percent(otherStudents.length, students.length),
    },
  }
}

export type ReportMetrics = ReturnType<typeof computeReportMetrics>
export type CategoryStat = ReportMetrics['categoryStats'][number]
