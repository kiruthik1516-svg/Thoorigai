import { NextResponse } from 'next/server'
import type { SupabaseClient } from '@supabase/supabase-js'
import { listCertificates } from '@/lib/server-data'
import { certificateSchema } from '@/lib/validation'
import { generateUniqueVerificationCode } from '@/lib/utils'
import type { CertificateRecord } from '@/lib/types'
import z from 'zod'
import { unexpectedApiError } from '@/lib/api-response'
import { pagePaginationFromSearchParams } from '@/lib/pagination'
import { withApi } from '@/lib/http/handler'
import { rolesFor } from '@/lib/auth/permissions'

// F-29: authentication, the admin check, CSRF, rate limiting and body validation happen in withApi.
async function getCertificates(request: Request, supabase: SupabaseClient) {
  try {
    const pagination = pagePaginationFromSearchParams(new URL(request.url).searchParams)
    const result = await listCertificates(supabase, { page: pagination.page, pageSize: pagination.pageSize })
    const mapped: CertificateRecord[] = result.data.map((row) => ({
      id: String(row.id),
      certificateId: String(row.certificate_id),
      studentRowId: row.student_id ? String(row.student_id) : undefined,
      studentRegisterId: Number(row.student_register_id),
      courseName: String(row.course_name),
      studentName: String(row.student_name),
      startDate: row.start_date ? String(row.start_date) : undefined,
      endDate: row.end_date ? String(row.end_date) : undefined,
      issueDate: String(row.issue_date),
      skills: Array.isArray(row.skills) ? row.skills : undefined,
      directorName: row.director_name ? String(row.director_name) : undefined,
      trainerName: row.trainer_name ? String(row.trainer_name) : undefined,
      customNote: row.custom_note ? String(row.custom_note) : undefined,
      issuedAt: row.issued_at ? String(row.issued_at) : undefined,
      verificationCode: row.verification_code ? String(row.verification_code) : undefined,
    }))
    return NextResponse.json({ ...result, data: mapped })
  } catch (error) {
    return unexpectedApiError(error, 'Unable to load certificates')
  }
}

async function postCertificate(parsedBody: z.infer<typeof certificateSchema>, supabase: SupabaseClient) {
  try {
    const {
      certificateId,
      studentRegisterId,
      issueDate,
      startDate,
      endDate,
      skills,
      directorName,
      trainerName,
      customNote,
    } = parsedBody

    const { data: student, error: studentError } = await supabase
      .from('students')
      .select('id, register_id, name, course, paid, total')
      .eq('register_id', studentRegisterId)
      .maybeSingle()
    if (studentError) throw studentError
    if (!student) return NextResponse.json({ error: 'Student not found.' }, { status: 404 })
    if (Number(student.paid) < Number(student.total)) {
      return NextResponse.json(
        { error: 'Clear the outstanding course fees before issuing a certificate.' },
        { status: 409 },
      )
    }

    const payload: Record<string, unknown> = {
      certificate_id: certificateId,
      student_register_id: studentRegisterId,
      course_name: student.course,
      student_name: student.name,
      issue_date: issueDate,
      skills,
      director_name: directorName,
      trainer_name: trainerName,
      custom_note: customNote,
    }

    payload.student_id = student.id
    if (startDate) payload.start_date = startDate
    if (endDate) payload.end_date = endDate

    const { data, error } = await supabase.from('certificates').insert(payload).select().single()
    if (error) throw error

    const verificationCode = await generateUniqueVerificationCode(supabase)
    const { error: verificationError } = await supabase.from('verifiable_documents').insert({
      doc_type: 'certificate',
      reference_id: data.id,
      verification_code: verificationCode,
      status: 'active',
    })
    if (verificationError) throw verificationError

    return NextResponse.json(
      {
        message: 'Certificate recorded successfully',
        data: {
          id: String(data.id),
          certificateId: String(data.certificate_id),
          studentRowId: data.student_id ? String(data.student_id) : undefined,
          studentRegisterId: Number(data.student_register_id),
          courseName: String(data.course_name),
          studentName: String(data.student_name),
          startDate: data.start_date ? String(data.start_date) : undefined,
          endDate: data.end_date ? String(data.end_date) : undefined,
          issueDate: String(data.issue_date),
          skills: Array.isArray(data.skills) ? data.skills : undefined,
          directorName: data.director_name ? String(data.director_name) : undefined,
          trainerName: data.trainer_name ? String(data.trainer_name) : undefined,
          customNote: data.custom_note ? String(data.custom_note) : undefined,
          issuedAt: data.issued_at ? String(data.issued_at) : undefined,
          verificationCode,
        } as CertificateRecord,
      },
      { status: 201 },
    )
  } catch (error) {
    return unexpectedApiError(error, 'Unable to record certificate')
  }
}

export const GET = withApi({ roles: rolesFor('certificates', 'read') }, async ({ request, supabase }) =>
  getCertificates(request, supabase!),
)
export const POST = withApi(
  {
    roles: rolesFor('certificates', 'create'),
    body: certificateSchema,
    userRateLimit: { limit: 10, window: '15 m' },
  },
  async ({ body, supabase }) => postCertificate(body, supabase!),
)
