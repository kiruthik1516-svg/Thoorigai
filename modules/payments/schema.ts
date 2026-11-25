import { z } from 'zod'
import { paymentSchema } from '@/lib/validation'

export const recordPaymentSchema = paymentSchema
export const idempotencyKeySchema = z.string().trim().min(1).max(200)
export type RecordPaymentInput = z.infer<typeof recordPaymentSchema>

export const cancelPaymentSchema = z.object({
  paymentId: z.string().trim().min(1).max(100),
  reason: z.string().trim().min(3, { message: 'Give a reason of at least 3 characters.' }).max(500),
})
export type CancelPaymentInput = z.infer<typeof cancelPaymentSchema>
