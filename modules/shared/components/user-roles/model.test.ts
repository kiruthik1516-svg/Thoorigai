import { describe, expect, it } from 'vitest'
import type { InviteCode } from '@/lib/types'
import {
  filterUsers,
  initialFilterTab,
  inviteStatus,
  isActiveInvite,
  pendingRoleChanges,
  userDetailsForm,
  userDetailsPayload,
  type UserProfile,
} from './model'

const user = (id: string, role: UserProfile['role'], fullName: string | null = null): UserProfile => ({
  id,
  role,
  full_name: fullName,
  created_at: null,
})

const invite = (overrides: Partial<InviteCode>): InviteCode =>
  ({
    id: 'i1',
    code: 'STAFF-1234',
    role: 'staff',
    isUsed: false,
    expiresAt: '2026-11-20T00:00:00Z',
    createdAt: '2026-11-19T00:00:00Z',
    ...overrides,
  }) as InviteCode

describe('initialFilterTab', () => {
  it('accepts known tabs and falls back to all', () => {
    expect(initialFilterTab('pending')).toBe('pending')
    expect(initialFilterTab('invites')).toBe('invites')
    expect(initialFilterTab('everyone')).toBe('all')
    expect(initialFilterTab(undefined)).toBe('all')
  })
})

describe('user details form', () => {
  it('round-trips known fields and keeps unknown metadata as custom attributes', () => {
    const form = userDetailsForm({
      ...user('u1', 'staff', 'Asha'),
      contact_details: { phone: '98765', email: 'a@example.test' },
      metadata: { department: 'Training', shift: 'morning', tags: ['a'] },
    })
    expect(form).toMatchObject({ fullName: 'Asha', phone: '98765', email: 'a@example.test', department: 'Training' })
    expect(form.customMeta.map(({ key, value }) => [key, value])).toEqual([
      ['shift', 'morning'],
      ['tags', '["a"]'],
    ])

    const payload = userDetailsPayload({ ...form, fullName: '  Asha K ', city: '  ' })
    expect(payload).toEqual({
      fullName: 'Asha K',
      contactDetails: { phone: '98765', email: 'a@example.test' },
      metadata: { department: 'Training', shift: 'morning', tags: ['a'] },
    })
  })

  it('keeps custom values that only look like JSON as text and skips blank keys', () => {
    const form = userDetailsForm(user('u1', 'staff'))
    const payload = userDetailsPayload({
      ...form,
      customMeta: [
        { id: '1', key: 'note', value: '{not json' },
        { id: '2', key: '  ', value: 'ignored' },
      ],
    })
    expect(payload.metadata).toEqual({ note: '{not json' })
  })
})

describe('pendingRoleChanges', () => {
  it('lists only users whose role differs from the saved one', () => {
    const saved = [user('a', 'staff'), user('b', 'pending')]
    expect(pendingRoleChanges([user('a', 'staff'), user('b', 'admin')], saved)).toEqual({ b: 'admin' })
  })
})

describe('filterUsers', () => {
  const rows = [user('a1', 'staff', 'Ravi'), user('b2', 'admin', 'Meena'), user('c3', 'pending', null)]

  it('filters by tab, and the invites tab shows everyone', () => {
    expect(filterUsers(rows, 'admin', '').map((u) => u.id)).toEqual(['b2'])
    expect(filterUsers(rows, 'invites', '')).toHaveLength(3)
  })

  it('searches name, id and role case-insensitively', () => {
    expect(filterUsers(rows, 'all', 'RAVI').map((u) => u.id)).toEqual(['a1'])
    expect(filterUsers(rows, 'all', 'c3').map((u) => u.id)).toEqual(['c3'])
    expect(filterUsers(rows, 'all', 'pend').map((u) => u.id)).toEqual(['c3'])
  })
})

describe('invite status', () => {
  const now = Date.parse('2026-11-19T12:00:00Z')

  it('describes redeemed, expired and active codes', () => {
    expect(inviteStatus(invite({ isUsed: true, usedByUserName: 'Asha' }), now)).toMatchObject({
      label: 'Redeemed',
      detail: 'by Asha',
    })
    expect(inviteStatus(invite({ expiresAt: '2026-11-19T11:00:00Z' }), now).label).toBe('Expired')
    expect(inviteStatus(invite({ expiresAt: '2026-11-19T15:00:00Z' }), now).detail).toBe('Expires in 3h')
    expect(inviteStatus(invite({ expiresAt: '2026-11-22T12:00:00Z' }), now).detail).toBe('Expires in 3d')
  })

  it('counts only unused, unexpired codes as active', () => {
    expect(isActiveInvite(invite({}), now)).toBe(true)
    expect(isActiveInvite(invite({ isUsed: true }), now)).toBe(false)
    expect(isActiveInvite(invite({ expiresAt: '2026-11-19T11:00:00Z' }), now)).toBe(false)
  })
})
