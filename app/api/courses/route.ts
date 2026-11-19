import { z } from 'zod'
import { apiResult, withApi } from '@/lib/http/handler'
import { rolesFor } from '@/lib/auth/permissions'
import { courseSchema } from '@/lib/validation'
import { paginationMeta, paginationQuerySchema, pagePagination } from '@/lib/pagination'
import { paiseToRupees, rupeesToPaise } from '@/lib/money'
import { revalidateTag } from 'next/cache'
import { randomUUID } from 'node:crypto'
import { ConflictError, NotFoundError } from '@/lib/http/errors'
import type { Tables } from '@/lib/supabase/database.types'

const getCoursesQuerySchema = paginationQuerySchema.extend({
  categoryId: z.string().optional(),
})

// F-15: create never accepts an id (it used to upsert, so a client id or a clock collision
// overwrote another course). Updates go through PATCH with an existing id.
const createCourseSchema = courseSchema
const updateCourseSchema = courseSchema.extend({ id: z.string().min(1).max(64) })
const deleteCourseQuerySchema = z.object({ id: z.string().min(1) })

function courseWriteError(error: { code?: string; message: string }): never {
  if (error.code === '23505') throw new ConflictError('A course with this name already exists.')
  if (error.code === '23503') throw new ConflictError(error.message)
  throw error
}

function courseResponse(data: Tables<'courses'> & { category: { name: string } | null }) {
  return {
    ...data,
    fee: paiseToRupees(Number(data.fee)),
    gstInclusive: Boolean(data.gst_inclusive),
    categoryId: data.category_id ?? null,
    categoryName: data.category?.name ?? null,
  }
}

export const GET = withApi(
  { roles: rolesFor('courses', 'read'), query: getCoursesQuerySchema },
  async ({ query, supabase }) => {
    const pagination = pagePagination(query.page, query.pageSize)
    let dbQuery = supabase!
      .from('courses')
      .select('*, category:course_categories(id, name, duration)', { count: 'exact' })

    if (query.categoryId) {
      if (query.categoryId === 'uncategorized') {
        dbQuery = dbQuery.is('category_id', null)
      } else {
        dbQuery = dbQuery.eq('category_id', query.categoryId)
      }
    }

    const { data, error, count } = await dbQuery
      .order('name')
      .range(pagination.offset, pagination.offset + pagination.limit - 1)
    if (error) throw error

    const courses = (data ?? []).map((course) => ({
      id: course.id,
      name: course.name,
      fee: paiseToRupees(Number(course.fee)),
      duration: course.duration,
      description: course.description,
      gstInclusive: course.gst_inclusive,
      categoryId: course.category_id ?? null,
      categoryName: course.category?.name ?? null,
    }))
    return apiResult(courses, { meta: paginationMeta(count ?? 0, pagination) })
  },
)

export const POST = withApi(
  {
    roles: rolesFor('courses', 'create'),
    body: createCourseSchema,
    successStatus: 201,
  },
  async ({ body, supabase }) => {
    const { data, error } = await supabase!
      .from('courses')
      .insert({
        id: `CRS-${randomUUID().slice(0, 8).toUpperCase()}`,
        name: body.name.trim(),
        fee: rupeesToPaise(body.fee),
        duration: body.duration,
        description: body.description,
        gst_inclusive: body.gstInclusive,
        category_id: body.categoryId ?? null,
      })
      .select('*, category:course_categories(id, name, duration)')
      .single()
    if (error) courseWriteError(error)
    if (!data) throw new Error('No course row was returned after save.')
    revalidateTag('course-options', { expire: 0 })
    return courseResponse(data)
  },
)

export const PATCH = withApi(
  { roles: rolesFor('courses', 'update'), body: updateCourseSchema },
  async ({ body, supabase }) => {
    // Renaming also renames the course on enrolled students (database trigger).
    const { data, error } = await supabase!
      .from('courses')
      .update({
        name: body.name.trim(),
        fee: rupeesToPaise(body.fee),
        duration: body.duration,
        description: body.description,
        gst_inclusive: body.gstInclusive,
        category_id: body.categoryId ?? null,
      })
      .eq('id', body.id)
      .select('*, category:course_categories(id, name, duration)')
      .maybeSingle()
    if (error) courseWriteError(error)
    if (!data) throw new NotFoundError('Course not found.')
    revalidateTag('course-options', { expire: 0 })
    return courseResponse(data)
  },
)

export const DELETE = withApi(
  { roles: rolesFor('courses', 'delete'), query: deleteCourseQuerySchema },
  async ({ query, supabase }) => {
    // A database trigger refuses the delete while students or records still depend on it.
    const { error } = await supabase!.from('courses').delete().eq('id', query.id)
    if (error) courseWriteError(error)
    revalidateTag('course-options', { expire: 0 })
    return { success: true, message: 'Course deleted' }
  },
)
