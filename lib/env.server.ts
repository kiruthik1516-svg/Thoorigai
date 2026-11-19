import 'server-only'
import { z } from 'zod'
import { parseEnvironment } from '@/lib/env'

/**
 * F-41: every server-side variable the app reads, validated in one place. Optional values are
 * checked for shape when present; getServerEnv() throws with the list of problems.
 */
const optionalUrl = z
  .string()
  .trim()
  .url()
  .optional()
  .or(z.literal('').transform(() => undefined))

export const serverEnvSchema = z
  .object({
    SUPABASE_SERVICE_ROLE_KEY: z.string().min(1, 'is required for privileged Supabase access'),
    UPSTASH_REDIS_REST_URL: optionalUrl,
    UPSTASH_REDIS_REST_TOKEN: z.string().optional(),
    RATE_LIMIT_REQUIRE_REDIS: z.enum(['true', 'false']).optional(),
    ALLOWED_ORIGINS: z
      .string()
      .optional()
      .refine(
        (value) =>
          !value ||
          value.split(',').every((entry) => {
            try {
              return Boolean(new URL(entry.trim()).origin)
            } catch {
              return false
            }
          }),
        'must be a comma-separated list of absolute origins',
      ),
  })
  .refine((env) => Boolean(env.UPSTASH_REDIS_REST_URL) === Boolean(env.UPSTASH_REDIS_REST_TOKEN), {
    message: 'UPSTASH_REDIS_REST_URL and UPSTASH_REDIS_REST_TOKEN must be set together',
    path: ['UPSTASH_REDIS_REST_TOKEN'],
  })
  .refine((env) => env.RATE_LIMIT_REQUIRE_REDIS !== 'true' || Boolean(env.UPSTASH_REDIS_REST_URL), {
    message: 'RATE_LIMIT_REQUIRE_REDIS=true needs the Upstash variables',
    path: ['RATE_LIMIT_REQUIRE_REDIS'],
  })

export type ServerEnv = z.infer<typeof serverEnvSchema>

export function readServerEnv(values: Record<string, string | undefined> = process.env): ServerEnv {
  return parseEnvironment(serverEnvSchema, {
    SUPABASE_SERVICE_ROLE_KEY: values.SUPABASE_SERVICE_ROLE_KEY,
    UPSTASH_REDIS_REST_URL: values.UPSTASH_REDIS_REST_URL,
    UPSTASH_REDIS_REST_TOKEN: values.UPSTASH_REDIS_REST_TOKEN,
    RATE_LIMIT_REQUIRE_REDIS: values.RATE_LIMIT_REQUIRE_REDIS,
    ALLOWED_ORIGINS: values.ALLOWED_ORIGINS,
  })
}

export function getServerEnv() {
  return readServerEnv()
}
