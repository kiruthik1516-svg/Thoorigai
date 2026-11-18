import 'server-only'
import { Ratelimit } from '@upstash/ratelimit'
import { Redis } from '@upstash/redis'
import { logger } from '@/lib/logger'

export type RateLimitWindow = '1 m' | '15 m'
export type RateLimitResult = { success: boolean; retryAfterSeconds: number }

/** Thrown when production requires Redis (RATE_LIMIT_REQUIRE_REDIS=true) and it is not configured. */
export class RateLimitUnavailableError extends Error {
  constructor() {
    super('Rate limiting is not configured')
    this.name = 'RateLimitUnavailableError'
  }
}

const redisLimiters = new Map<string, Ratelimit>()

const windowMs: Record<RateLimitWindow, number> = { '1 m': 60_000, '15 m': 900_000 }

// ── In-memory fallback ────────────────────────────────────────────────────
// Used in production only when Upstash is not configured. It is per server instance, so it is
// weaker than the shared Redis limiter, but it never silently allows unlimited requests (F-14).
const MAX_TRACKED_KEYS = 10_000
const memoryHits = new Map<string, number[]>()

export function memoryRateLimit(
  identifier: string,
  limit: number,
  duration: RateLimitWindow,
  now = Date.now(),
): RateLimitResult {
  const span = windowMs[duration]
  const key = `${duration}:${limit}:${identifier}`
  const recent = (memoryHits.get(key) ?? []).filter((at) => now - at < span)

  if (recent.length >= limit) {
    memoryHits.set(key, recent)
    const oldest = recent[0] ?? now
    return { success: false, retryAfterSeconds: Math.max(1, Math.ceil((oldest + span - now) / 1000)) }
  }

  recent.push(now)
  memoryHits.delete(key)
  memoryHits.set(key, recent)
  if (memoryHits.size > MAX_TRACKED_KEYS) {
    const oldestKey = memoryHits.keys().next().value
    if (oldestKey !== undefined) memoryHits.delete(oldestKey)
  }
  return { success: true, retryAfterSeconds: 0 }
}

/** Test helper. */
export function resetMemoryRateLimit() {
  memoryHits.clear()
}

let warnedMissingRedis = false

function isLocalPlaywrightRun() {
  try {
    const host = new URL(process.env.NEXT_PUBLIC_SUPABASE_URL ?? '').hostname
    return process.env.PLAYWRIGHT_TEST === '1' && ['127.0.0.1', 'localhost', '::1'].includes(host)
  } catch {
    return false
  }
}

export async function rateLimit(
  identifier: string,
  limit: number,
  duration: RateLimitWindow,
): Promise<RateLimitResult> {
  const url = process.env.UPSTASH_REDIS_REST_URL
  const token = process.env.UPSTASH_REDIS_REST_TOKEN

  if (!url || !token) {
    if (isLocalPlaywrightRun() || process.env.NODE_ENV !== 'production') {
      return { success: true, retryAfterSeconds: 0 }
    }
    if (process.env.RATE_LIMIT_REQUIRE_REDIS === 'true') {
      throw new RateLimitUnavailableError()
    }
    if (!warnedMissingRedis) {
      warnedMissingRedis = true
      logger.error(
        { event: 'rate_limit_degraded' },
        'Upstash Redis is not configured in production; using per-instance in-memory rate limiting',
      )
    }
    return memoryRateLimit(identifier, limit, duration)
  }

  const limiterKey = `${duration}:${limit}`
  let limiter = redisLimiters.get(limiterKey)
  if (!limiter) {
    limiter = new Ratelimit({
      redis: new Redis({ url, token }),
      limiter: Ratelimit.slidingWindow(limit, duration),
      prefix: 'thoorigai:ratelimit',
    })
    redisLimiters.set(limiterKey, limiter)
  }
  const result = await limiter.limit(identifier)
  return {
    success: result.success,
    retryAfterSeconds: Math.max(1, Math.ceil((result.reset - Date.now()) / 1000)),
  }
}
