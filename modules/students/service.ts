import 'server-only'
import { createClient } from '@/lib/supabase/server'
import { listStudents, listPayments, studentFromRow } from '@/lib/server-data'
import { normalizeJoined } from '@/lib/supabase/relations'
import type { Role } from '@/lib/types'
import { can } from '@/lib/auth/permissions'
import { ForbiddenError, ValidationError } from '@/lib/http/errors'
import { paiseToRupees, rupeesToPaise } from '@/lib/money'
import { generateVerificationCode } from '@/lib/utils'
import { createStudentWithPaymentAtomic } from './repository'
import type { CreateStudentInput } from './schema'
import { getCurrentProfile } from '@/lib/auth/current-profile'
import { createHash } from 'node:crypto'
import { idempotencyKeySchema } from '@/modules/payments/schema'
import { createNotification } from '@/modules/notifications/service'

function authorizeStudent(role: Role, action: 'read' | 'create') {
  if (!can(role, 'students', action)) throw new ForbiddenError()
}

export async function listStudentPage(options: {
  page: number
  pageSize: number
  search: string
  sort: string
  direction: 'asc' | 'desc'
  categoryId?: string
  course?: string
}) {
  authorizeStudent((await getCurrentProfile()).role, 'read')
  const supabase = await createClient()
  const allowedSort = ['register_id', 'name', 'created_at'] as const
  const sort = allowedSort.includes(options.sort as (typeof allowedSort)[number])
    ? (options.sort as (typeof allowedSort)[number])
    : 'register_id'
  return listStudents(supabase, {
    ...options,
    sort,
    direction: options.direction,
    categoryId: options.categoryId,
    course: options.course,
  })
}

/** Creates a student and optional first payment through the atomic database workflow. */
export async function createStudent(input: CreateStudentInput, idempotencyKey: string | null = null) {
  const { role } = await getCurrentProfile()
  authorizeStudent(role, 'create')
  let idempotency: { key: string; hash: string } | null = null
  if (idempotencyKey !== null) {
    const key = idempotencyKeySchema.safeParse(idempotencyKey)
    if (!key.success) throw new ValidationError('The Idempotency-Key header is invalid.')
    idempotency = { key: key.data, hash: createHash('sha256').update(JSON.stringify(input)).digest('hex') }
  }
  if (input.paid > input.total) throw new ValidationError('Paid amount cannot exceed total fees.')
  // F-03: payments are admin-only. Staff enrol with the fee set and no initial payment.
  if (input.paid > 0 && !can(role, 'payments', 'create')) {
    throw new ForbiddenError('Only admins can record payments. Enrol the student without an initial payment.')
  }
  const client = await createClient()
  const paymentDate = new Date().toISOString().slice(0, 10)
  const rpcResult = await createStudentWithPaymentAtomic(
    client,
    input,
    rupeesToPaise(input.paid),
    paymentDate,
    generateVerificationCode(10),
    idempotency,
  )
  const student = {
    ...studentFromRow(rpcResult.student),
    id: String(rpcResult.student.id),
    paid: paiseToRupees(Number(rpcResult.student.paid)),
    status: rpcResult.student.status as 'Pending' | 'Fully Paid',
  }
  const paymentRow = rpcResult.initial_payment?.payment
  const payment = paymentRow
    ? {
        id: String(paymentRow.id),
        student: input.name,
        method: String(paymentRow.method),
        date: new Date(`${String(paymentRow.payment_date)}T00:00:00`).toLocaleDateString('en-IN', {
          day: '2-digit',
          month: 'short',
          year: 'numeric',
        }),
        amount: paiseToRupees(Number(paymentRow.amount)),
        invoice: String(paymentRow.invoice),
        studentId: Number(paymentRow.student_register_id),
        studentRowId: String(paymentRow.student_id),
        cgst: paiseToRupees(Number(paymentRow.cgst ?? 0)),
        sgst: paiseToRupees(Number(paymentRow.sgst ?? 0)),
        gstRate: Number(paymentRow.gst_rate ?? 18),
        verification_code: rpcResult.initial_payment?.verification_code,
      }
    : null

  void createNotification({
    recipientRole: 'all',
    title: 'New Student Enrolled',
    message: `${student.name} enrolled in ${student.course} (TAI-${student.registerId}).`,
    type: 'success',
    link: `/students/${student.registerId}`,
    entityType: 'student',
    entityId: String(student.id),
  })

  return { message: 'Student created successfully', data: student, payment }
}

export async function getStudentDetail(registerId: number) {
  const { role } = await getCurrentProfile()
  authorizeStudent(role, 'read')
  const supabase = await createClient()
  const { data: row, error } = await supabase.from('students').select('*').eq('register_id', registerId).maybeSingle()
  if (error) throw error
  if (!row) return null
  // F-03: only roles that may read payments get the payment history (RLS enforces the same rule).
  const payments = can(role, 'payments', 'read')
    ? (await listPayments(supabase, { page: 1, pageSize: 100, studentId: registerId })).data
    : []
  // The dossier QR links to the student's latest certificate. Verification codes are admin-only.
  let certificateVerificationCode: string | null = null
  if (can(role, 'certificates', 'read')) {
    const { data: certificate } = await supabase
      .from('certificates')
      .select('id')
      .eq('student_id', row.id)
      .order('issued_at', { ascending: false })
      .limit(1)
      .maybeSingle()
    if (certificate) {
      const { data: document } = await supabase
        .from('verifiable_documents')
        .select('verification_code')
        .eq('doc_type', 'certificate')
        .eq('reference_id', String(certificate.id))
        .eq('status', 'active')
        .maybeSingle()
      certificateVerificationCode = document?.verification_code ? String(document.verification_code) : null
    }
  }
  return { student: studentFromRow(row), payments, certificateVerificationCode }
}

export async function getStudentAcademicHistory(registerId: number) {
  authorizeStudent((await getCurrentProfile()).role, 'read')
  const supabase = await createClient()
  const { data: studentRow, error } = await supabase
    .from('students')
    .select('id')
    .eq('register_id', registerId)
    .maybeSingle()

  if (error || !studentRow?.id) {
    return { attendance: [], assessments: [] }
  }

  const [attendanceRes, assessmentRes] = await Promise.all([
    supabase
      .from('attendance')
      .select('id,session_date,status')
      .eq('student_id', studentRow.id)
      .order('session_date', { ascending: false })
      .limit(180),
    supabase
      .from('assessment_results')
      .select('id,score,remarks,graded_at,assessments(title,max_score,assessment_date)')
      .eq('student_id', studentRow.id)
      .order('graded_at', { ascending: false })
      .limit(30),
  ])

  return {
    attendance: (attendanceRes.data ?? []).map((a: any) => ({
      id: String(a.id),
      sessionDate: String(a.session_date),
      status: (a.status === 'Excused' ? 'Exempt' : a.status) as 'Present' | 'Absent' | 'Exempt' | 'Late' | 'Excused',
    })),
    assessments: (assessmentRes.data ?? []).map((r: any) => {
      const assessment = normalizeJoined(r.assessments)
      return {
        id: String(r.id),
        score: Number(r.score),
        remarks: r.remarks ? String(r.remarks) : null,
        gradedAt: r.graded_at ? String(r.graded_at) : null,
        title: assessment?.title ? String(assessment.title) : 'Assessment',
        maxScore: Number(assessment?.max_score ?? 100),
        date: assessment?.assessment_date ? String(assessment.assessment_date) : '',
      }
    }),
  }
}

export async function listStudentsForPayment() {
  authorizeStudent((await getCurrentProfile()).role, 'read')
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('students')
    .select('id, register_id, name, course, batch, total, paid, phone, email')
    .order('register_id', { ascending: false })
    .limit(500)

  if (error) throw error
  return (data ?? []).map((row: any) => ({
    id: String(row.id),
    registerId: Number(row.register_id),
    name: String(row.name),
    course: String(row.course),
    batch: String(row.batch),
    total: paiseToRupees(Number(row.total ?? 0)),
    paid: paiseToRupees(Number(row.paid ?? 0)),
    phone: String(row.phone ?? ''),
    email: row.email ? String(row.email) : undefined,
  }))
}
