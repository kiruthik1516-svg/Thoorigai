import { NextResponse } from 'next/server'
import { z } from 'zod'
import type { SupabaseClient } from '@supabase/supabase-js'
import { validateMutationRequest } from '../server/csrf'

const credentialsSchema = z.object({
  email: z.string().email().max(254),
  password: z.string().min(1).max(1024),
})

export type LoginHandlerOptions = {
  createClient: (requestId: string) => Promise<SupabaseClient>
  getAdminClient?: (requestId: string) => SupabaseClient
  defaultRole?: string
  rateLimiter?: (ip: string) => Promise<{ success: boolean; retryAfterSeconds?: number }>
}

/**
 * Creates a Next.js App Router POST handler for user login.
 * Automatically checks the `profiles` table to prevent `pending` accounts from gaining entry.
 */
export function createLoginHandler(options: LoginHandlerOptions) {
  const { createClient, getAdminClient, defaultRole = 'pending', rateLimiter } = options

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
            { error: 'Too many sign-in attempts. Please try again later.' },
            {
              status: 429,
              headers: { 'Retry-After': String(limit.retryAfterSeconds ?? 60), 'x-request-id': requestId },
            },
          )
        }
      }

      const body = await request.json().catch(() => null)
      const parsed = credentialsSchema.safeParse(body)
      if (!parsed.success) {
        return NextResponse.json(
          { error: 'Invalid email or password format.' },
          { status: 400, headers: { 'x-request-id': requestId } },
        )
      }

      const supabase = await createClient(requestId)
      const { data: authData, error: authError } = await supabase.auth.signInWithPassword(parsed.data)

      if (authError || !authData.user) {
        return NextResponse.json(
          { error: authError?.message || 'Invalid email or password.' },
          { status: 401, headers: { 'x-request-id': requestId } },
        )
      }

      // Check current profile role
      const dbClient = getAdminClient ? getAdminClient(requestId) : supabase
      const { data: profile } = await dbClient.from('profiles').select('role').eq('id', authData.user.id).maybeSingle()

      const currentRole = profile?.role || (authData.user.app_metadata?.role as string | undefined)

      // Block access if user is still pending administrator clearance
      if (currentRole === defaultRole) {
        await supabase.auth.signOut()
        return NextResponse.json(
          {
            error: 'Your account is pending administrator approval. Please contact your administrator.',
            code: 'ACCOUNT_PENDING_APPROVAL',
          },
          { status: 403, headers: { 'x-request-id': requestId } },
        )
      }

      // Synchronize app_metadata if adminClient is available
      if (getAdminClient && profile?.role) {
        const adminClient = getAdminClient(requestId)
        const metaRole = authData.user.app_metadata?.role
        if (profile.role !== metaRole) {
          await adminClient.auth.admin
            .updateUserById(authData.user.id, {
              app_metadata: { role: profile.role },
            })
            .catch(() => {})
        }
      }

      return NextResponse.json({ data: { signedIn: true } }, { headers: { 'x-request-id': requestId } })
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Unable to sign in.'
      return NextResponse.json({ error: message }, { status: 500, headers: { 'x-request-id': requestId } })
    }
  }
}
