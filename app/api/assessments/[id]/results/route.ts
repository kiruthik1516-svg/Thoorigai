import { NextResponse } from 'next/server'
import type { SupabaseClient, User } from '@supabase/supabase-js'
import { assessmentResultSchema } from '@/lib/validation'
import { unexpectedApiError } from '@/lib/api-response'
import { normalizeJoined } from '@/lib/supabase/relations'
import z from 'zod'
import { pagePaginationFromSearchParams } from '@/lib/pagination'
import { withApi } from '@/lib/http/handler'
import { rolesFor } from '@/lib/auth/permissions'
import { sameCourse } from '@/lib/courses/match'
import { lookupProfileNames } from '@/lib/supabase/profile-names'

const assessmentParams = z.object({ id: z.guid() })
const resultBodySchema = z.union([
  assessmentResultSchema,
  z.object({ results: z.array(assessmentResultSchema).min(1).max(500) }),
])

// F-29: authentication, the role check and the RLS-bound client come from withApi.
async function getAssessmentResults(request: Request, supabase: SupabaseClient, assessmentId: string) {
  try {
    const { data: assessmentData, error: assessmentError } = await supabase
      .from('assessments')
      .select('id')
      .eq('id', assessmentId)
      .maybeSingle()
    if (assessmentError) throw assessmentError
    if (!assessmentData) return NextResponse.json({ error: 'Assessment not found' }, { status: 404 })

    const pagination = pagePaginationFromSearchParams(new URL(request.url).searchParams)
    const { data, error, count } = await supabase
      .from('assessment_results')
      .select(
        `
        id,
        assessment_id,
        student_id,
        score,
        remarks,
        graded_by,
        graded_at,
        students!assessment_results_student_id_fkey (id, register_id, name, course)
      `,
        { count: 'exact' },
      )
      .eq('assessment_id', assessmentId)
      .order('graded_at', { ascending: false })
      .order('id', { ascending: false })
      .range(pagination.offset, pagination.offset + pagination.limit - 1)
    if (error) throw error

    const graders = await lookupProfileNames(
      supabase,
      (data || []).map((record) => (record.graded_by ? String(record.graded_by) : null)),
    )
    const formattedData = (data || []).map((record) => {
      const student = normalizeJoined(record.students)
      const profile = record.graded_by ? graders.get(String(record.graded_by)) : undefined
      return {
        id: record.id,
        studentId: student?.register_id,
        studentName: student?.name,
        score: record.score,
        remarks: record.remarks,
        gradedBy: profile ? { id: profile.id, fullName: profile.fullName, role: profile.role } : null,
        gradedAt: record.graded_at,
      }
    })

    return NextResponse.json({
      data: formattedData,
      count: data?.length || 0,
      page: pagination.page,
      pageSize: pagination.pageSize,
      totalCount: count || 0,
      hasMore: pagination.offset + pagination.limit < (count || 0),
    })
  } catch (error) {
    return unexpectedApiError(error, 'Unable to load assessment results')
  }
}

async function postAssessmentResult(
  body: z.infer<typeof resultBodySchema>,
  supabase: SupabaseClient,
  user: User,
  role: string | undefined,
  assessmentId: string,
) {
  try {
    const { data: assessmentData, error: assessmentError } = await supabase
      .from('assessments')
      .select('id, course_id, max_score')
      .eq('id', assessmentId)
      .maybeSingle()
    if (assessmentError) throw assessmentError
    if (!assessmentData) return NextResponse.json({ error: 'Assessment not found' }, { status: 404 })

    const { data: course, error: courseError } = await supabase
      .from('courses')
      .select('id, name')
      .eq('id', assessmentData.course_id)
      .maybeSingle()
    if (courseError) throw courseError
    // F-20: exact (normalized) course match; an assessment whose course is gone matches nobody.
    const isEnrolled = (studentCourse: string | null | undefined) =>
      Boolean(course) && sameCourse(studentCourse, course!)

    const entries = 'results' in body ? body.results : [body]
    const studentIds = entries.map((entry) => entry.studentId)
    if (new Set(studentIds).size !== studentIds.length) {
      return NextResponse.json({ error: 'A student can only appear once in a bulk score request.' }, { status: 400 })
    }
    if (entries.some((entry) => entry.score > assessmentData.max_score)) {
      return NextResponse.json(
        { error: `Score cannot exceed the maximum score of ${assessmentData.max_score}` },
        { status: 400 },
      )
    }

    const { data: students, error: studentsError } = await supabase
      .from('students')
      .select('id,register_id,name,course')
      .in('register_id', studentIds)
    if (studentsError) throw studentsError
    const studentByRegisterId = new Map((students ?? []).map((student) => [student.register_id, student]))

    if ('results' in body) {
      if (entries.some((entry) => !isEnrolled(studentByRegisterId.get(entry.studentId)?.course))) {
        return NextResponse.json(
          { error: 'Every student must be enrolled in this assessment course.' },
          { status: 400 },
        )
      }
      const { data: saved, error: saveError } = await supabase
        .from('assessment_results')
        .upsert(
          entries.map((entry) => ({
            assessment_id: assessmentId,
            student_id: studentByRegisterId.get(entry.studentId)!.id,
            score: entry.score,
            remarks: entry.remarks ?? null,
            graded_by: user.id,
          })),
          { onConflict: 'assessment_id,student_id', ignoreDuplicates: false },
        )
        .select('id,score,remarks,graded_by,graded_at,student_id')
      if (saveError) throw saveError
      return NextResponse.json({ data: saved, message: `Saved ${saved?.length ?? 0} assessment scores.` })
    }

    const studentData = studentByRegisterId.get(body.studentId)
    if (!studentData) return NextResponse.json({ error: 'Student not found' }, { status: 404 })
    if (!isEnrolled(studentData.course)) {
      return NextResponse.json({ error: 'Student is not enrolled in this assessment course.' }, { status: 400 })
    }

    const { data: resultRecord, error: resultError } = await supabase
      .from('assessment_results')
      .upsert(
        {
          assessment_id: assessmentId,
          student_id: studentData.id,
          score: body.score,
          remarks: body.remarks ?? null,
          graded_by: user.id,
        },
        { onConflict: 'assessment_id,student_id', ignoreDuplicates: false },
      )
      .select()
      .single()
    if (resultError) throw resultError

    const { data: grader } = await supabase.from('profiles').select('full_name').eq('id', user.id).maybeSingle()

    return NextResponse.json(
      {
        data: {
          id: resultRecord.id,
          studentId: studentData.register_id,
          studentName: studentData.name,
          score: resultRecord.score,
          remarks: resultRecord.remarks,
          gradedBy: { id: resultRecord.graded_by, fullName: grader?.full_name ?? null, role },
          gradedAt: resultRecord.graded_at,
        },
        message: 'Assessment result saved successfully',
      },
      { status: 200 },
    )
  } catch (error) {
    return unexpectedApiError(error, 'Unable to save assessment result')
  }
}

export const GET = withApi(
  { roles: rolesFor('assessments', 'read'), params: assessmentParams },
  async ({ request, params, supabase }) => getAssessmentResults(request, supabase!, params.id),
)
export const POST = withApi(
  { roles: rolesFor('assessments', 'grade'), params: assessmentParams, body: resultBodySchema },
  async ({ body, params, supabase, user, role }) => postAssessmentResult(body, supabase!, user!, role, params.id),
)
const deleteResultQuery = z.object({ resultId: z.guid() })
export const DELETE = withApi(
  { roles: rolesFor('assessments', 'grade'), params: assessmentParams, query: deleteResultQuery },
  async ({ supabase, params, query }) => {
    const { error, count } = await supabase!
      .from('assessment_results')
      .delete({ count: 'exact' })
      .eq('id', query.resultId)
      .eq('assessment_id', params.id)
    if (error) throw error
    if (!count) return NextResponse.json({ error: 'Result not found.' }, { status: 404 })
    return { deleted: true }
  },
)
