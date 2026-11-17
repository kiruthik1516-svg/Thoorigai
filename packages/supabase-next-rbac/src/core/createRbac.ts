import type { RbacConfig, RbacEngine } from '../types'
import { ForbiddenError, UnauthorizedError } from './errors'

/**
 * Creates a type-safe Role-Based Access Control (RBAC) engine.
 *
 * @example
 * ```ts
 * export const rbac = createRbac({
 *   roles: ['admin', 'staff', 'pending'] as const,
 *   resources: ['students', 'invoices', 'users'] as const,
 *   defaultRole: 'pending',
 *   matrix: {
 *     admin: { students: ['read', 'create', 'update', 'delete'], users: ['manage'] },
 *     staff: { students: ['read', 'create'] },
 *     pending: {},
 *   },
 * })
 * ```
 */
export function createRbac<const TRole extends string, const TResource extends string, const TAction extends string>(
  config: RbacConfig<TRole, TResource, TAction>,
): RbacEngine<TRole, TResource, TAction> {
  const adminRole = config.adminRole ?? (config.roles.includes('admin' as TRole) ? ('admin' as TRole) : config.roles[0])

  function can(role: TRole | null | undefined, resource: TResource, action: TAction): boolean {
    if (!role) return false
    const rolePermissions = config.matrix[role]
    if (!rolePermissions) return false
    const resourceActions = rolePermissions[resource]
    return Array.isArray(resourceActions) && resourceActions.includes(action)
  }

  function rolesFor(resource: TResource, action: TAction): readonly TRole[] {
    return config.roles.filter((role) => can(role, resource, action))
  }

  function requireRole(
    currentRole: TRole | null | undefined,
    allowedRoles: readonly TRole[],
  ): asserts currentRole is TRole {
    if (!currentRole) throw new UnauthorizedError()
    if (!allowedRoles.includes(currentRole)) throw new ForbiddenError()
  }

  return {
    roles: config.roles,
    resources: config.resources,
    defaultRole: config.defaultRole,
    adminRole,
    can,
    rolesFor,
    requireRole,
  }
}
