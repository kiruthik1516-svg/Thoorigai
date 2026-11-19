/**
 * Extracts a user-facing message from any error body the API returns (F-22):
 *   { error: { message } }  withApi failures
 *   { error: 'text' }       older route responses
 *   { error: [{ message }] } validation issues
 *   { message: 'text' }
 * Anything else falls back, so users never see "[object Object]".
 */
export function apiErrorMessage(body: unknown, fallback: string): string {
  if (!body || typeof body !== 'object') return fallback
  const record = body as Record<string, unknown>
  const error = record.error
  if (typeof error === 'string' && error.trim()) return error
  if (Array.isArray(error)) {
    const first = error.find((issue) => issue && typeof issue === 'object' && typeof issue.message === 'string')
    if (first) return String((first as { message: string }).message)
  }
  if (error && typeof error === 'object' && typeof (error as Record<string, unknown>).message === 'string') {
    return (error as { message: string }).message
  }
  if (typeof record.message === 'string' && record.message.trim()) return record.message
  return fallback
}
