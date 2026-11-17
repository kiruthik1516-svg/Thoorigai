'use client'

import React, { useState } from 'react'
import { UserCheck, ShieldAlert, Trash2, KeyRound, AlertCircle, Plus, Check } from 'lucide-react'
import type { UserRolesManagerProps } from './types'

export function UserRolesManager({
  users: initialUsers,
  availableRoles,
  adminUsersEndpoint = '/api/admin/users',
  adminInvitesEndpoint = '/api/admin/invite-codes',
  currentUserId,
}: UserRolesManagerProps) {
  const [users, setUsers] = useState(initialUsers)
  const [updatingId, setUpdatingId] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)

  // Invite generation state
  const [isInviteModalOpen, setIsInviteModalOpen] = useState(false)
  const [inviteRole, setInviteRole] = useState(availableRoles[0]?.value || 'staff')
  const [inviteEmail, setInviteEmail] = useState('')
  const [inviteDays, setInviteDays] = useState(7)
  const [generatedInvite, setGeneratedInvite] = useState<string | null>(null)
  const [generatingInvite, setGeneratingInvite] = useState(false)

  const handleRoleChange = async (userId: string, newRole: string) => {
    setError(null)
    setSuccess(null)
    setUpdatingId(userId)

    const prevUsers = [...users]
    setUsers((current) => current.map((u) => (u.id === userId ? { ...u, role: newRole } : u)))

    try {
      const response = await fetch(adminUsersEndpoint, {
        method: 'PATCH',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ userId, role: newRole }),
      })

      if (!response.ok) {
        const data = await response.json().catch(() => null)
        throw new Error(data?.error || 'Failed to update user role.')
      }

      setSuccess('User role updated successfully.')
      setTimeout(() => setSuccess(null), 3000)
    } catch (err) {
      setUsers(prevUsers) // Revert optimistic update
      setError(err instanceof Error ? err.message : 'Failed to update user role.')
    } finally {
      setUpdatingId(null)
    }
  }

  const handleDeleteUser = async (userId: string, name: string | null) => {
    if (!confirm(`Are you sure you want to remove ${name || 'this user'}? This action cannot be undone.`)) {
      return
    }

    setError(null)
    setUpdatingId(userId)

    try {
      const response = await fetch(`${adminUsersEndpoint}?userId=${encodeURIComponent(userId)}`, {
        method: 'DELETE',
      })

      if (!response.ok) {
        const data = await response.json().catch(() => null)
        throw new Error(data?.error || 'Failed to delete user.')
      }

      setUsers((current) => current.filter((u) => u.id !== userId))
      setSuccess('User removed successfully.')
      setTimeout(() => setSuccess(null), 3000)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete user.')
    } finally {
      setUpdatingId(null)
    }
  }

  const handleCreateInvite = async (e: React.FormEvent) => {
    e.preventDefault()
    setGeneratingInvite(true)
    setError(null)

    try {
      const response = await fetch(adminInvitesEndpoint, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          role: inviteRole,
          recipientEmail: inviteEmail.trim() || undefined,
          expiresInDays: inviteDays,
        }),
      })

      const data = await response.json().catch(() => null)
      if (!response.ok) {
        throw new Error(data?.error || 'Failed to generate invite code.')
      }

      setGeneratedInvite(data.data.code)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to generate invite code.')
    } finally {
      setGeneratingInvite(false)
    }
  }

  return (
    <div className="w-full space-y-4">
      {/* Header & Controls */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h2 className="text-base font-bold text-slate-900">User Access & Roles</h2>
          <p className="text-xs text-slate-500">
            Manage permission levels, clear pending accounts, or issue invite codes.
          </p>
        </div>
        <button
          onClick={() => {
            setGeneratedInvite(null)
            setIsInviteModalOpen(true)
          }}
          className="inline-flex items-center gap-1.5 py-2 px-3 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold shadow-xs transition-colors self-start sm:self-auto cursor-pointer"
        >
          <Plus size={15} />
          <span>Generate Invite Code</span>
        </button>
      </div>

      {error && (
        <div className="flex items-start gap-2.5 p-3 rounded-xl bg-red-50 border border-red-200 text-red-700 text-xs">
          <AlertCircle size={15} className="shrink-0 mt-0.5" />
          <span>{error}</span>
        </div>
      )}

      {success && (
        <div className="flex items-start gap-2.5 p-3 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-700 text-xs">
          <Check size={15} className="shrink-0 mt-0.5" />
          <span>{success}</span>
        </div>
      )}

      {/* Users Table */}
      <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white">
        <table className="w-full text-left border-collapse text-xs">
          <thead>
            <tr className="border-b border-slate-200 bg-slate-50/70 text-slate-600 font-semibold">
              <th className="py-2.5 px-3">Name</th>
              <th className="py-2.5 px-3">Status / Role</th>
              <th className="py-2.5 px-3">Change Role</th>
              <th className="py-2.5 px-3 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {users.map((user) => {
              const isPending = user.role === 'pending'
              const isSelf = user.id === currentUserId
              const isUpdating = updatingId === user.id

              return (
                <tr key={user.id} className="hover:bg-slate-50/50 transition-colors">
                  <td className="py-3 px-3">
                    <div className="font-semibold text-slate-900">{user.full_name || 'Unnamed User'}</div>
                    <div className="text-[11px] text-slate-400 font-mono">{user.id.slice(0, 8)}...</div>
                  </td>
                  <td className="py-3 px-3">
                    <span
                      className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                        isPending
                          ? 'bg-amber-100 text-amber-900'
                          : user.role === 'admin'
                            ? 'bg-purple-100 text-purple-900'
                            : 'bg-blue-100 text-blue-900'
                      }`}
                    >
                      {user.role}
                    </span>
                  </td>
                  <td className="py-3 px-3">
                    <select
                      value={user.role}
                      disabled={isUpdating || isSelf}
                      onChange={(e) => handleRoleChange(user.id, e.target.value)}
                      className="py-1 px-2 text-xs rounded-lg border border-slate-300 bg-white text-slate-800 disabled:opacity-50 focus:outline-none focus:ring-1 focus:ring-slate-900"
                    >
                      {isPending && <option value="pending">Pending Clearance</option>}
                      {availableRoles.map((role) => (
                        <option key={role.value} value={role.value}>
                          {role.label}
                        </option>
                      ))}
                    </select>
                  </td>
                  <td className="py-3 px-3 text-right">
                    {!isSelf && (
                      <button
                        onClick={() => handleDeleteUser(user.id, user.full_name)}
                        disabled={isUpdating}
                        className="p-1.5 text-slate-400 hover:text-red-600 rounded-lg hover:bg-red-50 transition-colors"
                        title="Delete user"
                      >
                        <Trash2 size={15} />
                      </button>
                    )}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      {/* Generate Invite Modal */}
      {isInviteModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="w-full max-w-sm bg-white rounded-2xl p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-bold text-slate-900 flex items-center gap-1.5">
                <KeyRound size={16} className="text-indigo-600" />
                <span>Create Invite Code</span>
              </h3>
              <button
                onClick={() => setIsInviteModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 text-xs font-semibold"
              >
                ✕
              </button>
            </div>

            {generatedInvite ? (
              <div className="p-4 rounded-xl bg-indigo-50 border border-indigo-200 text-center space-y-2">
                <p className="text-xs text-indigo-700 font-medium">One-Time Invite Code Generated:</p>
                <div className="text-lg font-mono font-extrabold tracking-widest text-indigo-950 bg-white p-2 rounded-lg border border-indigo-300 select-all">
                  {generatedInvite}
                </div>
                <p className="text-[11px] text-indigo-600">
                  Share this code with the recipient. It will expire in {inviteDays} days.
                </p>
                <button
                  type="button"
                  onClick={() => setIsInviteModalOpen(false)}
                  className="w-full mt-2 py-2 px-3 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold"
                >
                  Done
                </button>
              </div>
            ) : (
              <form onSubmit={handleCreateInvite} className="space-y-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Target Role</label>
                  <select
                    value={inviteRole}
                    onChange={(e) => setInviteRole(e.target.value)}
                    className="w-full py-1.5 px-2 text-xs rounded-xl border border-slate-300"
                  >
                    {availableRoles.map((role) => (
                      <option key={role.value} value={role.value}>
                        {role.label}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Restrict to Email (Optional)
                  </label>
                  <input
                    type="email"
                    value={inviteEmail}
                    onChange={(e) => setInviteEmail(e.target.value)}
                    placeholder="user@example.com"
                    className="w-full py-1.5 px-3 text-xs rounded-xl border border-slate-300"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Expires After (Days)</label>
                  <input
                    type="number"
                    min={1}
                    max={90}
                    value={inviteDays}
                    onChange={(e) => setInviteDays(Number(e.target.value))}
                    className="w-full py-1.5 px-3 text-xs rounded-xl border border-slate-300"
                  />
                </div>

                <div className="flex justify-end gap-2 pt-2">
                  <button
                    type="button"
                    onClick={() => setIsInviteModalOpen(false)}
                    className="py-1.5 px-3 rounded-xl border border-slate-200 text-xs font-semibold text-slate-600 hover:bg-slate-50"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={generatingInvite}
                    className="py-1.5 px-3 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold"
                  >
                    {generatingInvite ? 'Generating...' : 'Create Code'}
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
