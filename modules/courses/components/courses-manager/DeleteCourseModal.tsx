'use client'

import { useState } from 'react'
import { AlertCircle, AlertTriangle, CheckCircle2, ShieldAlert, X } from 'lucide-react'
import type { Course } from '@/lib/types'
import { Button } from '@/components/ui/button'
import { errorMessage } from '@/lib/api/error-message'
import { courseNameMatches } from './model'

export function DeleteCourseModal({
  course,
  onDelete,
  onClose,
  onDeleted,
}: {
  course: Course
  onDelete: (id: string) => Promise<void>
  onClose: () => void
  onDeleted: () => void
}) {
  const [typedName, setTypedName] = useState('')
  const [error, setError] = useState('')
  const [deleting, setDeleting] = useState(false)
  const nameMatched = courseNameMatches(course, typedName)

  const handleConfirm = async () => {
    if (!nameMatched) {
      setError('The course name you entered does not match.')
      return
    }
    setDeleting(true)
    setError('')
    try {
      await onDelete(course.id)
      onDeleted()
    } catch (err) {
      setError(errorMessage(err, 'Failed to delete course. Please check if active dependencies prevent removal.'))
      setDeleting(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 z-60 overflow-y-auto animate-in fade-in duration-150">
      <div className="bg-[var(--card)] rounded-[26px] shadow-2xl border border-rose-500/20 w-full max-w-md my-auto max-h-[90vh] flex flex-col overflow-hidden animate-in zoom-in-95 duration-150">
        <div className="bg-rose-500/10 border-b border-rose-500/20 px-6 py-4 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-full bg-rose-500/20 text-[#b53c37] flex items-center justify-center shrink-0">
              <ShieldAlert size={20} />
            </div>
            <div>
              <h3 className="text-base font-bold text-[var(--text)]">Delete Course</h3>
              <span className="text-[11px] font-bold tracking-wider uppercase text-[#b53c37]">Permanent Action</span>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={deleting}
            className="text-[var(--mute)] hover:text-[var(--text)] p-1.5 rounded-full hover:bg-[var(--panel)] transition-colors cursor-pointer"
          >
            <X size={18} />
          </button>
        </div>

        <div className="p-6 space-y-4 overflow-y-auto flex-1">
          <div className="p-3.5 bg-amber-50/80 border border-amber-200/80 rounded-lg text-xs space-y-2 text-amber-900">
            <div className="flex items-center gap-2 font-semibold text-amber-800">
              <AlertTriangle size={15} className="shrink-0 text-amber-600" />
              <span>This cannot be undone</span>
            </div>
            <p className="leading-relaxed">
              Deleting <strong className="text-gray-900 font-semibold">{course.name}</strong> is permanent. A course
              that still has enrolled students, attendance, assessments or materials cannot be deleted: the error lists
              what still depends on it, so move or remove those first.
            </p>
          </div>

          <div>
            <label htmlFor="delete-course-name" className="block text-xs font-medium text-gray-700 mb-1.5">
              To confirm deletion, please type the course name:
            </label>
            <div className="mb-2 p-2 bg-slate-100 border border-slate-200 rounded-md font-mono text-xs font-semibold text-gray-800 select-all text-center">
              {course.name}
            </div>
            <input
              id="delete-course-name"
              type="text"
              value={typedName}
              onChange={(e) => {
                setTypedName(e.target.value)
                if (error) setError('')
              }}
              placeholder="Type the exact course name here"
              disabled={deleting}
              className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-red-500 font-medium"
              autoFocus
            />
            <div className="mt-1.5 flex items-center justify-between text-xs">
              {typedName.trim().length === 0 ? (
                <span className="text-gray-400">Course name required to proceed</span>
              ) : nameMatched ? (
                <span className="text-emerald-600 font-medium flex items-center gap-1">
                  <CheckCircle2 size={13} /> Name matched. You may proceed.
                </span>
              ) : (
                <span className="text-amber-600">Course name does not match yet</span>
              )}
            </div>
          </div>

          {error && (
            <div className="p-3 rounded-md bg-red-50 border border-red-200 text-xs text-red-600 flex items-center gap-2">
              <AlertCircle size={15} className="shrink-0" />
              <span>{error}</span>
            </div>
          )}

          <div className="flex items-center justify-end gap-3 pt-3 border-t border-gray-100">
            <Button type="button" variant="outline" onClick={onClose} disabled={deleting}>
              Cancel
            </Button>
            <Button
              type="button"
              onClick={handleConfirm}
              disabled={!nameMatched || deleting}
              className="bg-red-600 hover:bg-red-700 text-white disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {deleting ? 'Deleting...' : 'Permanently Delete Course'}
            </Button>
          </div>
        </div>
      </div>
    </div>
  )
}
