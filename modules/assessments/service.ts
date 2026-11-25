import 'server-only'
import { safeFormUrl, safeSheetUrl } from '@/lib/validation'
import { createClient } from '@/lib/supabase/server'
import { normalizeJoined } from '@/lib/supabase/relations'
import { lookupProfileNames } from '@/lib/supabase/profile-names'

export type AssessmentListItem = {
  id: string
  courseId: string
  courseName: string
  title: string
  maxScore: number
  assessmentDate: string
  formUrl: string | null
  sheetUrl: string | null
  createdAt: string
  createdBy: { id: string; fullName: string; role: string } | null
}

/**
 * One page of assessments the caller can see (RLS limits staff to their courses). Errors are
 * thrown so the page shows an error instead of an empty list that looks like "no assessments".
 */
export async function listAssessmentPage(options: {
  page: number
  pageSize: number
  search: string
  courseId: string
}): Promise<{ totalCount: number; data: AssessmentListItem[] }> {
  const supabase = await createClient()
  const offset = (options.page - 1) * options.pageSize

  let query = supabase
    .from('assessments')
    .select(
      'id,course_id,title,max_score,assessment_date,created_by,created_at,form_url,sheet_url,courses!assessments_course_id_fkey(id,name)',
      { count: 'exact' },
    )
  if (options.courseId) query = query.eq('course_id', options.courseId)
  if (options.search) {
    const term = options.search
      .trim()
      .slice(0, 100)
      .replace(/[\\%_,()]/g, ' ')
    query = query.ilike('title', `%${term}%`)
  }
  const { data, error, count } = await query
    .order('assessment_date', { ascending: false })
    .order('id', { ascending: false })
    .range(offset, offset + options.pageSize - 1)
  if (error) throw error

  const creators = await lookupProfileNames(
    supabase,
    (data ?? []).map((row) => row.created_by),
  )
  return {
    totalCount: count ?? 0,
    data: (data ?? []).map((row) => {
      const course = normalizeJoined(row.courses)
      const creator = row.created_by ? creators.get(String(row.created_by)) : undefined
      return {
        id: String(row.id),
        courseId: String(row.course_id),
        courseName: String(course?.name ?? ''),
        title: String(row.title),
        maxScore: Number(row.max_score),
        assessmentDate: String(row.assessment_date),
        formUrl: safeFormUrl(row.form_url),
        sheetUrl: safeSheetUrl(row.sheet_url),
        createdAt: String(row.created_at),
        createdBy: creator ? { id: creator.id, fullName: creator.fullName ?? '', role: creator.role } : null,
      }
    }),
  }
}
