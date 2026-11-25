import { apiResult, withApi } from '@/lib/http/handler'
import { rolesFor } from '@/lib/auth/permissions'
import { paginationQuerySchema } from '@/lib/pagination'
import { createStudentSchema, studentRegisterIdQuerySchema, updateStudentSchema } from '@/modules/students/schema'
import { createStudent, deleteStudent, listStudentPage, updateStudent } from '@/modules/students/service'

import { z } from 'zod'

const getStudentsQuerySchema = paginationQuerySchema.extend({
  categoryId: z.string().optional(),
  course: z.string().optional(),
})

export const GET = withApi(
  { roles: rolesFor('students', 'read'), query: getStudentsQuerySchema },
  async ({ query }) => {
    const result = await listStudentPage({
      ...query,
      search: String(query.search ?? ''),
      sort: String(query.sort ?? 'register_id'),
      direction: query.direction === 'asc' ? 'asc' : 'desc',
      categoryId: query.categoryId,
      course: query.course,
    })
    return apiResult(result.data, {
      meta: { page: result.page, pageSize: result.pageSize, totalCount: result.totalCount },
    })
  },
)

export const POST = withApi(
  { roles: rolesFor('students', 'create'), body: createStudentSchema, successStatus: 201 },
  async ({ body, request }) =>
    apiResult(await createStudent(body, request.headers.get('Idempotency-Key')), { status: 201 }),
)

/** PATCH /api/students?registerId=1048 — edit a student. */
export const PATCH = withApi(
  { roles: rolesFor('students', 'update'), query: studentRegisterIdQuerySchema, body: updateStudentSchema },
  async ({ query, body }) => apiResult(await updateStudent(query.registerId, body)),
)

/** DELETE /api/students?registerId=1048 — remove a student with no invoices or certificates. */
export const DELETE = withApi(
  {
    roles: rolesFor('students', 'delete'),
    query: studentRegisterIdQuerySchema,
    userRateLimit: { limit: 10, window: '1 m' },
  },
  async ({ query }) => apiResult(await deleteStudent(query.registerId)),
)
