import { describe, expect, it, vi } from 'vitest'

vi.mock('server-only', () => ({}))
vi.hoisted(() => {
  // lib/env validates the public variables on import.
  process.env.NEXT_PUBLIC_SUPABASE_URL ??= 'https://project.supabase.co'
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ??= 'sb_publishable_test'
  process.env.NEXT_PUBLIC_VERIFY_BASE_URL ??= 'https://app.example'
  process.env.NEXT_PUBLIC_APP_URL ??= 'https://app.example'
})

import { readServerEnv } from './env.server'
import { allowedOrigins } from './security/csrf'

describe('server env validation (F-41)', () => {
  const base = { SUPABASE_SERVICE_ROLE_KEY: 'key' }

  it('accepts the minimal configuration', () => {
    expect(readServerEnv(base)).toMatchObject(base)
  })

  it('requires the Upstash URL and token together', () => {
    expect(() => readServerEnv({ ...base, UPSTASH_REDIS_REST_URL: 'https://redis.example' })).toThrow(
      'must be set together',
    )
  })

  it('refuses RATE_LIMIT_REQUIRE_REDIS=true without Upstash', () => {
    expect(() => readServerEnv({ ...base, RATE_LIMIT_REQUIRE_REDIS: 'true' })).toThrow('needs the Upstash variables')
  })

  it('rejects malformed ALLOWED_ORIGINS', () => {
    expect(() => readServerEnv({ ...base, ALLOWED_ORIGINS: 'not a url' })).toThrow('ALLOWED_ORIGINS')
  })
})

describe('allowed origins come from configuration (F-41)', () => {
  it('uses the app URL and ALLOWED_ORIGINS, and localhost only outside production', () => {
    const production = allowedOrigins({
      NODE_ENV: 'production',
      NEXT_PUBLIC_APP_URL: 'https://app.example/dashboard',
      ALLOWED_ORIGINS: 'https://admin.example, https://other.example',
    })
    expect([...production].sort()).toEqual(['https://admin.example', 'https://app.example', 'https://other.example'])
    expect(allowedOrigins({ NODE_ENV: 'development' }).has('http://localhost:3000')).toBe(true)
  })
})
