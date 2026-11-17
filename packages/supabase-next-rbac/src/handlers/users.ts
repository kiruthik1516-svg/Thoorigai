import { NextResponse } from 'next/server'
import { z } from 'zod'
import type { SupabaseClient } from '@supabase/supabase-js'
import { validateMutationRequest } from '../server/csrf'

const updateUserSchema = z.object({
  userId: z.string().uuid(),
  role: z.string().min(1).optional(),
  fullName: z.string().min(1).max(200).optional(),
  metadata: z.record(z.unknown()).optional(),
})

export type AdminUsersHandlerOptions = {
  createClient: (requestId: string) => Promise<SupabaseClient>
  getAdminClient: (requestId: string) => SupabaseClient
  adminRole?: string
}

/**
 * Creates admin user management route handlers (GET, PATCH, DELETE).
 * Enforces admin authorization, advisory locks, and audit logging via PostgreSQL RPC.
 */
export function createAdminUsersHandler(options: AdminUsersHandlerOptions) {
  const { createClient, getAdminClient, adminRole = 'admin' } = options

  async function checkAdmin(requestId: string) {
    const supabase = await createClient(requestId)
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) return null

    const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).maybeSingle()

    return profile?.role === adminRole ? user : null
  }

  return {
    async GET(request: Request) {
      const requestId = request.headers.get('x-request-id')?.trim() || crypto.randomUUID()
      const admin = await checkAdmin(requestId)
      if (!admin) return NextResponse.json({ error: 'Unauthorized.' }, { status: 403 })

      const adminClient = getAdminClient(requestId)
      const { data, error } = await adminClient
        .from('profiles')
        .select('id, full_name, role, metadata, created_at, updated_at')
        .order('created_at', { ascending: false })
        .limit(500)

      if (error) return NextResponse.json({ error: error.message }, { status: 500 })
      return NextResponse.json({ data })
    },

    async PATCH(request: Request) {
      const requestId = request.headers.get('x-request-id')?.trim() || crypto.randomUUID()
      const csrfError = validateMutationRequest(request)
      if (csrfError) return csrfError

      const admin = await checkAdmin(requestId)
      if (!admin) return NextResponse.json({ error: 'Unauthorized.' }, { status: 403 })

      const body = await request.json().catch(() => null)
      const parsed = updateUserSchema.safeParse(body)
      if (!parsed.success) {
        return NextResponse.json({ error: 'Invalid user parameters.' }, { status: 400 })
      }

      const supabase = await createClient(requestId)
      const adminClient = getAdminClient(requestId)

      // Role modification executes the atomic security definer RPC
      if (parsed.data.role) {
        const { error: rpcError } = await supabase.rpc('admin_change_profile_role', {
          p_user_id: parsed.data.userId,
          p_role: parsed.data.role,
        })

        if (rpcError) {
          if (rpcError.code === 'P0002') return NextResponse.json({ error: 'User not found.' }, { status: 404 })
          if (rpcError.code === '22023' || rpcError.code === '23514') {
            return NextResponse.json({ error: rpcError.message }, { status: 409 })
          }
          if (rpcError.code === '42501') return NextResponse.json({ error: 'Admin access required.' }, { status: 403 })
          return NextResponse.json({ error: rpcError.message }, { status: 500 })
        }

        // Synchronize auth app_metadata
        try {
          await adminClient.auth.admin.updateUserById(parsed.data.userId, {
            app_metadata: { role: parsed.data.role },
          })
        } catch {
          // Non-fatal if Supabase auth background sync has a slight delay
        }
      }

      // Profile details modification
      const updates: Record<string, unknown> = {}
      if (parsed.data.fullName !== undefined) updates.full_name = parsed.data.fullName.trim()
      if (parsed.data.metadata !== undefined) updates.metadata = parsed.data.metadata

      if (Object.keys(updates).length > 0) {
        const { error: updateError } = await adminClient.from('profiles').update(updates).eq('id', parsed.data.userId)

        if (updateError) return NextResponse.json({ error: updateError.message }, { status: 500 })
      }

      return NextResponse.json({ data: { success: true } })
    },

    async DELETE(request: Request) {
      const requestId = request.headers.get('x-request-id')?.trim() || crypto.randomUUID()
      const csrfError = validateMutationRequest(request, ['application/json', ''])
      if (csrfError) return csrfError

      const admin = await checkAdmin(requestId)
      if (!admin) return NextResponse.json({ error: 'Unauthorized.' }, { status: 403 })

      const { searchParams } = new URL(request.url)
      const userId = searchParams.get('userId')
      if (!userId) return NextResponse.json({ error: 'userId is required.' }, { status: 400 })

      if (userId === admin.id) {
        return NextResponse.json({ error: 'You cannot delete your own account.' }, { status: 400 })
      }

      const adminClient = getAdminClient(requestId)
      const { error } = await adminClient.auth.admin.deleteUser(userId)
      if (error) return NextResponse.json({ error: error.message }, { status: 500 })

      return NextResponse.json({ data: { success: true } })
    },
  }
}
