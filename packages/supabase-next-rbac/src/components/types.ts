import type { ReactNode } from 'react'

export type BrandConfig = {
  displayName: string
  logo?: ReactNode
  logoUrl?: string
  supportEmail?: string
}

export type AuthShellProps = {
  children: ReactNode
  brand?: BrandConfig
}

export type LoginFormProps = {
  brand?: BrandConfig
  signupUrl?: string
  loginApiEndpoint?: string
  onSuccess?: () => void
}

export type SignupFormProps = {
  brand?: BrandConfig
  loginUrl?: string
  signupApiEndpoint?: string
  verifyInviteApiEndpoint?: string
  onSuccess?: (result: { status: 'active' | 'pending'; role: string }) => void
}

export type UserRow = {
  id: string
  full_name: string | null
  role: string
  created_at?: string | null
  metadata?: Record<string, unknown>
}

export type UserRolesManagerProps = {
  users: UserRow[]
  availableRoles: { value: string; label: string }[]
  adminUsersEndpoint?: string
  adminInvitesEndpoint?: string
  currentUserId?: string
}
