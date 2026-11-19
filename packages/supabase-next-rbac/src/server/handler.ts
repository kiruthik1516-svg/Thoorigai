import { NextResponse } from 'next/server'
import type { SupabaseClient, User } from '@supabase/supabase-js'
import { ZodError, type ZodTypeAny, z } from 'zod'
import type { RbacEngine, UserProfile } from '../types'
import { ForbiddenError, RbacError, UnauthorizedError, ValidationError } from '../core/errors'
import { validateMutationRequest } from './csrf'

export type WithApiContext<TQuery, TBody, TParams, TRole extends string> = {
  request: Request
  requestId: string
  query: TQuery
  body: TBody
  params: TParams
  user?: User
  profile?: UserProfile<TRole>
  role?: TRole
  supabase: SupabaseClient
}

export type RouteOptions<TRole extends string> = {
  query?: ZodTypeAny
  body?: ZodTypeAny
  params?: ZodTypeAny
  successStatus?: number
  roles?: readonly TRole[]
  public?: boolean
}

type InferSchema<TSchema> = TSchema extends ZodTypeAny ? z.infer<TSchema> : undefined

/**
 * Creates the `withApi` route wrapper parameterized by your project's RBAC engine
 * and Supabase client factory.
 */
export function createApiHandlerFactory<
  TRole extends string,
  TResource extends string,
  TAction extends string,
>(config: {
  createClient: (requestId?: string) => Promise<SupabaseClient>
  rbac: RbacEngine<TRole, TResource, TAction>
}) {
  const { createClient, rbac } = config

  return function withApi<TOptions extends RouteOptions<TRole>, TResult>(
    options: TOptions,
    handler: (
      context: WithApiContext<
        InferSchema<TOptions['query']>,
        InferSchema<TOptions['body']>,
        InferSchema<TOptions['params']>,
        TRole
      >,
    ) => Promise<TResult> | TResult,
  ) {
    return async (request: Request, routeContext?: { params?: Promise<Record<string, string>> }) => {
      const requestId = request.headers.get('x-request-id')?.trim() || crypto.randomUUID()

      try {
        // 1. CSRF Protection for state mutations
        if (['POST', 'PUT', 'PATCH', 'DELETE'].includes(request.method.toUpperCase())) {
          const csrfError = validateMutationRequest(request)
          if (csrfError) return csrfError
        }

        const supabase = await createClient(requestId)
        let user: User | undefined
        let profile: UserProfile<TRole> | undefined
        let role: TRole | undefined

        // 2. Authentication & Authorization
        if (!options.public) {
          const { data, error } = await supabase.auth.getUser()
          if (error || !data.user) {
            throw new UnauthorizedError()
          }
          user = data.user

          const { data: profileData, error: profileError } = await supabase
            .from('profiles')
            .select('id, role, full_name, metadata, created_at')
            .eq('id', user.id)
            .maybeSingle()

          if (profileError || !profileData) {
            throw new UnauthorizedError('User profile was not found.')
          }

          role = profileData.role as TRole
          profile = {
            id: user.id,
            role,
            fullName: profileData.full_name ?? '',
            metadata: profileData.metadata ?? {},
            createdAt: profileData.created_at,
          }

          if (options.roles && options.roles.length > 0) {
            if (!role || !options.roles.includes(role)) {
              throw new ForbiddenError()
            }
          }
        }

        // 3. Request parsing & validation
        type Context = Parameters<typeof handler>[0]
        let query: unknown = undefined
        if (options.query) {
          const searchParams = Object.fromEntries(new URL(request.url).searchParams.entries())
          query = options.query.parse(searchParams)
        }

        let body: unknown = undefined
        if (options.body) {
          try {
            const rawBody = await request.json()
            body = options.body.parse(rawBody)
          } catch (err) {
            if (err instanceof ZodError) {
              throw new ValidationError('Invalid request body.', err.issues)
            }
            throw new ValidationError('Request body must be valid JSON.')
          }
        }

        let params: unknown = undefined
        if (options.params) {
          const rawParams = routeContext?.params ? await routeContext.params : {}
          params = options.params.parse(rawParams)
        }

        // 4. Execute route handler
        const result = await handler({
          request,
          requestId,
          // Each value was produced by the matching schema's parse(), so it has the inferred type.
          query: query as Context['query'],
          body: body as Context['body'],
          params: params as Context['params'],
          user,
          profile,
          role,
          supabase,
        })

        if (result instanceof Response) {
          result.headers.set('x-request-id', requestId)
          return result
        }

        return NextResponse.json(
          { data: result },
          { status: options.successStatus ?? 200, headers: { 'x-request-id': requestId } },
        )
      } catch (error) {
        if (error instanceof ZodError) {
          return NextResponse.json(
            { error: { code: 'VALIDATION_ERROR', message: 'Validation failed.', details: error.issues, requestId } },
            { status: 400, headers: { 'x-request-id': requestId } },
          )
        }

        if (error instanceof RbacError) {
          return NextResponse.json(
            { error: { code: error.code, message: error.message, details: error.details, requestId } },
            { status: error.status, headers: { 'x-request-id': requestId } },
          )
        }

        const message = error instanceof Error ? error.message : 'An unexpected server error occurred.'
        return NextResponse.json(
          { error: { code: 'INTERNAL_ERROR', message, requestId } },
          { status: 500, headers: { 'x-request-id': requestId } },
        )
      }
    }
  }
}
