import { NextResponse } from 'next/server'
import type { SupabaseClient, User } from '@supabase/supabase-js'
import { getSupabaseAdminClient } from '@/lib/supabase/admin'
import { lookupProfileNames } from '@/lib/supabase/profile-names'
import { materialDownloadPath } from '@/modules/materials/service'
import { logger } from '@/lib/logger'
import { courseMaterialSchema, courseMaterialResponseSchema } from '@/lib/validation'
import { unexpectedApiError } from '@/lib/api-response'
import { pagePaginationFromSearchParams } from '@/lib/pagination'
import { normalizeJoined } from '@/lib/supabase/relations'
import z from 'zod'
import { validateCourseMaterialFile } from '@/lib/security/uploads'
import { withApi } from '@/lib/http/handler'
import { rolesFor } from '@/lib/auth/permissions'

// F-29: authentication, the role check and CSRF happen in withApi. The user client enforces
// RLS; the service role is used only for signed storage URLs.
async function getCourseMaterials(req: Request, requestId: string, supabase: SupabaseClient) {
  try {
    const { searchParams } = new URL(req.url)
    const courseId = searchParams.get('courseId')
    const pagination = pagePaginationFromSearchParams(searchParams)

    let query = supabase
      .from('course_materials')
      .select(
        'id, course_id, title, type, storage_path, uploaded_by, created_at, courses!course_materials_course_id_fkey (id, name)',
        { count: 'exact' },
      )
    if (courseId) query = query.eq('course_id', courseId)

    const { data, error, count } = await query
      .order('created_at', { ascending: false })
      .order('id', { ascending: false })
      .range(pagination.offset, pagination.offset + pagination.limit - 1)
    if (error) throw error

    const uploaders = await lookupProfileNames(
      supabase,
      (data || []).map((material) => (material.uploaded_by ? String(material.uploaded_by) : null)),
    )
    const formattedData = (data || []).map((material) => {
      const course = normalizeJoined(material.courses)
      const uploader = material.uploaded_by ? uploaders.get(String(material.uploaded_by)) : undefined
      return {
        id: material.id,
        courseId: material.course_id,
        courseName: course?.name,
        title: material.title,
        type: material.type,
        storagePath: material.storage_path,
        uploadedBy: uploader ? { id: uploader.id, fullName: uploader.fullName, role: uploader.role } : null,
        createdAt: material.created_at,
        // Signed on click by /api/course-materials/download, so the link never goes stale.
        signedUrl: materialDownloadPath(String(material.id)),
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
    return unexpectedApiError(error, 'Unable to load course materials')
  }
}

async function postCourseMaterial(req: Request, requestId: string, supabase: SupabaseClient, user: User) {
  const { data: profile } = await supabase
    .from('profiles')
    .select('id, full_name, role')
    .eq('id', user.id)
    .maybeSingle()
  if (!profile) {
    return unexpectedApiError(
      new Error('User profile was not found.'),
      'Unable to fetch course material uploader profile',
    )
  }

  try {
    // Parse the form data
    const formData = await req.formData()
    const file = formData.get('file')
    const courseId = formData.get('courseId') as string
    const title = formData.get('title') as string
    const type = formData.get('type') as string

    // Validate the metadata
    const parsedBody = courseMaterialSchema.parse({
      courseId,
      title,
      type,
    })

    // Validate the file
    if (!(file instanceof File)) {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 })
    }

    const extension = await validateCourseMaterialFile(file)
    if (!extension) return NextResponse.json({ error: 'Unsupported or invalid file.' }, { status: 400 })

    // We'll create a storage path that is unique to avoid collisions
    // We can use a combination of courseId, title, and a random string or timestamp
    // Objects live under the course id; storage RLS checks the uploader may access that course.
    const storagePath = `${parsedBody.courseId}/${crypto.randomUUID()}.${extension}`

    // Uploads use the authenticated user client so Storage RLS remains in force.
    const { data: uploadData, error: uploadError } = await supabase.storage
      .from('course-materials')
      .upload(storagePath, file)

    if (uploadError) {
      return unexpectedApiError(uploadError, 'Failed to upload course material')
    }

    // Insert the course material metadata into the database
    const courseMaterialData = {
      course_id: parsedBody.courseId,
      title: parsedBody.title,
      type: parsedBody.type,
      storage_path: storagePath,
      uploaded_by: user.id,
    }

    const { data: courseMaterial, error: courseMaterialError } = await supabase
      .from('course_materials')
      .insert(courseMaterialData)
      .select()
      .single()

    if (courseMaterialError) {
      // If the database insert fails, we should try to delete the uploaded file to avoid orphaned files
      // Note: This is a best-effort cleanup; if this fails, we might have an orphaned file.
      await getSupabaseAdminClient(requestId, user.id).storage.from('course-materials').remove([storagePath])
      return unexpectedApiError(courseMaterialError, 'Failed to save course material metadata')
    }

    // Format the response
    const formattedResponse = {
      id: courseMaterial.id,
      courseId: courseMaterial.course_id,
      courseName: null, // We don't have the course name in the inserted data, but we can fetch it if needed
      title: courseMaterial.title,
      type: courseMaterial.type,
      storagePath: courseMaterial.storage_path,
      uploadedBy: {
        id: profile.id,
        fullName: profile.full_name,
        role: profile.role,
      },
      createdAt: courseMaterial.created_at,
      signedUrl: materialDownloadPath(String(courseMaterial.id)),
    }

    return NextResponse.json(
      {
        data: formattedResponse,
        message: 'Course material uploaded successfully',
      },
      { status: 201 },
    )
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.issues }, { status: 400 })
    }
    return unexpectedApiError(error, 'Unable to upload course material')
  }
}

export const GET = withApi({ roles: rolesFor('materials', 'read') }, async ({ request, requestId, supabase }) =>
  getCourseMaterials(request, requestId, supabase!),
)
export const POST = withApi(
  {
    roles: rolesFor('materials', 'create'),
    mutationContentTypes: ['multipart/form-data'],
    userRateLimit: { limit: 10, window: '1 m' },
  },
  async ({ request, requestId, supabase, user }) => postCourseMaterial(request, requestId, supabase!, user!),
)

const deleteMaterialQuery = z.object({ id: z.guid() })
export const DELETE = withApi(
  { roles: rolesFor('materials', 'delete'), query: deleteMaterialQuery },
  async ({ supabase, query, requestId, user }) => {
    const client = supabase!
    const { data: material, error: lookupError } = await client
      .from('course_materials')
      .select('id,storage_path')
      .eq('id', query.id)
      .maybeSingle()
    if (lookupError) throw lookupError
    if (!material) return NextResponse.json({ error: 'Material not found.' }, { status: 404 })
    // Remove the record first: if the file removal then fails, an orphaned file is harmless, while
    // a record pointing at a deleted file would show a broken download.
    const { error: deleteError } = await client.from('course_materials').delete().eq('id', material.id)
    if (deleteError) throw deleteError
    const { error: storageError } = await getSupabaseAdminClient(requestId, user?.id)
      .storage.from('course-materials')
      .remove([material.storage_path])
    if (storageError) {
      logger.warn({ event: 'material_file_not_removed', requestId }, 'Course material file could not be removed')
    }
    return { deleted: true }
  },
)
