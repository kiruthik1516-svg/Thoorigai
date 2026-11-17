import { NextResponse } from 'next/server'
import type { SupabaseClient } from '@supabase/supabase-js'
import { validateMutationRequest } from '../server/csrf'

export type LogoutHandlerOptions = {
  createClient: (requestId: string) => Promise<SupabaseClient>
}

/**
 * Creates a Next.js App Router POST handler for logging out and revoking auth tokens.
 */
export function createLogoutHandler(options: LogoutHandlerOptions) {
  return async function POST(request: Request) {
    const requestId = request.headers.get('x-request-id')?.trim() || crypto.randomUUID()

    const csrfError = validateMutationRequest(request, ['application/json', ''])
    if (csrfError) return csrfError

    try {
      const supabase = await options.createClient(requestId)
      await supabase.auth.signOut()
      return NextResponse.json({ data: { signedOut: true } }, { headers: { 'x-request-id': requestId } })
    } catch {
      return NextResponse.json({ data: { signedOut: true } }, { headers: { 'x-request-id': requestId } })
    }
  }
}
