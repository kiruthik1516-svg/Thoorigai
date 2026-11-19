'use client'

import { useState } from 'react'
import { AlertCircle, FileSpreadsheet, Plus, Sparkles } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import type { CourseCategory } from '@/lib/types'
import { emptyAssessmentInput, type Course, type NewAssessmentInput } from './model'

export function CreateAssessmentForm({
  courses,
  categories,
  error,
  creating,
  onCreate,
  onCancel,
}: {
  courses: Course[]
  categories: CourseCategory[]
  error: string | null
  creating: boolean
  /** Resolves to true when the assessment was created (the form then resets). */
  onCreate: (input: NewAssessmentInput) => Promise<boolean>
  onCancel: () => void
}) {
  const [form, setForm] = useState<NewAssessmentInput>(emptyAssessmentInput)
  const setField = (field: keyof NewAssessmentInput, value: string) => setForm((prev) => ({ ...prev, [field]: value }))
  const handleSubmit = async () => {
    if (await onCreate(form)) setForm(emptyAssessmentInput())
  }

  return (
    <section className="panel p-6 sm:p-8 shadow-xs border border-slate-200/90 space-y-6">
      <div className="flex items-start justify-between pb-4 border-b border-slate-100">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-indigo-50 text-indigo-700 border border-indigo-200">
              <Sparkles size={12} />
              New Evaluation
            </span>
          </div>
          <h2 className="text-xl font-bold text-slate-900">Create Assessment / Quiz</h2>
          <p className="text-xs sm:text-sm text-slate-500">
            Set up an evaluation and attach a Google Form link for automatic student quiz distribution.
          </p>
        </div>
      </div>

      {/* Quick Presets */}
      <div className="space-y-2">
        <span className="text-xs font-semibold text-slate-600 block">Quick Template Presets:</span>
        <div className="flex flex-wrap gap-2">
          {[
            { title: 'AWS Cloud — Week 3 Assessment', max: '30' },
            { title: 'Full Stack — Module 2 Practical Exam', max: '50' },
            { title: 'Python Fundamentals Weekly Quiz', max: '25' },
            { title: 'Data Analytics Midterm Test', max: '100' },
          ].map((preset) => (
            <button
              key={preset.title}
              type="button"
              onClick={() => {
                setForm((prev) => ({
                  ...prev,
                  title: preset.title,
                  maxScore: preset.max,
                }))
              }}
              className="px-3 py-1.5 rounded-xl border border-slate-200 bg-white hover:bg-indigo-50 hover:border-indigo-300 text-xs text-slate-700 hover:text-indigo-800 font-medium transition-all cursor-pointer shadow-2xs"
            >
              + {preset.title} ({preset.max} pts)
            </button>
          ))}
        </div>
      </div>

      <form
        onSubmit={(e) => {
          e.preventDefault()
          void handleSubmit()
        }}
        className="space-y-5"
      >
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label htmlFor="assessment-course" className="text-xs font-semibold text-slate-700 mb-1.5 block">
              Course Curriculum <span className="text-rose-500">*</span>
            </label>
            <Select
              value={form.courseId}
              onValueChange={(value) => setField('courseId', value as string)}
              placeholder="Select a course batch"
            >
              <SelectTrigger id="assessment-course" className="min-h-11 rounded-xl text-sm">
                <SelectValue placeholder="Select a course batch" />
              </SelectTrigger>
              <SelectContent>
                {categories.map((cat) => {
                  const catCourses = courses.filter((c) => String(c.categoryId) === String(cat.id))
                  if (!catCourses.length) return null
                  return (
                    <div key={cat.id} className="py-1">
                      <div className="px-2.5 py-1 text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                        {cat.name} {cat.duration ? `(${cat.duration})` : ''}
                      </div>
                      {catCourses.map((c) => (
                        <SelectItem key={c.id} value={c.id}>
                          {c.name}
                        </SelectItem>
                      ))}
                    </div>
                  )
                })}
                {(() => {
                  const catIds = new Set(categories.map((cat) => String(cat.id)))
                  const otherCourses = courses.filter((c) => !c.categoryId || !catIds.has(String(c.categoryId)))
                  if (!otherCourses.length) return null
                  return (
                    <div className="py-1">
                      <div className="px-2.5 py-1 text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                        {categories.length > 0 ? 'Other Curricula' : 'Available Courses'}
                      </div>
                      {otherCourses.map((c) => (
                        <SelectItem key={c.id} value={c.id}>
                          {c.name}
                        </SelectItem>
                      ))}
                    </div>
                  )
                })()}
                {courses.length === 0 && (
                  <div className="px-3 py-3 text-xs text-slate-400 text-center">No courses available</div>
                )}
              </SelectContent>
            </Select>
          </div>

          <div>
            <label htmlFor="assessment-title" className="text-xs font-semibold text-slate-700 mb-1.5 block">
              Assessment Title <span className="text-rose-500">*</span>
            </label>
            <Input
              id="assessment-title"
              value={form.title}
              onChange={(e) => setField('title', e.target.value)}
              placeholder="e.g., AWS Cloud — Week 3 Assessment"
              className="min-h-11 rounded-xl text-sm"
              required
            />
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label htmlFor="assessment-max-score" className="text-xs font-semibold text-slate-700 mb-1.5 block">
              Max Score (Total Points) <span className="text-rose-500">*</span>
            </label>
            <Input
              id="assessment-max-score"
              value={form.maxScore}
              onChange={(e) => setField('maxScore', e.target.value)}
              placeholder="e.g., 30"
              type="number"
              min={0}
              step="0.01"
              className="min-h-11 rounded-xl text-sm"
              required
            />
          </div>
          <div>
            <label htmlFor="assessment-date" className="text-xs font-semibold text-slate-700 mb-1.5 block">
              Assessment Date <span className="text-rose-500">*</span>
            </label>
            <Input
              id="assessment-date"
              value={form.assessmentDate}
              onChange={(e) => setField('assessmentDate', e.target.value)}
              placeholder="YYYY-MM-DD"
              type="date"
              className="min-h-11 rounded-xl text-sm"
              required
            />
          </div>
        </div>

        {/* Google Forms Integration Card */}
        <div className="p-5 rounded-2xl bg-gradient-to-br from-purple-50/70 via-indigo-50/40 to-slate-50 border border-purple-200/80 space-y-4">
          <div className="flex items-center gap-2 text-purple-900 font-bold text-sm">
            <FileSpreadsheet size={18} className="text-purple-700" />
            <span>Google Forms &amp; Sheets Integration (Optional)</span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label htmlFor="assessment-form-url" className="text-xs font-semibold text-purple-900 mb-1 block">
                Google Form Student URL
              </label>
              <Input
                id="assessment-form-url"
                value={form.formUrl}
                onChange={(e) => setField('formUrl', e.target.value)}
                placeholder="https://docs.google.com/forms/d/e/.../viewform"
                className="bg-white min-h-10 text-xs sm:text-sm rounded-xl border-purple-200"
              />
              <p className="text-[11px] text-purple-700/80 mt-1">
                Students can scan a classroom QR code or click to open this quiz.
              </p>
            </div>

            <div>
              <label htmlFor="assessment-sheet-url" className="text-xs font-semibold text-purple-900 mb-1 block">
                Google Sheets Response URL
              </label>
              <Input
                id="assessment-sheet-url"
                value={form.sheetUrl}
                onChange={(e) => setField('sheetUrl', e.target.value)}
                placeholder="https://docs.google.com/spreadsheets/d/..."
                className="bg-white min-h-10 text-xs sm:text-sm rounded-xl border-purple-200"
              />
              <p className="text-[11px] text-purple-700/80 mt-1">
                One-click access to the live response sheet for grading and review.
              </p>
            </div>
          </div>
        </div>

        {error && (
          <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-xs text-rose-700 flex items-center gap-2">
            <AlertCircle size={15} />
            <span>{error}</span>
          </div>
        )}

        <div className="flex items-center justify-end gap-3 pt-2">
          <Button type="button" variant="outline" onClick={onCancel} className="cursor-pointer">
            Cancel
          </Button>
          <Button type="submit" disabled={creating} className="btn-primary min-h-11 px-6 cursor-pointer">
            {creating ? 'Creating...' : 'Create Assessment'}
            <Plus size={16} className="ml-1.5" />
          </Button>
        </div>
      </form>
    </section>
  )
}
