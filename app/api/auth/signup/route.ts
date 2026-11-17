import { NextResponse } from 'next/server'
import { z } from 'zod'
import { validateMutationRequest } from '@/lib/security/csrf'
import { rateLimit } from '@/lib/security/rate-limit'
import { withApi } from '@/lib/http/handler'
import { getSupabaseAdminClient } from '@/lib/supabase/admin'
import { logger } from '@/lib/logger'
import { passwordSchema } from '@/lib/validation'
import { createNotification } from '@/modules/notifications/service'
import { checkInviteCode, inviteErrorMessages, normalizeInviteCode, redeemInviteForUser } from '@/lib/auth/invite-codes'

const signupSchema = z.object({
  fullName: z.string().trim().min(2, 'Name must be at least 2 characters').max(100),
  email: z.string().trim().email('Please enter a valid email address').max(254),
  password: passwordSchema,
  passcode: z.string().trim().max(100).optional(),
})

async function postSignup(request: Request, requestId: string) {
  const csrfResponse = validateMutationRequest(request)
  if (csrfResponse) return csrfResponse

  const headers = { 'x-request-id': requestId }

  try {
    const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown'
    const limit = await rateLimit(`signup:${ip}`, 5, '15 m')
    if (!limit.success) {
      return NextResponse.json(
        { error: 'Too many signup attempts. Please try again later.' },
        { status: 429, headers: { ...headers, 'Retry-After': String(limit.retryAfterSeconds) } },
      )
    }

    const json = await request.json().catch(() => null)
    const parsed = signupSchema.safeParse(json)
    if (!parsed.success) {
      const firstError = parsed.error.issues[0]?.message || 'Invalid form values.'
      return NextResponse.json({ error: firstError }, { status: 400, headers })
    }

    const { fullName, email, password, passcode } = parsed.data
    const adminClient = getSupabaseAdminClient(requestId)

    // Invite codes are the only way to obtain an active role at signup. There is no static/master passcode.
    let inviteCode: string | null = null
    if (passcode) {
      inviteCode = normalizeInviteCode(passcode)
      if (!inviteCode) {
        return NextResponse.json({ error: inviteErrorMessages.not_found }, { status: 400, headers })
      }
      const check = await checkInviteCode(adminClient, inviteCode, email)
      if (!check.ok) {
        return NextResponse.json({ error: inviteErrorMessages[check.reason] }, { status: 400, headers })
      }
    }

    // Every self-registered account starts as `pending`; an invite is consumed atomically afterwards.
    const { data: authData, error: authError } = await adminClient.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { full_name: fullName },
      app_metadata: { role: 'pending' },
    })

    if (authError || !authData?.user) {
      const msg = authError?.message.toLowerCase() ?? ''
      if (msg.includes('already') || msg.includes('exists') || msg.includes('unique')) {
        // Never modify an existing account from the public signup endpoint. Existing users
        // prove ownership by signing in through the redeem flow instead.
        return NextResponse.json(
          {
            error: inviteCode
              ? 'An account with this email already exists. Sign in, then use "Activate Instantly" on the pending approval page with your invite code.'
              : 'An account with this email address already exists. Please sign in instead.',
          },
          { status: 400, headers },
        )
      }
      logger.warn({ requestId, errorType: authError?.name }, 'Signup createUser failed')
      return NextResponse.json({ error: 'Unable to complete registration. Please try again.' }, { status: 400, headers })
    }

    const userId = authData.user.id
    let assignedRole: 'staff' | 'admin' | 'pending' = 'pending'
    let inviteFailure: string | null = null

    if (inviteCode) {
      const redeemed = await redeemInviteForUser(adminClient, inviteCode, userId, email)
      if (redeemed.ok) {
        assignedRole = redeemed.role
        const { error: metaError } = await adminClient.auth.admin.updateUserById(userId, {
          app_metadata: { role: assignedRole },
        })
        if (metaError) {
          logger.error({ requestId, userId, errorType: metaError.name }, 'Failed to sync app_metadata role after signup')
        }
      } else {
        // Lost a race for the invite (or it changed since the pre-check). The account remains pending.
        inviteFailure = redeemed.message
      }
    }

    if (assignedRole === 'pending') {
      void createNotification({
        recipientRole: 'admin',
        title: 'Access Request Pending',
        message: `${fullName} registered and requested academy portal access.`,
        type: 'alert',
        link: '/settings/users?filter=pending',
        urgent: true,
        entityType: 'user',
        entityId: userId,
      })
    }

    logger.info({ requestId, role: assignedRole, userId }, 'User registered')

    return NextResponse.json(
      {
        data: {
          userId,
          role: assignedRole,
          status: assignedRole === 'pending' ? 'pending_approval' : 'active',
          message:
            assignedRole === 'pending'
              ? inviteFailure
                ? `Account created, but the invite code could not be applied: ${inviteFailure} Your account is waiting for administrator approval.`
                : 'Registration submitted. Your account is waiting for administrator approval.'
              : 'Account verified and ready. You can now sign in.',
        },
      },
      { status: 201, headers },
    )
  } catch (err: unknown) {
    logger.error({ requestId, errorType: err instanceof Error ? err.name : typeof err }, 'Signup failed')
    return NextResponse.json({ error: 'Unable to complete registration. Please try again.' }, { status: 500, headers })
  }
}

export const POST = withApi({ public: true }, async ({ request, requestId }) => postSignup(request, requestId))
