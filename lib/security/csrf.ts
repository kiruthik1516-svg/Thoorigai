import { NextResponse } from 'next/server'
import { currentRequestId } from '@/lib/observability/request-context'

const DEV_ORIGINS = ['http://localhost:3000', 'http://127.0.0.1:3000', 'http://localhost:3001', 'http://127.0.0.1:3001']

/**
 * F-41: allowed origins come from configuration (NEXT_PUBLIC_APP_URL plus the optional
 * comma-separated ALLOWED_ORIGINS), not a hard-coded deployment host. Localhost is accepted only
 * outside production.
 */
export function allowedOrigins(env: Record<string, string | undefined> = process.env): Set<string> {
  const origins = new Set<string>()
  const add = (value: string | undefined) => {
    if (!value?.trim()) return
    try {
      origins.add(new URL(value.trim()).origin)
    } catch {
      // Ignore malformed entries; env validation reports them.
    }
  }
  add(env.NEXT_PUBLIC_APP_URL)
  for (const entry of (env.ALLOWED_ORIGINS ?? '').split(',')) add(entry)
  if (env.NODE_ENV !== 'production') DEV_ORIGINS.forEach(add)
  return origins
}

export function validateMutationRequest(request: Request, contentTypes = ['application/json']) {
  const requestId = currentRequestId()
  let allowed = false
  try {
    const appOrigin = new URL(process.env.NEXT_PUBLIC_APP_URL ?? request.url).origin
    const origin = request.headers.get('origin')
    const host = request.headers.get('x-forwarded-host') ?? request.headers.get('host')
    const contentType = request.headers.get('content-type')?.split(';', 1)[0]?.trim().toLowerCase()

    if (!origin || !host) {
      return NextResponse.json(
        { error: { code: 'FORBIDDEN', message: 'Request rejected.', requestId } },
        { status: 403, headers: { 'x-request-id': requestId } },
      )
    }

    const originUrl = new URL(origin)
    const originString = originUrl.origin
    const requestOrigin = new URL(request.url).origin

    const configured = allowedOrigins()
    const originMatches = originString === appOrigin || originString === requestOrigin || configured.has(originString)

    const hostMatches =
      host === new URL(appOrigin).host ||
      host === new URL(request.url).host ||
      host === originUrl.host ||
      [...configured].some((allowed) => new URL(allowed).host === host)

    allowed = originMatches && hostMatches && contentTypes.includes(contentType ?? '')
  } catch {
    allowed = false
  }
  if (allowed) return null
  return NextResponse.json(
    { error: { code: 'FORBIDDEN', message: 'Request rejected.', requestId } },
    {
      status: 403,
      headers: { 'x-request-id': requestId },
    },
  )
}
