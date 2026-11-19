'use client'

import { createBrowserClient as createSupabaseBrowserClient } from '@supabase/ssr'
import { clientEnv } from '@/lib/env'
import type { Database } from './database.types'

export const supabaseBrowser = createSupabaseBrowserClient<Database>(
  clientEnv.NEXT_PUBLIC_SUPABASE_URL,
  clientEnv.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
  { auth: { detectSessionInUrl: false } },
)
