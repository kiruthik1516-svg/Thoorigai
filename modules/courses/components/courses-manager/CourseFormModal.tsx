'use client'

import { useMemo, useRef, useState } from 'react'
import { useDialog } from '@/lib/hooks/useDialog'
import Link from 'next/link'
import { AlertCircle, ArrowUpRight, BookOpen, Trash2, X } from 'lucide-react'
import type { Course, CourseCategory } from '@/lib/types'
import { money } from '@/lib/formatters'
import { calculateGstForRupees } from '@/lib/money'
import { CategoryBadge } from '@/components/CategoryBadge'
import { errorMessage } from '@/lib/api/error-message'
import { availableDurations, courseFormFromCourse, coursePayload, newCourseForm, type CourseForm } from './model'

export function CourseFormModal({
  editingCourse,
  categories,
  selectedCategoryId,
  gstRate,
  canManageCategories,
  canDelete,
  onSave,
  onClose,
  onRequestDelete,
}: {
  /** null when adding a course. */
  editingCourse: Course | null
  categories: CourseCategory[]
  selectedCategoryId?: string
  gstRate: number
  canManageCategories: boolean
  canDelete: boolean
  onSave: (course: Partial<Course>) => Promise<void>
  onClose: () => void
  onRequestDelete: (course: Course) => void
}) {
  const dialogRef = useRef<HTMLDivElement>(null)
  useDialog(true, onClose, dialogRef)
  const [form, setForm] = useState<CourseForm>(() =>
    editingCourse ? courseFormFromCourse(editingCourse) : newCourseForm(categories, selectedCategoryId),
  )
  const [submitting, setSubmitting] = useState(false)
  const [formError, setFormError] = useState('')

  const setField = <K extends keyof CourseForm>(field: K, value: CourseForm[K]) =>
    setForm((prev) => ({ ...prev, [field]: value }))

  // Picking a category fills in its duration; picking a duration selects the matching category.
  const selectCategory = (categoryId: string) => {
    const category = categoryId && categoryId !== 'none' ? categories.find((c) => c.id === categoryId) : undefined
    setForm((prev) => ({ ...prev, categoryId, duration: category ? category.duration : prev.duration }))
  }
  const selectDuration = (duration: string) => {
    const match = categories.find((c) => c.duration.trim().toLowerCase() === duration.trim().toLowerCase())
    setForm((prev) => ({ ...prev, duration, categoryId: match ? match.id : prev.categoryId }))
  }

  const durations = useMemo(() => availableDurations(categories, form.duration), [categories, form.duration])
  const enteredFee = Number(form.fee) || 0
  const breakdown = calculateGstForRupees(enteredFee, gstRate, form.gstInclusive)
  const modalBase = breakdown.taxableAmount
  const modalGst = breakdown.gstAmount
  const modalTotal = breakdown.totalAmount

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    const result = coursePayload(form, editingCourse?.id)
    if ('error' in result) {
      setFormError(result.error)
      return
    }
    setSubmitting(true)
    setFormError('')
    try {
      await onSave(result.course)
      onClose()
    } catch (err) {
      setFormError(errorMessage(err, 'Failed to save course.'))
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div
      ref={dialogRef}
      role="dialog"
      aria-modal="true"
      aria-label="Course details"
      className="fixed inset-0 bg-black/50 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 z-50 overflow-y-auto"
    >
      <div className="bg-[var(--card)] rounded-[26px] shadow-2xl border border-[var(--border)] w-full max-w-lg my-auto max-h-[90vh] flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        <div className="flex items-center justify-between px-6 py-4 border-b border-[var(--border)] shrink-0">
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-lg font-bold text-[var(--text)]">
                {editingCourse ? 'Edit Course' : 'Add New Course'}
              </h2>
              {editingCourse?.categoryName && <CategoryBadge categoryName={editingCourse.categoryName} />}
            </div>
            <p className="text-xs text-[var(--mute)] mt-0.5">
              {editingCourse
                ? `Modify curriculum pricing, duration tier, and course settings for ${editingCourse.name}.`
                : 'Configure curriculum tuition fee, GST pricing mode, duration tier, and details.'}
            </p>
          </div>
          <div className="flex items-center gap-2">
            {editingCourse && (
              <Link
                href={`/courses/${encodeURIComponent(editingCourse.id)}/materials`}
                className="inline-flex items-center gap-1 px-3 py-1 text-xs font-bold rounded-full border border-[var(--border)] bg-[var(--panel)] text-[var(--text)] hover:bg-[var(--card)] transition-colors"
                title="Manage course materials and syllabus"
              >
                <BookOpen size={13} />
                Materials
                <ArrowUpRight size={12} />
              </Link>
            )}
            <button
              type="button"
              onClick={onClose}
              className="text-[var(--mute)] hover:text-[var(--text)] p-1.5 rounded-full hover:bg-[var(--panel)] transition-colors cursor-pointer"
            >
              <X size={18} />
            </button>
          </div>
        </div>

        {formError && (
          <div className="mx-6 mt-4 p-3 rounded-xl bg-rose-500/10 border border-rose-500/20 text-xs font-semibold text-[#b53c37] flex items-center gap-2 shrink-0">
            <AlertCircle size={16} />
            <span>{formError}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="flex flex-col flex-1 min-h-0 overflow-hidden">
          <div className="p-6 space-y-4 overflow-y-auto flex-1">
            <div>
              <label htmlFor="course-name" className="block text-xs font-bold text-[var(--text)] mb-1">
                Course Name <span className="text-[#b53c37]">*</span>
              </label>
              <input
                id="course-name"
                type="text"
                required
                placeholder="e.g. Full Stack Development"
                value={form.name}
                onChange={(e) => setField('name', e.target.value)}
                className="w-full px-3.5 py-2 border border-[var(--border)] rounded-full text-xs text-[var(--text)] bg-[var(--panel)] focus:outline-none focus:ring-1 focus:ring-[var(--g1)]"
              />
            </div>

            {/* Course Category Selector */}
            <div>
              <div className="flex items-center justify-between mb-1">
                <label htmlFor="course-category-select" className="block text-xs font-bold text-[var(--text)]">
                  Category Tier
                </label>
                {canManageCategories && (
                  <Link
                    href="/settings/course-categories"
                    className="text-xs font-bold hover:underline flex items-center gap-1"
                    style={{ color: 'var(--g1)' }}
                    target="_blank"
                  >
                    Manage Categories <ArrowUpRight size={11} />
                  </Link>
                )}
              </div>
              <select
                id="course-category-select"
                aria-label="Category Tier"
                value={form.categoryId}
                onChange={(e) => selectCategory(e.target.value)}
                className="w-full px-3.5 py-2 border border-[var(--border)] rounded-full text-xs text-[var(--text)] bg-[var(--panel)] focus:outline-none focus:ring-1 focus:ring-[var(--g1)]"
              >
                <option value="">-- Select Category --</option>
                {categories.map((cat) => (
                  <option key={cat.id} value={cat.id}>
                    {cat.name} ({cat.duration})
                  </option>
                ))}
                <option value="none">No Category (Custom Duration)</option>
              </select>
              <p className="text-[11px] text-[var(--mute)] mt-1">
                Selecting a category auto-fills the duration below (e.g. Essential → 6 weeks, Elite → 12 weeks).
              </p>
            </div>

            {/* GST Pricing Mode Selector */}
            <div>
              <p id="course-gst-mode" className="block text-xs font-bold text-[var(--text)] mb-1.5">
                GST Calculation Mode <span className="text-[#b53c37]">*</span>
              </p>
              <div role="group" aria-labelledby="course-gst-mode" className="grid grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={() => setField('gstInclusive', false)}
                  className={`p-3 rounded-[16px] border text-left transition-all flex flex-col justify-between cursor-pointer ${
                    !form.gstInclusive
                      ? 'border-[var(--g1)] bg-[var(--panel)] ring-1 ring-[var(--g1)]'
                      : 'border-[var(--border)] hover:border-[var(--mute)] bg-[var(--card)]'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-[var(--text)]">Exclusive of GST</span>
                    <span
                      className={`w-4 h-4 rounded-full border flex items-center justify-center ${
                        !form.gstInclusive ? 'border-[var(--g1)] bg-[var(--g1)]' : 'border-[var(--border)]'
                      }`}
                    >
                      {!form.gstInclusive && <span className="w-1.5 h-1.5 rounded-full bg-white" />}
                    </span>
                  </div>
                  <span className="text-[11px] text-[var(--mute)] mt-1 leading-tight">+GST added on top of fee</span>
                </button>

                <button
                  type="button"
                  onClick={() => setField('gstInclusive', true)}
                  className={`p-3 rounded-[16px] border text-left transition-all flex flex-col justify-between cursor-pointer ${
                    form.gstInclusive
                      ? 'border-[var(--g1)] bg-[var(--panel)] ring-1 ring-[var(--g1)]'
                      : 'border-[var(--border)] hover:border-[var(--mute)] bg-[var(--card)]'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-[var(--text)]">Inclusive of GST</span>
                    <span
                      className={`w-4 h-4 rounded-full border flex items-center justify-center ${
                        form.gstInclusive ? 'border-[var(--g1)] bg-[var(--g1)]' : 'border-[var(--border)]'
                      }`}
                    >
                      {form.gstInclusive && <span className="w-1.5 h-1.5 rounded-full bg-white" />}
                    </span>
                  </div>
                  <span className="text-[11px] text-[var(--mute)] mt-1 leading-tight">Fee already contains GST</span>
                </button>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label htmlFor="course-fee" className="block text-xs font-bold text-[var(--text)] mb-1">
                  Course Fee (₹) <span className="text-[#b53c37]">*</span>
                </label>
                <input
                  id="course-fee"
                  type="number"
                  min="0"
                  required
                  placeholder="e.g. 42000"
                  value={form.fee}
                  onChange={(e) => setField('fee', e.target.value)}
                  className="w-full px-3.5 py-2 border border-[var(--border)] rounded-full text-xs text-[var(--text)] bg-[var(--panel)] focus:outline-none focus:ring-1 focus:ring-[var(--g1)]"
                />
                <span className="text-[11px] text-[var(--mute)] mt-0.5 block">
                  {form.gstInclusive ? 'All-inclusive tuition fee' : 'Base tuition fee before GST'}
                </span>
              </div>

              <div>
                <label htmlFor="course-duration-select" className="block text-xs font-bold text-[var(--text)] mb-1">
                  Duration <span className="text-[#b53c37]">*</span>
                </label>
                <select
                  id="course-duration-select"
                  aria-label="Course Duration"
                  required
                  value={form.duration}
                  onChange={(e) => selectDuration(e.target.value)}
                  className="w-full px-3.5 py-2 border border-[var(--border)] rounded-full text-xs text-[var(--text)] bg-[var(--panel)] focus:outline-none focus:ring-1 focus:ring-[var(--g1)]"
                >
                  <option value="">-- Select Duration --</option>
                  {durations.map((item) => (
                    <option key={item.duration} value={item.duration}>
                      {item.label}
                    </option>
                  ))}
                </select>
                <span className="text-[11px] text-[var(--mute)] mt-0.5 block">Configured from category tiers</span>
              </div>
            </div>

            {/* Live Fee + GST Preview Box */}
            {enteredFee > 0 && (
              <div className="p-3.5 bg-[var(--panel)] border border-[var(--border)] rounded-[18px] text-xs space-y-1.5 text-[var(--text)]">
                <div className="font-bold flex items-center justify-between">
                  <span className="flex items-center gap-1.5">
                    Fee Breakdown
                    <span
                      className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                        form.gstInclusive ? 'bg-emerald-500/15 text-[#1b7a4b]' : 'bg-amber-500/15 text-[#854d0e]'
                      }`}
                    >
                      {form.gstInclusive ? 'GST Inclusive' : 'GST Exclusive'}
                    </span>
                  </span>
                  <span className="text-[var(--mute)] font-normal">
                    {gstRate > 0 ? `GST @ ${gstRate}%` : 'GST Not Applicable'}
                  </span>
                </div>
                <div className="flex justify-between text-[var(--mute)]">
                  <span>Base Tuition (Taxable Amount):</span>
                  <strong className="text-[var(--text)]">{money(modalBase)}</strong>
                </div>
                {gstRate > 0 && (
                  <div className="flex justify-between text-[var(--mute)]">
                    <span>GST Amount:</span>
                    <strong className="text-[var(--text)]">{money(modalGst)}</strong>
                  </div>
                )}
                <div className="pt-1.5 border-t border-[var(--border)] flex justify-between font-bold text-sm">
                  <span>Total Invoice Amount:</span>
                  <span style={{ color: 'var(--g1)' }}>{money(modalTotal)}</span>
                </div>
              </div>
            )}

            <div>
              <label htmlFor="course-description" className="block text-xs font-bold text-[var(--text)] mb-1">
                Description (Optional)
              </label>
              <textarea
                id="course-description"
                rows={3}
                placeholder="Short summary of technologies covered..."
                value={form.description}
                onChange={(e) => setField('description', e.target.value)}
                className="w-full px-3.5 py-2.5 border border-[var(--border)] rounded-[18px] text-xs text-[var(--text)] bg-[var(--panel)] focus:outline-none focus:ring-1 focus:ring-[var(--g1)]"
              />
            </div>
          </div>

          <div className="flex items-center justify-between gap-3 p-4 px-6 border-t border-[var(--border)] bg-[var(--card)] shrink-0">
            <div>
              {editingCourse && canDelete && (
                <button
                  type="button"
                  onClick={() => onRequestDelete(editingCourse)}
                  className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-xs font-bold text-[#b53c37] hover:bg-rose-500/10 border border-rose-500/20 transition-colors cursor-pointer"
                  disabled={submitting}
                >
                  <Trash2 size={14} />
                  Delete Course
                </button>
              )}
            </div>
            <div className="flex items-center gap-2.5">
              <button
                type="button"
                onClick={onClose}
                disabled={submitting}
                className="px-4 py-2 rounded-full text-xs font-semibold text-[var(--text)] bg-[var(--panel)] border border-[var(--border)] hover:bg-[var(--card)] transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={submitting}
                className="px-5 py-2 rounded-full text-xs font-bold text-white shadow-xs transition-opacity hover:opacity-90 disabled:opacity-50 cursor-pointer"
                style={{ background: 'linear-gradient(135deg, var(--g1), var(--g1b))' }}
              >
                {submitting ? 'Saving...' : editingCourse ? 'Save Changes' : 'Create Course'}
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  )
}
