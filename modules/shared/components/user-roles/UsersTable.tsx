'use client'

import Link from 'next/link'
import {
  Building,
  Check,
  Clock,
  History,
  Mail,
  Phone,
  RotateCcw,
  Save,
  Search,
  Shield,
  UserCheck,
  UserCog,
  UserMinus,
} from 'lucide-react'
import type { Role } from '@/lib/types'
import { Button } from '@/components/ui/button'
import type { FilterTab, UserProfile } from './model'

export function UsersTable({
  users,
  totalUsers,
  activeTab,
  search,
  onSearchChange,
  currentUserId,
  pendingChanges,
  saving,
  approvingId,
  revokingUserId,
  onRoleSelect,
  onDiscard,
  onSave,
  onEdit,
  onRevokeAccess,
  onQuickApprove,
}: {
  /** Users after the tab and search filters. */
  users: UserProfile[]
  totalUsers: number
  activeTab: FilterTab
  search: string
  onSearchChange: (value: string) => void
  currentUserId: string
  pendingChanges: Record<string, Role>
  saving: boolean
  approvingId: string | null
  revokingUserId: string | null
  onRoleSelect: (userId: string, role: Role) => void
  onDiscard: () => void
  onSave: () => void
  onEdit: (user: UserProfile) => void
  onRevokeAccess: (userId: string) => void
  onQuickApprove: (userId: string, role: Role) => void
}) {
  const changedCount = Object.keys(pendingChanges).length
  const hasChanges = changedCount > 0

  return (
    <>
      {/* Top Controls: Instructions, Search, and Save Button */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 p-4 rounded-[22px] border border-[var(--border)] bg-[var(--card)] shadow-xs">
        <div className="space-y-1">
          <div>
            <span className="text-xs font-semibold text-[var(--ink)]">
              {hasChanges
                ? `${changedCount} unsaved role ${changedCount === 1 ? 'change' : 'changes'}`
                : 'All user roles synchronized'}
            </span>
          </div>
          <p className="text-xs text-[var(--mute)]">
            Role changes require an admin account. Your own role cannot be changed here, and at least one admin must
            remain.
          </p>
        </div>

        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5 shrink-0">
          <div className="relative">
            <Search
              size={15}
              className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[var(--mute)] pointer-events-none"
            />
            <input
              aria-label="Search name, ID, or role"
              type="text"
              value={search}
              onChange={(e) => onSearchChange(e.target.value)}
              placeholder="Search name, ID, or role..."
              className="w-full sm:w-60 pl-9 pr-3.5 py-2 border border-[var(--border)] rounded-full text-xs text-[var(--ink)] placeholder:text-[var(--mute)] focus:outline-none focus:ring-2 focus:ring-[var(--g1)] transition-colors bg-[var(--panel)]"
            />
          </div>

          <div className="flex items-center gap-2">
            {hasChanges && (
              <button
                type="button"
                onClick={onDiscard}
                disabled={saving || approvingId !== null}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-full text-xs font-semibold text-[var(--mute)] hover:text-[var(--ink)] hover:bg-[var(--panel)] transition-colors cursor-pointer"
              >
                <RotateCcw size={13} className="mr-1" />
                Discard
              </button>
            )}

            <button
              type="button"
              onClick={onSave}
              disabled={!hasChanges || saving || approvingId !== null}
              className="inline-flex items-center justify-center gap-1.5 px-4 py-2 rounded-full text-xs font-semibold bg-[var(--g1)] text-white hover:opacity-90 transition-opacity shadow-xs cursor-pointer disabled:opacity-50"
            >
              {saving ? (
                'Saving...'
              ) : (
                <>
                  <Save size={14} className="mr-1.5" />
                  Save Changes
                </>
              )}
            </button>
          </div>
        </div>
      </div>

      {/* Table wrapper with card styling */}
      <div
        className="bg-[var(--card)] rounded-xl shadow-xs border border-[var(--border)] overflow-x-auto w-full"
        role="region"
        aria-label="Users and roles"
        tabIndex={0}
      >
        <table className="min-w-[640px] w-full divide-y divide-gray-200">
          <caption className="sr-only">Users and assigned roles</caption>
          <thead className="bg-gray-50/80">
            <tr>
              <th
                scope="col"
                className="px-6 py-3.5 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider"
              >
                User
              </th>
              <th
                scope="col"
                className="px-6 py-3.5 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider"
              >
                Role
              </th>
              <th
                scope="col"
                className="px-6 py-3.5 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider"
              >
                Created
              </th>
              <th
                scope="col"
                className="px-6 py-3.5 text-right text-xs font-semibold text-gray-500 uppercase tracking-wider"
              >
                Quick Actions
              </th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-100">
            {users.map((user) => {
              const isModified = pendingChanges[user.id] !== undefined
              const isSelf = user.id === currentUserId
              const isPending = user.role === 'pending'
              const isApproving = approvingId === user.id

              return (
                <tr
                  key={user.id}
                  className={`hover:bg-gray-50/70 transition-colors ${
                    isPending ? 'bg-amber-50/20' : isModified ? 'bg-amber-50/40' : ''
                  }`}
                >
                  <th scope="row" className="px-6 py-4 whitespace-nowrap text-left font-medium">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-semibold text-slate-900">{user.full_name || 'Unnamed user'}</span>
                      {user.disabled_at && (
                        <span className="text-[10px] font-semibold bg-red-50 text-red-700 px-1.5 py-0.5 rounded border border-red-200">
                          Disabled
                        </span>
                      )}
                      {isSelf && (
                        <span className="text-[10px] font-semibold bg-slate-100 text-slate-600 px-1.5 py-0.5 rounded border border-slate-200">
                          You
                        </span>
                      )}
                      {isPending && (
                        <span className="inline-flex items-center gap-1 text-[10px] font-semibold bg-amber-100 text-amber-800 px-2 py-0.5 rounded-full border border-amber-200">
                          <Clock size={10} className="text-amber-600" />
                          Awaiting Approval
                        </span>
                      )}
                      {isModified && (
                        <span className="text-[10px] font-semibold bg-amber-100 text-amber-800 px-1.5 py-0.5 rounded border border-amber-200 animate-in fade-in">
                          Unsaved
                        </span>
                      )}
                    </div>
                    <span className="block mt-0.5 text-xs text-gray-400 font-mono">{user.id}</span>
                    {(user.contact_details?.phone || user.contact_details?.email || user.metadata?.department) && (
                      <div className="flex flex-wrap items-center gap-2 mt-1.5 text-[11px] text-slate-500">
                        {user.contact_details?.phone && (
                          <span className="inline-flex items-center gap-1 font-mono text-slate-600 bg-slate-100 px-1.5 py-0.5 rounded">
                            <Phone size={10} className="text-slate-400" />
                            {user.contact_details.phone}
                          </span>
                        )}
                        {user.contact_details?.email && (
                          <span className="inline-flex items-center gap-1 text-slate-600">
                            <Mail size={10} className="text-slate-400" />
                            {user.contact_details.email}
                          </span>
                        )}
                        {user.metadata?.department && (
                          <span className="inline-flex items-center gap-1 bg-teal-50 text-teal-800 px-1.5 py-0.5 rounded border border-teal-200 text-[10px] font-medium">
                            <Building size={10} className="text-teal-600" />
                            {user.metadata.department}
                          </span>
                        )}
                      </div>
                    )}
                  </th>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <label className="sr-only" htmlFor={`role-${user.id}`}>
                      Role for {user.full_name || user.id}
                    </label>
                    <select
                      id={`role-${user.id}`}
                      className={`border rounded-lg shadow-2xs px-2.5 py-1 text-sm font-medium transition-colors ${
                        isPending
                          ? 'border-amber-300 bg-amber-50/50 text-amber-900 font-semibold'
                          : isModified
                            ? 'border-amber-400 bg-amber-50/60 text-amber-900 focus:ring-amber-500/20'
                            : 'border-gray-300 bg-white text-slate-800 focus:ring-indigo-500/20'
                      }`}
                      value={user.role}
                      disabled={saving || approvingId !== null || isSelf}
                      onChange={(event) => onRoleSelect(user.id, event.target.value as Role)}
                    >
                      <option value="admin">Admin</option>
                      <option value="staff">Staff</option>
                      <option value="pending">Pending</option>
                    </select>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-xs text-slate-500 font-mono">
                    {user.created_at ? new Date(user.created_at).toLocaleDateString('en-IN') : '—'}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-right space-x-1.5">
                    <Link
                      href={`/audit-log?userName=${encodeURIComponent(user.full_name || '')}&search=${encodeURIComponent(user.id)}`}
                      className="inline-flex items-center justify-center px-2.5 py-1 text-xs font-medium text-slate-700 hover:text-slate-900 border border-slate-200 rounded-md hover:bg-slate-50 transition-colors"
                      title="View user activity and audit log"
                    >
                      <History size={13} className="mr-1 text-slate-500" />
                      User Log
                    </Link>
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      onClick={() => onEdit(user)}
                      className="text-xs text-slate-700 hover:text-slate-900 border-slate-200 hover:bg-slate-50 px-2.5 py-1"
                      title="Edit user settings, contact details & metadata"
                    >
                      <UserCog size={13} className="mr-1 text-slate-500" />
                      Settings & Info
                    </Button>
                    {!isSelf && user.role !== 'pending' && (
                      <Button
                        type="button"
                        size="sm"
                        variant="ghost"
                        disabled={saving || revokingUserId === user.id}
                        onClick={() => onRevokeAccess(user.id)}
                        className="text-xs text-amber-700 hover:text-amber-900 hover:bg-amber-50 px-2 py-1"
                        title="Revoke access immediately (demote to Pending)"
                      >
                        <UserMinus size={13} className="mr-1 text-amber-600" />
                        {revokingUserId === user.id ? 'Revoking...' : 'Revoke'}
                      </Button>
                    )}
                    {isPending && (
                      <div className="inline-flex items-center gap-1.5">
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          disabled={saving || isApproving}
                          onClick={() => onQuickApprove(user.id, 'staff')}
                          className="text-xs font-semibold border-amber-300 bg-amber-50 hover:bg-amber-100 text-amber-900 hover:border-amber-400 shadow-2xs"
                          title="Approve user with Staff privileges"
                        >
                          {isApproving ? (
                            'Approving...'
                          ) : (
                            <>
                              <UserCheck size={14} className="mr-1 text-amber-700" />
                              Approve as Staff
                            </>
                          )}
                        </Button>
                        <Button
                          type="button"
                          size="sm"
                          disabled={saving || isApproving}
                          onClick={() => onQuickApprove(user.id, 'admin')}
                          className="text-xs font-semibold bg-purple-600 hover:bg-purple-700 text-white shadow-2xs px-2.5 py-1"
                          title="Approve user with Administrator privileges"
                        >
                          {isApproving ? (
                            'Approving...'
                          ) : (
                            <>
                              <Shield size={13} className="mr-1 text-purple-200" />
                              Approve as Admin
                            </>
                          )}
                        </Button>
                      </div>
                    )}
                  </td>
                </tr>
              )
            })}
            {users.length === 0 && (
              <tr>
                <td colSpan={4} className="px-6 py-12 text-center text-sm text-gray-500">
                  {activeTab === 'pending' ? (
                    <div className="flex flex-col items-center justify-center space-y-2">
                      <div className="w-10 h-10 rounded-full bg-emerald-50 text-emerald-600 flex items-center justify-center">
                        <Check size={20} />
                      </div>
                      <p className="font-medium text-slate-800">No pending approvals</p>
                      <p className="text-xs text-slate-500">All registered users have been approved or reviewed.</p>
                    </div>
                  ) : totalUsers === 0 ? (
                    'No users found.'
                  ) : (
                    'No users match your search and filter criteria.'
                  )}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Sticky/bottom Action Bar when changes exist on longer tables */}
      {hasChanges && (
        <div className="flex items-center justify-between p-3.5 rounded-xl border border-amber-200 bg-amber-50/70 text-xs shadow-xs animate-in fade-in">
          <span className="font-medium text-amber-900">
            You have {changedCount} pending role {changedCount === 1 ? 'change' : 'changes'}. Click &quot;Save
            Changes&quot; to apply.
          </span>
          <div className="flex items-center gap-2">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={onDiscard}
              disabled={saving || approvingId !== null}
              className="text-xs text-amber-900 hover:bg-amber-100"
            >
              Discard
            </Button>
            <Button
              type="button"
              variant="default"
              size="sm"
              onClick={onSave}
              disabled={saving || approvingId !== null}
              className="text-xs font-semibold shadow-xs"
            >
              {saving ? 'Saving...' : 'Save Changes'}
            </Button>
          </div>
        </div>
      )}
    </>
  )
}
