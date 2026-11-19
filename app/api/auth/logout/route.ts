import { z } from 'zod'
import { apiResult, withApi } from '@/lib/http/handler'

// F-45: any signed-in account may sign out (it was gated on the reports permission).
// scope=global signs out every device ("sign out everywhere").
const logoutQuerySchema = z.object({ scope: z.enum(['local', 'global']).default('local') })

export const POST = withApi(
  {
    roles: ['admin', 'staff', 'pending'],
    query: logoutQuerySchema,
    mutationContentTypes: ['application/json', ''],
  },
  async ({ supabase, query }) => {
    const { error } = await supabase!.auth.signOut({ scope: query.scope })
    if (error) throw error
    return apiResult({ message: query.scope === 'global' ? 'Signed out on every device.' : 'Signed out.' })
  },
)
