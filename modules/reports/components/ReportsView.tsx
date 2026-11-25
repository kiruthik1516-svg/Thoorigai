'use client'

import { useMemo } from 'react'
import dynamic from 'next/dynamic'
import {
  ArrowDownRight,
  CircleDollarSign,
  Clock,
  GraduationCap,
  ShieldCheck,
  TrendingUp,
  Users,
  Wallet,
} from 'lucide-react'
import type { Payment, Student, Course, CourseCategory } from '@/lib/types'
import { money } from '@/lib/formatters'
import { toCsv } from '@/lib/csv'
import { PaymentsTable } from '@/components/shared/PaymentsTable'
import { KpiCard } from '@/components/ui/KpiCard'
import { computeReportMetrics, type ReportMetrics } from './report/metrics'
import { isoDateInIndia } from '@/lib/dates'
import { CategoryPerformanceTiers } from './report/CategoryPerformanceTiers'
import { GenderDemographicsChart } from './report/GenderDemographicsChart'
import { ReportDateRangeBar } from './report/ReportDateRangeBar'
import { useReportDateRange, type ReportDateRange } from './report/dateRange'

// recharts is large, so the charts load after the KPIs and filters are interactive (mobile audit).
const chartPlaceholder = () => <div className="h-[260px] rounded-xl bg-[var(--panel)] animate-pulse" aria-hidden />
const PaymentMethodTotalsChart = dynamic(
  () => import('./report/PaymentMethodTotalsChart').then((m) => m.PaymentMethodTotalsChart),
  { ssr: false, loading: chartPlaceholder },
)
const CourseEnrollmentChart = dynamic(
  () => import('./report/CourseEnrollmentChart').then((m) => m.CourseEnrollmentChart),
  { ssr: false, loading: chartPlaceholder },
)
const AcquisitionChannelsChart = dynamic(
  () => import('./report/AcquisitionChannelsChart').then((m) => m.AcquisitionChannelsChart),
  { ssr: false, loading: chartPlaceholder },
)
const PaymentVelocityChart = dynamic(
  () => import('./report/PaymentVelocityChart').then((m) => m.PaymentVelocityChart),
  { ssr: false, loading: chartPlaceholder },
)
const PaymentClearanceChart = dynamic(
  () => import('./report/PaymentClearanceChart').then((m) => m.PaymentClearanceChart),
  { ssr: false, loading: chartPlaceholder },
)

/** The CSV matches the screen: the selected period's payments and each student's balance at its end. */
function downloadReportCsv(metrics: ReportMetrics, range: ReportDateRange) {
  const rows: string[][] = [
    ['Report period', `${range.start} to ${range.end}`],
    ['Revenue collected in period', String(metrics.revenue)],
    ['GST in period', String(metrics.gstCollected)],
    ['Students enrolled by end date', String(metrics.studentCount)],
    ['Total course fees', String(metrics.totalFees)],
    ['Paid by end date', String(metrics.totalPaid)],
    ['Outstanding at end date', String(metrics.outstanding)],
    [],
    ['Student', 'Register ID', 'Course', 'Enrolled', 'Total Fees', 'Paid by end date', 'Balance', 'Status', 'Source'],
    ...metrics.cohort.map(({ student, paid, balance, fullyPaid }) => [
      student.name,
      'TAI-' + student.registerId,
      student.course,
      student.createdAt ? isoDateInIndia(new Date(student.createdAt)) : '-',
      String(student.total),
      String(paid),
      String(balance),
      fullyPaid ? 'Fully Paid' : 'Pending',
      student.studentSource || '-',
    ]),
    [],
    ['Invoice', 'Date', 'Student', 'Register ID', 'Method', 'Amount', 'CGST', 'SGST'],
    ...metrics.periodPayments.map((p) => [
      p.invoice,
      p.paymentDate ?? p.date,
      p.student,
      'TAI-' + p.studentId,
      p.method,
      String(p.amount),
      String(p.cgst ?? 0),
      String(p.sgst ?? 0),
    ]),
  ]
  const csv = toCsv(rows)
  const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }))
  const link = document.createElement('a')
  link.href = url
  link.download = `thoorigai-report-${range.start}-to-${range.end}.csv`
  link.click()
  URL.revokeObjectURL(url)
}

export function ReportsView({
  students = [],
  payments = [],
  categories = [],
  courses = [],
  dateRange,
  onDateRangeChange,
}: {
  students: Student[]
  payments: Payment[]
  categories?: CourseCategory[]
  courses?: Course[]
  /** Controlled range shared with the other report sections; defaults to the current month. */
  dateRange?: ReportDateRange
  onDateRangeChange?: (range: ReportDateRange) => void
}) {
  const own = useReportDateRange()
  const range = dateRange ?? own.range
  const setRange = onDateRangeChange ?? own.setRange
  const startDateStr = range.start
  const endDateStr = range.end
  const metrics = useMemo(
    () =>
      computeReportMetrics({ students, payments, categories, courses, startDate: startDateStr, endDate: endDateStr }),
    [students, payments, categories, courses, startDateStr, endDateStr],
  )
  const download = () => downloadReportCsv(metrics, range)

  return (
    <>
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 pb-4 border-b border-[var(--border)] mb-6">
        <div>
          <p className="text-xs font-bold uppercase tracking-wider text-[var(--mute)]">OPERATIONS REPORTING</p>
          <h1 className="text-3xl font-extrabold tracking-tight text-[var(--text)]">Reports</h1>
          <p className="text-xs text-[var(--mute)] mt-1">
            Executive analytics — financial velocity, cohort enrollment, marketing channels, and collection insights.
          </p>
        </div>
        <ReportDateRangeBar idPrefix="rep" range={range} onChange={setRange} onDownload={download} />
      </div>

      {/* ═══════════════════════════════════════════════════════
          4x2 BALANCED KPI METRICS GRID (8 Comprehensive Metrics)
          ═══════════════════════════════════════════════════════ */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4 mb-6">
        {/* Row 1: Financial Performance */}
        <KpiCard
          title="Revenue collected"
          value={money(metrics.revenue)}
          subtitle={`In selected period · GST ${money(metrics.gstCollected)}`}
          icon={CircleDollarSign}
        />

        <KpiCard
          title="Total course fees"
          value={money(metrics.totalFees)}
          subtitle="Enrolled cohort value"
          icon={Wallet}
        />

        <KpiCard
          title="Outstanding balance"
          value={money(metrics.outstanding)}
          subtitle="Pending collection"
          icon={ArrowDownRight}
        />

        <KpiCard
          title="Collection efficiency"
          value={`${metrics.collectionRate}%`}
          subtitle={`${money(metrics.totalPaid)} of ${money(metrics.totalFees)}`}
          icon={TrendingUp}
        />

        {/* Row 2: Operational Health & Demographics */}
        <KpiCard title="Total students" value={metrics.studentCount} subtitle="Enrolled by the end date" icon={Users} />

        <KpiCard
          title="Certificate eligible"
          value={metrics.fullyPaid}
          subtitle="100% fees cleared"
          icon={ShieldCheck}
        />

        <KpiCard title="Pending dues" value={metrics.pending} subtitle="Students with balance" icon={Clock} />

        <KpiCard
          title="Average course fee"
          value={money(metrics.averageFee)}
          subtitle="Per enrolled student"
          icon={GraduationCap}
        />
      </div>

      {/* Curriculum Category Performance Tiers */}
      <CategoryPerformanceTiers categoryStats={metrics.categoryStats} />

      {/* ═══════════════════════════════════════════════════════
          DISTINCT GRAPH VISUALIZATIONS (6 Diverse Graph Types)
          ═══════════════════════════════════════════════════════ */}
      <div className="report-grid">
        {/* ── GRAPH 1: Payment Method Breakdown (SVG Donut Chart) ── */}
        <section className="panel report-main">
          <div className="panel-header chart-panel-header">
            <div>
              <h2>Payment method totals</h2>
              <p>Revenue distribution by payment channel (selected period)</p>
            </div>
          </div>

          <PaymentMethodTotalsChart
            paymentChartData={metrics.paymentChartData}
            paymentChartConfig={metrics.paymentChartConfig}
            revenue={metrics.revenue}
          />
        </section>

        {/* ── GRAPH 2: Enrollment by Course (Interactive Density Bar Chart) ── */}
        <section className="panel report-side">
          <div className="panel-header chart-panel-header">
            <div>
              <h2>Enrollment by course</h2>
              <p>Student density across active training programs</p>
            </div>
          </div>

          <CourseEnrollmentChart courseCounts={metrics.courseCounts} totalStudents={metrics.studentCount} />
        </section>

        {/* ── GRAPH 3: Acquisition Channels (Radar Chart) ── */}
        <section className="panel report-main">
          <div className="panel-header chart-panel-header">
            <div>
              <h2>Acquisition channels</h2>
              <p>How registered students discovered the institute</p>
            </div>
          </div>

          <AcquisitionChannelsChart data={metrics.acquisitionChannels} />
        </section>

        {/* ── GRAPH 4: Payment Cash Flow Velocity (Recharts Area Chart) ── */}
        <section className="panel report-side">
          <div className="panel-header chart-panel-header">
            <div>
              <h2>Payment cash flow velocity</h2>
              <p>Transaction inflow pattern across selected period</p>
            </div>
          </div>

          <PaymentVelocityChart
            data={metrics.velocity}
            revenue={metrics.revenue}
            transactionCount={metrics.periodPayments.length}
          />
        </section>

        {/* ── GRAPH 5: Payment Clearance Status (Gauge + Cards) ── */}
        <section className="panel report-main">
          <div className="panel-header chart-panel-header">
            <div>
              <h2>Payment clearance status</h2>
              <p>Clearance ratio & active balances</p>
            </div>
          </div>

          <PaymentClearanceChart
            collectionRate={metrics.collectionRate}
            fullyPaid={metrics.fullyPaid}
            pending={metrics.pending}
            totalStudents={metrics.studentCount}
            totalPaid={metrics.totalPaid}
            outstanding={metrics.outstanding}
          />
        </section>

        {/* ── GRAPH 6: Gender Demographics ── */}
        <section className="panel report-side">
          <div className="panel-header chart-panel-header">
            <div>
              <h2>Gender demographics</h2>
              <p>Cohort gender distribution & representation</p>
            </div>
          </div>

          <GenderDemographicsChart
            femaleStudents={metrics.gender.femaleStudents}
            maleStudents={metrics.gender.maleStudents}
            otherStudents={metrics.gender.otherStudents}
            femalePct={metrics.gender.femalePct}
            malePct={metrics.gender.malePct}
            otherPct={metrics.gender.otherPct}
            unspecifiedCount={metrics.gender.unspecifiedStudents.length}
          />
        </section>
      </div>

      {/* Recent Transactions Panel */}
      <section className="panel table-panel" style={{ marginTop: 20 }}>
        <div className="panel-header">
          <div>
            <h2>Recent transactions</h2>
            <p>{metrics.periodPayments.length} payment records in selected period</p>
          </div>
        </div>
        <PaymentsTable
          payments={metrics.periodPayments.slice(0, 10)}
          onInvoice={(p) => {
            window.location.assign(`/invoices/${encodeURIComponent(p.invoice)}`)
          }}
        />
      </section>
    </>
  )
}
