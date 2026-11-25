import 'server-only'
import { createClient } from '@/lib/supabase/server'
import { paymentFromRow } from '@/lib/server-data'
import { balanceAfterPayment } from './balance'
import { listPayments } from '@/lib/server-data'
import { paiseToRupees } from '@/lib/money'
import { createHash } from 'node:crypto'
import type { Role } from '@/lib/types'
import { can } from '@/lib/auth/permissions'
import { ForbiddenError, ConflictError, NotFoundError, ValidationError } from '@/lib/http/errors'
import { rupeesToPaise } from '@/lib/money'
import { generateVerificationCode } from '@/lib/utils'
import { idempotencyKeySchema, type CancelPaymentInput, type RecordPaymentInput } from './schema'
import { recordPaymentAtomic } from './repository'
import { getCurrentProfile } from '@/lib/auth/current-profile'
import { createNotification } from '@/modules/notifications/service'
import { indiaToday } from '@/lib/dates'

function authorizePayment(role: Role, action: 'read' | 'create') {
  if (!can(role, 'payments', action)) throw new ForbiddenError()
}

function paymentRpcError(error: unknown): never {
  const message =
    error && typeof error === 'object' && typeof (error as { message?: unknown }).message === 'string'
      ? (error as { message: string }).message
      : ''
  if (message.includes('PAYMENT_EXCEEDS_BALANCE')) throw new ValidationError('Payment exceeds the remaining balance.')
  if (message.includes('STUDENT_NOT_FOUND')) throw new NotFoundError('Student not found.')
  if (message.includes('PAYMENT_DATE_IN_FUTURE')) throw new ValidationError('The payment date cannot be in the future.')
  if (message.includes('PAYMENT_NOT_FOUND')) throw new NotFoundError('Payment not found.')
  if (message.includes('PAYMENT_ALREADY_CANCELLED')) throw new ConflictError('This payment is already cancelled.')
  if (message.includes('CANCEL_REASON_REQUIRED')) throw new ValidationError('Give a reason of at least 3 characters.')
  if ((error as { code?: string })?.code === '42501') throw new ForbiddenError('Only admins can do this.')
  if (message.includes('IDEMPOTENCY_KEY_REUSED'))
    throw new ConflictError('Idempotency-Key was already used for a different request.')
  throw error
}

export async function listPaymentPage(options: {
  page: number
  pageSize: number
  search: string
  sort: string
  direction: 'asc' | 'desc'
  date?: string
  startDate?: string
  endDate?: string
  keyset?: boolean
  cursor?: string
}) {
  authorizePayment((await getCurrentProfile()).role, 'read')
  const supabase = await createClient()
  const sort = ['payment_date', 'amount', 'invoice'].includes(options.sort)
    ? (options.sort as 'payment_date' | 'amount' | 'invoice')
    : 'payment_date'
  return listPayments(supabase, {
    ...options,
    sort,
    direction: options.direction,
    keyset: options.keyset,
    cursor: options.cursor,
  })
}

/**
 * Records a payment with a required idempotency key. The database RPC locks the
 * student balance and commits the payment, paid amount, invoice, and verification
 * record atomically; replaying the same key and body returns the original result.
 */
export async function createPayment(input: RecordPaymentInput, idempotencyKey: string | null) {
  const profile = await getCurrentProfile()
  authorizePayment(profile.role, 'create')
  const key = idempotencyKeySchema.safeParse(idempotencyKey)
  if (!key.success) throw new ValidationError('The Idempotency-Key header is required.')
  const client = await createClient()
  const payload = JSON.stringify(input)
  const hash = createHash('sha256').update(payload).digest('hex')
  try {
    const result = await recordPaymentAtomic(client, {
      key: key.data,
      hash,
      studentRegisterId: input.studentId,
      amountPaise: rupeesToPaise(input.amount),
      method: input.method,
      date: input.date ?? indiaToday(),
      transactionId: input.transactionId ?? null,
      customNote: input.customNote ?? null,
      paymentType: input.paymentType?.trim() || null,
      verificationCode: generateVerificationCode(10),
    })

    const instanceNumber =
      result.payment.instance_number === null || result.payment.instance_number === undefined
        ? undefined
        : Number(result.payment.instance_number)
    const paymentRecord = {
      id: String(result.payment.id),
      student: String(result.student.name),
      method: String(result.payment.method),
      date: new Date(`${String(result.payment.payment_date)}T00:00:00`).toLocaleDateString('en-IN', {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
      }),
      amount: paiseToRupees(Number(result.payment.amount)),
      invoice: String(result.payment.invoice),
      studentId: Number(result.payment.student_register_id),
      studentRowId: String(result.payment.student_id),
      cgst: paiseToRupees(Number(result.payment.cgst ?? 0)),
      sgst: paiseToRupees(Number(result.payment.sgst ?? 0)),
      transactionId: result.payment.transaction_id ? String(result.payment.transaction_id) : null,
      customNote: result.payment.custom_note ? String(result.payment.custom_note) : null,
      paymentType: result.payment.payment_type ? String(result.payment.payment_type) : undefined,
      instanceNumber,
      instance: instanceNumber,
      gstRate: Number(result.payment.gst_rate ?? 0),
      gstInclusive: Boolean(result.payment.gst_inclusive),
      taxableValue: paiseToRupees(Number(result.payment.taxable_value ?? result.payment.amount)),
      grandTotal: paiseToRupees(Number(result.payment.grand_total ?? result.payment.amount)),
      verification_code: result.verification_code,
    }

    void createNotification(
      {
        recipientRole: 'admin',
        title: 'Fee Payment Received',
        message: `Invoice ${String(result.payment.invoice)} recorded for ₹${(Number(result.payment.amount) / 100).toLocaleString('en-IN')} (${String(result.student.name)}).`,
        type: 'info',
        link: `/invoices/${encodeURIComponent(String(result.payment.invoice))}`,
        entityType: 'payment',
        entityId: String(result.payment.id),
      },
      profile.id,
    )

    return paymentRecord
  } catch (error) {
    paymentRpcError(error)
  }
}

export async function getPaymentByInvoice(invoice: string) {
  authorizePayment((await getCurrentProfile()).role, 'read')
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('payments')
    .select('*,students!payments_student_id_fkey(id,register_id,name,phone,course,batch,total,paid)')
    .eq('invoice', invoice)
    .maybeSingle()
  if (error) throw error
  if (!data) return null
  const { data: document, error: documentError } = await supabase
    .from('verifiable_documents')
    .select('verification_code')
    .eq('doc_type', 'invoice')
    .eq('reference_id', String(data.id))
    .maybeSingle()
  if (documentError) throw documentError
  const studentRow = Array.isArray(data.students) ? data.students[0] : data.students
  // The balance printed on an invoice is what was left after this payment, not today's balance.
  const { data: ledger, error: ledgerError } = await supabase
    .from('payments')
    .select('id, amount, payment_date, instance_number, created_at, cancelled_at')
    .eq('student_id', data.student_id)
  if (ledgerError) throw ledgerError
  const balanceAfter = studentRow ? balanceAfterPayment(String(data.id), ledger ?? [], studentRow) : undefined
  const payment = paymentFromRow({
    ...data,
    student_name: studentRow?.name,
    student_register_id: studentRow?.register_id,
    verification_code: document?.verification_code,
  })
  const student = studentRow
    ? {
        id: String(studentRow.id),
        registerId: Number(studentRow.register_id),
        name: String(studentRow.name),
        phone: String(studentRow.phone ?? ''),
        course: String(studentRow.course),
        batch: String(studentRow.batch),
        total: paiseToRupees(Number(studentRow.total)),
        paid: paiseToRupees(Number(studentRow.paid)),
        status: Number(studentRow.paid) >= Number(studentRow.total) ? ('Fully Paid' as const) : ('Pending' as const),
      }
    : null
  return { payment, student, balanceAfter }
}

/**
 * Cancels a payment (admins only). The invoice keeps its number and stays on record marked
 * cancelled; it stops counting toward the student's paid amount and revenue, and its QR code no
 * longer verifies.
 */
export async function cancelPayment(input: CancelPaymentInput) {
  const profile = await getCurrentProfile()
  if (!can(profile.role, 'payments', 'update')) throw new ForbiddenError()
  const supabase = await createClient()
  const { data, error } = await supabase.rpc('admin_cancel_payment', {
    p_payment_id: input.paymentId,
    p_reason: input.reason,
  })
  if (error) paymentRpcError(error)
  const payment = (data as { payment: Record<string, unknown> }).payment
  void createNotification(
    {
      recipientRole: 'admin',
      title: 'Invoice Cancelled',
      message: `Invoice ${String(payment.invoice)} was cancelled: ${input.reason}`,
      type: 'warning',
      link: `/invoices/${encodeURIComponent(String(payment.invoice))}`,
      entityType: 'payment',
      entityId: String(payment.id),
    },
    profile.id,
  )
  return { cancelled: true, paymentId: String(payment.id), invoice: String(payment.invoice) }
}
