'use client'

import { useState } from 'react'
import { ArrowRight, CalendarDays, Check, ClipboardList, Copy, ExternalLink, FileSpreadsheet } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { CategoryBadge } from '@/components/CategoryBadge'
import type { CourseCategory } from '@/lib/types'
import { formatDate, type Assessment, type Course } from './model'

export function AssessmentLibrary({
  assessments,
  courses,
  categories,
  courseFilter,
  categoryFilter,
  totalCount,
  hasMore,
  onCourseChange,
  onCategoryChange,
  onLoadMore,
  onOpen,
}: {
  assessments: Assessment[]
  courses: Course[]
  categories: CourseCategory[]
  courseFilter: string
  categoryFilter: string
  totalCount: number
  hasMore: boolean
  onCourseChange: (courseId: string) => void
  onCategoryChange: (categoryId: string) => void
  onLoadMore: () => void
  onOpen: (assessmentId: string) => void
}) {
  const [copiedFormId, setCopiedFormId] = useState<string | null>(null)

  const handleCopyLink = async (formUrl: string, id: string) => {
    try {
      await navigator.clipboard.writeText(formUrl)
      setCopiedFormId(id)
      setTimeout(() => setCopiedFormId(null), 2000)
    } catch {
      // Fallback
    }
  }

  return (
    <section className="panel p-6 sm:p-7 shadow-xs border border-slate-200/90 space-y-6">
      {/* Filter Toolbar */}
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4 pb-4 border-b border-slate-100">
        <div className="space-y-0.5">
          <h2 className="text-xl font-bold text-slate-900">Assessments Catalog</h2>
          <p className="text-xs sm:text-sm text-slate-700">
            Filter by curriculum or category tier to review student evaluations and launch quizzes.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <div>
            <label className="sr-only" htmlFor="category-tier-filter">
              Category Tier Filter
            </label>
            <Select
              value={categoryFilter}
              onValueChange={(value) => {
                const newCat = (value as string) || ''
                onCategoryChange(newCat)
                if (newCat) {
                  const currentCrs = courses.find((c) => c.id === courseFilter)
                  if (currentCrs && currentCrs.categoryId !== newCat) {
                    onCourseChange('')
                  }
                }
              }}
              placeholder="All Categories"
            >
              <SelectTrigger id="category-tier-filter" className="w-[180px] min-h-10 text-xs font-medium">
                <SelectValue placeholder="All Categories" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="">All Categories</SelectItem>
                {categories.map((cat) => (
                  <SelectItem key={cat.id} value={cat.id}>
                    {cat.name} ({cat.duration})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div>
            <label className="sr-only" htmlFor="course-batch-filter">
              Course Batch Filter
            </label>
            <Select
              value={courseFilter}
              onValueChange={(value) => onCourseChange(value as string)}
              placeholder="All Curricula"
            >
              <SelectTrigger id="course-batch-filter" className="w-[220px] min-h-10 text-xs font-medium">
                <SelectValue placeholder="All Curricula" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="">All Curricula</SelectItem>
                {courses
                  .filter((c) => !categoryFilter || c.categoryId === categoryFilter)
                  .map((course) => (
                    <SelectItem key={course.id} value={course.id}>
                      {course.name}
                    </SelectItem>
                  ))}
              </SelectContent>
            </Select>
          </div>
        </div>
      </div>

      {/* Assessment Table / Cards */}
      <div className="overflow-x-auto rounded-xl border border-[var(--border)] shadow-xs bg-[var(--card)]">
        <table className="w-full min-w-[700px] text-left">
          <thead className="bg-slate-50/90 border-b border-slate-200">
            <tr>
              <th scope="col" className="p-4 font-bold text-slate-900 text-xs uppercase tracking-wider w-28">
                Date
              </th>
              <th scope="col" className="p-4 font-bold text-slate-900 text-xs uppercase tracking-wider w-48">
                Curriculum
              </th>
              <th scope="col" className="p-4 font-bold text-slate-900 text-xs uppercase tracking-wider">
                Assessment Title
              </th>
              <th
                scope="col"
                className="p-4 font-bold text-slate-900 text-xs uppercase tracking-wider w-24 text-center"
              >
                Max Score
              </th>
              <th scope="col" className="p-4 font-bold text-slate-900 text-xs uppercase tracking-wider w-36">
                Google Form
              </th>
              <th scope="col" className="p-4 font-bold text-slate-900 text-xs uppercase tracking-wider text-right w-36">
                Actions
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {assessments.map((assessment) => (
              <tr
                key={assessment.id}
                className="hover:bg-slate-50/80 transition-colors group cursor-pointer"
                onClick={() => onOpen(assessment.id)}
              >
                <td className="p-4 text-xs font-medium text-slate-600">
                  <div className="flex items-center gap-1.5">
                    <CalendarDays size={13} className="text-slate-400" />
                    <span>{formatDate(assessment.assessmentDate)}</span>
                  </div>
                </td>

                <td className="p-4">
                  <div className="flex flex-col items-start gap-1">
                    <span className="text-xs sm:text-sm font-semibold text-slate-900 line-clamp-1">
                      {assessment.courseName}
                    </span>
                    {(() => {
                      const crs = courses.find((c) => c.id === assessment.courseId || c.name === assessment.courseName)
                      const catName = crs?.categoryName
                      if (!catName) return null
                      return <CategoryBadge categoryName={catName} />
                    })()}
                  </div>
                </td>

                <td className="p-4">
                  <div className="space-y-1">
                    <span className="font-bold text-slate-900 group-hover:text-indigo-600 transition-colors text-sm sm:text-base">
                      {assessment.title}
                    </span>
                    {assessment.createdBy && (
                      <p className="text-[11px] text-slate-700">
                        Created by {assessment.createdBy.fullName} ({assessment.createdBy.role})
                      </p>
                    )}
                  </div>
                </td>

                <td className="p-4 text-center">
                  <span className="inline-flex items-center px-2.5 py-1 rounded-lg text-xs font-bold bg-slate-100 text-slate-800 border border-slate-200/80">
                    {assessment.maxScore} pts
                  </span>
                </td>

                <td className="p-4" onClick={(e) => e.stopPropagation()}>
                  {assessment.formUrl ? (
                    <div className="flex items-center gap-1.5">
                      <a
                        href={assessment.formUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-semibold bg-purple-50 text-purple-700 border border-purple-200 hover:bg-purple-100 transition-all"
                        title="Open Google Form Quiz"
                      >
                        <FileSpreadsheet size={13} />
                        <span>Quiz</span>
                        <ExternalLink size={11} />
                      </a>
                      <button
                        type="button"
                        onClick={() => handleCopyLink(assessment.formUrl!, assessment.id)}
                        className="p-1.5 rounded-lg border border-slate-200 text-slate-700 hover:text-slate-900 hover:bg-slate-100 cursor-pointer transition-all"
                        title="Copy student quiz link"
                      >
                        {copiedFormId === assessment.id ? (
                          <Check size={13} className="text-emerald-600" />
                        ) : (
                          <Copy size={13} />
                        )}
                      </button>
                    </div>
                  ) : (
                    <span className="text-xs text-slate-700 italic">None linked</span>
                  )}
                </td>

                <td className="p-4 text-right" onClick={(e) => e.stopPropagation()}>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    aria-label={`View results for ${assessment.title}`}
                    onClick={() => onOpen(assessment.id)}
                    className="text-xs font-semibold cursor-pointer hover:bg-indigo-50 hover:text-indigo-700 hover:border-indigo-300"
                  >
                    <span>Open Studio</span>
                    <ArrowRight size={13} className="ml-1" />
                  </Button>
                </td>
              </tr>
            ))}

            {assessments.length === 0 && (
              <tr>
                <td colSpan={6} className="text-center py-12 text-slate-700 space-y-2">
                  <ClipboardList size={32} className="mx-auto text-slate-600" />
                  <p className="text-sm font-semibold text-slate-900">No assessments match current filters</p>
                  <p className="text-xs text-slate-700">Create a new assessment above or choose another curriculum.</p>
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination / Load More */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 pt-2">
        <div className="text-xs text-slate-700">
          Showing {assessments.length} of {totalCount} assessments
        </div>
        {hasMore && (
          <Button variant="outline" onClick={onLoadMore} className="text-xs font-semibold cursor-pointer">
            Load More Assessments
          </Button>
        )}
      </div>
    </section>
  )
}
