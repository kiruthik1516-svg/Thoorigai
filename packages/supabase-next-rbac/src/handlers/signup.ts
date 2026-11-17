import { NextResponse } from 'next/server'
import { z } from 'zod'
import type { SupabaseClient } from '@supabase/supabase-js'
import { validateMutationRequest } from '../server/csrf'

const signupSchema = z.object({
  fullName: z.string().trim().min(2, 'Name must be at least 2 characters').max(100),
  email: z.string().trim().email('Please enter a valid email address').max(254),
  password: z.string().min(8, 'Password must be at least 8 characters').max(1024),
  inviteCode: z.string().trim().optional(),
})

export type SignupHandlerOptions = {
  getAdminClient: (requestId: string) => SupabaseClient
  defaultRole?: string
  fallbackStaffPasscode?: string
  defaultActiveRole?: string
  rateLimiter?: (ip: string) => Promise<{ success: boolean; retryAfterSeconds?: number }>
  onPendingRegistration?: (user: { id: string; email: string; fullName: string }) => Promise<void> | void
}

/**
 * Creates a Next.js App Router POST handler for user registration.
 * Supports dual-path signup: self-service pending requests vs instant activation via invite codes.
 */
export function createSignupHandler(options: SignupHandlerOptions) {
  const {
    getAdminClient,
    defaultRole = 'pending',
    defaultActiveRole = 'staff',
    fallbackStaffPasscode,
    rateLimiter,
    onPendingRegistration,
  } = options

  return async function POST(request: Request) {
    const requestId = request.headers.get('x-request-id')?.trim() || crypto.randomUUID()

    const csrfError = validateMutationRequest(request)
    if (csrfError) return csrfError

    try {
      if (rateLimiter) {
        const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown'
        const limit = await rateLimiter(ip)
        if (!limit.success) {
          return NextResponse.json(
            { error: 'Too many registration attempts. Please try again later.' },
            {
              status: 429,
              headers: { 'Retry-After': String(limit.retryAfterSeconds ?? 60), 'x-request-id': requestId },
            },
          )
        }
      }

      const body = await request.json().catch(() => null)
      const parsed = signupSchema.safeParse(body)
      if (!parsed.success) {
        const firstError = parsed.error.issues[0]?.message || 'Invalid form input.'
        return NextResponse.json({ error: firstError }, { status: 400, headers: { 'x-request-id': requestId } })
      }

      const { fullName, email, password, inviteCode } = parsed.data
      let assignedRole = defaultRole
      let validInviteId: string | null = null

      const adminClient = getAdminClient(requestId)

      // 1. Process Invite Code / Passcode if supplied
      if (inviteCode && inviteCode.trim()) {
        const trimmedCode = inviteCode.trim().toUpperCase().replace(/\s+/g, '-')

        if (fallbackStaffPasscode && trimmedCode === fallbackStaffPasscode.toUpperCase()) {
          assignedRole = defaultActiveRole
        } else {
          const { data: invite } = await adminClient
            .from('invite_codes')
            .select('id, role, recipient_email, expires_at, is_used')
            .ilike('code', trimmedCode)
            .maybeSingle()

          if (!invite) {
            return NextResponse.json(
              { error: 'Invalid invite code. Check the code or leave blank to request access.' },
              { status: 400, headers: { 'x-request-id': requestId } },
            )
          }

          if (invite.is_used) {
            return NextResponse.json(
              { error: 'This invite code has already been redeemed.' },
              { status: 400, headers: { 'x-request-id': requestId } },
            )
          }

          if (new Date(invite.expires_at).getTime() < Date.now()) {
            return NextResponse.json(
              { error: 'This invite code has expired.' },
              { status: 400, headers: { 'x-request-id': requestId } },
            )
          }

          if (invite.recipient_email && invite.recipient_email.toLowerCase() !== email.toLowerCase()) {
            return NextResponse.json(
              { error: `This invite code is reserved for ${invite.recipient_email}.` },
              { status: 400, headers: { 'x-request-id': requestId } },
            )
          }

          assignedRole = invite.role
          validInviteId = invite.id
        }
      }

      // 2. Create Auth User via Supabase Admin API
      const { data: authData, error: authError } = await adminClient.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
        user_metadata: { full_name: fullName },
        app_metadata: { role: assignedRole },
      })

      if (authError) {
        return NextResponse.json({ error: authError.message }, { status: 400, headers: { 'x-request-id': requestId } })
      }

      if (authData?.user) {
        // Upsert profile record
        await adminClient.from('profiles').upsert({
          id: authData.user.id,
          role: assignedRole,
          full_name: fullName,
        })

        // Mark invite code as used if applicable
        if (validInviteId) {
          await adminClient
            .from('invite_codes')
            .update({
              is_used: true,
              used_by_user_id: authData.user.id,
              used_at: new Date().toISOString(),
            })
            .eq('id', validInviteId)
        }

        // Trigger notification callback if user is pending
        if (assignedRole === defaultRole && onPendingRegistration) {
          try {
            await onPendingRegistration({ id: authData.user.id, email, fullName })
          } catch {
            // Non-blocking notification
          }
        }
      }

      return NextResponse.json(
        {
          data: {
            userId: authData.user.id,
            role: assignedRole,
            status: assignedRole === defaultRole ? 'pending_approval' : 'active',
            message:
              assignedRole === defaultRole
                ? 'Registration submitted. Your account is awaiting administrator clearance.'
                : 'Account verified and ready. You can now sign in.',
          },
        },
        { status: 201, headers: { 'x-request-id': requestId } },
      )
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Unable to complete registration.'
      return NextResponse.json({ error: message }, { status: 500, headers: { 'x-request-id': requestId } })
    }
  }
}
