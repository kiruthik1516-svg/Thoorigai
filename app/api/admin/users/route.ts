import { z } from 'zod'
import { withApi } from '@/lib/http/handler'
import { getSupabaseAdminClient } from '@/lib/supabase/admin'
import { logger } from '@/lib/logger'

// Effectively permanent; Supabase Auth takes a Go duration string.
const DISABLED_BAN_DURATION = '876000h'

/**
 * Mirrors a profile change into Supabase Auth. supabase-js returns errors instead of throwing, so
 * the old try/catch never saw a failure (F-32). Retry once, then log for follow-up.
 */
async function syncAuthUser(
  requestId: string,
  userId: string,
  attributes: { app_metadata?: Record<string, unknown>; ban_duration?: string },
): Promise<boolean> {
  const adminClient = getSupabaseAdminClient(requestId)
  for (let attempt = 1; attempt <= 2; attempt += 1) {
    const { error } = await adminClient.auth.admin.updateUserById(userId, attributes)
    if (!error) return true
    if (attempt === 2) {
      logger.error(
        { event: 'auth_user_sync_failed', requestId, userId, fields: Object.keys(attributes), status: error.status },
        'Failed to sync profile change to Supabase Auth',
      )
    }
  }
  return false
}

function roleChangeError(error: { code?: string; message: string }) {
  if (error.code === 'P0002') return Response.json({ error: 'User profile was not found.' }, { status: 404 })
  if (error.code === '22023' || error.code === '23514') return Response.json({ error: error.message }, { status: 409 })
  if (error.code === '42501') return Response.json({ error: 'Admin access required.' }, { status: 403 })
  return null
}

const updateUserSchema = z.object({
  userId: z.guid(),
  role: z.enum(['admin', 'staff', 'pending']).optional(),
  fullName: z.string().min(1).max(200).optional(),
  contactDetails: z.record(z.string(), z.unknown()).optional(),
  metadata: z.record(z.string(), z.unknown()).optional(),
})

const createUserSchema = z.object({
  email: z.string().email().max(254),
  fullName: z.string().min(1).max(200),
  role: z.enum(['admin', 'staff', 'pending']).default('staff'),
  password: z.string().min(8).max(1024).optional(),
  contactDetails: z.record(z.string(), z.unknown()).optional(),
  metadata: z.record(z.string(), z.unknown()).optional(),
})

export const GET = withApi({ roles: ['admin'] }, async ({ supabase }) => {
  const { data, error } = await supabase!
    .from('profiles')
    .select('id,full_name,role,created_at,contact_details,metadata,disabled_at')
    .order('full_name')
    .limit(500)
  if (error) throw error
  return data ?? []
})

export const PATCH = withApi(
  { roles: ['admin'], body: updateUserSchema, userRateLimit: { limit: 20, window: '1 m' } },
  async ({ supabase, body, requestId }) => {
    let authSynced = true
    if (body.role) {
      const { error } = await supabase!.rpc('admin_change_profile_role', {
        p_user_id: body.userId,
        p_role: body.role,
      })
      if (error) {
        const response = roleChangeError(error)
        if (response) return response
        throw error
      }

      // Approving a disabled account (F-12) re-enables it and lifts the auth ban.
      let reEnable = false
      if (body.role !== 'pending') {
        const { data: target } = await supabase!
          .from('profiles')
          .select('disabled_at')
          .eq('id', body.userId)
          .maybeSingle()
        if (target?.disabled_at) {
          const { error: enableError } = await supabase!.rpc('admin_set_user_disabled', {
            p_user_id: body.userId,
            p_disabled: false,
          })
          if (enableError) {
            const response = roleChangeError(enableError)
            if (response) return response
            throw enableError
          }
          reEnable = true
        }
      }

      authSynced = await syncAuthUser(requestId, body.userId, {
        app_metadata: { role: body.role },
        ...(reEnable ? { ban_duration: 'none' } : {}),
      })
    }

    const profileUpdates: Record<string, unknown> = {}
    if (body.fullName !== undefined) profileUpdates.full_name = body.fullName.trim()
    if (body.contactDetails !== undefined) profileUpdates.contact_details = body.contactDetails
    if (body.metadata !== undefined) profileUpdates.metadata = body.metadata

    if (Object.keys(profileUpdates).length > 0) {
      const { error: updateError } = await supabase!.from('profiles').update(profileUpdates).eq('id', body.userId)

      if (updateError) throw updateError
    }

    return { updated: true, authSynced }
  },
)

export const POST = withApi(
  { roles: ['admin'], body: createUserSchema, userRateLimit: { limit: 10, window: '1 m' } },
  async ({ body, requestId }) => {
    const adminClient = getSupabaseAdminClient(requestId)

    if (body.password) {
      const { data, error } = await adminClient.auth.admin.createUser({
        email: body.email,
        password: body.password,
        email_confirm: true,
        user_metadata: { full_name: body.fullName },
        app_metadata: { role: body.role },
      })
      if (error) {
        return Response.json({ error: error.message }, { status: 400 })
      }
      if (data.user) {
        await adminClient.from('profiles').upsert({
          id: data.user.id,
          role: body.role,
          full_name: body.fullName,
        })
      }
      return { created: true, user: { id: data.user?.id, email: data.user?.email } }
    }

    const { data, error } = await adminClient.auth.admin.inviteUserByEmail(body.email, {
      data: { full_name: body.fullName },
    })
    if (error) {
      return Response.json({ error: error.message }, { status: 400 })
    }
    if (data.user) {
      await adminClient.auth.admin.updateUserById(data.user.id, {
        app_metadata: { role: body.role },
      })
      await adminClient.from('profiles').upsert({
        id: data.user.id,
        role: body.role,
        full_name: body.fullName,
      })
    }
    return { invited: true, user: { id: data.user?.id, email: data.user?.email } }
  },
)

const deleteUserQuerySchema = z.object({
  userId: z.guid(),
})

// F-12: accounts are disabled, never deleted, so the audit log keeps who did what.
export const DELETE = withApi(
  { roles: ['admin'], query: deleteUserQuerySchema, userRateLimit: { limit: 10, window: '1 m' } },
  async ({ query, user, requestId, supabase }) => {
    if (query.userId === user?.id) {
      return Response.json({ error: 'You cannot disable your own account.' }, { status: 400 })
    }

    // Role drops to pending (access ends immediately) under the role-change lock, which also
    // enforces that at least one admin remains (F-32).
    const { error } = await supabase!.rpc('admin_set_user_disabled', {
      p_user_id: query.userId,
      p_disabled: true,
    })
    if (error) {
      const response = roleChangeError(error)
      if (response) return response
      throw error
    }

    const authSynced = await syncAuthUser(requestId, query.userId, {
      app_metadata: { role: 'pending' },
      ban_duration: DISABLED_BAN_DURATION,
    })
    return { disabled: true, userId: query.userId, authSynced }
  },
)
