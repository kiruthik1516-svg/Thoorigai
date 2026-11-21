'use client'

import { useMemo, useState } from 'react'
import dynamic from 'next/dynamic'
import {
  ArrowDownRight,
  Calendar,
  CircleDollarSign,
  Clock,
  FileText,
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
import { computeReportMetrics } from './report/metrics'
import { CategoryPerformanceTiers } from './report/CategoryPerformanceTiers'
import { GenderDemographicsChart } from './report/GenderDemographicsChart'

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

function downloadStudentsCsv(students: Student[]) {
  const rows = [
    ['Student', 'Register ID', 'Course', 'Total Fees', 'Paid', 'Balance', 'Status', 'Source'],
    ...students.map((student) => [
      student.name,
      'TAI-' + student.registerId,
      student.course,
      String(student.total),
      String(student.paid),
      String(student.total - student.paid),
      student.status,
      student.studentSource || '-',
    ]),
  ]
  const csv = toCsv(rows)
  const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }))
  const link = document.createElement('a')
  link.href = url
  link.download = 'thoorigai-report-' + new Date().toISOString().slice(0, 10) + '.csv'
  link.click()
  URL.revokeObjectURL(url)
}

export function ReportsView({
  students = [],
  payments = [],
  categories = [],
  courses = [],
}: {
  students: Student[]
  payments: Payment[]
  categories?: CourseCategory[]
  courses?: Course[]
}) {
  const [startDateStr, setStartDateStr] = useState(() => `${new Date().getFullYear()}-01-01`)
  const [endDateStr, setEndDateStr] = useState(() => new Date().toISOString().slice(0, 10))
  const metrics = useMemo(
    () =>
      computeReportMetrics({ students, payments, categories, courses, startDate: startDateStr, endDate: endDateStr }),
    [students, payments, categories, courses, startDateStr, endDateStr],
  )
  const download = () => downloadStudentsCsv(students)

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
        <div className="flex items-center gap-3 flex-wrap min-w-0">
          {/* Each label stays with its date, and the two pairs wrap on narrow screens. */}
          <div className="flex flex-wrap items-center gap-x-3 gap-y-2 p-1.5 rounded-2xl sm:rounded-full bg-[var(--card)] border border-[var(--border)] shadow-2xs min-w-0">
            <div className="flex items-center gap-1.5 text-xs text-[var(--mute)]">
              <label htmlFor="rep-start-date" className="text-xs font-bold text-[var(--mute)] pl-2 w-9">
                From
              </label>
              <Calendar size={14} className="text-[var(--mute)]" />
              <input
                id="rep-start-date"
                aria-label="Start date"
                type="date"
                value={startDateStr}
                onChange={(e) => setStartDateStr(e.target.value)}
                className="text-xs border border-[var(--border)] rounded-full px-2.5 py-1 bg-[var(--panel)] text-[var(--text)] focus:outline-none focus:ring-1 focus:ring-[var(--g1)]"
              />
            </div>
            <div className="flex items-center gap-1.5 text-xs text-[var(--mute)] pr-1">
              <label htmlFor="rep-end-date" className="text-xs font-bold text-[var(--mute)] pl-2 sm:pl-0 w-9 sm:w-auto">
                To
              </label>
              <Calendar size={14} className="text-[var(--mute)]" />
              <input
                id="rep-end-date"
                aria-label="End date"
                type="date"
                value={endDateStr}
                onChange={(e) => setEndDateStr(e.target.value)}
                className="text-xs border border-[var(--border)] rounded-full px-2.5 py-1 bg-[var(--panel)] text-[var(--text)] focus:outline-none focus:ring-1 focus:ring-[var(--g1)]"
              />
            </div>
          </div>
          <button
            onClick={download}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-full text-xs font-bold text-white shadow-xs transition-opacity hover:opacity-90 shrink-0 cursor-pointer"
            style={{ background: 'linear-gradient(135deg, var(--g1), var(--g1b))' }}
          >
            <FileText size={15} />
            <span>Download CSV</span>
          </button>
        </div>
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
        <KpiCard title="Total students" value={students.length} subtitle="Active enrollments" icon={Users} />

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

          <CourseEnrollmentChart courseCounts={metrics.courseCounts} totalStudents={students.length} />
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
            totalStudents={students.length}
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
