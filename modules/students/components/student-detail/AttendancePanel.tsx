'use client'

import { useMemo, useState } from 'react'
import type { Student } from '@/lib/types'
import { attendanceSummary, attendanceWeek, type AttendanceRecord } from './model'
import { CalendarCheck, CheckCircle2, ChevronLeft, ChevronRight, Clock, ShieldCheck, XCircle } from 'lucide-react'
import Link from 'next/link'
import { Button, buttonVariants } from '@/components/ui/button'
import { Gauge } from '@/components/ui/Gauge'

export function AttendancePanel({ student, attendance }: { student: Student; attendance: AttendanceRecord[] }) {
  const [weekOffset, setWeekOffset] = useState(0)
  const { totalSessions, presentSessions, absentSessions, exemptSessions, attendanceRate } =
    attendanceSummary(attendance)
  const { weekDays, weekRangeLabel, isCurrentWeek, weekSummary } = useMemo(
    () => attendanceWeek(attendance, weekOffset),
    [attendance, weekOffset],
  )

  return (
    <section aria-label="Classroom Attendance" className="space-y-4">
      <div className="panel p-6 bg-white border border-slate-200/80 shadow-xs rounded-2xl">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-100">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-lg bg-emerald-50 text-emerald-600 border border-emerald-100">
              <CalendarCheck size={18} />
            </div>
            <div>
              <h3 className="text-sm font-bold text-slate-900">Attendance Metrics</h3>
              <p className="text-xs text-slate-500">Live roster records for {student.name}</p>
            </div>
          </div>
          <div className="flex items-center gap-2.5 flex-wrap">
            <span
              className={`text-xs font-semibold px-2.5 py-0.5 rounded-full border ${
                attendanceRate >= 80
                  ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                  : attendanceRate >= 70
                    ? 'bg-amber-50 text-amber-700 border-amber-200'
                    : 'bg-rose-50 text-rose-700 border-rose-200'
              }`}
            >
              {attendanceRate >= 80 ? 'Good Standing' : attendanceRate >= 70 ? 'Average' : 'Attendance Alert'}
            </span>
            <Link
              href={`/attendance?search=${encodeURIComponent(student.name)}`}
              className={buttonVariants({ variant: 'outline', size: 'sm', className: 'text-xs font-semibold' })}
            >
              <CalendarCheck size={14} className="mr-1.5 text-emerald-600" />
              <span>Open Attendance Roster</span>
            </Link>
          </div>
        </div>

        <div className="mt-5 grid grid-cols-1 md:grid-cols-3 gap-6 items-center">
          {/* Semicircle Gauge vs 75% threshold */}
          <div className="flex flex-col items-center justify-center p-4 rounded-[22px] bg-[var(--panel)] border border-[var(--border)]">
            <Gauge
              value={attendanceRate}
              size={150}
              label="Attendance Rate"
              sublabel={attendanceRate >= 75 ? 'Meets 75% minimum threshold' : 'Below 75% required threshold'}
            />
            <span
              className={`mt-2 text-[10px] font-bold px-2.5 py-0.5 rounded-full ${
                attendanceRate >= 75 ? 'bg-[var(--success-bg)] text-[#1b7a4b]' : 'bg-[var(--danger-bg)] text-[#b53c37]'
              }`}
            >
              {attendanceRate >= 75 ? 'Criterion Met (>= 75%)' : 'At-Risk (< 75%)'}
            </span>
          </div>

          {/* Roster Metrics Breakdown */}
          <div className="md:col-span-2 grid grid-cols-2 sm:grid-cols-4 gap-3 text-center">
            <div className="p-3.5 rounded-[18px] bg-[var(--panel)] border border-[var(--border)]">
              <span className="text-[11px] font-semibold text-[var(--mute)] uppercase tracking-wider block">Rate</span>
              <strong
                className={`text-2xl font-extrabold mt-0.5 block ${
                  attendanceRate >= 80 ? 'text-[#1b7a4b]' : attendanceRate >= 70 ? 'text-[#854d0e]' : 'text-[#b53c37]'
                }`}
              >
                {totalSessions > 0 ? `${attendanceRate}%` : 'N/A'}
              </strong>
              <span className="text-[10px] text-[var(--mute)] font-medium">Weighted presence</span>
            </div>

            <div className="p-3.5 rounded-[18px] bg-[var(--success-bg)] border border-emerald-200/60">
              <span className="text-[11px] font-semibold text-[#1b7a4b] uppercase tracking-wider block">Present</span>
              <strong className="text-2xl font-extrabold text-[#1b7a4b] mt-0.5 block">{presentSessions}</strong>
              <span className="text-[10px] text-[#1b7a4b] font-medium">Attended sessions</span>
            </div>

            <div className="p-3.5 rounded-[18px] bg-[var(--danger-bg)] border border-rose-200/60">
              <span className="text-[11px] font-semibold text-[#b53c37] uppercase tracking-wider block">Absent</span>
              <strong className="text-2xl font-extrabold text-[#b53c37] mt-0.5 block">{absentSessions}</strong>
              <span className="text-[10px] text-[#b53c37] font-medium">Missed sessions</span>
            </div>

            <div className="p-3.5 rounded-[18px] bg-sky-50 border border-sky-200/60">
              <span className="text-[11px] font-semibold text-sky-700 uppercase tracking-wider block">Exempt</span>
              <strong className="text-2xl font-extrabold text-sky-700 mt-0.5 block">{exemptSessions}</strong>
              <span className="text-[10px] text-sky-600 font-medium">Approved leave</span>
            </div>
          </div>
        </div>

        {/* Weekly Attendance Schedule & Historic Navigation */}
        <div className="mt-6 pt-5 border-t border-slate-100">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-3">
            <div className="flex items-center gap-2">
              <h4 className="text-xs font-bold text-slate-900 uppercase tracking-wider">Weekly Roster</h4>
              {isCurrentWeek ? (
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200">
                  Current Week
                </span>
              ) : (
                <button
                  type="button"
                  onClick={() => setWeekOffset(0)}
                  className="text-[11px] font-semibold text-indigo-600 hover:text-indigo-800 underline transition-colors cursor-pointer"
                >
                  Jump to Current Week
                </button>
              )}
            </div>

            {/* Historic Week Navigation */}
            <div className="flex items-center gap-1.5">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setWeekOffset((prev) => prev - 1)}
                className="h-7 px-2 text-xs text-slate-700 hover:bg-slate-100"
                aria-label="Previous week"
              >
                <ChevronLeft size={14} className="mr-0.5" />
                <span>Prev</span>
              </Button>

              <span className="text-xs font-semibold text-slate-800 font-mono px-2.5 py-1 bg-slate-100 rounded-lg border border-slate-200">
                {weekRangeLabel}
              </span>

              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setWeekOffset((prev) => prev + 1)}
                disabled={weekOffset >= 4}
                className="h-7 px-2 text-xs text-slate-700 hover:bg-slate-100 disabled:opacity-40"
                aria-label="Next week"
              >
                <span>Next</span>
                <ChevronRight size={14} className="ml-0.5" />
              </Button>
            </div>
          </div>

          {/* 7-Day Week Calendar Grid */}
          <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-2.5">
            {weekDays.map((day) => {
              const att = day.record
              return (
                <div
                  key={day.dateStr}
                  className={`p-3 rounded-xl border text-xs flex flex-col justify-between min-h-[96px] transition-all ${
                    day.isToday
                      ? 'border-indigo-300 ring-2 ring-indigo-500/20 bg-indigo-50/20'
                      : 'border-slate-200/80 bg-slate-50/50'
                  }`}
                >
                  <div className="flex items-start justify-between gap-1 pb-1">
                    <div>
                      <span className="text-[11px] font-bold text-slate-500 uppercase block">{day.dayName}</span>
                      <span className="font-mono text-xs font-bold text-slate-900 block">{day.dateStr.slice(5)}</span>
                    </div>
                    {day.isToday && (
                      <span className="text-[9px] font-extrabold uppercase px-1.5 py-0.5 rounded bg-indigo-600 text-white tracking-wider">
                        Today
                      </span>
                    )}
                  </div>

                  <div className="pt-2">
                    {att ? (
                      <span
                        className={`inline-flex items-center gap-1 w-full justify-center px-2 py-1 rounded-md text-[11px] font-bold border ${
                          att.status === 'Present'
                            ? 'bg-emerald-100/90 text-emerald-800 border-emerald-200'
                            : att.status === 'Absent'
                              ? 'bg-rose-100/90 text-rose-800 border-rose-200'
                              : att.status === 'Exempt' || att.status === 'Excused'
                                ? 'bg-sky-100/90 text-sky-800 border-sky-200'
                                : 'bg-amber-100/90 text-amber-800 border-amber-200'
                        }`}
                      >
                        {att.status === 'Present' && <CheckCircle2 size={12} className="shrink-0" />}
                        {att.status === 'Absent' && <XCircle size={12} className="shrink-0" />}
                        {(att.status === 'Exempt' || att.status === 'Excused') && (
                          <ShieldCheck size={12} className="shrink-0" />
                        )}
                        {att.status === 'Late' && <Clock size={12} className="shrink-0" />}
                        <span>{att.status === 'Excused' ? 'Exempt' : att.status}</span>
                      </span>
                    ) : day.isFuture ? (
                      <span className="text-[11px] text-slate-400 font-medium italic block text-center py-1">
                        Upcoming
                      </span>
                    ) : day.dayName === 'Sun' ? (
                      <span className="text-[11px] text-slate-400 font-medium block text-center py-1">Weekend</span>
                    ) : (
                      <span className="text-[11px] text-slate-400 font-medium block text-center py-1">No Session</span>
                    )}
                  </div>
                </div>
              )
            })}
          </div>

          {/* Week Summary Bar */}
          {weekSummary.total > 0 ? (
            <div className="mt-3 p-2.5 rounded-xl bg-slate-50 border border-slate-100 text-xs flex flex-wrap items-center justify-between gap-2 text-slate-600">
              <div className="flex items-center gap-2.5 flex-wrap">
                <span>
                  Logged this week: <strong className="text-slate-900">{weekSummary.total} sessions</strong>
                </span>
                <span className="text-slate-300">•</span>
                <span className="text-emerald-700 font-semibold">{weekSummary.present} Present</span>
                {weekSummary.absent > 0 && (
                  <>
                    <span className="text-slate-300">•</span>
                    <span className="text-rose-700 font-semibold">{weekSummary.absent} Absent</span>
                  </>
                )}
                {weekSummary.exempt > 0 && (
                  <>
                    <span className="text-slate-300">•</span>
                    <span className="text-sky-700 font-semibold">{weekSummary.exempt} Exempt</span>
                  </>
                )}
              </div>
              <span className="text-[11px] text-slate-500 font-medium">
                {(() => {
                  const countable = weekSummary.total - weekSummary.exempt
                  const rate = countable > 0 ? Math.round((weekSummary.present / countable) * 100) : 100
                  return `${rate}% weekly attendance`
                })()}
              </span>
            </div>
          ) : (
            <p className="mt-3 text-xs text-slate-400 italic py-1">
              No attendance sessions recorded for this week ({weekRangeLabel}).
            </p>
          )}
        </div>
      </div>
    </section>
  )
}
