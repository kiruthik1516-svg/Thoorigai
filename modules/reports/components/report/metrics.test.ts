import { describe, expect, it } from 'vitest'
import type { Course, CourseCategory, Payment, Student } from '@/lib/types'
import { computeReportMetrics, parseDate } from './metrics'

const student = (registerId: number, overrides: Partial<Student> = {}): Student => ({
  registerId,
  name: `Student ${registerId}`,
  course: 'Full Stack',
  batch: '2026-01-01',
  total: 1000,
  paid: 0,
  phone: '9',
  status: 'Pending',
  ...overrides,
})

const payment = (studentId: number, amount: number, date: string, overrides: Partial<Payment> = {}): Payment =>
  ({
    id: `${studentId}-${date}`,
    student: '',
    method: 'UPI',
    date,
    amount,
    invoice: 'INV',
    studentId,
    cgst: 0,
    sgst: 0,
    ...overrides,
  }) as Payment

describe('parseDate', () => {
  it('reads the date formats the payment rows use', () => {
    expect(parseDate('2026-09-18').toISOString().slice(0, 10)).toBe('2026-09-18')
    expect(parseDate('15 Sep 2026')).toEqual(new Date(2026, 8, 15))
    expect(parseDate('14-Sep-2026')).toEqual(new Date(2026, 8, 14))
    expect(parseDate(undefined).getTime()).toBe(0)
    expect(parseDate('nonsense').getTime()).toBe(0)
  })
})

describe('computeReportMetrics', () => {
  const categories = [{ id: 'cat-1', name: 'Elite', duration: '12 weeks' }] as CourseCategory[]
  const courses = [{ id: 'c1', name: 'Full Stack', categoryId: 'cat-1', categoryName: 'Elite' }] as Course[]
  const students = [
    student(1, { gender: 'Female', studentSource: 'Website', status: 'Fully Paid', paid: 1000 }),
    student(2, { gender: 'Male', paid: 400 }),
    student(3, { course: 'Design', total: 2000, paid: 0 }),
  ]
  const payments = [
    payment(1, 600, '2025-12-20'),
    payment(1, 400, '15 Jan 2026', { method: 'Cash', cgst: 36, sgst: 36 }),
    payment(2, 400, '2026-02-01'),
    payment(2, 300, '2026-04-01'),
  ]
  const metrics = computeReportMetrics({
    students,
    payments,
    categories,
    courses,
    startDate: '2026-01-01',
    endDate: '2026-03-31',
  })

  it('counts revenue and GST only inside the period', () => {
    expect(metrics.periodPayments).toHaveLength(2)
    expect(metrics.revenue).toBe(800)
    expect(metrics.gstCollected).toBe(72)
  })

  it('measures balances as of the end date, falling back to the stored paid amount', () => {
    // Student 1: 1000 paid by the end date; student 2: 400 (the April payment is later); student 3: none.
    expect(metrics.totalFees).toBe(4000)
    expect(metrics.totalPaid).toBe(1400)
    expect(metrics.outstanding).toBe(2600)
    expect(metrics.collectionRate).toBe(35)
    expect(metrics.averageFee).toBe(1333)
  })

  it('groups categories, methods, channels and gender', () => {
    expect(metrics.categoryStats).toEqual([
      expect.objectContaining({
        studentCount: 2,
        totalFees: 2000,
        collected: 1400,
        outstanding: 600,
        collectionRate: 70,
      }),
    ])
    // Equal totals keep first-seen order (the January cash payment).
    expect(metrics.paymentChartData.map((d) => [d.method, d.amount, d.count])).toEqual([
      ['Cash', 400, 1],
      ['UPI', 400, 1],
    ])
    expect(metrics.acquisitionChannels[0]).toEqual({ channel: 'Direct Walk-in', students: 2, sharePct: 67 })
    expect(metrics.gender).toMatchObject({ femalePct: 33, malePct: 33, otherPct: 33 })
    expect(metrics.courseCounts).toEqual({ 'Full Stack': 2, Design: 1 })
    expect([metrics.fullyPaid, metrics.pending]).toEqual([1, 2])
  })

  it('orders the cash-flow timeline by date', () => {
    expect(metrics.velocity.map((v) => v.fullDate)).toEqual(['15 Jan 2026', '2026-02-01'])
  })
})
