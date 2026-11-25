import 'server-only'
import { createClient } from '@/lib/supabase/server'
import { normalizeJoined } from '@/lib/supabase/relations'
import { lookupProfileNames } from '@/lib/supabase/profile-names'
import { decodeCursor, encodeCursor } from '@/lib/pagination'
import { z } from 'zod'

export async function listAttendancePage(options: {
  page: number
  pageSize: number
  search: string
  sort: string
  direction: 'asc' | 'desc'
  keyset?: boolean
  cursor?: string
}) {
  const supabase = await createClient()
  const offset = (options.page - 1) * options.pageSize
  const search = (options.search ?? '')
    .trim()
    .slice(0, 100)
    .replace(/[\\%_,()]/g, ' ')
    .trim()
  // With a search the student embed must be !inner; otherwise the filter only blanks the embedded
  // student and every attendance row is still returned.
  const studentEmbed = search ? 'students!inner' : 'students'
  let query = supabase
    .from('attendance')
    .select(
      `id,student_id,course_id,session_date,status,marked_by,${studentEmbed}(register_id,name),courses(name)`,
      options.keyset ? undefined : { count: 'exact' },
    )
  const cursorSchema = z.object({ date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/), id: z.guid() })
  if (options.keyset && options.cursor) {
    const cursor = decodeCursor(options.cursor, cursorSchema)
    query = query.or(`session_date.lt.${cursor.date},and(session_date.eq.${cursor.date},id.lt.${cursor.id})`)
  }
  if (search) {
    query = query.or(`name.ilike.%${search}%,phone.ilike.%${search}%`, { referencedTable: 'students' })
  }
  const orderedQuery = options.keyset
    ? query
        .order('session_date', { ascending: false })
        .order('id', { ascending: false })
        .limit(options.pageSize + 1)
    : query
        .order('session_date', { ascending: options.direction === 'asc' })
        .order('id', { ascending: options.direction === 'asc' })
        .range(offset, offset + options.pageSize - 1)
  const { data: rawData, error, count } = await orderedQuery
  if (error) throw error
  const hasMore = Boolean(options.keyset && rawData && rawData.length > options.pageSize)
  const data = options.keyset ? (rawData ?? []).slice(0, options.pageSize) : rawData
  const markers = await lookupProfileNames(
    supabase,
    (data ?? []).map((row) => (row.marked_by ? String(row.marked_by) : null)),
  )
  return {
    totalCount: count ?? 0,
    ...(options.keyset
      ? {
          hasMore,
          nextCursor:
            hasMore && data?.length
              ? encodeCursor({ date: String(data[data.length - 1].session_date), id: String(data[data.length - 1].id) })
              : null,
        }
      : {}),
    data: (data ?? []).map((row) => {
      const student = normalizeJoined(row.students)
      const course = normalizeJoined(row.courses)
      const marker = row.marked_by ? markers.get(String(row.marked_by)) : undefined
      return {
        id: String(row.id),
        studentId: Number(student?.register_id),
        studentName: String(student?.name ?? ''),
        courseId: String(row.course_id),
        courseName: String(course?.name ?? ''),
        sessionDate: String(row.session_date),
        status: String(row.status),
        markedBy: marker?.fullName ? String(marker.fullName) : '—',
      }
    }),
  }
}
