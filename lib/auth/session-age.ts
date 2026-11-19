/**
 * F-27: admin sessions must be re-authenticated after 12 hours. Supabase access tokens carry the
 * original sign-in time in `amr` (it does not change when the token is refreshed), so the check
 * needs no database call.
 */
export const ADMIN_SESSION_MAX_AGE_SECONDS = 12 * 60 * 60

type Claims = {
  amr?: unknown
  app_metadata?: Record<string, unknown> | null
}

/** Latest authentication time (seconds since epoch) recorded in the token, if any. */
export function authenticatedAt(claims: Claims): number | null {
  if (!Array.isArray(claims.amr)) return null
  const times = claims.amr
    .map((entry) => (entry && typeof entry === 'object' ? Number((entry as { timestamp?: unknown }).timestamp) : NaN))
    .filter((value) => Number.isFinite(value) && value > 0)
  return times.length > 0 ? Math.max(...times) : null
}

export function isAdminSessionExpired(claims: Claims, nowSeconds = Math.floor(Date.now() / 1000)): boolean {
  if (String(claims.app_metadata?.role ?? '').toLowerCase() !== 'admin') return false
  const signedInAt = authenticatedAt(claims)
  if (signedInAt === null) return false
  return nowSeconds - signedInAt > ADMIN_SESSION_MAX_AGE_SECONDS
}
