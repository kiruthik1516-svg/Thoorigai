import { NextResponse } from 'next/server'
import { z } from 'zod'
import { validateMutationRequest } from '@/lib/security/csrf'
import { rateLimit } from '@/lib/security/rate-limit'
import { withApi } from '@/lib/http/handler'
import { getSupabaseAdminClient } from '@/lib/supabase/admin'
import { createClient } from '@/lib/supabase/server'
import { logger } from '@/lib/logger'
import { checkInviteCode, inviteErrorMessages, normalizeInviteCode, redeemInviteForUser } from '@/lib/auth/invite-codes'

const redeemSchema = z.object({
  email: z.string().trim().email('Please enter a valid email address').max(254),
  password: z.string().min(1, 'Password is required').max(1024),
  code: z.string().trim().min(1, 'Invite code or OTP is required').max(100),
})

const roleRank = { pending: 0, staff: 1, admin: 2 } as const

async function postRedeemInvite(request: Request, requestId: string) {
  const csrfResponse = validateMutationRequest(request)
  if (csrfResponse) return csrfResponse

  const headers = { 'x-request-id': requestId }

  try {
    const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown'
    const limit = await rateLimit(`redeem-invite:${ip}`, 5, '15 m')
    if (!limit.success) {
      return NextResponse.json(
        { error: 'Too many attempts. Please try again later.' },
        { status: 429, headers: { ...headers, 'Retry-After': String(limit.retryAfterSeconds) } },
      )
    }

    const json = await request.json().catch(() => null)
    const parsed = redeemSchema.safeParse(json)
    if (!parsed.success) {
      const firstError = parsed.error.issues[0]?.message || 'Invalid form values.'
      return NextResponse.json({ error: firstError }, { status: 400, headers })
    }

    const { email, password } = parsed.data
    const code = normalizeInviteCode(parsed.data.code)
    if (!code) {
      return NextResponse.json(
        { error: 'Invalid invite code or OTP. Please check the code.' },
        { status: 400, headers },
      )
    }

    // 1. Prove account ownership.
    const supabase = await createClient(requestId)
    const { data: authData, error: authError } = await supabase.auth.signInWithPassword({ email, password })
    if (authError || !authData.user) {
      return NextResponse.json(
        { error: 'Incorrect email or password. Please verify your credentials.' },
        { status: 401, headers },
      )
    }

    const userId = authData.user.id
    const adminClient = getSupabaseAdminClient(requestId, userId)

    const { data: profile } = await adminClient.from('profiles').select('id, role').eq('id', userId).maybeSingle()
    if (!profile) {
      return NextResponse.json({ error: 'User profile not found.' }, { status: 404, headers })
    }

    // 2. Read-only pre-check for a helpful message and to avoid burning a code on a no-op.
    const check = await checkInviteCode(adminClient, code, email)
    if (!check.ok) {
      return NextResponse.json({ error: inviteErrorMessages[check.reason] }, { status: 400, headers })
    }

    const currentRank = roleRank[profile.role as keyof typeof roleRank] ?? 0
    if (currentRank >= roleRank[check.invite.role]) {
      return NextResponse.json(
        {
          data: {
            role: profile.role,
            alreadyActive: true,
            message: `Your account is already active with the ${String(profile.role).toUpperCase()} role. You can sign in directly.`,
          },
        },
        { status: 200, headers },
      )
    }

    // 3. Consume the invite and assign the role in one database transaction.
    const redeemed = await redeemInviteForUser(adminClient, code, userId, email)
    if (!redeemed.ok) {
      return NextResponse.json({ error: redeemed.message }, { status: 400, headers })
    }

    const { error: metaError } = await adminClient.auth.admin.updateUserById(userId, {
      app_metadata: { role: redeemed.role },
    })
    if (metaError) {
      logger.error({ requestId, userId, errorType: metaError.name }, 'Failed to sync app_metadata role after redeem')
    }

    logger.info({ requestId, role: redeemed.role, userId }, 'Account activated via invite code')

    // Clear the sign-in cookie used for credential verification so the next login picks up the new role.
    await supabase.auth.signOut().catch(() => {})

    return NextResponse.json(
      {
        data: {
          activated: true,
          role: redeemed.role,
          message: `Account activated successfully as ${redeemed.role.toUpperCase()}! You can now access your dashboard.`,
        },
      },
      { status: 200, headers },
    )
  } catch (err: unknown) {
    logger.error({ requestId, errorType: err instanceof Error ? err.name : typeof err }, 'Invite redemption failed')
    return NextResponse.json({ error: 'Unable to activate account. Please try again.' }, { status: 500, headers })
  }
}

export const POST = withApi({ public: true }, async ({ request, requestId }) => postRedeemInvite(request, requestId))
