import 'server-only'
import { createClient as createSupabaseClient } from '@supabase/supabase-js'
import { clientEnv } from '@/lib/env'
import { getServerEnv } from '@/lib/env.server'
import type { Database } from './database.types'

/**
 * Service-role client. Pass the signed-in user's id as `actorId` so the audit log records who
 * acted: the database trusts the x-actor-id header only on service-role requests.
 */
export function getSupabaseAdminClient(requestId?: string, actorId?: string) {
  const { SUPABASE_SERVICE_ROLE_KEY } = getServerEnv()
  const headers: Record<string, string> = {}
  if (requestId) headers['x-request-id'] = requestId
  if (actorId) headers['x-actor-id'] = actorId

  return createSupabaseClient<Database>(clientEnv.NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
    global: Object.keys(headers).length > 0 ? { headers } : undefined,
  })
}
