import { cache } from 'react'
import { redirect } from 'next/navigation'
import type { SupabaseClient } from '@supabase/supabase-js'
import type { RbacEngine, UserProfile } from '../types'

export type ProfileHelperOptions<TRole extends string, TResource extends string, TAction extends string> = {
  createClient: () => Promise<SupabaseClient>
  rbac: RbacEngine<TRole, TResource, TAction>
  loginPath?: string
  unauthorizedRedirectPath?: string
}

/**
 * Creates React Server Component helpers for getting profiles and asserting permissions.
 *
 * @example
 * ```ts
 * import { createProfileHelpers } from '@repo/supabase-next-rbac/server'
 * import { createClient } from '@/lib/supabase/server'
 * import { rbac } from '@/lib/rbac'
 *
 * export const { getCurrentProfile, requirePermission } = createProfileHelpers({
 *   createClient,
 *   rbac,
 * })
 * ```
 */
export function createProfileHelpers<TRole extends string, TResource extends string, TAction extends string>(
  options: ProfileHelperOptions<TRole, TResource, TAction>,
) {
  const { createClient, rbac, loginPath = '/login', unauthorizedRedirectPath = '/' } = options

  const getCurrentProfile = cache(async (): Promise<UserProfile<TRole>> => {
    const supabase = await createClient()
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()

    if (authError || !user) {
      redirect(loginPath)
    }

    const { data, error } = await supabase
      .from('profiles')
      .select('id, role, full_name, metadata, created_at')
      .eq('id', user.id)
      .maybeSingle()

    if (error || !data || data.role === rbac.defaultRole) {
      redirect(loginPath)
    }

    return {
      id: user.id,
      role: data.role as TRole,
      fullName: data.full_name ?? '',
      metadata: data.metadata ?? {},
      createdAt: data.created_at,
    }
  })

  async function requirePermission(resource: TResource, action: TAction): Promise<UserProfile<TRole>> {
    const profile = await getCurrentProfile()
    if (!rbac.can(profile.role, resource, action)) {
      redirect(unauthorizedRedirectPath)
    }
    return profile
  }

  return {
    getCurrentProfile,
    requirePermission,
  }
}
