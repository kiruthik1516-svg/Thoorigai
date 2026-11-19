'use client'

import { useState } from 'react'
import Link from 'next/link'
import {
  AlertCircle,
  CalendarDays,
  Download,
  ExternalLink,
  FileSpreadsheet,
  GraduationCap,
  QrCode,
  RefreshCw,
  Search,
  Trash2,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import type { StudentOption } from '../../utils/google-form-parser'
import { GradeDistribution } from './GradeDistribution'
import {
  filterRoster,
  formatDate,
  getInitials,
  resultsCsv,
  type Assessment,
  type AssessmentResult,
  type ResultsFilter,
} from './model'

export function GradingStudio({
  assessment,
  students,
  results,
  bulkScores,
  saving,
  error,
  onScoreChange,
  onSaveScores,
  onDeleteResult,
  onRefresh,
  onOpenImport,
  onOpenQr,
}: {
  assessment: Assessment
  students: StudentOption[]
  results: AssessmentResult[]
  bulkScores: Record<string, string>
  saving: boolean
  error: string | null
  onScoreChange: (registerId: number, value: string) => void
  onSaveScores: () => Promise<void>
  onDeleteResult: (resultId: string) => void
  onRefresh: () => void
  onOpenImport: () => void
  onOpenQr: () => void
}) {
  const [search, setSearch] = useState('')
  const [filter, setFilter] = useState<ResultsFilter>('all')
  const roster = filterRoster(students, results, filter, search)

  const exportResults = () => {
    if (results.length === 0) return
    const csv = resultsCsv(results, assessment.maxScore || 100)
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.setAttribute('download', `assessment-results-${assessment.id}.csv`)
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
  }

  return (
    <div className="space-y-6">
      {/* Assessment Hero Card */}
      <section className="panel p-6 sm:p-7 shadow-xs border border-slate-200/90 space-y-5">
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4 pb-5 border-b border-slate-100">
          <div className="space-y-2">
            <div className="flex flex-wrap items-center gap-2">
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-indigo-600 text-white shadow-2xs">
                <GraduationCap size={13} />
                {assessment.courseName}
              </span>
              <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-slate-100 text-slate-700 border border-slate-200">
                Max Score: {assessment.maxScore} pts
              </span>
              <span className="inline-flex items-center gap-1.5 text-xs text-slate-500 font-medium ml-1">
                <CalendarDays size={14} className="text-slate-400" />
                {formatDate(assessment.assessmentDate)}
              </span>
            </div>

            <h2 className="text-xl sm:text-2xl font-bold tracking-tight text-slate-900">{assessment.title}</h2>
          </div>

          {/* Action Buttons Toolbar */}
          <div className="flex flex-wrap items-center gap-2">
            {assessment.formUrl && (
              <>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={onOpenQr}
                  className="text-xs font-semibold cursor-pointer hover:bg-indigo-50 hover:text-indigo-700"
                  title="Project QR code for classroom"
                >
                  <QrCode size={14} className="mr-1.5" />
                  Classroom QR
                </Button>

                <a
                  href={assessment.formUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold border border-purple-300 text-purple-800 bg-purple-50 hover:bg-purple-100 shadow-2xs transition-all cursor-pointer"
                  title="Open Google Form Quiz"
                >
                  <FileSpreadsheet size={14} className="text-purple-700" />
                  <span>Launch Form</span>
                  <ExternalLink size={12} />
                </a>
              </>
            )}

            {assessment.sheetUrl && (
              <a
                href={assessment.sheetUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold border border-emerald-300 text-emerald-800 bg-emerald-50 hover:bg-emerald-100 shadow-2xs transition-all cursor-pointer"
                title="Open Google Sheets Response Table"
              >
                <ExternalLink size={14} />
                <span>Response Sheet</span>
              </a>
            )}

            {/* The Google Forms Import Button */}
            <Button
              type="button"
              onClick={onOpenImport}
              className="btn-primary text-xs font-semibold px-4 cursor-pointer shadow-sm"
            >
              <FileSpreadsheet size={15} className="mr-1.5" />
              Import Google Form Responses
            </Button>

            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={onRefresh}
              className="text-xs font-semibold cursor-pointer"
              title="Refresh results"
            >
              <RefreshCw size={14} />
            </Button>
          </div>
        </div>

        {/* Performance Distribution Strip */}
        <GradeDistribution results={results} maxScore={assessment.maxScore ?? 0} enrolledCount={students.length} />
      </section>

      {error && (
        <div
          role="alert"
          className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-xs text-rose-700 flex items-center gap-2"
        >
          <AlertCircle size={15} />
          <span>{error}</span>
        </div>
      )}

      {/* Student Roster & Live Scoring Table */}
      <section className="panel p-6 sm:p-7 shadow-xs border border-slate-200/90 space-y-5">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 pb-3 border-b border-slate-100">
          <div className="flex items-center gap-3">
            <div className="relative w-64">
              <Search
                size={14}
                className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none"
              />
              <Input
                type="text"
                placeholder="Search student or ID..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-8.5 py-1.5 text-xs w-full min-h-9 rounded-xl"
              />
            </div>

            {/* Filter Chips */}
            <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-xl text-xs font-semibold">
              <button
                type="button"
                onClick={() => setFilter('all')}
                className={`px-2.5 py-1 rounded-lg cursor-pointer transition-all ${
                  filter === 'all' ? 'bg-white text-slate-900 shadow-2xs' : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                All ({students.length})
              </button>
              <button
                type="button"
                onClick={() => setFilter('graded')}
                className={`px-2.5 py-1 rounded-lg cursor-pointer transition-all ${
                  filter === 'graded' ? 'bg-white text-emerald-700 shadow-2xs' : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Graded ({results.length})
              </button>
              <button
                type="button"
                onClick={() => setFilter('unmarked')}
                className={`px-2.5 py-1 rounded-lg cursor-pointer transition-all ${
                  filter === 'unmarked' ? 'bg-white text-rose-700 shadow-2xs' : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Unmarked ({Math.max(0, students.length - results.length)})
              </button>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={results.length === 0}
              onClick={exportResults}
              className="text-xs font-semibold cursor-pointer"
            >
              <Download size={13} className="mr-1.5" />
              Export CSV
            </Button>
            <Button
              type="button"
              size="sm"
              onClick={() => void onSaveScores()}
              disabled={saving}
              className="btn-primary text-xs font-semibold cursor-pointer shadow-sm"
            >
              {saving ? 'Saving...' : 'Save All Scores'}
            </Button>
          </div>
        </div>

        {/* Table */}
        <div className="overflow-x-auto rounded-xl border border-[var(--border)] shadow-xs bg-[var(--card)]">
          <table className="w-full min-w-[720px] text-left text-xs sm:text-sm">
            <thead className="bg-slate-50/90 border-b border-slate-200">
              <tr>
                <th scope="col" className="p-3.5 font-bold text-slate-700 text-xs uppercase tracking-wider">
                  Student
                </th>
                <th
                  scope="col"
                  className="p-3.5 font-bold text-slate-700 text-xs uppercase tracking-wider w-40 text-center"
                >
                  Score ({assessment.maxScore} pts)
                </th>
                <th
                  scope="col"
                  className="p-3.5 font-bold text-slate-700 text-xs uppercase tracking-wider w-28 text-center"
                >
                  Percentage
                </th>
                <th scope="col" className="p-3.5 font-bold text-slate-700 text-xs uppercase tracking-wider">
                  Remarks / Notes
                </th>
                <th
                  scope="col"
                  className="p-3.5 font-bold text-slate-700 text-xs uppercase tracking-wider w-20 text-center"
                >
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {roster.map((student) => {
                const existing = results.find((r) => r.studentId === student.register_id)
                const maxScore = assessment.maxScore || 100
                const currentScoreStr =
                  bulkScores[String(student.register_id)] ?? (existing ? String(existing.score) : '')
                const numericScore = parseFloat(currentScoreStr)
                const percentage =
                  !isNaN(numericScore) && maxScore > 0 ? ((numericScore / maxScore) * 100).toFixed(1) : null

                return (
                  <tr key={student.register_id} className="hover:bg-slate-50/80 transition-colors">
                    <td className="p-3.5">
                      <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-indigo-500/10 to-indigo-600/20 text-indigo-700 font-bold text-xs flex items-center justify-center shrink-0 border border-indigo-200/60 shadow-2xs">
                          {getInitials(student.name)}
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <Link
                              href={`/students/${student.register_id}`}
                              className="font-semibold text-slate-900 hover:text-indigo-600 text-xs sm:text-sm hover:underline"
                            >
                              {student.name}
                            </Link>
                            <span className="font-mono text-[11px] text-slate-500 bg-slate-100 px-1.5 py-0.5 rounded">
                              #{student.register_id}
                            </span>
                          </div>
                          {existing && (
                            <p className="text-[11px] text-slate-500 mt-0.5">Graded: {formatDate(existing.gradedAt)}</p>
                          )}
                        </div>
                      </div>
                    </td>

                    <td className="p-3.5 text-center">
                      <div className="inline-flex items-center gap-1.5">
                        <Input
                          type="number"
                          min={0}
                          max={assessment.maxScore}
                          step="0.01"
                          placeholder="Score"
                          value={currentScoreStr}
                          onChange={(e) => onScoreChange(student.register_id, e.target.value)}
                          className="w-24 text-center font-bold min-h-9 rounded-xl text-xs sm:text-sm"
                        />
                        <span className="text-xs text-slate-500">/ {assessment.maxScore}</span>
                      </div>
                    </td>

                    <td className="p-3.5 text-center">
                      {percentage !== null ? (
                        <span
                          className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold ${
                            Number(percentage) >= 70
                              ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                              : Number(percentage) >= 50
                                ? 'bg-amber-50 text-amber-700 border border-amber-200'
                                : 'bg-rose-50 text-rose-700 border border-rose-200'
                          }`}
                        >
                          {percentage}%
                        </span>
                      ) : (
                        <span className="text-xs text-slate-500 italic">Pending</span>
                      )}
                    </td>

                    <td className="p-3.5">
                      <span className="text-xs text-slate-600 line-clamp-1">{existing?.remarks || '-'}</span>
                    </td>

                    <td className="p-3.5 text-center">
                      {existing ? (
                        <Button
                          variant="ghost"
                          size="icon"
                          title="Delete result"
                          aria-label={`Delete result for ${student.name}`}
                          onClick={() => onDeleteResult(existing.id)}
                          className="text-slate-500 hover:text-rose-600 cursor-pointer"
                        >
                          <Trash2 size={14} />
                        </Button>
                      ) : (
                        <span className="text-xs text-slate-500">-</span>
                      )}
                    </td>
                  </tr>
                )
              })}

              {roster.length === 0 && (
                <tr>
                  <td colSpan={5} className="text-center py-8 text-slate-500">
                    No enrolled students match current query.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  )
}
