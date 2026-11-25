import { NextResponse } from 'next/server'
import { createHash } from 'node:crypto'
import { z } from 'zod'
import { createClient } from '@/lib/supabase/server'
import { validateMutationRequest } from '@/lib/security/csrf'
import { rateLimit } from '@/lib/security/rate-limit'
import { withApi } from '@/lib/http/handler'
import { logger, logProductEvent } from '@/lib/logger'
import { getSupabaseAdminClient } from '@/lib/supabase/admin'

// F-31: callers get fixed messages; logs carry the request id and error code, never the email.
const GENERIC_FAILURE = 'Unable to sign in. Please try again.'
const failureMessages: Record<string, string> = {
  invalid_credentials: 'Incorrect email or password.',
  email_not_confirmed: 'Please confirm your email address before signing in.',
  user_banned: 'This account has been disabled. Contact your academy administrator.',
}

const credentialsSchema = z.object({
  email: z.string().email().max(254),
  password: z.string().min(1).max(1024),
})

async function postLogin(request: Request, requestId: string) {
  const csrfResponse = validateMutationRequest(request)
  if (csrfResponse) return csrfResponse
  try {
    const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown'
    const parsed = credentialsSchema.safeParse(await request.json().catch(() => null))
    if (!parsed.success) return NextResponse.json({ error: 'Unable to sign in. Please try again.' }, { status: 400 })
    // Everyone in one office shares an IP, so the tight limit is per account (and IP); the IP-wide
    // limit is looser and only stops bulk guessing. The email is hashed, never stored as a key.
    const account = createHash('sha256').update(parsed.data.email.trim().toLowerCase()).digest('hex').slice(0, 32)
    const limits = await Promise.all([
      rateLimit(`login:${ip}:${account}`, 5, '15 m'),
      rateLimit(`login:${ip}`, 40, '15 m'),
    ])
    const blocked = limits.find((limit) => !limit.success)
    if (blocked) {
      return NextResponse.json(
        { error: 'Too many sign-in attempts. Please wait a few minutes and try again.' },
        {
          status: 429,
          headers: { 'Retry-After': String(blocked.retryAfterSeconds), 'x-request-id': requestId },
        },
      )
    }
    const supabase = await createClient(requestId)
    const { data: authData, error } = await supabase.auth.signInWithPassword(parsed.data)
    if (error) {
      logger.warn({ event: 'login_failed', requestId, code: error.code, status: error.status }, 'Sign-in failed')
      logProductEvent('login_failed', requestId)
      return NextResponse.json(
        { error: (error.code && failureMessages[error.code]) || GENERIC_FAILURE },
        {
          status: 401,
          headers: { 'x-request-id': requestId },
        },
      )
    }
    if (authData?.user) {
      // Query profiles table via adminClient to avoid RLS limitations and stale JWT claims
      const adminClient = getSupabaseAdminClient(requestId, authData.user.id)
      const { data: profile } = await adminClient
        .from('profiles')
        .select('role')
        .eq('id', authData.user.id)
        .maybeSingle()

      const currentRole = profile?.role || (authData.user.app_metadata?.role as string | undefined)?.toLowerCase()

      // If user's profile is still pending, block access
      if (currentRole === 'pending') {
        await supabase.auth.signOut()
        return NextResponse.json(
          {
            error: 'Your account is pending administrator approval. Please contact your academy administrator.',
            code: 'ACCOUNT_PENDING_APPROVAL',
          },
          { status: 403, headers: { 'x-request-id': requestId } },
        )
      }

      // If user is active in profiles (admin or staff), ensure app_metadata is synchronized
      const metaRole = (authData.user.app_metadata?.role as string | undefined)?.toLowerCase()
      if (profile?.role && profile.role !== metaRole && (profile.role === 'admin' || profile.role === 'staff')) {
        await adminClient.auth.admin
          .updateUserById(authData.user.id, {
            app_metadata: { role: profile.role },
          })
          .catch(() => {})
      }
    }

    return NextResponse.json({ data: { signedIn: true } }, { headers: { 'x-request-id': requestId } })
  } catch (err) {
    logger.error({ event: 'login_error', requestId, err }, 'Sign-in request failed')
    return NextResponse.json(
      { error: GENERIC_FAILURE },
      {
        status: 500,
        headers: { 'x-request-id': requestId },
      },
    )
  }
}

export const POST = withApi({ public: true }, async ({ request, requestId }) => postLogin(request, requestId))
