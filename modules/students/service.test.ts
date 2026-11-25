import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  role: 'staff',
  rows: {} as Record<string, unknown>,
  listStudents: vi.fn(),
  listPayments: vi.fn(),
  studentFromRow: vi.fn(),
  createStudentWithPaymentAtomic: vi.fn(),
  getCurrentProfile: vi.fn(),
  error: null as null | { code?: string; message?: string },
  updateSpy: vi.fn(),
  createNotification: vi.fn(),
  notifyCourseTrainers: vi.fn(),
}))
vi.mock('server-only', () => ({}))
vi.mock('@/lib/supabase/server', () => ({
  createClient: async () => ({
    from: (table: string) => {
      const query = {
        select: () => query,
        eq: () => query,
        order: () => query,
        limit: () => query,
        update: (values: unknown) => {
          mocks.updateSpy(values)
          return query
        },
        delete: () => query,
        maybeSingle: async () =>
          mocks.error ? { data: null, error: mocks.error } : { data: mocks.rows[table] ?? null, error: null },
        then: (onfulfilled: any) =>
          Promise.resolve(
            mocks.error ? { data: null, error: mocks.error } : { data: mocks.rows[table] ?? [], error: null },
          ).then(onfulfilled),
      }
      return query
    },
  }),
}))
vi.mock('@/lib/server-data', () => ({
  listStudents: mocks.listStudents,
  listPayments: mocks.listPayments,
  studentFromRow: mocks.studentFromRow,
  withoutMoney: (student: Record<string, unknown>) => ({
    ...student,
    total: 0,
    paid: 0,
    status: 'Pending',
    moneyHidden: true,
  }),
}))
vi.mock('./repository', () => ({ createStudentWithPaymentAtomic: mocks.createStudentWithPaymentAtomic }))
vi.mock('@/lib/auth/current-profile', () => ({ getCurrentProfile: mocks.getCurrentProfile }))
vi.mock('@/modules/notifications/service', () => ({
  createNotification: mocks.createNotification,
  notifyCourseTrainers: mocks.notifyCourseTrainers,
}))

import {
  createStudent,
  deleteStudent,
  getStudentAcademicHistory,
  getStudentDetail,
  listStudentPage,
  updateStudent,
} from './service'
import { ConflictError, ForbiddenError, NotFoundError, ValidationError } from '@/lib/http/errors'

const input = {
  name: 'Asha',
  phone: '9000000000',
  course: 'Web',
  batch: '2026-09-29',
  total: 500,
  paid: 0,
  knowledgeTags: [],
}

describe('student service', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.role = 'staff'
    mocks.rows = {}
    mocks.error = null
    mocks.getCurrentProfile.mockImplementation(async () => ({ id: 'user-1', role: mocks.role, fullName: 'Staff' }))
    mocks.studentFromRow.mockImplementation((row) => ({ registerId: row.register_id, name: row.name, paid: 0 }))
    mocks.listStudents.mockResolvedValue({ data: [], totalCount: 0 })
    mocks.listPayments.mockResolvedValue({ data: [] })
    mocks.createStudentWithPaymentAtomic.mockResolvedValue({
      student: { id: 1, register_id: 1, name: 'Asha', paid: 100, status: 'Pending' },
      initial_payment: null,
    })
  })

  it('checks permissions and delegates a paginated student list', async () => {
    await expect(
      listStudentPage({ page: 1, pageSize: 10, search: '', sort: 'bad', direction: 'asc' }),
    ).resolves.toEqual({ data: [], totalCount: 0 })
    expect(mocks.listStudents).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({ sort: 'register_id' }))
    mocks.role = 'staff'
    await expect(
      listStudentPage({ page: 1, pageSize: 10, search: '', sort: 'name', direction: 'desc' }),
    ).resolves.toBeDefined()
    mocks.role = 'pending'
    await expect(createStudent(input)).rejects.toThrow('not allowed')
  })

  it('rejects overpayment before invoking the atomic transaction', async () => {
    mocks.role = 'admin'
    await expect(createStudent({ ...input, paid: 501 })).rejects.toThrow('Paid amount cannot exceed total fees.')
    expect(mocks.createStudentWithPaymentAtomic).not.toHaveBeenCalled()
  })

  it('rejects an initial payment from staff (payments are admin-only)', async () => {
    mocks.role = 'staff'
    await expect(createStudent({ ...input, paid: 100 })).rejects.toThrow('Only admins can record payments')
    expect(mocks.createStudentWithPaymentAtomic).not.toHaveBeenCalled()
  })

  it('creates a student with the atomic repository and maps an optional initial receipt', async () => {
    mocks.role = 'admin'
    mocks.createStudentWithPaymentAtomic.mockResolvedValueOnce({
      student: { id: 1, register_id: 7, name: 'Asha', paid: 100, status: 'Pending' },
      initial_payment: {
        payment: {
          id: 2,
          method: 'UPI',
          payment_date: '2026-09-29',
          amount: 10000,
          invoice: 'TAI-1',
          student_register_id: 7,
          student_id: 1,
          cgst: 900,
          sgst: 900,
          gst_rate: 18,
        },
        verification_code: 'verify-1',
      },
    })
    const result = await createStudent({ ...input, paid: 100 })
    expect(result.data).toMatchObject({ id: '1', paid: 1, status: 'Pending' })
    expect(result.payment).toMatchObject({
      student: 'Asha',
      amount: 100,
      invoice: 'TAI-1',
      verification_code: 'verify-1',
    })
    expect(mocks.createStudentWithPaymentAtomic).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ name: 'Asha' }),
      10000,
      expect.any(String),
      expect.any(String),
      null,
    )
  })

  it('passes an idempotency key and request hash when the client sends one (F-19)', async () => {
    mocks.role = 'admin'
    mocks.createStudentWithPaymentAtomic.mockResolvedValueOnce({
      student: { id: 2, register_id: 1001, name: 'Asha', paid: 0, total: 10000, status: 'Pending' },
      initial_payment: null,
    })
    await createStudent(input, 'enrol-key-1')
    const idempotency = mocks.createStudentWithPaymentAtomic.mock.calls.at(-1)?.[5]
    expect(idempotency).toMatchObject({ key: 'enrol-key-1' })
    expect(idempotency.hash).toMatch(/^[0-9a-f]{64}$/)
    await expect(createStudent(input, '   ')).rejects.toThrow('Idempotency-Key')
  })

  it('returns no detail for missing students and combines student and payment data when present', async () => {
    mocks.role = 'admin'
    mocks.rows.students = null
    await expect(getStudentDetail(99)).resolves.toBeNull()
    mocks.rows.students = { register_id: 8, name: 'Asha' }
    mocks.listPayments.mockResolvedValueOnce({ data: [{ id: 'p1' }] })
    await expect(getStudentDetail(8)).resolves.toEqual({
      student: { registerId: 8, name: 'Asha', paid: 0 },
      payments: [{ id: 'p1' }],
      certificateVerificationCode: null,
    })

    // Admins get the latest certificate's active verification code for the dossier QR.
    mocks.rows.certificates = { id: 'cert-1' }
    mocks.rows.verifiable_documents = { verification_code: 'VERIFY-1' }
    mocks.listPayments.mockResolvedValueOnce({ data: [] })
    await expect(getStudentDetail(8)).resolves.toMatchObject({ certificateVerificationCode: 'VERIFY-1' })
  })

  it('omits payment history and fee figures for staff', async () => {
    mocks.role = 'staff'
    mocks.rows.students = { register_id: 8, name: 'Asha' }
    await expect(getStudentDetail(8)).resolves.toEqual({
      student: { registerId: 8, name: 'Asha', paid: 0, total: 0, status: 'Pending', moneyHidden: true },
      payments: [],
      certificateVerificationCode: null,
    })
    expect(mocks.listPayments).not.toHaveBeenCalled()
  })

  it('returns academic history for a student or empty arrays if student missing', async () => {
    mocks.rows.students = { id: 'uuid-1', register_id: 8 }
    mocks.rows.attendance = [{ id: 'att-1', session_date: '2026-09-20', status: 'Present' }]
    mocks.rows.assessment_results = [
      {
        id: 'res-1',
        score: 85,
        remarks: 'Good job',
        graded_at: '2026-09-21',
        assessments: { title: 'JS Test', max_score: 100, assessment_date: '2026-09-21' },
      },
    ]
    const history = await getStudentAcademicHistory(8)
    expect(history.attendance).toEqual([{ id: 'att-1', sessionDate: '2026-09-20', status: 'Present' }])
    expect(history.assessments).toEqual([
      {
        id: 'res-1',
        title: 'JS Test',
        date: '2026-09-21',
        score: 85,
        maxScore: 100,
        remarks: 'Good job',
        gradedAt: '2026-09-21',
      },
    ])

    mocks.rows.students = null
    const emptyHistory = await getStudentAcademicHistory(99)
    expect(emptyHistory).toEqual({ attendance: [], assessments: [] })
  })
})

describe('student edits, deletes and enrolment rules', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.role = 'admin'
    mocks.rows = {}
    mocks.error = null
    mocks.getCurrentProfile.mockImplementation(async () => ({ id: 'user-1', role: mocks.role, fullName: 'User' }))
    mocks.studentFromRow.mockImplementation((row) => ({
      registerId: row.register_id,
      name: row.name,
      course: row.course,
      paid: 0,
      total: 500,
    }))
    mocks.createStudentWithPaymentAtomic.mockResolvedValue({
      student: { id: 1, register_id: 7, name: 'Asha', course: 'Web', paid: 0, status: 'Pending' },
      initial_payment: null,
    })
  })

  it('lets staff edit profile fields but never returns fee figures to them', async () => {
    mocks.role = 'staff'
    mocks.rows.students = { register_id: 7, name: 'Asha K' }
    const updated = await updateStudent(7, { name: 'Asha K', altPhone: '9111111111', knowledgeTags: ['SQL'] })
    expect(mocks.updateSpy).toHaveBeenCalledWith({
      name: 'Asha K',
      alt_phone: '9111111111',
      knowledge_tags: ['SQL'],
    })
    expect(updated).toMatchObject({ registerId: 7, total: 0, paid: 0, moneyHidden: true })
  })

  it('only lets admins change the fee, and stores it in paise', async () => {
    mocks.role = 'staff'
    await expect(updateStudent(7, { total: 100 })).rejects.toBeInstanceOf(ForbiddenError)
    expect(mocks.updateSpy).not.toHaveBeenCalled()

    mocks.role = 'admin'
    mocks.rows.students = { register_id: 7, name: 'Asha' }
    const updated = await updateStudent(7, { total: 500 })
    expect(mocks.updateSpy).toHaveBeenCalledWith({ total: 50000 })
    expect(updated).toMatchObject({ total: 500 })
    expect(updated).not.toHaveProperty('moneyHidden')
  })

  it('rejects edits from accounts without permission and reports a missing student', async () => {
    mocks.role = 'pending'
    await expect(updateStudent(7, { name: 'X' })).rejects.toBeInstanceOf(ForbiddenError)
    mocks.role = 'admin'
    mocks.rows.students = null
    await expect(updateStudent(99, { name: 'X' })).rejects.toBeInstanceOf(NotFoundError)
  })

  it.each([
    [{ code: '42501', message: 'Only admins can change a student fee' }, ForbiddenError],
    [{ message: 'COURSE_NOT_FOUND' }, ValidationError],
    [{ message: 'FEE_REQUIRED' }, ValidationError],
    [{ code: '23514', message: 'FEE_BELOW_PAID' }, ValidationError],
    [{ message: 'PAYMENT_DATE_IN_FUTURE' }, ValidationError],
  ])('maps database error %j to a user-facing error', async (error, expected) => {
    mocks.error = error
    await expect(updateStudent(7, { name: 'X' })).rejects.toBeInstanceOf(expected)
  })

  it('rethrows database errors it does not recognise', async () => {
    mocks.error = { code: 'XX000', message: 'boom' }
    await expect(updateStudent(7, { name: 'X' })).rejects.toMatchObject({ message: 'boom' })
  })

  it('deletes a student only for admins and explains why invoices block it', async () => {
    mocks.role = 'staff'
    await expect(deleteStudent(7)).rejects.toBeInstanceOf(ForbiddenError)

    mocks.role = 'admin'
    mocks.rows.students = [{ id: 's1' }]
    await expect(deleteStudent(7)).resolves.toEqual({ deleted: true, registerId: 7 })

    mocks.rows.students = []
    await expect(deleteStudent(7)).rejects.toBeInstanceOf(NotFoundError)

    mocks.error = { code: '23503', message: 'violates foreign key' }
    await expect(deleteStudent(7)).rejects.toBeInstanceOf(ConflictError)

    mocks.error = { message: 'COURSE_NOT_FOUND' }
    await expect(deleteStudent(7)).rejects.toBeInstanceOf(ValidationError)
  })

  it('requires an admin to enter a fee and hides money from staff when enrolling', async () => {
    mocks.role = 'admin'
    await expect(createStudent({ ...input, total: 0 })).rejects.toThrow('Enter the tuition fee')

    mocks.role = 'staff'
    const result = await createStudent({ ...input, total: 0 })
    expect(result.data).toMatchObject({ registerId: 7, total: 0, paid: 0, moneyHidden: true })
  })

  it('tells admins about an enrolment and only the trainers of that course otherwise', async () => {
    mocks.role = 'admin'
    await createStudent(input)
    expect(mocks.createNotification).toHaveBeenCalledWith(
      expect.objectContaining({ recipientRole: 'admin', title: 'New Student Enrolled', entityType: 'student' }),
      'user-1',
    )
    expect(mocks.notifyCourseTrainers).toHaveBeenCalledWith(
      'Web',
      expect.objectContaining({ title: 'New Student Enrolled' }),
      'user-1',
    )
  })

  it('maps enrolment database errors', async () => {
    mocks.role = 'admin'
    mocks.createStudentWithPaymentAtomic.mockRejectedValueOnce({ code: '42501', message: 'not assigned' })
    await expect(createStudent(input)).rejects.toBeInstanceOf(ForbiddenError)
    mocks.createStudentWithPaymentAtomic.mockRejectedValueOnce({ message: 'COURSE_NOT_FOUND' })
    await expect(createStudent(input)).rejects.toBeInstanceOf(ValidationError)
    mocks.createStudentWithPaymentAtomic.mockRejectedValueOnce({ message: 'INITIAL_PAYMENT_EXCEEDS_TOTAL' })
    await expect(createStudent(input)).rejects.toBeInstanceOf(ValidationError)
  })
})
