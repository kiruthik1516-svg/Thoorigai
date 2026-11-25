import { NextResponse } from 'next/server'
import type { SupabaseClient } from '@supabase/supabase-js'
import { listCertificates } from '@/lib/server-data'
import { certificateSchema } from '@/lib/validation'
import { generateVerificationCode } from '@/lib/utils'
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
      revokedAt: row.revoked_at ? String(row.revoked_at) : undefined,
      revokeReason: row.revoke_reason ? String(row.revoke_reason) : undefined,
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

function certificateRecord(row: Record<string, unknown>, verificationCode?: string): CertificateRecord {
  return {
    id: String(row.id),
    certificateId: String(row.certificate_id),
    studentRowId: row.student_id ? String(row.student_id) : undefined,
    studentRegisterId: Number(row.student_register_id),
    courseName: String(row.course_name),
    studentName: String(row.student_name),
    startDate: row.start_date ? String(row.start_date) : undefined,
    endDate: row.end_date ? String(row.end_date) : undefined,
    issueDate: String(row.issue_date),
    skills: Array.isArray(row.skills) ? (row.skills as string[]) : undefined,
    directorName: row.director_name ? String(row.director_name) : undefined,
    trainerName: row.trainer_name ? String(row.trainer_name) : undefined,
    customNote: row.custom_note ? String(row.custom_note) : undefined,
    issuedAt: row.issued_at ? String(row.issued_at) : undefined,
    revokedAt: row.revoked_at ? String(row.revoked_at) : undefined,
    revokeReason: row.revoke_reason ? String(row.revoke_reason) : undefined,
    verificationCode,
  }
}

const CERTIFICATE_ERRORS: Record<string, { status: number; message: string }> = {
  STUDENT_NOT_FOUND: { status: 404, message: 'Student not found.' },
  FEES_OUTSTANDING: { status: 409, message: 'Clear the outstanding course fees before issuing a certificate.' },
  CERTIFICATE_EXISTS: {
    status: 409,
    message: 'This student already has a certificate for this course. Open it from Certificates, or revoke it first.',
  },
  CERTIFICATE_DATES_INVALID: {
    status: 400,
    message: 'Check the dates: the start must be before the end and the issue date cannot be in the future.',
  },
}

/**
 * Issues a certificate in one database transaction with its verification record (F-certificates):
 * the number comes from a database sequence, each student gets one active certificate per course,
 * and the fee must be fully paid. Student name and course are taken from the student record.
 */
async function postCertificate(parsedBody: z.infer<typeof certificateSchema>, supabase: SupabaseClient) {
  try {
    const verificationCode = generateVerificationCode(10)
    const { data, error } = await supabase.rpc('issue_certificate', {
      p_student_register_id: parsedBody.studentRegisterId,
      p_issue_date: parsedBody.issueDate ?? null,
      p_start_date: parsedBody.startDate ?? null,
      p_end_date: parsedBody.endDate ?? null,
      p_skills: parsedBody.skills,
      p_director_name: parsedBody.directorName ?? null,
      p_trainer_name: parsedBody.trainerName ?? null,
      p_custom_note: parsedBody.customNote ?? null,
      p_verification_code: verificationCode,
    })
    if (error) {
      const known = Object.entries(CERTIFICATE_ERRORS).find(([code]) => error.message.includes(code))
      if (known) return NextResponse.json({ error: { message: known[1].message } }, { status: known[1].status })
      throw error
    }
    const result = data as { certificate: Record<string, unknown>; verification_code: string }
    return NextResponse.json(
      {
        message: 'Certificate recorded successfully',
        data: certificateRecord(result.certificate, result.verification_code),
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

const revokeSchema = z.object({
  id: z.guid(),
  reason: z.string().trim().min(3, { message: 'Give a reason of at least 3 characters.' }).max(500),
})

/** PATCH /api/certificates — revoke a certificate (admins only). The record stays; its QR stops verifying. */
export const PATCH = withApi(
  { roles: rolesFor('certificates', 'update'), body: revokeSchema, userRateLimit: { limit: 10, window: '1 m' } },
  async ({ body, supabase }) => {
    const { error } = await supabase!.rpc('admin_revoke_certificate', {
      p_certificate_uuid: body.id,
      p_reason: body.reason,
    })
    if (error) {
      if (error.message.includes('CERTIFICATE_NOT_FOUND')) {
        return NextResponse.json({ error: { message: 'Certificate not found or already revoked.' } }, { status: 404 })
      }
      if (error.code === '42501')
        return NextResponse.json({ error: { message: 'Admin access required.' } }, { status: 403 })
      throw error
    }
    return NextResponse.json({ data: { revoked: true, id: body.id }, message: 'Certificate revoked' })
  },
)
