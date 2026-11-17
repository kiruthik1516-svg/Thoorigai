import { NextResponse } from 'next/server'
import { rateLimit } from '@/lib/security/rate-limit'
import { withApi } from '@/lib/http/handler'
import { getSupabaseAdminClient } from '@/lib/supabase/admin'
import { checkInviteCode, normalizeInviteCode } from '@/lib/auth/invite-codes'
import { logger } from '@/lib/logger'

const verifyMessages = {
  not_found: 'Invite code was not found. Please verify the code or request access without one.',
  used: 'This invite code has already been redeemed. Please request a new code.',
  expired: 'This invite code has expired. Please contact an administrator for a new code.',
  // Email binding is enforced at signup/redeem time; the public check does not reveal it.
  email_mismatch: 'Invite code was not found. Please verify the code or request access without one.',
} as const

async function getVerifyInvite(request: Request, requestId: string) {
  const headers = { 'x-request-id': requestId, 'Cache-Control': 'no-store' }
  try {
    const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown'
    const limit = await rateLimit(`verify-invite:${ip}`, 30, '1 m')
    if (!limit.success) {
      return NextResponse.json(
        { error: 'Too many verification attempts. Please wait a moment.' },
        { status: 429, headers: { ...headers, 'Retry-After': String(limit.retryAfterSeconds) } },
      )
    }

    const rawCode = new URL(request.url).searchParams.get('code')
    if (!rawCode || !rawCode.trim()) {
      return NextResponse.json({ valid: false, error: 'Please provide an invite code.' }, { status: 400, headers })
    }

    const code = normalizeInviteCode(rawCode)
    if (!code) {
      return NextResponse.json({ valid: false, error: verifyMessages.not_found }, { status: 200, headers })
    }

    const result = await checkInviteCode(getSupabaseAdminClient(requestId), code)
    if (!result.ok) {
      return NextResponse.json({ valid: false, error: verifyMessages[result.reason] }, { status: 200, headers })
    }

    return NextResponse.json(
      {
        valid: true,
        role: result.invite.role,
        // Tell the client the code is email-bound without disclosing the address.
        emailRestricted: Boolean(result.invite.recipient_email),
        expiresAt: result.invite.expires_at,
        message: `Valid ${result.invite.role.toUpperCase()} invite code.`,
      },
      { headers },
    )
  } catch (err: unknown) {
    logger.error({ requestId, errorType: err instanceof Error ? err.name : typeof err }, 'Invite verification failed')
    return NextResponse.json(
      { valid: false, error: 'Unable to verify code right now. Please try again.' },
      { status: 500, headers },
    )
  }
}

export const GET = withApi({ public: true }, async ({ request, requestId }) => getVerifyInvite(request, requestId))
