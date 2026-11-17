import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

export type RbacMiddlewareOptions = {
  supabaseUrl: string
  supabaseAnonKey: string
  publicPaths?: readonly string[]
  loginPath?: string
  pendingPath?: string
}

const defaultPublicPaths = [
  '/login',
  '/signup',
  '/pending-approval',
  '/api/auth/login',
  '/api/auth/signup',
  '/api/auth/logout',
  '/api/auth/verify-invite',
  '/api/auth/redeem-invite',
  '/api/health',
  '/api/ready',
]

/**
 * Creates Next.js proxy/middleware session updater with Supabase SSR cookie synchronization.
 *
 * @example
 * ```ts
 * // proxy.ts or middleware.ts
 * import { createRbacMiddleware } from '@repo/supabase-next-rbac/server'
 *
 * export const proxy = createRbacMiddleware({
 *   supabaseUrl: process.env.NEXT_PUBLIC_SUPABASE_URL!,
 *   supabaseAnonKey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
 * })
 *
 * export const config = {
 *   matcher: ['/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)'],
 * }
 * ```
 */
export function createRbacMiddleware(options: RbacMiddlewareOptions) {
  const publicPaths = options.publicPaths ?? defaultPublicPaths
  const loginPath = options.loginPath ?? '/login'

  return async function rbacMiddleware(request: NextRequest): Promise<NextResponse> {
    const pathname = request.nextUrl.pathname
    const isPublic = publicPaths.some((p) => pathname === p || pathname.startsWith(`${p}/`))

    if (isPublic) {
      return NextResponse.next({ request })
    }

    let response = NextResponse.next({ request })

    const supabase = createServerClient(options.supabaseUrl, options.supabaseAnonKey, {
      cookies: {
        getAll: () => request.cookies.getAll(),
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value))
          response = NextResponse.next({ request })
          cookiesToSet.forEach(({ name, value, options }) => response.cookies.set(name, value, options))
        },
      },
    })

    try {
      const { data, error } = await supabase.auth.getClaims()

      if (error || !data?.claims) {
        if (pathname.startsWith('/api/')) {
          return NextResponse.json(
            { error: { code: 'UNAUTHORIZED', message: 'Authentication is required.' } },
            { status: 401 },
          )
        }
        const redirectUrl = request.nextUrl.clone()
        redirectUrl.pathname = loginPath
        return NextResponse.redirect(redirectUrl)
      }

      return response
    } catch {
      if (pathname.startsWith('/api/')) {
        return NextResponse.json(
          { error: { code: 'SERVICE_UNAVAILABLE', message: 'Authentication service is unavailable.' } },
          { status: 503 },
        )
      }
      const redirectUrl = request.nextUrl.clone()
      redirectUrl.pathname = loginPath
      return NextResponse.redirect(redirectUrl)
    }
  }
}
