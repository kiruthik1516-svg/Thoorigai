import type { InviteCode, Role, UserContactDetails, UserMetadata } from '@/lib/types'

export type UserProfile = {
  id: string
  full_name: string | null
  role: Role
  created_at: string | null
  contact_details?: UserContactDetails
  metadata?: UserMetadata
  /** Set when the account is disabled (F-12). Approving the user re-enables it. */
  disabled_at?: string | null
}

export type FilterTab = 'all' | 'pending' | 'staff' | 'admin' | 'invites'

export type GeneratedInvite = {
  code: string
  role: string
  expiresAt: string
  recipientEmail?: string | null
}

export type CustomMetaEntry = { id: string; key: string; value: string }

export type UserDetailsForm = {
  fullName: string
  phone: string
  altPhone: string
  email: string
  address: string
  city: string
  emergencyContact: string
  department: string
  designation: string
  employeeId: string
  bio: string
  customMeta: CustomMetaEntry[]
}

export type UserDetailsPayload = {
  fullName: string
  contactDetails: UserContactDetails
  metadata: UserMetadata
}

const FILTER_TABS: FilterTab[] = ['pending', 'staff', 'admin', 'invites']
const KNOWN_METADATA_KEYS = new Set(['department', 'designation', 'employeeId', 'bio', 'timezone'])

export function initialFilterTab(filter: string | undefined): FilterTab {
  return filter && (FILTER_TABS as string[]).includes(filter) ? (filter as FilterTab) : 'all'
}

export function newCustomMetaId() {
  return Math.random().toString(36).substring(2, 9)
}

export function userDetailsForm(user: UserProfile): UserDetailsForm {
  const contact = (user.contact_details as Record<string, unknown>) || {}
  const meta = (user.metadata as Record<string, unknown>) || {}
  return {
    fullName: user.full_name || '',
    phone: String(contact.phone || ''),
    altPhone: String(contact.altPhone || ''),
    email: String(contact.email || ''),
    address: String(contact.address || ''),
    city: String(contact.city || ''),
    emergencyContact: String(contact.emergencyContact || ''),
    department: String(meta.department || ''),
    designation: String(meta.designation || ''),
    employeeId: String(meta.employeeId || ''),
    bio: String(meta.bio || ''),
    customMeta: Object.entries(meta)
      .filter(([key]) => !KNOWN_METADATA_KEYS.has(key))
      .map(([key, value]) => ({
        id: newCustomMetaId(),
        key,
        value: typeof value === 'object' ? JSON.stringify(value) : String(value ?? ''),
      })),
  }
}

/** Trims every field, drops empty ones, and parses custom values that look like JSON. */
export function userDetailsPayload(form: UserDetailsForm): UserDetailsPayload {
  const contactDetails: Record<string, unknown> = {}
  if (form.phone.trim()) contactDetails.phone = form.phone.trim()
  if (form.altPhone.trim()) contactDetails.altPhone = form.altPhone.trim()
  if (form.email.trim()) contactDetails.email = form.email.trim()
  if (form.address.trim()) contactDetails.address = form.address.trim()
  if (form.city.trim()) contactDetails.city = form.city.trim()
  if (form.emergencyContact.trim()) contactDetails.emergencyContact = form.emergencyContact.trim()

  const metadata: Record<string, unknown> = {}
  if (form.department.trim()) metadata.department = form.department.trim()
  if (form.designation.trim()) metadata.designation = form.designation.trim()
  if (form.employeeId.trim()) metadata.employeeId = form.employeeId.trim()
  if (form.bio.trim()) metadata.bio = form.bio.trim()
  for (const item of form.customMeta) {
    const key = item.key.trim()
    if (!key) continue
    try {
      metadata[key] = item.value.startsWith('{') || item.value.startsWith('[') ? JSON.parse(item.value) : item.value
    } catch {
      metadata[key] = item.value
    }
  }

  return {
    fullName: form.fullName.trim(),
    contactDetails: contactDetails as UserContactDetails,
    metadata: metadata as UserMetadata,
  }
}

/** Users whose selected role differs from the saved one: userId -> new role. */
export function pendingRoleChanges(rows: UserProfile[], savedRows: UserProfile[]): Record<string, Role> {
  return rows.reduce<Record<string, Role>>((changes, row) => {
    const saved = savedRows.find((item) => item.id === row.id)
    if (saved && saved.role !== row.role) changes[row.id] = row.role
    return changes
  }, {})
}

export function filterUsers(rows: UserProfile[], tab: FilterTab, search: string): UserProfile[] {
  const query = search.trim().toLowerCase()
  return rows.filter((user) => {
    if (tab !== 'all' && tab !== 'invites' && user.role !== tab) return false
    if (!query) return true
    return (
      (user.full_name?.toLowerCase().includes(query) ?? false) ||
      user.id.toLowerCase().includes(query) ||
      user.role.toLowerCase().includes(query)
    )
  })
}

export function isActiveInvite(invite: InviteCode, now = Date.now()) {
  return !invite.isUsed && new Date(invite.expiresAt).getTime() > now
}

export function inviteStatus(invite: InviteCode, now = Date.now()) {
  if (invite.isUsed) {
    return {
      label: 'Redeemed',
      badge: 'bg-blue-100 text-blue-800 border-blue-200',
      detail: invite.usedByUserName ? `by ${invite.usedByUserName}` : 'Used',
    }
  }
  const expiresAt = new Date(invite.expiresAt).getTime()
  if (expiresAt <= now) {
    return { label: 'Expired', badge: 'bg-slate-100 text-slate-600 border-slate-200', detail: 'Code expired' }
  }
  const hoursLeft = Math.max(1, Math.round((expiresAt - now) / (3600 * 1000)))
  return {
    label: 'Active',
    badge: 'bg-emerald-100 text-emerald-800 border-emerald-200',
    detail: hoursLeft >= 24 ? `Expires in ${Math.round(hoursLeft / 24)}d` : `Expires in ${hoursLeft}h`,
  }
}

export function inviteSignupUrl(code: string) {
  const origin = typeof window !== 'undefined' ? window.location.origin : ''
  return `${origin}/signup?code=${code}`
}
