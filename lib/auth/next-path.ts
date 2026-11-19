/**
 * Validates a post-login redirect target (F-45). Only same-site absolute paths are allowed, so
 * "?next=" can never send a signed-in user to another origin ("//evil.example", "/\evil",
 * "https://...", "javascript:").
 */
export function safeNextPath(value: string | null | undefined, fallback = '/'): string {
  if (!value || value.length > 512) return fallback
  if (!value.startsWith('/') || value.startsWith('//') || value.startsWith('/\\')) return fallback
  if (/[\u0000-\u001f\u007f]/.test(value)) return fallback
  try {
    const url = new URL(value, 'https://app.invalid')
    if (url.origin !== 'https://app.invalid') return fallback
    if (url.pathname === '/login' || url.pathname.startsWith('/api/')) return fallback
    return `${url.pathname}${url.search}${url.hash}`
  } catch {
    return fallback
  }
}
