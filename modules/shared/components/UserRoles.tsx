'use client'

import { useState } from 'react'
import { AlertCircle, Check } from 'lucide-react'
import type { Role } from '@/lib/types'
import { ConfirmDialog } from '@/components/ui/ConfirmDialog'
import { apiErrorMessage } from '@/lib/api/error-message'
import {
  filterUsers,
  initialFilterTab,
  isActiveInvite,
  pendingRoleChanges,
  type FilterTab,
  type UserDetailsPayload,
  type UserProfile,
} from './user-roles/model'
import { useInviteCodes } from './user-roles/useInviteCodes'
import { RoleFilterTabs } from './user-roles/RoleFilterTabs'
import { InviteCodesPanel } from './user-roles/InviteCodesPanel'
import { UsersTable } from './user-roles/UsersTable'
import { GenerateInviteModal } from './user-roles/GenerateInviteModal'
import { EditUserModal } from './user-roles/EditUserModal'

async function patchUser(body: Record<string, unknown>, fallback: string) {
  const res = await fetch('/api/admin/users', {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  const result = await res.json().catch(() => null)
  if (!res.ok) throw new Error(apiErrorMessage(result, fallback))
}

export function UserRoles({
  users,
  currentUserId,
  initialFilter,
}: {
  users: UserProfile[]
  currentUserId: string
  initialFilter?: string
}) {
  // savedRows mirror the server; rows hold unsaved role selections.
  const [savedRows, setSavedRows] = useState<UserProfile[]>(users)
  const [rows, setRows] = useState<UserProfile[]>(users)
  const [search, setSearch] = useState('')
  const [activeTab, setActiveTab] = useState<FilterTab>(initialFilterTab(initialFilter))
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [saving, setSaving] = useState(false)
  const [approvingId, setApprovingId] = useState<string | null>(null)
  const [showGenerateModal, setShowGenerateModal] = useState(false)
  const [editingUser, setEditingUser] = useState<UserProfile | null>(null)
  const [revokingUserId, setRevokingUserId] = useState<string | null>(null)
  const [confirmDeleteUser, setConfirmDeleteUser] = useState<UserProfile | null>(null)
  const [deletingUserId, setDeletingUserId] = useState<string | null>(null)

  const flashSuccess = (message: string, durationMs: number) => {
    setSuccess(message)
    setTimeout(() => setSuccess(''), durationMs)
  }
  const invites = useInviteCodes({ onError: setError, onSuccess: flashSuccess })

  /** Applies a saved change to both the saved and the edited rows. */
  const updateUser = (userId: string, change: (user: UserProfile) => UserProfile) => {
    const apply = (user: UserProfile) => (user.id === userId ? change(user) : user)
    setRows((current) => current.map(apply))
    setSavedRows((current) => current.map(apply))
  }

  const pendingChanges = pendingRoleChanges(rows, savedRows)
  const changedCount = Object.keys(pendingChanges).length

  const handleSaveUserDetails = async (payload: UserDetailsPayload) => {
    if (!editingUser) return
    setError('')
    setSuccess('')
    try {
      await patchUser({ userId: editingUser.id, ...payload }, 'Failed to update user settings.')
      updateUser(editingUser.id, (user) => ({
        ...user,
        full_name: payload.fullName,
        contact_details: payload.contactDetails,
        metadata: payload.metadata,
      }))
      setEditingUser(null)
      flashSuccess(`Updated contact details and metadata for ${payload.fullName || editingUser.id}.`, 5000)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update user settings.')
    }
  }

  const handleRevokeUserAccess = async (userId: string) => {
    setRevokingUserId(userId)
    setError('')
    try {
      await patchUser({ userId, role: 'pending' }, 'Failed to revoke user access.')
      updateUser(userId, (user) => ({ ...user, role: 'pending' as Role }))
      if (editingUser?.id === userId) {
        setEditingUser((prev) => (prev ? { ...prev, role: 'pending' as Role } : null))
      }
      flashSuccess('User access has been revoked. Account is now set to Pending approval.', 5000)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to revoke user access.')
    } finally {
      setRevokingUserId(null)
    }
  }

  const handleRemoveUser = async () => {
    if (!confirmDeleteUser) return
    const userId = confirmDeleteUser.id
    setDeletingUserId(userId)
    setError('')
    try {
      const res = await fetch(`/api/admin/users?userId=${encodeURIComponent(userId)}`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
      })
      const result = await res.json().catch(() => null)
      if (!res.ok) {
        throw new Error(apiErrorMessage(result, 'Failed to disable user account.'))
      }
      const disabledAt = new Date().toISOString()
      updateUser(userId, (user) => ({ ...user, role: 'pending' as Role, disabled_at: user.disabled_at ?? disabledAt }))
      if (editingUser?.id === userId) {
        setEditingUser(null)
      }
      setConfirmDeleteUser(null)
      flashSuccess(
        `User "${confirmDeleteUser.full_name || userId}" has been disabled. Their history stays in the audit log; approve them again to restore access.`,
        5000,
      )
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to disable user.')
    } finally {
      setDeletingUserId(null)
    }
  }

  const handleRoleSelect = (userId: string, newRole: Role) => {
    setError('')
    setSuccess('')
    setRows((current) => current.map((row) => (row.id === userId ? { ...row, role: newRole } : row)))
  }

  const handleDiscard = () => {
    setRows(savedRows)
    setError('')
    setSuccess('')
  }

  const handleQuickApprove = async (userId: string, role: Role) => {
    const selectedUser = rows.find((r) => r.id === userId)
    setApprovingId(userId)
    setError('')
    setSuccess('')
    try {
      await patchUser({ userId, role }, `Failed to approve user ${userId}.`)
      updateUser(userId, (user) => ({ ...user, role, disabled_at: null }))
      flashSuccess(
        `Approved ${selectedUser?.full_name || 'user'} as ${role.toUpperCase()}. Access has been activated.`,
        6000,
      )
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Approval failed. Please try again.')
    } finally {
      setApprovingId(null)
    }
  }

  const handleSave = async () => {
    if (changedCount === 0) return
    setSaving(true)
    setError('')
    setSuccess('')
    try {
      await Promise.all(
        Object.entries(pendingChanges).map(([userId, role]) =>
          patchUser({ userId, role }, `Failed to update role for user ${userId}.`),
        ),
      )
      setSavedRows(rows)
      flashSuccess(
        changedCount === 1
          ? 'User role updated successfully. The change was recorded in the audit log.'
          : `${changedCount} user roles updated successfully. Changes were recorded in the audit log.`,
        5000,
      )
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Role update failed. Please try again.')
    } finally {
      setSaving(false)
    }
  }

  const counts = {
    all: rows.length,
    pending: rows.filter((r) => r.role === 'pending').length,
    staff: rows.filter((r) => r.role === 'staff').length,
    admin: rows.filter((r) => r.role === 'admin').length,
    activeInvites: invites.inviteCodes.filter((code) => isActiveInvite(code)).length,
  }

  return (
    <section className="space-y-6">
      <RoleFilterTabs
        activeTab={activeTab}
        onChange={setActiveTab}
        counts={counts}
        onGenerateInvite={() => setShowGenerateModal(true)}
      />

      {/* Notifications */}
      {error && (
        <div
          role="alert"
          className="flex items-start gap-2.5 p-3 rounded-lg bg-red-50 border border-red-200 text-xs text-red-700 animate-in fade-in"
        >
          <AlertCircle size={16} className="shrink-0 mt-0.5 text-red-600" />
          <span>{error}</span>
        </div>
      )}

      {success && (
        <div
          role="status"
          className="flex items-center gap-2.5 p-3 rounded-lg bg-emerald-50 border border-emerald-200 text-xs text-emerald-800 animate-in fade-in"
        >
          <Check size={16} className="shrink-0 text-emerald-600" />
          <span>{success}</span>
        </div>
      )}

      {activeTab === 'invites' ? (
        <InviteCodesPanel
          inviteCodes={invites.inviteCodes}
          loading={invites.loading}
          revokingId={invites.revokingId}
          onRevoke={invites.revoke}
          onNewCode={() => setShowGenerateModal(true)}
        />
      ) : (
        <UsersTable
          users={filterUsers(rows, activeTab, search)}
          totalUsers={rows.length}
          activeTab={activeTab}
          search={search}
          onSearchChange={setSearch}
          currentUserId={currentUserId}
          pendingChanges={pendingChanges}
          saving={saving}
          approvingId={approvingId}
          revokingUserId={revokingUserId}
          onRoleSelect={handleRoleSelect}
          onDiscard={handleDiscard}
          onSave={handleSave}
          onEdit={setEditingUser}
          onRevokeAccess={handleRevokeUserAccess}
          onQuickApprove={handleQuickApprove}
        />
      )}

      {showGenerateModal && (
        <GenerateInviteModal onGenerate={invites.generate} onClose={() => setShowGenerateModal(false)} />
      )}

      {editingUser && (
        <EditUserModal
          user={editingUser}
          currentUserId={currentUserId}
          revokingUserId={revokingUserId}
          deletingUserId={deletingUserId}
          onClose={() => setEditingUser(null)}
          onSave={handleSaveUserDetails}
          onRevokeAccess={handleRevokeUserAccess}
          onRequestDisable={setConfirmDeleteUser}
        />
      )}

      {confirmDeleteUser && (
        <ConfirmDialog
          isOpen={true}
          title={`Disable User "${confirmDeleteUser.full_name || confirmDeleteUser.id}"?`}
          description="This signs the user out of the dashboard and blocks future sign-ins. Their profile and everything they did stay in the audit log. You can restore access later by approving them again."
          confirmText={deletingUserId ? 'Disabling...' : 'Disable User'}
          cancelText="Cancel"
          destructive={true}
          onConfirm={handleRemoveUser}
          onCancel={() => !deletingUserId && setConfirmDeleteUser(null)}
        />
      )}
    </section>
  )
}
