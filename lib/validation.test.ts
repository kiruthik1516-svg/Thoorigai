import { describe, expect, it } from 'vitest'
import { attendanceSchema, paymentSchema, studentSchema, passwordSchema } from './validation'

describe('validation schemas', () => {
  it('accepts valid student and payment payloads and rejects invalid boundaries', () => {
    expect(studentSchema.safeParse({ name: 'Asha', phone: '9876543210', course: 'Web', total: 10000 }).success).toBe(
      true,
    )
    expect(studentSchema.safeParse({ name: '', phone: '', total: 0 }).success).toBe(false)
    // A course must be named; there is no silent default course any more.
    expect(studentSchema.safeParse({ name: 'Asha', phone: '9876543210', total: 10000 }).success).toBe(false)
    expect(studentSchema.safeParse({ name: 'Asha', phone: 'call me', course: 'Web', total: 1 }).success).toBe(false)
    expect(
      studentSchema.safeParse({ name: 'Asha', phone: '98765 43210', course: 'Web', total: 1, email: 'not-an-email' })
        .success,
    ).toBe(false)
    // Blank optional fields from the form mean "not given".
    expect(
      studentSchema.safeParse({ name: 'Asha', phone: '+91 98765-43210', course: 'Web', total: 1, email: '', dob: '' })
        .success,
    ).toBe(true)
    expect(
      studentSchema.safeParse({ name: 'Asha', phone: '9876543210', course: 'Web', total: 1, dob: '2001-02-30' })
        .success,
    ).toBe(false)
    expect(paymentSchema.safeParse({ studentId: 1, amount: 1, method: 'UPI', date: '2026-03-31' }).success).toBe(true)
    expect(paymentSchema.safeParse({ studentId: 0, amount: 0, method: '', date: '31/03/2026' }).success).toBe(false)
    expect(paymentSchema.safeParse({ studentId: 1, amount: 1, method: 'UPI', date: '2026-02-31' }).success).toBe(false)
    expect(paymentSchema.safeParse({ studentId: 1, amount: 1, method: 'UPI', date: '2999-01-01' }).success).toBe(false)
  })

  it('accepts only the supported attendance statuses and ISO session dates', () => {
    const base = { studentId: 1, courseId: 'CRS-01', sessionDate: '2026-03-31' }
    expect(attendanceSchema.safeParse({ ...base, status: 'Exempt' }).success).toBe(true)
    expect(attendanceSchema.safeParse({ ...base, status: 'Late' }).success).toBe(false)
    expect(attendanceSchema.safeParse({ ...base, status: 'Tardy' }).success).toBe(false)
    expect(attendanceSchema.safeParse({ ...base, sessionDate: '31/03/2026', status: 'Present' }).success).toBe(false)
    expect(attendanceSchema.safeParse({ ...base, sessionDate: '2999-01-01', status: 'Present' }).success).toBe(false)
  })

  it('enforces simple and secure password requirements', () => {
    // Valid passwords (8+ chars, at least 1 letter, at least 1 number)
    expect(passwordSchema.safeParse('Secret123').success).toBe(true)
    expect(passwordSchema.safeParse('Thoorigai2026!').success).toBe(true)
    expect(passwordSchema.safeParse('adminPass1').success).toBe(true)

    // Invalid: under 8 characters
    expect(passwordSchema.safeParse('Pass1').success).toBe(false)

    // Invalid: no numbers
    expect(passwordSchema.safeParse('PasswordOnly').success).toBe(false)

    // Invalid: no letters
    expect(passwordSchema.safeParse('1234567890').success).toBe(false)

    // Invalid: excessively long (> 128 chars)
    expect(passwordSchema.safeParse('A1' + 'x'.repeat(128)).success).toBe(false)
  })
})
