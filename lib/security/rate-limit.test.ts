import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('server-only', () => ({}))

const mocks = vi.hoisted(() => ({
  limit: vi.fn(),
}))

vi.mock('@upstash/ratelimit', () => {
  return {
    Ratelimit: class MockRatelimit {
      static slidingWindow = vi.fn()
      limit = mocks.limit
    },
  }
})

vi.mock('@/lib/logger', () => ({ logger: { error: vi.fn(), warn: vi.fn(), info: vi.fn() } }))

vi.mock('@upstash/redis', () => {
  return {
    Redis: class MockRedis {},
  }
})

import { memoryRateLimit, rateLimit, RateLimitUnavailableError, resetMemoryRateLimit } from './rate-limit'

describe('rate limit helper', () => {
  const originalEnv = { ...process.env }

  beforeEach(() => {
    vi.clearAllMocks()
    process.env = { ...originalEnv }
    delete process.env.UPSTASH_REDIS_REST_URL
    delete process.env.UPSTASH_REDIS_REST_TOKEN
    resetMemoryRateLimit()
  })

  afterEach(() => {
    vi.unstubAllEnvs()
  })

  it('bypasses when Upstash Redis is not configured in dev or test', async () => {
    vi.stubEnv('NODE_ENV', 'development')
    const res = await rateLimit('test-ip', 5, '1 m')
    expect(res).toEqual({ success: true, retryAfterSeconds: 0 })
  })

  it('bypasses in Playwright test environment with localhost', async () => {
    vi.stubEnv('PLAYWRIGHT_TEST', '1')
    vi.stubEnv('NEXT_PUBLIC_SUPABASE_URL', 'http://127.0.0.1:54321')
    const res = await rateLimit('test-ip', 5, '1 m')
    expect(res).toEqual({ success: true, retryAfterSeconds: 0 })
  })

  it('does not fail open in production without redis: falls back to an in-memory limit', async () => {
    vi.stubEnv('NODE_ENV', 'production')
    for (let i = 0; i < 3; i++) {
      await expect(rateLimit('prod-ip', 3, '1 m')).resolves.toMatchObject({ success: true })
    }
    const blocked = await rateLimit('prod-ip', 3, '1 m')
    expect(blocked.success).toBe(false)
    expect(blocked.retryAfterSeconds).toBeGreaterThan(0)
    // Other identifiers are unaffected.
    await expect(rateLimit('other-ip', 3, '1 m')).resolves.toMatchObject({ success: true })
  })

  it('fails closed in production when RATE_LIMIT_REQUIRE_REDIS=true and redis is missing', async () => {
    vi.stubEnv('NODE_ENV', 'production')
    vi.stubEnv('RATE_LIMIT_REQUIRE_REDIS', 'true')
    await expect(rateLimit('test-ip', 5, '1 m')).rejects.toBeInstanceOf(RateLimitUnavailableError)
  })

  it('in-memory limiter frees capacity once the window passes', () => {
    const start = 1_000_000
    expect(memoryRateLimit('k', 1, '1 m', start).success).toBe(true)
    expect(memoryRateLimit('k', 1, '1 m', start + 1_000).success).toBe(false)
    expect(memoryRateLimit('k', 1, '1 m', start + 61_000).success).toBe(true)
  })

  it('calls Upstash limiter when redis is configured', async () => {
    process.env.UPSTASH_REDIS_REST_URL = 'https://fake-redis.upstash.io'
    process.env.UPSTASH_REDIS_REST_TOKEN = 'secret-token'
    mocks.limit.mockResolvedValueOnce({
      success: true,
      reset: Date.now() + 30000,
    })

    const res = await rateLimit('client-1', 10, '1 m')
    expect(res.success).toBe(true)
    expect(res.retryAfterSeconds).toBeGreaterThanOrEqual(1)
  })

  it('handles rate-limited response when limit exceeded', async () => {
    process.env.UPSTASH_REDIS_REST_URL = 'https://fake-redis.upstash.io'
    process.env.UPSTASH_REDIS_REST_TOKEN = 'secret-token'
    mocks.limit.mockResolvedValueOnce({
      success: false,
      reset: Date.now() + 45000,
    })

    const res = await rateLimit('client-2', 5, '15 m')
    expect(res.success).toBe(false)
    expect(res.retryAfterSeconds).toBeGreaterThan(0)
  })
})
