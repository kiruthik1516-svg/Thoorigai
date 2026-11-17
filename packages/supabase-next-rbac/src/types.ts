import type { SupabaseClient, User } from '@supabase/supabase-js'

export type StandardRole = 'admin' | 'staff' | 'pending' | (string & {})

export type PermissionMatrix<
  TRole extends string = string,
  TResource extends string = string,
  TAction extends string = string,
> = Record<TRole, Partial<Record<TResource, readonly TAction[]>>>

export type RbacConfig<TRole extends string, TResource extends string, TAction extends string> = {
  roles: readonly TRole[]
  resources: readonly TResource[]
  defaultRole: TRole
  adminRole?: TRole
  matrix: PermissionMatrix<TRole, TResource, TAction>
}

export type RbacEngine<TRole extends string, TResource extends string, TAction extends string> = {
  roles: readonly TRole[]
  resources: readonly TResource[]
  defaultRole: TRole
  adminRole: TRole
  can: (role: TRole | null | undefined, resource: TResource, action: TAction) => boolean
  rolesFor: (resource: TResource, action: TAction) => readonly TRole[]
  requireRole: (currentRole: TRole | null | undefined, allowedRoles: readonly TRole[]) => asserts currentRole is TRole
}

export type UserProfile<TRole extends string = string> = {
  id: string
  role: TRole
  fullName: string
  metadata?: Record<string, unknown>
  createdAt?: string
}

export type RequestContext = {
  requestId: string
  user?: User
  profile?: UserProfile
  supabase?: SupabaseClient
}
