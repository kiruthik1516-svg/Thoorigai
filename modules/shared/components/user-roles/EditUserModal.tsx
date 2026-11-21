'use client'

import { useRef, useState } from 'react'
import { useDialog } from '@/lib/hooks/useDialog'
import Link from 'next/link'
import { History, Plus, ShieldAlert, Trash2, UserMinus, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  newCustomMetaId,
  userDetailsForm,
  userDetailsPayload,
  type UserDetailsForm,
  type UserDetailsPayload,
  type UserProfile,
} from './model'

const inputClass =
  'w-full px-3 py-1.5 text-xs border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-600'

type TextField = Exclude<keyof UserDetailsForm, 'customMeta'>

export function EditUserModal({
  user,
  currentUserId,
  revokingUserId,
  deletingUserId,
  onClose,
  onSave,
  onRevokeAccess,
  onRequestDisable,
}: {
  user: UserProfile
  currentUserId: string
  revokingUserId: string | null
  deletingUserId: string | null
  onClose: () => void
  /** Saves the details; the page closes the modal on success. */
  onSave: (payload: UserDetailsPayload) => Promise<void>
  onRevokeAccess: (userId: string) => void
  onRequestDisable: (user: UserProfile) => void
}) {
  const dialogRef = useRef<HTMLDivElement>(null)
  useDialog(true, onClose, dialogRef)
  const [form, setForm] = useState<UserDetailsForm>(() => userDetailsForm(user))
  const [saving, setSaving] = useState(false)

  const setField = (field: TextField) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
    setForm((current) => ({ ...current, [field]: e.target.value }))
  const setCustomMeta = (update: (entries: UserDetailsForm['customMeta']) => UserDetailsForm['customMeta']) =>
    setForm((current) => ({ ...current, customMeta: update(current.customMeta) }))

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setSaving(true)
    try {
      await onSave(userDetailsPayload(form))
    } finally {
      setSaving(false)
    }
  }

  const accessBusy = saving || revokingUserId === user.id || deletingUserId === user.id

  return (
    <div
      ref={dialogRef}
      role="dialog"
      aria-modal="true"
      aria-label="Edit user"
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-xs p-3 sm:p-4 animate-in fade-in"
    >
      <div className="bg-white rounded-2xl shadow-xl border border-slate-200 max-w-2xl w-full max-h-[92vh] overflow-y-auto p-5 sm:p-7 relative">
        <button
          type="button"
          onClick={onClose}
          className="absolute top-4 right-4 p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100"
        >
          <X size={18} />
        </button>

        <div className="mb-6 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 pr-8">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="w-2 h-2 rounded-full bg-teal-500" />
              <span className="text-xs uppercase font-bold text-teal-700 tracking-wider">User Settings</span>
            </div>
            <h3 className="text-lg font-bold text-slate-900">
              Contact Details & Metadata for {user.full_name || 'User'}
            </h3>
            <p className="text-xs text-slate-500 font-mono mt-0.5">ID: {user.id}</p>
          </div>
          <Link
            href={`/audit-log?userName=${encodeURIComponent(user.full_name || '')}&search=${encodeURIComponent(user.id)}`}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 border border-slate-200 transition-colors shrink-0"
            title="View user activity & audit log"
          >
            <History size={14} className="text-slate-600" />
            View User Log
          </Link>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Identity & Basic Info */}
          <div className="space-y-3">
            <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wider border-b border-slate-100 pb-1.5">
              Profile Name
            </h4>
            <div>
              <label htmlFor="user-detail-fullName" className="block text-xs font-medium text-slate-700 mb-1">
                Full Name
              </label>
              <input
                id="user-detail-fullName"
                type="text"
                required
                value={form.fullName}
                onChange={setField('fullName')}
                className={inputClass}
              />
            </div>
          </div>

          {/* Contact Details */}
          <div className="space-y-3">
            <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wider border-b border-slate-100 pb-1.5">
              Contact Details
            </h4>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label htmlFor="user-detail-phone" className="block text-xs font-medium text-slate-700 mb-1">
                  Primary Phone
                </label>
                <input
                  id="user-detail-phone"
                  type="tel"
                  value={form.phone}
                  onChange={setField('phone')}
                  placeholder="+91 98765 43210"
                  className={inputClass}
                />
              </div>
              <div>
                <label htmlFor="user-detail-altPhone" className="block text-xs font-medium text-slate-700 mb-1">
                  Alternate Phone
                </label>
                <input
                  id="user-detail-altPhone"
                  type="tel"
                  value={form.altPhone}
                  onChange={setField('altPhone')}
                  placeholder="+91 91234 56789"
                  className={inputClass}
                />
              </div>
              <div>
                <label htmlFor="user-detail-email" className="block text-xs font-medium text-slate-700 mb-1">
                  Contact Email
                </label>
                <input
                  id="user-detail-email"
                  type="email"
                  value={form.email}
                  onChange={setField('email')}
                  placeholder="user@example.com"
                  className={inputClass}
                />
              </div>
              <div>
                <label htmlFor="user-detail-city" className="block text-xs font-medium text-slate-700 mb-1">
                  City / Region
                </label>
                <input
                  id="user-detail-city"
                  type="text"
                  value={form.city}
                  onChange={setField('city')}
                  placeholder="Madurai, Tamil Nadu"
                  className={inputClass}
                />
              </div>
              <div className="sm:col-span-2">
                <label htmlFor="user-detail-address" className="block text-xs font-medium text-slate-700 mb-1">
                  Office / Address
                </label>
                <input
                  id="user-detail-address"
                  type="text"
                  value={form.address}
                  onChange={setField('address')}
                  placeholder="Branch location or residence address"
                  className={inputClass}
                />
              </div>
              <div className="sm:col-span-2">
                <label htmlFor="user-detail-emergencyContact" className="block text-xs font-medium text-slate-700 mb-1">
                  Emergency Contact
                </label>
                <input
                  id="user-detail-emergencyContact"
                  type="text"
                  value={form.emergencyContact}
                  onChange={setField('emergencyContact')}
                  placeholder="Contact Name & Number"
                  className={inputClass}
                />
              </div>
            </div>
          </div>

          {/* Metadata */}
          <div className="space-y-3">
            <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wider border-b border-slate-100 pb-1.5">
              Operational Metadata
            </h4>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label htmlFor="user-detail-department" className="block text-xs font-medium text-slate-700 mb-1">
                  Department
                </label>
                <input
                  id="user-detail-department"
                  type="text"
                  value={form.department}
                  onChange={setField('department')}
                  placeholder="Academics, Training, Accounts"
                  className={inputClass}
                />
              </div>
              <div>
                <label htmlFor="user-detail-designation" className="block text-xs font-medium text-slate-700 mb-1">
                  Designation
                </label>
                <input
                  id="user-detail-designation"
                  type="text"
                  value={form.designation}
                  onChange={setField('designation')}
                  placeholder="Instructor, Coordinator"
                  className={inputClass}
                />
              </div>
              <div>
                <label htmlFor="user-detail-employeeId" className="block text-xs font-medium text-slate-700 mb-1">
                  Employee / Staff ID
                </label>
                <input
                  id="user-detail-employeeId"
                  type="text"
                  value={form.employeeId}
                  onChange={setField('employeeId')}
                  placeholder="EMP-012"
                  className={`${inputClass} font-mono`}
                />
              </div>
              <div className="sm:col-span-2">
                <label htmlFor="user-detail-bio" className="block text-xs font-medium text-slate-700 mb-1">
                  Bio / Notes
                </label>
                <textarea
                  id="user-detail-bio"
                  rows={2}
                  value={form.bio}
                  onChange={setField('bio')}
                  placeholder="Operational notes or user bio"
                  className={inputClass}
                />
              </div>
            </div>

            {/* Custom Metadata Key-Values */}
            <div className="pt-2 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-semibold text-slate-600 uppercase">Custom Metadata Attributes</span>
                <button
                  type="button"
                  onClick={() => setCustomMeta((prev) => [...prev, { id: newCustomMetaId(), key: '', value: '' }])}
                  className="text-xs text-teal-600 hover:text-teal-700 font-medium inline-flex items-center gap-1"
                >
                  <Plus size={12} /> Add Attribute
                </button>
              </div>
              {form.customMeta.map((item) => (
                <div key={item.id} className="flex items-center gap-2">
                  <input
                    type="text"
                    placeholder="Key"
                    value={item.key}
                    onChange={(e) =>
                      setCustomMeta((prev) => prev.map((c) => (c.id === item.id ? { ...c, key: e.target.value } : c)))
                    }
                    className="w-1/3 px-2.5 py-1 text-xs font-mono border border-slate-300 rounded-md"
                  />
                  <input
                    type="text"
                    placeholder="Value"
                    value={item.value}
                    onChange={(e) =>
                      setCustomMeta((prev) => prev.map((c) => (c.id === item.id ? { ...c, value: e.target.value } : c)))
                    }
                    className="flex-1 px-2.5 py-1 text-xs border border-slate-300 rounded-md"
                  />
                  <button
                    type="button"
                    onClick={() => setCustomMeta((prev) => prev.filter((c) => c.id !== item.id))}
                    className="p-1 text-slate-400 hover:text-rose-600"
                  >
                    <Trash2 size={13} />
                  </button>
                </div>
              ))}
            </div>
          </div>

          {/* Account Access & Danger Zone */}
          {user.id !== currentUserId && (
            <div className="rounded-xl border border-rose-200 bg-rose-50/50 p-4 space-y-3">
              <div className="flex items-center gap-2">
                <ShieldAlert size={16} className="text-rose-600" />
                <h4 className="text-xs font-bold text-rose-950 uppercase tracking-wider">
                  Account Access & Management
                </h4>
              </div>
              <p className="text-xs text-rose-700">
                Revoke access to immediately suspend this user from accessing the system, or permanently remove their
                account.
              </p>
              <div className="flex flex-wrap items-center gap-2.5 pt-1">
                {user.role !== 'pending' ? (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    disabled={accessBusy}
                    onClick={() => onRevokeAccess(user.id)}
                    className="text-xs font-semibold border-amber-300 text-amber-900 hover:bg-amber-100 bg-white"
                    title="Demote to Pending approval"
                  >
                    <UserMinus size={14} className="mr-1.5 text-amber-700" />
                    {revokingUserId === user.id ? 'Revoking...' : 'Revoke Access (Set Pending)'}
                  </Button>
                ) : (
                  <span className="text-xs font-medium text-amber-800 bg-amber-100/70 px-2.5 py-1 rounded-md border border-amber-200">
                    Access is currently revoked (Pending)
                  </span>
                )}

                <Button
                  type="button"
                  variant="destructive"
                  size="sm"
                  disabled={accessBusy}
                  onClick={() => onRequestDisable(user)}
                  className="text-xs font-semibold shadow-xs"
                  title="Disable this account (history is kept)"
                >
                  <Trash2 size={14} className="mr-1.5" />
                  Disable User
                </Button>
              </div>
            </div>
          )}

          <div className="flex items-center justify-end gap-2 pt-4 border-t border-slate-100">
            <Button type="button" variant="ghost" size="sm" onClick={onClose} className="text-xs text-slate-600">
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={saving}
              size="sm"
              className="text-xs font-semibold bg-teal-700 hover:bg-teal-800 text-white shadow-xs"
            >
              {saving ? 'Saving...' : 'Save User Details'}
            </Button>
          </div>
        </form>
      </div>
    </div>
  )
}
