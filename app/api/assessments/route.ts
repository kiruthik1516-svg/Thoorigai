import { NextResponse } from 'next/server'
import type { SupabaseClient, User } from '@supabase/supabase-js'
import { assessmentSchema, safeFormUrl, safeSheetUrl } from '@/lib/validation'
import { unexpectedApiError } from '@/lib/api-response'
import { normalizeJoined } from '@/lib/supabase/relations'
import z from 'zod'
import { pagePaginationFromSearchParams } from '@/lib/pagination'
import { withApi } from '@/lib/http/handler'
import { rolesFor } from '@/lib/auth/permissions'
import type { Database, TablesInsert } from '@/lib/supabase/database.types'

type AssessmentListItem = {
  id: string
  courseId: string
  courseName: string | undefined
  title: string
  maxScore: number
  assessmentDate: string
  formUrl: ReturnType<typeof safeFormUrl>
  sheetUrl: ReturnType<typeof safeSheetUrl>
  createdBy: { id: string; fullName: string; role: string } | null
  createdAt: string | null
}

// F-29: authentication, the role check, CSRF and body validation happen in withApi.
async function getAssessments(req: Request, supabase: SupabaseClient<Database>) {
  try {
    const { searchParams } = new URL(req.url)
    const courseId = searchParams.get('courseId')
    const pagination = pagePaginationFromSearchParams(searchParams)

    let query = supabase.from('assessments').select(
      `
        id,
        course_id,
        title,
        max_score,
        assessment_date,
        form_url,
        sheet_url,
        created_by,
        created_at,
        courses!assessments_course_id_fkey (id, name),
        profiles!assessments_created_by_fkey (id, full_name, role)
      `,
      { count: 'exact' },
    )

    // Apply filters
    if (courseId) {
      query = query.eq('course_id', courseId)
    }

    let formattedData: AssessmentListItem[] = []
    let totalCount = 0

    const { data, error, count } = await query
      .order('assessment_date', { ascending: false })
      .range(pagination.offset, pagination.offset + pagination.limit - 1)

    if (!error && data) {
      totalCount = count || data.length
      formattedData = data.map((record) => {
        const course = normalizeJoined(record.courses)
        const profile = normalizeJoined(record.profiles)
        return {
          id: record.id,
          courseId: record.course_id,
          courseName: course?.name,
          title: record.title,
          maxScore: record.max_score,
          assessmentDate: record.assessment_date,
          formUrl: safeFormUrl(record.form_url),
          sheetUrl: safeSheetUrl(record.sheet_url),
          createdBy: profile
            ? {
                id: profile.id,
                fullName: profile.full_name,
                role: profile.role,
              }
            : null,
          createdAt: record.created_at,
        }
      })
    } else {
      // Resilient fallback query if specific joined foreign keys or optional columns fail
      let fbQuery = supabase
        .from('assessments')
        .select('id, course_id, title, max_score, assessment_date, created_by, created_at, form_url, sheet_url', {
          count: 'exact',
        })
      if (courseId) {
        fbQuery = fbQuery.eq('course_id', courseId)
      }
      const fbResult = await fbQuery
        .order('assessment_date', { ascending: false })
        .range(pagination.offset, pagination.offset + pagination.limit - 1)

      const records = fbResult.data ?? []
      totalCount = fbResult.count ?? records.length

      const courseIds = Array.from(new Set(records.map((r) => r.course_id)))
      const userIds = Array.from(new Set(records.map((r) => r.created_by).filter((id): id is string => Boolean(id))))
      let courseMap = new Map<string, string>()
      let profileMap = new Map<string, { id: string; fullName: string; role: string }>()

      if (courseIds.length > 0) {
        const { data: cData } = await supabase.from('courses').select('id, name').in('id', courseIds)
        if (cData) courseMap = new Map(cData.map((c) => [c.id, c.name]))
      }
      if (userIds.length > 0) {
        const { data: pData } = await supabase.from('profiles').select('id, full_name, role').in('id', userIds)
        if (pData) {
          profileMap = new Map(
            pData.map((p) => [
              p.id,
              { id: String(p.id), fullName: String(p.full_name || ''), role: String(p.role || 'staff') },
            ]),
          )
        }
      }

      formattedData = records.map((record) => ({
        id: record.id,
        courseId: record.course_id,
        courseName: courseMap.get(String(record.course_id)) ?? '',
        title: record.title,
        maxScore: record.max_score,
        assessmentDate: record.assessment_date,
        formUrl: safeFormUrl(record.form_url),
        sheetUrl: safeSheetUrl(record.sheet_url),
        createdBy: profileMap.get(String(record.created_by)) ?? null,
        createdAt: record.created_at,
      }))
    }

    return NextResponse.json({
      data: formattedData,
      count: formattedData.length,
      page: pagination.page,
      pageSize: pagination.pageSize,
      totalCount,
      hasMore: pagination.offset + pagination.limit < totalCount,
    })
  } catch (error) {
    return unexpectedApiError(error, 'Unable to load assessments')
  }
}

async function postAssessment(
  parsedBody: z.infer<typeof assessmentSchema>,
  supabase: SupabaseClient<Database>,
  user: User,
) {
  const { data: profile } = await supabase
    .from('profiles')
    .select('id, full_name, role')
    .eq('id', user.id)
    .maybeSingle()
  if (!profile)
    return unexpectedApiError(new Error('User profile was not found.'), 'Unable to fetch assessment creator profile')

  try {
    const { courseId, title, maxScore, assessmentDate, formUrl, sheetUrl } = parsedBody

    // Business logic validations
    // 1. Check if course exists
    const { data: courseData, error: courseError } = await supabase
      .from('courses')
      .select('id, name')
      .eq('id', courseId)
      .single()

    if (courseError?.code === 'PGRST116' || (!courseError && !courseData)) {
      return NextResponse.json({ error: 'Course not found' }, { status: 404 })
    }
    if (courseError) return unexpectedApiError(courseError, 'Unable to load assessment course')

    // Insert assessment record
    const assessmentData: TablesInsert<'assessments'> = {
      course_id: courseId,
      title,
      max_score: maxScore,
      assessment_date: assessmentDate,
      created_by: user.id,
    }
    if (formUrl) assessmentData.form_url = formUrl
    if (sheetUrl) assessmentData.sheet_url = sheetUrl

    const { data: inserted, error: assessmentError } = await supabase
      .from('assessments')
      .insert(assessmentData)
      .select()
      .single()

    if (assessmentError) throw assessmentError
    const assessmentRecord = inserted

    // Format response
    const formattedRecord = {
      id: assessmentRecord.id,
      courseId: assessmentRecord.course_id,
      courseName: courseData.name,
      title: assessmentRecord.title,
      maxScore: assessmentRecord.max_score,
      assessmentDate: assessmentRecord.assessment_date,
      formUrl: safeFormUrl(assessmentRecord.form_url ?? formUrl),
      sheetUrl: safeSheetUrl(assessmentRecord.sheet_url ?? sheetUrl),
      createdBy: {
        id: assessmentRecord.created_by,
        fullName: profile.full_name,
        role: profile.role,
      },
      createdAt: assessmentRecord.created_at,
    }

    return NextResponse.json(
      {
        data: formattedRecord,
        message: 'Assessment created successfully',
      },
      { status: 201 },
    )
  } catch (error) {
    return unexpectedApiError(error, 'Unable to create assessment')
  }
}

export const GET = withApi({ roles: rolesFor('assessments', 'read') }, async ({ request, supabase }) =>
  getAssessments(request, supabase!),
)
export const POST = withApi(
  { roles: rolesFor('assessments', 'create'), body: assessmentSchema },
  async ({ body, supabase, user }) => postAssessment(body, supabase!, user!),
)
