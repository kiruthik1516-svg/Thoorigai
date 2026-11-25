import { NextResponse } from 'next/server'
import type { SupabaseClient, User } from '@supabase/supabase-js'
import { assessmentSchema, safeFormUrl, safeSheetUrl } from '@/lib/validation'
import { unexpectedApiError } from '@/lib/api-response'
import z from 'zod'
import { pagePaginationFromSearchParams } from '@/lib/pagination'
import { withApi } from '@/lib/http/handler'
import { rolesFor } from '@/lib/auth/permissions'
import type { Database, TablesInsert, TablesUpdate } from '@/lib/supabase/database.types'
import { listAssessmentPage } from '@/modules/assessments/service'

// F-29: authentication, the role check, CSRF and body validation happen in withApi.
async function getAssessments(req: Request) {
  try {
    const { searchParams } = new URL(req.url)
    const courseId = searchParams.get('courseId') ?? ''
    const pagination = pagePaginationFromSearchParams(searchParams)
    const result = await listAssessmentPage({
      page: pagination.page,
      pageSize: pagination.pageSize,
      search: searchParams.get('search') ?? '',
      courseId,
    })
    return NextResponse.json({
      data: result.data,
      count: result.data.length,
      page: pagination.page,
      pageSize: pagination.pageSize,
      totalCount: result.totalCount,
      hasMore: pagination.offset + pagination.limit < result.totalCount,
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

export const GET = withApi({ roles: rolesFor('assessments', 'read') }, async ({ request }) => getAssessments(request))
export const POST = withApi(
  { roles: rolesFor('assessments', 'create'), body: assessmentSchema },
  async ({ body, supabase, user }) => postAssessment(body, supabase!, user!),
)

const assessmentIdQuery = z.object({ id: z.guid() })
const assessmentUpdateSchema = assessmentSchema.omit({ courseId: true }).partial()

/** PATCH /api/assessments?id=… — edit title, maximum score, date or links (RLS: own courses). */
export const PATCH = withApi(
  { roles: rolesFor('assessments', 'update'), query: assessmentIdQuery, body: assessmentUpdateSchema },
  async ({ query, body, supabase }) => {
    const updates: TablesUpdate<'assessments'> = {}
    if (body.title !== undefined) updates.title = body.title
    if (body.maxScore !== undefined) updates.max_score = body.maxScore
    if (body.assessmentDate !== undefined) updates.assessment_date = body.assessmentDate
    if (body.formUrl !== undefined) updates.form_url = body.formUrl
    if (body.sheetUrl !== undefined) updates.sheet_url = body.sheetUrl
    if (Object.keys(updates).length === 0) {
      return NextResponse.json({ error: { message: 'Nothing to update.' } }, { status: 400 })
    }
    if (updates.max_score !== undefined) {
      const { data: top, error: topError } = await supabase!
        .from('assessment_results')
        .select('score')
        .eq('assessment_id', query.id)
        .order('score', { ascending: false })
        .limit(1)
        .maybeSingle()
      if (topError) throw topError
      if (top && Number(top.score) > Number(updates.max_score)) {
        return NextResponse.json(
          { error: { message: `A student already scored ${top.score}; the maximum cannot be lower.` } },
          { status: 400 },
        )
      }
    }
    const { data, error } = await supabase!
      .from('assessments')
      .update(updates)
      .eq('id', query.id)
      .select('id, title, max_score, assessment_date, form_url, sheet_url')
      .maybeSingle()
    if (error) throw error
    if (!data) return NextResponse.json({ error: { message: 'Assessment not found' } }, { status: 404 })
    return NextResponse.json({
      data: {
        id: data.id,
        title: data.title,
        maxScore: data.max_score,
        assessmentDate: data.assessment_date,
        formUrl: safeFormUrl(data.form_url),
        sheetUrl: safeSheetUrl(data.sheet_url),
      },
      message: 'Assessment updated',
    })
  },
)

/** DELETE /api/assessments?id=… — removes the assessment and its scores (RLS: own courses). */
export const DELETE = withApi(
  { roles: rolesFor('assessments', 'delete'), query: assessmentIdQuery },
  async ({ query, supabase }) => {
    const { data, error } = await supabase!.from('assessments').delete().eq('id', query.id).select('id')
    if (error) throw error
    if (!data || data.length === 0) {
      return NextResponse.json({ error: { message: 'Assessment not found' } }, { status: 404 })
    }
    return NextResponse.json({ data: { deleted: true }, message: 'Assessment deleted' })
  },
)
