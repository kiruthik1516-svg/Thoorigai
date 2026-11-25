'use client'

import { useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useDialog } from '@/lib/hooks/useDialog'
import { apiErrorMessage } from '@/lib/api/error-message'
import type { Course, Student } from '@/lib/types'

type FieldKey =
  | 'name'
  | 'phone'
  | 'altPhone'
  | 'email'
  | 'gender'
  | 'dob'
  | 'maritalStatus'
  | 'course'
  | 'batch'
  | 'country'
  | 'state'
  | 'city'
  | 'area'
  | 'studentSource'
  | 'comments'

const TEXT_FIELDS: { key: FieldKey; label: string; type?: string; required?: boolean }[] = [
  { key: 'name', label: 'Full name', required: true },
  { key: 'phone', label: 'Phone', type: 'tel', required: true },
  { key: 'altPhone', label: 'Alternate phone', type: 'tel' },
  { key: 'email', label: 'Email', type: 'email' },
  { key: 'dob', label: 'Date of birth', type: 'date' },
  { key: 'maritalStatus', label: 'Marital status' },
  { key: 'batch', label: 'Batch start', required: true },
  { key: 'country', label: 'Country' },
  { key: 'state', label: 'State' },
  { key: 'city', label: 'City' },
  { key: 'area', label: 'Area' },
  { key: 'studentSource', label: 'How they found us' },
]

function initialValues(student: Student): Record<FieldKey, string> {
  return {
    name: student.name ?? '',
    phone: student.phone ?? '',
    altPhone: student.altPhone ?? '',
    email: student.email ?? '',
    gender: student.gender ?? '',
    dob: student.dob ?? '',
    maritalStatus: student.maritalStatus ?? '',
    course: student.course ?? '',
    batch: student.batch ?? '',
    country: student.country ?? '',
    state: student.state ?? '',
    city: student.city ?? '',
    area: student.area ?? '',
    studentSource: student.studentSource ?? '',
    comments: student.comments ?? '',
  }
}

/**
 * Edits a student's details. Staff edit students in their own courses; only admins see and
 * change the fee. Only changed fields are sent.
 */
export function EditStudentModal({
  student,
  courses,
  canEditFee,
  onClose,
}: {
  student: Student
  courses: Course[]
  canEditFee: boolean
  onClose: () => void
}) {
  const router = useRouter()
  const dialogRef = useRef<HTMLDivElement>(null)
  useDialog(true, onClose, dialogRef)
  const [values, setValues] = useState(() => initialValues(student))
  const [fee, setFee] = useState(String(student.total || ''))
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const set = (key: FieldKey, value: string) => setValues((current) => ({ ...current, [key]: value }))

  const save = async (event: React.FormEvent) => {
    event.preventDefault()
    const original = initialValues(student)
    const changes: Record<string, unknown> = {}
    for (const key of Object.keys(values) as FieldKey[]) {
      if (values[key] !== original[key]) changes[key] = values[key].trim() === '' ? null : values[key].trim()
    }
    if (canEditFee && Number(fee) !== student.total) {
      const nextFee = Number(fee)
      if (!Number.isInteger(nextFee) || nextFee <= 0) {
        setError('Enter the fee as a whole number of rupees above zero.')
        return
      }
      changes.total = nextFee
    }
    if (Object.keys(changes).length === 0) {
      onClose()
      return
    }
    setSaving(true)
    setError(null)
    try {
      const res = await fetch(`/api/students?registerId=${student.registerId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(changes),
      })
      if (!res.ok) throw new Error(apiErrorMessage(await res.json().catch(() => null), 'Could not save the changes.'))
      onClose()
      router.refresh()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save the changes.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div
      ref={dialogRef}
      role="dialog"
      aria-modal="true"
      aria-labelledby="edit-student-title"
      className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/50 p-4 backdrop-blur-xs"
    >
      <form onSubmit={save} className="my-6 w-full max-w-3xl rounded-xl border border-gray-100 bg-white shadow-2xl">
        <div className="flex items-center justify-between border-b border-gray-100 px-6 py-4">
          <div>
            <h2 id="edit-student-title" className="text-lg font-bold text-gray-900">
              Edit student
            </h2>
            <p className="text-xs text-gray-500">TAI-{student.registerId}</p>
          </div>
          <button type="button" onClick={onClose} aria-label="Close" className="rounded-lg p-1 hover:bg-gray-100">
            <X size={18} />
          </button>
        </div>

        <div className="grid grid-cols-1 gap-4 px-6 py-5 md:grid-cols-2">
          {TEXT_FIELDS.map((field) => (
            <label key={field.key} className="block text-xs font-semibold text-gray-700">
              {field.label}
              {field.required && <span className="text-red-500"> *</span>}
              <input
                type={field.type ?? 'text'}
                required={field.required}
                value={values[field.key]}
                onChange={(e) => set(field.key, e.target.value)}
                className="mt-1 w-full rounded-md border border-gray-200 px-3 py-2 text-sm font-normal"
              />
            </label>
          ))}

          <label className="block text-xs font-semibold text-gray-700">
            Gender
            <select
              value={values.gender}
              onChange={(e) => set('gender', e.target.value)}
              className="mt-1 w-full rounded-md border border-gray-200 px-3 py-2 text-sm font-normal"
            >
              <option value="">Not recorded</option>
              <option value="Female">Female</option>
              <option value="Male">Male</option>
              <option value="Others">Others</option>
            </select>
          </label>

          <label className="block text-xs font-semibold text-gray-700">
            Course <span className="text-red-500">*</span>
            <select
              required
              value={values.course}
              onChange={(e) => set('course', e.target.value)}
              className="mt-1 w-full rounded-md border border-gray-200 px-3 py-2 text-sm font-normal"
            >
              {!courses.some((c) => c.name === values.course) && <option value={values.course}>{values.course}</option>}
              {courses.map((course) => (
                <option key={course.id} value={course.name}>
                  {course.name}
                </option>
              ))}
            </select>
          </label>

          {canEditFee && (
            <label className="block text-xs font-semibold text-gray-700">
              Tuition fee (₹) <span className="text-red-500">*</span>
              <input
                type="number"
                min={1}
                step={1}
                value={fee}
                onChange={(e) => setFee(e.target.value)}
                className="mt-1 w-full rounded-md border border-gray-200 px-3 py-2 text-sm font-normal"
              />
              <span className="mt-1 block text-[11px] font-normal text-gray-500">
                Cannot be lower than the ₹{student.paid.toLocaleString('en-IN')} already paid.
              </span>
            </label>
          )}

          <label className="block text-xs font-semibold text-gray-700 md:col-span-2">
            Comments
            <textarea
              rows={3}
              value={values.comments}
              onChange={(e) => set('comments', e.target.value)}
              className="mt-1 w-full rounded-md border border-gray-200 px-3 py-2 text-sm font-normal"
            />
          </label>
        </div>

        {error && (
          <p role="alert" className="px-6 pb-2 text-xs text-red-700">
            {error}
          </p>
        )}
        <div className="flex justify-end gap-3 border-t border-gray-100 px-6 py-4">
          <Button type="button" variant="secondary" onClick={onClose} disabled={saving}>
            Cancel
          </Button>
          <Button type="submit" disabled={saving}>
            {saving ? 'Saving…' : 'Save changes'}
          </Button>
        </div>
      </form>
    </div>
  )
}
