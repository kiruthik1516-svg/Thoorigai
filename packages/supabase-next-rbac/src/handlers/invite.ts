import { NextResponse } from 'next/server'
import { z } from 'zod'
import type { SupabaseClient } from '@supabase/supabase-js'
import { validateMutationRequest } from '../server/csrf'

const createCodeSchema = z.object({
  role: z.string().min(1),
  recipientEmail: z.string().email().optional().nullable(),
  expiresInDays: z.number().int().min(1).max(90).default(7),
})

export type InviteHandlerOptions = {
  createClient: (requestId: string) => Promise<SupabaseClient>
  getAdminClient: (requestId: string) => SupabaseClient
  fallbackStaffPasscode?: string
  adminRole?: string
}

/**
 * Creates live invite verification handler (GET).
 */
export function createVerifyInviteHandler(options: InviteHandlerOptions) {
  return async function GET(request: Request) {
    const requestId = request.headers.get('x-request-id')?.trim() || crypto.randomUUID()
    const { searchParams } = new URL(request.url)
    const code = searchParams.get('code')?.trim()

    if (!code) {
      return NextResponse.json({ valid: false, error: 'Code is required.' }, { status: 400 })
    }

    const trimmedCode = code.toUpperCase().replace(/\s+/g, '-')

    if (options.fallbackStaffPasscode && trimmedCode === options.fallbackStaffPasscode.toUpperCase()) {
      return NextResponse.json({ valid: true, role: 'staff', message: 'Standard staff invite verified.' })
    }

    const adminClient = options.getAdminClient(requestId)
    const { data: invite } = await adminClient
      .from('invite_codes')
      .select('id, role, recipient_email, expires_at, is_used')
      .ilike('code', trimmedCode)
      .maybeSingle()

    if (!invite) {
      return NextResponse.json({ valid: false, error: 'Invite code was not found.' }, { status: 404 })
    }
    if (invite.is_used) {
      return NextResponse.json({ valid: false, error: 'Invite code has already been redeemed.' }, { status: 400 })
    }
    if (new Date(invite.expires_at).getTime() < Date.now()) {
      return NextResponse.json({ valid: false, error: 'Invite code has expired.' }, { status: 400 })
    }

    return NextResponse.json({
      valid: true,
      role: invite.role,
      recipientEmail: invite.recipient_email,
    })
  }
}

/**
 * Creates admin invite codes management route handlers (GET, POST, DELETE).
 */
export function createAdminInviteCodesHandler(options: InviteHandlerOptions) {
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
      if (!admin) {
        return NextResponse.json({ error: 'Unauthorized.' }, { status: 403 })
      }

      const adminClient = getAdminClient(requestId)
      const { data, error } = await adminClient
        .from('invite_codes')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(100)

      if (error) return NextResponse.json({ error: error.message }, { status: 500 })
      return NextResponse.json({ data })
    },

    async POST(request: Request) {
      const requestId = request.headers.get('x-request-id')?.trim() || crypto.randomUUID()
      const csrfError = validateMutationRequest(request)
      if (csrfError) return csrfError

      const admin = await checkAdmin(requestId)
      if (!admin) return NextResponse.json({ error: 'Unauthorized.' }, { status: 403 })

      const body = await request.json().catch(() => null)
      const parsed = createCodeSchema.safeParse(body)
      if (!parsed.success) {
        return NextResponse.json({ error: 'Invalid parameters.' }, { status: 400 })
      }

      const generatedCode = 'INV-' + crypto.randomUUID().slice(0, 8).toUpperCase()
      const expiresAt = new Date(Date.now() + parsed.data.expiresInDays * 86400 * 1000).toISOString()

      const adminClient = getAdminClient(requestId)
      const { data, error } = await adminClient
        .from('invite_codes')
        .insert({
          code: generatedCode,
          role: parsed.data.role,
          recipient_email: parsed.data.recipientEmail ?? null,
          expires_at: expiresAt,
          created_by: admin.id,
        })
        .select()
        .single()

      if (error) return NextResponse.json({ error: error.message }, { status: 500 })
      return NextResponse.json({ data }, { status: 201 })
    },

    async DELETE(request: Request) {
      const requestId = request.headers.get('x-request-id')?.trim() || crypto.randomUUID()
      const csrfError = validateMutationRequest(request, ['application/json', ''])
      if (csrfError) return csrfError

      const admin = await checkAdmin(requestId)
      if (!admin) return NextResponse.json({ error: 'Unauthorized.' }, { status: 403 })

      const { searchParams } = new URL(request.url)
      const id = searchParams.get('id')
      if (!id) return NextResponse.json({ error: 'Code id is required.' }, { status: 400 })

      const adminClient = getAdminClient(requestId)
      const { error } = await adminClient.from('invite_codes').delete().eq('id', id)
      if (error) return NextResponse.json({ error: error.message }, { status: 500 })
      return NextResponse.json({ data: { success: true } })
    },
  }
}
