import { NextResponse } from 'next/server'

/**
 * Validates Origin and Host headers on state-changing requests (POST, PUT, PATCH, DELETE)
 * to prevent Cross-Site Request Forgery (CSRF).
 */
export function validateMutationRequest(
  request: Request,
  allowedContentTypes: readonly string[] = ['application/json'],
): NextResponse | null {
  const method = request.method.toUpperCase()
  if (!['POST', 'PUT', 'PATCH', 'DELETE'].includes(method)) {
    return null
  }

  const origin = request.headers.get('origin')
  const host = request.headers.get('host')

  if (origin && host) {
    try {
      const originHost = new URL(origin).host
      if (originHost !== host) {
        return NextResponse.json({ error: 'Forbidden: cross-origin mutation rejected.' }, { status: 403 })
      }
    } catch {
      return NextResponse.json({ error: 'Forbidden: invalid origin header.' }, { status: 403 })
    }
  }

  if (allowedContentTypes.length > 0) {
    const contentType = request.headers.get('content-type') || ''
    const matches = allowedContentTypes.some((allowed) =>
      allowed === '' ? !contentType : contentType.toLowerCase().includes(allowed.toLowerCase()),
    )
    if (!matches) {
      return NextResponse.json(
        { error: `Unsupported media type. Expected: ${allowedContentTypes.join(', ')}` },
        { status: 415 },
      )
    }
  }

  return null
}
