import 'server-only'
import { after } from 'next/server'
import { logger } from '@/lib/logger'
import { createClient } from '@/lib/supabase/server'
import { likePattern } from '@/lib/server-data'
import type { AppNotification, CreateNotificationInput, NotificationType } from './types'

function formatRelativeTime(dateStr: string): string {
  try {
    const date = new Date(dateStr)
    const now = new Date()
    const diffSec = Math.floor((now.getTime() - date.getTime()) / 1000)
    if (diffSec < 60) return 'Just now'
    if (diffSec < 3600) return `${Math.floor(diffSec / 60)}m ago`
    if (diffSec < 86400) return `${Math.floor(diffSec / 3600)}h ago`
    if (diffSec < 604800) return `${Math.floor(diffSec / 86400)}d ago`
    return date.toLocaleDateString('en-IN', { month: 'short', day: 'numeric' })
  } catch {
    return 'Recent'
  }
}

const NOTIFICATION_LIMIT = 50

function accessibleFilter(userId: string, role: string) {
  const safeRole = role === 'admin' ? 'admin' : 'staff'
  return `user_id.eq.${userId},and(user_id.is.null,recipient_role.in.(${safeRole},all))`
}

export async function listUserNotifications(userId: string, role: string): Promise<AppNotification[]> {
  const supabase = await createClient()
  const { data: notifs, error } = await supabase
    .from('notifications')
    .select('id, title, message, type, link, urgent, entity_type, entity_id, created_at, recipient_role, user_id')
    .or(accessibleFilter(userId, role))
    .order('created_at', { ascending: false })
    .limit(NOTIFICATION_LIMIT)
  if (error) throw error
  if (!notifs || notifs.length === 0) return []

  // Only the markers for the notifications shown; an unbounded query would stop at the row cap.
  const { data: reads, error: readError } = await supabase
    .from('notification_reads')
    .select('notification_id')
    .eq('user_id', userId)
    .in(
      'notification_id',
      notifs.map((n) => n.id),
    )
  if (readError) throw readError
  const readSet = new Set((reads ?? []).map((r) => String(r.notification_id)))

  return notifs.map((n) => ({
    id: String(n.id),
    title: String(n.title),
    message: String(n.message),
    type: n.type as NotificationType,
    link: n.link ? String(n.link) : '/',
    timestamp: formatRelativeTime(n.created_at),
    urgent: Boolean(n.urgent),
    isRead: readSet.has(String(n.id)),
    createdAt: String(n.created_at),
    entityType: n.entity_type ? String(n.entity_type) : undefined,
    entityId: n.entity_id ? String(n.entity_id) : undefined,
  }))
}

export async function markNotificationRead(userId: string, notificationId: string): Promise<void> {
  const supabase = await createClient()
  const { error } = await supabase
    .from('notification_reads')
    .upsert(
      { user_id: userId, notification_id: notificationId, read_at: new Date().toISOString() },
      { onConflict: 'user_id,notification_id' },
    )
  if (error) throw error
}

/** Marks every notification the panel can show (the newest NOTIFICATION_LIMIT) as read. */
export async function markAllNotificationsRead(userId: string, role: string): Promise<void> {
  const supabase = await createClient()
  const { data: notifs, error } = await supabase
    .from('notifications')
    .select('id')
    .or(accessibleFilter(userId, role))
    .order('created_at', { ascending: false })
    .limit(NOTIFICATION_LIMIT)
  if (error) throw error
  if (!notifs || notifs.length === 0) return
  const readAt = new Date().toISOString()
  const { error: upsertError } = await supabase.from('notification_reads').upsert(
    notifs.map((n) => ({ user_id: userId, notification_id: n.id, read_at: readAt })),
    { onConflict: 'user_id,notification_id' },
  )
  if (upsertError) throw upsertError
}

/** Same rule as the notifications_link_internal constraint: a same-origin path, never `//host` or a URL. */
const INTERNAL_LINK = /^\/(?:[A-Za-z0-9_?=&.%-][A-Za-z0-9/_?=&.%-]*)?$/

export function isInternalLink(link: string | null | undefined): link is string {
  return typeof link === 'string' && INTERNAL_LINK.test(link)
}

/**
 * Runs after the response when inside a request; elsewhere (scripts, tests) it runs right away
 * and the returned promise settles when it is done.
 */
function runAfterResponse(task: () => Promise<void>): Promise<void> {
  try {
    after(task)
    return Promise.resolve()
  } catch {
    return task()
  }
}

function logNotificationFailure(error: unknown, message: string) {
  logger.error({ event: 'notification_failed', errorType: error instanceof Error ? error.name : typeof error }, message)
}

async function insertNotifications(inputs: CreateNotificationInput[], actorId?: string): Promise<void> {
  try {
    const { getSupabaseAdminClient } = await import('@/lib/supabase/admin')
    const supabase = getSupabaseAdminClient(undefined, actorId)
    const { error } = await supabase.from('notifications').insert(
      inputs.map((input) => ({
        recipient_role: input.recipientRole || 'all',
        user_id: input.userId || null,
        title: input.title,
        message: input.message,
        type: input.type || 'info',
        link: isInternalLink(input.link) ? input.link : '/',
        urgent: Boolean(input.urgent),
        entity_type: input.entityType || null,
        entity_id: input.entityId || null,
      })),
    )
    if (error) throw error
  } catch (error) {
    // A notification must never fail the request that triggered it; log it instead of hiding it.
    logNotificationFailure(error, 'Could not create notification')
  }
}

/**
 * Server-side only. Notifications are written with the service role (F-10): end users have no
 * INSERT privilege on public.notifications. The write runs after the response is sent (Next.js
 * after()), so it neither slows the request nor is lost when the serverless function freezes.
 */
export function createNotification(input: CreateNotificationInput, actorId?: string): Promise<void> {
  return runAfterResponse(() => insertNotifications([input], actorId))
}

/**
 * Notifies each trainer assigned to a course (one row per trainer), so staff only hear about
 * students in courses they can open. The acting user is not notified about their own action.
 */
export function notifyCourseTrainers(
  courseName: string,
  input: Omit<CreateNotificationInput, 'recipientRole' | 'userId'>,
  actorId?: string,
): Promise<void> {
  return runAfterResponse(async () => {
    try {
      const { getSupabaseAdminClient } = await import('@/lib/supabase/admin')
      const supabase = getSupabaseAdminClient(undefined, actorId)
      const pattern = likePattern(courseName.trim()).slice(1, -1)
      const { data: courses, error } = await supabase
        .from('courses')
        .select('id, course_trainers(trainer_id)')
        .ilike('name', pattern)
      if (error) throw error
      const trainerIds = new Set<string>()
      for (const course of courses ?? []) {
        for (const row of (course.course_trainers ?? []) as { trainer_id: string }[]) trainerIds.add(row.trainer_id)
      }
      if (actorId) trainerIds.delete(actorId)
      if (trainerIds.size === 0) return
      await insertNotifications(
        [...trainerIds].map((userId) => ({ ...input, userId, recipientRole: 'staff' as const })),
        actorId,
      )
    } catch (error) {
      logNotificationFailure(error, 'Could not notify course trainers')
    }
  })
}
