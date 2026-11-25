import { z } from 'zod'
import { studentSchema, studentUpdateSchema } from '@/lib/validation'

export const createStudentSchema = studentSchema
export type CreateStudentInput = ReturnType<typeof createStudentSchema.parse>

export const updateStudentSchema = studentUpdateSchema
export type StudentUpdateInput = z.infer<typeof updateStudentSchema>

export const studentRegisterIdQuerySchema = z.object({
  registerId: z.coerce.number().int().positive(),
})
