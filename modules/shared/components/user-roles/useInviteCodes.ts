'use client'

import { useCallback, useEffect, useState } from 'react'
import type { InviteCode } from '@/lib/types'
import { apiErrorMessage } from '@/lib/api/error-message'
import type { GeneratedInvite } from './model'

type Notify = { onError: (message: string) => void; onSuccess: (message: string, durationMs: number) => void }

export type GenerateInviteInput = { role: 'staff' | 'admin'; expiresInHours: number; recipientEmail: string }

/** Loads, creates and revokes one-time invite codes through /api/admin/invite-codes. */
export function useInviteCodes({ onError, onSuccess }: Notify) {
  const [inviteCodes, setInviteCodes] = useState<InviteCode[]>([])
  const [loading, setLoading] = useState(false)
  const [revokingId, setRevokingId] = useState<string | null>(null)

  const refresh = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/admin/invite-codes')
      const json = await res.json().catch(() => null)
      if (res.ok && json) {
        setInviteCodes(json.data ?? json ?? [])
      }
    } catch {
      // ignore
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    refresh()
  }, [refresh])

  /** Returns the created invite, or null after reporting the error. */
  const generate = async (input: GenerateInviteInput): Promise<GeneratedInvite | null> => {
    onError('')
    try {
      const response = await fetch('/api/admin/invite-codes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          role: input.role,
          expiresInHours: Number(input.expiresInHours),
          recipientEmail: input.recipientEmail.trim() || null,
        }),
      })
      const result = await response.json().catch(() => null)
      if (!response.ok) {
        throw new Error(apiErrorMessage(result, 'Failed to generate invite code.'))
      }
      refresh()
      return result?.data?.invite ?? result?.invite ?? null
    } catch (err: unknown) {
      onError(err instanceof Error ? err.message : 'Failed to generate invite code.')
      return null
    }
  }

  const revoke = async (id: string) => {
    setRevokingId(id)
    onError('')
    try {
      const response = await fetch(`/api/admin/invite-codes?id=${encodeURIComponent(id)}`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
      })
      const result = await response.json().catch(() => null)
      if (!response.ok) {
        throw new Error(apiErrorMessage(result, 'Failed to revoke invite code.'))
      }
      setInviteCodes((prev) => prev.filter((c) => c.id !== id))
      onSuccess('Invite code was revoked and can no longer be used.', 4000)
    } catch (err: unknown) {
      onError(err instanceof Error ? err.message : 'Failed to revoke invite code.')
    } finally {
      setRevokingId(null)
    }
  }

  return { inviteCodes, loading, revokingId, generate, revoke }
}
