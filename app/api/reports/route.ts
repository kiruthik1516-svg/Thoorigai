import { apiResult, withApi } from '@/lib/http/handler'
import { can, rolesFor } from '@/lib/auth/permissions'
import { getDashboardSummary } from '@/modules/dashboard/service'

/** Dashboard totals. Staff do not see money, so they get only the enrolment figures. */
export const GET = withApi({ roles: rolesFor('reports', 'read') }, async ({ role }) => {
  const summary = await getDashboardSummary()
  if (can(role, 'payments', 'read')) return apiResult(summary)
  return apiResult({ studentCount: summary.studentCount, courseMix: summary.courseMix })
})
