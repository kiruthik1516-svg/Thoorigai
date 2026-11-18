import { z } from 'zod'
import { apiResult, withApi } from '@/lib/http/handler'
import { getCurrentProfile } from '@/lib/auth/current-profile'
import { listUserNotifications, markNotificationRead, markAllNotificationsRead } from '@/modules/notifications/service'
import type { AppNotification } from '@/modules/notifications/types'

export type { AppNotification }

const patchNotificationSchema = z.object({
  id: z.string().optional(),
  all: z.boolean().optional(),
})

export const GET = withApi({ roles: ['admin', 'staff'] as const }, async ({ user, role }) => {
  const profile = await getCurrentProfile()
  const userId = user?.id || profile.id
  const userRole = role || profile.role || 'staff'
  const notifications = await listUserNotifications(userId, userRole)
  return apiResult(notifications)
})

export const PATCH = withApi(
  {
    roles: ['admin', 'staff'] as const,
    body: patchNotificationSchema,
  },
  async ({ user, role, body }) => {
    const profile = await getCurrentProfile()
    const userId = user?.id || profile.id
    const userRole = role || profile.role || 'staff'
    if (body.all) {
      await markAllNotificationsRead(userId, userRole)
      return apiResult({ success: true, message: 'All notifications marked as read' })
    }
    if (body.id) {
      await markNotificationRead(userId, body.id)
      return apiResult({ success: true, message: 'Notification marked as read' })
    }
    return apiResult({ success: false, message: 'No action specified' })
  },
)

// F-10: there is intentionally no POST handler. Notifications are created only by server code
// (modules/notifications/service.ts) with the service role.
