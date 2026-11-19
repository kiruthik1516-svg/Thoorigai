import { NextResponse } from 'next/server'
import type { SupabaseClient, User } from '@supabase/supabase-js'
import { attendanceSchema } from '@/lib/validation'
import { unexpectedApiError } from '@/lib/api-response'
import { normalizeJoined } from '@/lib/supabase/relations'
import z from 'zod'
import { decodeCursor, encodeCursor, pagePaginationFromSearchParams } from '@/lib/pagination'
import { withApi } from '@/lib/http/handler'
import { rolesFor } from '@/lib/auth/permissions'
import { sameCourse } from '@/lib/courses/match'

// F-21: studentId is either a register number (what the UI shows) or the student row UUID.
const studentFilterSchema = z.union([z.string().regex(/^\d{1,9}$/), z.guid()])

// F-29: authentication, the role check and the RLS-bound client come from withApi.
async function getAttendance(request: Request, supabase: SupabaseClient) {
  try {
    const { searchParams } = new URL(request.url)
    const studentId = searchParams.get('studentId')
    const courseId = searchParams.get('courseId')
    const startDate = searchParams.get('startDate')
    const endDate = searchParams.get('endDate')
    const pagination = pagePaginationFromSearchParams(searchParams)
    const keyset = searchParams.has('cursor') || !searchParams.has('page')

    const studentFilter = studentId ? studentFilterSchema.safeParse(studentId) : null
    if (studentFilter && !studentFilter.success) {
      return NextResponse.json(
        { error: { message: 'studentId must be a register number or student id.' } },
        { status: 400 },
      )
    }
    const byRegisterId = Boolean(studentFilter?.success && /^\d+$/.test(studentFilter.data))
    const studentJoin = byRegisterId
      ? 'students!attendance_student_id_fkey!inner (register_id, name)'
      : 'students!attendance_student_id_fkey (register_id, name)'

    let query = supabase.from('attendance').select(
      `
        id,
        student_id,
        course_id,
        session_date,
        status,
        marked_by,
        created_at,
        ${studentJoin},
        courses!attendance_course_id_fkey (id, name),
        profiles!attendance_marked_by_fkey (id, full_name, role)
      `,
      keyset ? undefined : { count: 'exact' },
    )

    if (studentFilter?.success) {
      query = byRegisterId
        ? query.eq('students.register_id', Number(studentFilter.data))
        : query.eq('student_id', studentFilter.data)
    }
    if (courseId) query = query.eq('course_id', courseId)
    if (startDate) query = query.gte('session_date', startDate)
    if (endDate) query = query.lte('session_date', endDate)

    const cursorToken = searchParams.get('cursor')
    if (keyset && cursorToken) {
      const cursor = decodeCursor(
        cursorToken,
        z.object({ date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/), id: z.guid() }),
      )
      query = query.or(`session_date.lt.${cursor.date},and(session_date.eq.${cursor.date},id.lt.${cursor.id})`)
    }

    const orderedQuery = keyset
      ? query
          .order('session_date', { ascending: false })
          .order('id', { ascending: false })
          .limit(pagination.pageSize + 1)
      : query
          .order('session_date', { ascending: false })
          .order('id', { ascending: false })
          .range(pagination.offset, pagination.offset + pagination.limit - 1)
    const { data: rawData, error, count } = await orderedQuery

    if (error) throw error
    const hasMore = Boolean(keyset && rawData && rawData.length > pagination.pageSize)
    const data = keyset ? (rawData ?? []).slice(0, pagination.pageSize) : rawData
    const last = data?.at(-1)
    const nextCursor = hasMore && last ? encodeCursor({ date: String(last.session_date), id: String(last.id) }) : null

    const formattedData = (data || []).map((record) => {
      const student = normalizeJoined(record.students)
      const course = normalizeJoined(record.courses)
      const profile = normalizeJoined(record.profiles)
      return {
        id: record.id,
        studentId: student?.register_id,
        studentName: student?.name,
        courseId: course?.id,
        courseName: course?.name,
        sessionDate: record.session_date,
        status: record.status === 'Excused' ? 'Exempt' : record.status,
        markedBy: profile ? { id: profile.id, fullName: profile.full_name, role: profile.role } : null,
        createdAt: record.created_at,
      }
    })

    return NextResponse.json({
      data: formattedData,
      count: data?.length || 0,
      page: pagination.page,
      pageSize: pagination.pageSize,
      totalCount: count || 0,
      hasMore: keyset ? hasMore : pagination.offset + pagination.limit < (count || 0),
      ...(keyset ? { nextCursor } : {}),
    })
  } catch (error) {
    return unexpectedApiError(error, 'Unable to load attendance')
  }
}

async function postAttendance(
  body: z.infer<typeof attendanceSchema>,
  supabase: SupabaseClient,
  user: User,
  role: string | undefined,
) {
  try {
    const { studentId, courseId, sessionDate, status } = body

    const { data: studentData, error: studentError } = await supabase
      .from('students')
      .select('id, register_id, name, course')
      .eq('register_id', studentId)
      .maybeSingle()
    if (studentError) return unexpectedApiError(studentError, 'Unable to load attendance student')
    if (!studentData) return NextResponse.json({ error: { message: 'Student not found' } }, { status: 404 })

    const { data: courseData, error: courseError } = await supabase
      .from('courses')
      .select('id, name')
      .eq('id', courseId)
      .maybeSingle()
    if (courseError) return unexpectedApiError(courseError, 'Unable to load attendance course')
    if (!courseData) return NextResponse.json({ error: { message: 'Course not found' } }, { status: 404 })
    if (!sameCourse(studentData.course, courseData)) {
      return NextResponse.json({ error: { message: 'Student is not enrolled in this course.' } }, { status: 400 })
    }

    const { data: attendanceRecord, error: attendanceError } = await supabase
      .from('attendance')
      .upsert(
        {
          student_id: studentData.id,
          course_id: courseId,
          session_date: sessionDate,
          status,
          marked_by: user.id,
        },
        { onConflict: 'student_id,course_id,session_date', ignoreDuplicates: false },
      )
      .select()
      .single()
    if (attendanceError) throw attendanceError

    const { data: marker } = await supabase.from('profiles').select('full_name').eq('id', user.id).maybeSingle()

    return NextResponse.json(
      {
        data: {
          id: attendanceRecord.id,
          studentId: studentData.register_id,
          studentName: studentData.name,
          courseId: courseData.id,
          courseName: courseData.name,
          sessionDate: attendanceRecord.session_date,
          status: attendanceRecord.status,
          markedBy: { id: attendanceRecord.marked_by, fullName: marker?.full_name ?? null, role },
          createdAt: attendanceRecord.created_at,
        },
        message: 'Attendance marked successfully',
      },
      { status: 200 },
    )
  } catch (error) {
    return unexpectedApiError(error, 'Unable to mark attendance')
  }
}

export const GET = withApi({ roles: rolesFor('attendance', 'read') }, async ({ request, supabase }) =>
  getAttendance(request, supabase!),
)
export const POST = withApi(
  { roles: rolesFor('attendance', 'create'), body: attendanceSchema },
  async ({ body, supabase, user, role }) => postAttendance(body, supabase!, user!, role),
)
