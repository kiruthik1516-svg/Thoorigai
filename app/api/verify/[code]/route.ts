import { NextResponse } from 'next/server'
import * as Sentry from '@sentry/nextjs'
import { createClient } from '@/lib/supabase/server'
import { logger, logProductEvent } from '@/lib/logger'
import { withApi } from '@/lib/http/handler'
import { z } from 'zod'

const invalid = {
  status: 'Invalid' as const,
  document_type: null,
  student_name: null,
  course_name: null,
  issue_date: null,
  invoice_number: null,
}

/**
 * Verification codes come from `generateVerificationCode` (URL-safe base64 alphabet). `_` and `-` are legal
 * characters, so safety comes from exact equality in `public_verify_document`, not from this filter. The
 * filter only rejects input that can never be a code before it costs a database round trip.
 */
const VERIFICATION_CODE_PATTERN = /^[A-Za-z0-9_-]{6,128}$/

function parseCode(rawCode: string): string | null {
  // Next.js has already decoded the path segment once. Older links may still be double-encoded, so try one more
  // decode but never let a malformed escape sequence (for example a bare `%`) throw.
  let code = rawCode
  try {
    code = decodeURIComponent(rawCode)
  } catch {
    code = rawCode
  }
  code = code.trim().replace(/^['"]|['"]$/g, '')
  return VERIFICATION_CODE_PATTERN.test(code) ? code : null
}

async function verifyDocument(requestId: string, rawCode: string) {
  const headers = {
    'Cache-Control': 'no-store, max-age=0',
    'X-Robots-Tag': 'noindex, nofollow',
    'x-request-id': requestId,
  }

  const code = parseCode(rawCode)
  if (!code) {
    logProductEvent('verification_hit', requestId, { valid: false })
    return NextResponse.json({ data: invalid }, { headers })
  }

  // The RPC is the only lookup path: exact match on verification_code, revocation always enforced.
  // There is intentionally no service-role fallback and no lookup by invoice number or certificate id.
  try {
    const supabase = await createClient(requestId)
    const { data, error } = await supabase.rpc('public_verify_document', { p_code: code })
    if (error) throw error

    const row = Array.isArray(data) ? data[0] : undefined
    const valid = row?.status === 'Valid'
    logProductEvent('verification_hit', requestId, { valid })
    return NextResponse.json({ data: valid ? row : invalid }, { headers })
  } catch (error) {
    logger.error(
      { requestId, errorType: error instanceof Error ? error.name : typeof error },
      'Document verification failed',
    )
    Sentry.captureException(error, { tags: { request_id: requestId, route: '/api/verify/[code]' } })
    // Distinguish an outage from an invalid document so the page does not tell a holder their document is revoked.
    return NextResponse.json(
      { error: { code: 'VERIFICATION_UNAVAILABLE', message: 'Verification is temporarily unavailable.', requestId } },
      { status: 503, headers: { ...headers, 'Retry-After': '30' } },
    )
  }
}

export const GET = withApi({ public: true, params: z.object({ code: z.string() }) }, async ({ params, requestId }) =>
  verifyDocument(requestId, params.code),
)
