import 'server-only'
import type { SupabaseClient } from '@supabase/supabase-js'

export type AtomicPaymentInput = {
  key: string
  hash: string
  studentRegisterId: number
  amountPaise: number
  method: string
  date: string
  transactionId: string | null
  customNote: string | null
  /** Optional label; the database derives "<n>th Part Fees Payment" when null. */
  paymentType: string | null
  verificationCode: string
}

/**
 * Records a payment. GST rate, CGST/SGST, the inclusive flag, payment type and instalment
 * number are all decided inside the database transaction (F-07, F-08, F-16).
 */
export async function recordPaymentAtomic(client: SupabaseClient, input: AtomicPaymentInput) {
  const { data, error } = await client.rpc('record_payment_idempotent', {
    p_idempotency_key: input.key,
    p_request_hash: input.hash,
    p_student_register_id: input.studentRegisterId,
    p_amount: input.amountPaise,
    p_method: input.method,
    p_payment_date: input.date,
    p_transaction_id: input.transactionId,
    p_custom_note: input.customNote,
    p_payment_type: input.paymentType,
    p_verification_code: input.verificationCode,
  })
  if (error) throw error
  return data as { payment: Record<string, unknown>; student: Record<string, unknown>; verification_code: string }
}
