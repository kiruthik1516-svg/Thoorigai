import 'server-only'
import { createClient } from '@/lib/supabase/server'
import { NotFoundError } from '@/lib/http/errors'
import type { CourseMaterial } from '@/modules/materials/types'
import { normalizeJoined } from '@/lib/supabase/relations'
import { lookupProfileNames } from '@/lib/supabase/profile-names'

/**
 * Link that signs a fresh, short-lived storage URL each time it is opened. Signing URLs when
 * the page loads made downloads fail once the page had been open longer than the URL lifetime.
 */
export function materialDownloadPath(materialId: string): string {
  return `/api/course-materials/download?id=${encodeURIComponent(materialId)}`
}

export async function listCourseMaterials(
  courseId: string,
  page: number,
  pageSize: number,
): Promise<{ courseName: string; data: CourseMaterial[] }> {
  const supabase = await createClient()
  const { data: course, error: courseError } = await supabase
    .from('courses')
    .select('name')
    .eq('id', courseId)
    .maybeSingle()
  if (courseError) throw courseError
  if (!course) throw new NotFoundError('Course was not found.')
  const offset = (page - 1) * pageSize
  const { data, error } = await supabase
    .from('course_materials')
    .select('id,course_id,title,type,storage_path,uploaded_by,created_at,courses(id,name)', { count: 'exact' })
    .eq('course_id', courseId)
    .order('created_at', { ascending: false })
    .order('id', { ascending: false })
    .range(offset, offset + pageSize - 1)
  if (error) throw error
  const uploaders = await lookupProfileNames(
    supabase,
    (data ?? []).map((material) => (material.uploaded_by ? String(material.uploaded_by) : null)),
  )
  const materials = (data ?? []).map((material) => {
    const courseData = normalizeJoined(material.courses)
    const uploader = material.uploaded_by ? uploaders.get(String(material.uploaded_by)) : undefined
    return {
      id: String(material.id),
      courseId: String(material.course_id),
      courseName: String(courseData?.name ?? course.name),
      title: String(material.title),
      type: String(material.type),
      storagePath: String(material.storage_path),
      uploadedBy: uploader ? { id: uploader.id, fullName: String(uploader.fullName ?? ''), role: uploader.role } : null,
      createdAt: String(material.created_at),
      signedUrl: materialDownloadPath(String(material.id)),
    }
  })
  return { courseName: String(course.name), data: materials }
}
