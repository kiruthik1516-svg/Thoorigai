import type { Student } from '@/lib/types'
import { assessmentSummary, type AssessmentRecord } from './model'
import { ArrowUpRight, Award, BookOpen } from 'lucide-react'
import Link from 'next/link'
import { buttonVariants } from '@/components/ui/button'

export function AcademicsPanel({ student, assessments }: { student: Student; assessments: AssessmentRecord[] }) {
  const { totalEvaluations, avgScore, passedEvaluations } = assessmentSummary(assessments)

  return (
    <section aria-label="Academic Assessments & Materials" className="space-y-4">
      <div className="panel p-6 bg-white border border-slate-200/80 shadow-xs rounded-2xl">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-100">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-lg bg-indigo-50 text-indigo-600 border border-indigo-100">
              <Award size={18} />
            </div>
            <div>
              <h3 className="text-sm font-bold text-slate-900">Academic Assessments</h3>
              <p className="text-xs text-slate-500">Evaluations, test scores, & grades</p>
            </div>
          </div>
          <div className="flex items-center gap-2.5 flex-wrap">
            <span className="text-xs font-semibold px-2.5 py-0.5 rounded-full bg-indigo-50 text-indigo-700 border border-indigo-200">
              {totalEvaluations > 0 ? `${avgScore}% Average` : 'No tests yet'}
            </span>
            <Link
              href={`/assessments?search=${encodeURIComponent(student.name)}`}
              className={buttonVariants({ variant: 'outline', size: 'sm', className: 'text-xs font-semibold' })}
            >
              <Award size={14} className="mr-1.5 text-indigo-600" />
              <span>Enter Assessment Score</span>
            </Link>
          </div>
        </div>

        <div className="mt-5 grid grid-cols-1 sm:grid-cols-3 gap-3 text-center">
          <div className="p-3 rounded-lg bg-slate-50 border border-slate-100">
            <span className="text-[11px] font-semibold text-slate-600 uppercase tracking-wider block">Average</span>
            <strong className="text-2xl font-bold text-indigo-600 mt-0.5 block">
              {totalEvaluations > 0 ? `${avgScore}%` : '—'}
            </strong>
            <span className="text-[10px] text-slate-600 font-medium">Cohort score</span>
          </div>

          <div className="p-3 rounded-lg bg-indigo-50/50 border border-indigo-100">
            <span className="text-[11px] font-semibold text-indigo-700 uppercase tracking-wider block">Completed</span>
            <strong className="text-2xl font-bold text-indigo-700 mt-0.5 block">{totalEvaluations}</strong>
            <span className="text-[10px] text-indigo-600 font-medium">Tests graded</span>
          </div>

          <div className="p-3 rounded-lg bg-emerald-50/50 border border-emerald-100">
            <span className="text-[11px] font-semibold text-emerald-700 uppercase tracking-wider block">Pass Rate</span>
            <strong className="text-2xl font-bold text-emerald-700 mt-0.5 block">
              {totalEvaluations > 0 ? `${Math.round((passedEvaluations / totalEvaluations) * 100)}%` : '—'}
            </strong>
            <span className="text-[10px] text-emerald-600 font-medium">{passedEvaluations} passed</span>
          </div>
        </div>

        {/* Recent Assessment Results */}
        <div className="mt-6">
          <h4 className="text-xs font-semibold text-slate-700 mb-2">Evaluated Assessments</h4>
          {assessments.length > 0 ? (
            <div className="space-y-2">
              {assessments.slice(0, 4).map((ass) => {
                const pct = Math.round((ass.score / (ass.maxScore || 100)) * 100)
                return (
                  <div
                    key={ass.id}
                    className="p-2.5 rounded-lg border border-slate-100 bg-slate-50/50 text-xs flex items-center justify-between"
                  >
                    <div>
                      <strong className="text-slate-900 block font-semibold">{ass.title}</strong>
                      <span className="text-[11px] text-slate-600 font-mono">{ass.date || 'Recent'}</span>
                      {ass.remarks && (
                        <p className="text-[11px] text-slate-700 italic mt-0.5">&ldquo;{ass.remarks}&rdquo;</p>
                      )}
                    </div>
                    <div className="text-right">
                      <span className="font-bold text-slate-900 text-sm block">
                        {ass.score} / {ass.maxScore}
                      </span>
                      <span
                        className={`text-[10px] font-semibold px-1.5 py-0.5 rounded ${
                          pct >= 70
                            ? 'bg-emerald-100 text-emerald-800'
                            : pct >= 50
                              ? 'bg-amber-100 text-amber-800'
                              : 'bg-rose-100 text-rose-800'
                        }`}
                      >
                        {pct}% · {pct >= 50 ? 'Pass' : 'Retake'}
                      </span>
                    </div>
                  </div>
                )
              })}
            </div>
          ) : (
            <p className="text-xs text-slate-600 italic py-2">No assessment evaluations posted yet for this student.</p>
          )}
        </div>
      </div>

      {/* Course Curriculum & Learning Materials Banner */}
      <div className="p-4 rounded-2xl border border-indigo-100 bg-indigo-50/40 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-xl bg-indigo-100 text-indigo-700 shrink-0">
            <BookOpen size={18} />
          </div>
          <div>
            <h4 className="text-sm font-semibold text-slate-900">Curriculum Learning Materials</h4>
            <p className="text-xs text-slate-600">
              Access slide decks, code snippets, and handouts for {student.course}.
            </p>
          </div>
        </div>
        <Link
          href="/materials"
          className={buttonVariants({ variant: 'outline', size: 'sm', className: 'text-xs bg-white shrink-0' })}
        >
          Browse Materials
          <ArrowUpRight size={13} className="ml-1" />
        </Link>
      </div>
    </section>
  )
}
