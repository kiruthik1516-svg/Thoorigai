import 'server-only'
import { createClient } from '@/lib/supabase/server'
import { listStudents, listPayments, studentFromRow, withoutMoney } from '@/lib/server-data'
import { normalizeJoined } from '@/lib/supabase/relations'
import type { Role } from '@/lib/types'
import { can } from '@/lib/auth/permissions'
import { ConflictError, ForbiddenError, NotFoundError, ValidationError } from '@/lib/http/errors'
import type { StudentUpdateInput } from './schema'
import type { TablesUpdate } from '@/lib/supabase/database.types'
import { paiseToRupees, rupeesToPaise } from '@/lib/money'
import { generateVerificationCode } from '@/lib/utils'
import { createStudentWithPaymentAtomic } from './repository'
import type { CreateStudentInput } from './schema'
import { getCurrentProfile } from '@/lib/auth/current-profile'
import { createHash } from 'node:crypto'
import { idempotencyKeySchema } from '@/modules/payments/schema'
import { createNotification, notifyCourseTrainers } from '@/modules/notifications/service'
import { indiaToday } from '@/lib/dates'

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
  const { role } = await getCurrentProfile()
  authorizeStudent(role, 'read')
  const supabase = await createClient()
  const allowedSort = ['register_id', 'name', 'created_at'] as const
  const sort = allowedSort.includes(options.sort as (typeof allowedSort)[number])
    ? (options.sort as (typeof allowedSort)[number])
    : 'register_id'
  const result = await listStudents(supabase, {
    ...options,
    sort,
    direction: options.direction,
    categoryId: options.categoryId,
    course: options.course,
  })
  return can(role, 'payments', 'read') ? result : { ...result, data: result.data.map(withoutMoney) }
}

/** Maps database errors from student writes to user-facing API errors. */
function studentWriteError(error: { code?: string; message?: string }): never {
  const message = error?.message ?? ''
  if (error?.code === '42501') throw new ForbiddenError(message || 'You are not allowed to change this student.')
  if (message.includes('COURSE_NOT_FOUND')) throw new ValidationError('Choose a course from the course list.')
  if (message.includes('FEE_REQUIRED'))
    throw new ValidationError('The course fee must be more than zero. Ask an admin to set the course fee.')
  if (message.includes('FEE_BELOW_PAID')) throw new ValidationError('The fee cannot be less than what has been paid.')
  if (message.includes('INITIAL_PAYMENT_EXCEEDS_TOTAL'))
    throw new ValidationError('Paid amount cannot exceed total fees.')
  if (message.includes('PAYMENT_DATE_IN_FUTURE')) throw new ValidationError('The payment date cannot be in the future.')
  throw error
}

const STUDENT_COLUMNS: Record<keyof Omit<StudentUpdateInput, 'total'>, string> = {
  name: 'name',
  phone: 'phone',
  course: 'course',
  batch: 'batch',
  gender: 'gender',
  dob: 'dob',
  altPhone: 'alt_phone',
  maritalStatus: 'marital_status',
  email: 'email',
  country: 'country',
  state: 'state',
  city: 'city',
  area: 'area',
  studentSource: 'lead_source',
  comments: 'comments',
  knowledgeTags: 'knowledge_tags',
}

/** Edits a student. Staff edit students of their own courses (RLS); only admins change the fee. */
export async function updateStudent(registerId: number, input: StudentUpdateInput) {
  const { role } = await getCurrentProfile()
  if (!can(role, 'students', 'update')) throw new ForbiddenError()
  if (input.total !== undefined && !can(role, 'payments', 'update')) {
    throw new ForbiddenError('Only admins can change a student’s fee.')
  }
  const updates: Record<string, unknown> = {}
  // Keys come from STUDENT_COLUMNS, so this is a valid students update.
  for (const [key, column] of Object.entries(STUDENT_COLUMNS)) {
    const value = input[key as keyof typeof STUDENT_COLUMNS]
    if (value !== undefined) updates[column] = value
  }
  if (input.total !== undefined) updates.total = rupeesToPaise(input.total)

  const supabase = await createClient()
  const { data, error } = await supabase
    .from('students')
    .update(updates as TablesUpdate<'students'>)
    .eq('register_id', registerId)
    .select('*')
    .maybeSingle()
  if (error) studentWriteError(error)
  if (!data) throw new NotFoundError('Student not found.')
  const student = studentFromRow(data)
  return can(role, 'payments', 'read') ? student : withoutMoney(student)
}

/** Deletes a student who has no invoices or certificates (admins only). */
export async function deleteStudent(registerId: number) {
  const { role } = await getCurrentProfile()
  if (!can(role, 'students', 'delete')) throw new ForbiddenError()
  const supabase = await createClient()
  const { data, error } = await supabase.from('students').delete().eq('register_id', registerId).select('id')
  if (error) {
    if (error.code === '23503') {
      throw new ConflictError(
        'This student has invoices or certificates, so the record must stay. Cancel the invoices instead.',
      )
    }
    studentWriteError(error)
  }
  if (!data || data.length === 0) throw new NotFoundError('Student not found.')
  return { deleted: true, registerId }
}

/** Creates a student and optional first payment through the atomic database workflow. */
export async function createStudent(input: CreateStudentInput, idempotencyKey: string | null = null) {
  const { role, id: profileId } = await getCurrentProfile()
  authorizeStudent(role, 'create')
  let idempotency: { key: string; hash: string } | null = null
  if (idempotencyKey !== null) {
    const key = idempotencyKeySchema.safeParse(idempotencyKey)
    if (!key.success) throw new ValidationError('The Idempotency-Key header is invalid.')
    idempotency = { key: key.data, hash: createHash('sha256').update(JSON.stringify(input)).digest('hex') }
  }
  if (can(role, 'payments', 'create') && input.total <= 0) {
    throw new ValidationError('Enter the tuition fee for this student.')
  }
  if (input.paid > input.total && can(role, 'payments', 'create')) {
    throw new ValidationError('Paid amount cannot exceed total fees.')
  }
  // F-03: payments are admin-only. Staff enrol with the fee set and no initial payment.
  if (input.paid > 0 && !can(role, 'payments', 'create')) {
    throw new ForbiddenError('Only admins can record payments. Enrol the student without an initial payment.')
  }
  const client = await createClient()
  const paymentDate = indiaToday()
  const rpcResult = await createStudentWithPaymentAtomic(
    client,
    input,
    rupeesToPaise(input.paid),
    paymentDate,
    generateVerificationCode(10),
    idempotency,
  ).catch((error: { code?: string; message?: string }) => studentWriteError(error))
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

  // Admins see every enrolment; staff only hear about students in the courses they teach.
  const notice = {
    title: 'New Student Enrolled',
    message: `${student.name} enrolled in ${student.course} (TAI-${student.registerId}).`,
    type: 'success' as const,
    link: `/students/${student.registerId}`,
    entityType: 'student',
    entityId: String(student.id),
  }
  void createNotification({ ...notice, recipientRole: 'admin' }, profileId)
  void notifyCourseTrainers(student.course, notice, profileId)

  return {
    message: 'Student created successfully',
    data: can(role, 'payments', 'read') ? student : withoutMoney(student),
    payment,
  }
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
  const student = studentFromRow(row)
  return {
    student: can(role, 'payments', 'read') ? student : withoutMoney(student),
    payments,
    certificateVerificationCode,
  }
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
    attendance: (attendanceRes.data ?? []).map((a) => ({
      id: String(a.id),
      sessionDate: String(a.session_date),
      status: (a.status === 'Excused' ? 'Exempt' : a.status) as 'Present' | 'Absent' | 'Exempt' | 'Late' | 'Excused',
    })),
    assessments: (assessmentRes.data ?? []).map((r) => {
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
  return (data ?? []).map((row) => ({
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
