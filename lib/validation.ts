import { z } from 'zod'
import { indiaToday, isIsoDate } from '@/lib/dates'

/** A real calendar date written as YYYY-MM-DD (2026-02-31 is rejected). */
export const isoDateSchema = z.string().refine(isIsoDate, { message: 'Enter a valid date (YYYY-MM-DD).' })

/** Same as isoDateSchema, and not later than today in India. */
export const pastOrTodaySchema = isoDateSchema.refine((value) => value <= indiaToday(), {
  message: 'The date cannot be in the future.',
})

/** Empty strings from forms mean "not given". */
const blankToNull = (value: unknown) => (typeof value === 'string' && value.trim() === '' ? null : value)
const optionalText = (max: number) =>
  z.preprocess(blankToNull, z.union([z.string().trim().max(max), z.null()]).optional())

const PHONE = /^\+?[0-9][0-9 -]{6,18}[0-9]$/
export const phoneSchema = z
  .string()
  .trim()
  .regex(PHONE, { message: 'Enter a valid phone number (digits, spaces or dashes; 8 to 20 characters).' })

export const passwordSchema = z
  .string()
  .min(8, 'Password must be at least 8 characters long')
  .max(128, 'Password cannot exceed 128 characters')
  .regex(/[A-Za-z]/, 'Password must contain at least one letter')
  .regex(/[0-9]/, 'Password must contain at least one number')

const studentProfileFields = {
  name: z.string().trim().min(1, { message: 'Name is required' }).max(200),
  phone: phoneSchema,
  gender: z.preprocess(blankToNull, z.union([z.enum(['Male', 'Female', 'Others']), z.null()]).optional()),
  dob: z.preprocess(blankToNull, z.union([pastOrTodaySchema, z.null()]).optional()),
  altPhone: z.preprocess(blankToNull, z.union([phoneSchema, z.null()]).optional()),
  maritalStatus: optionalText(50),
  email: z.preprocess(
    blankToNull,
    z.union([z.email({ message: 'Enter a valid email address.' }).max(254), z.null()]).optional(),
  ),
  country: optionalText(100),
  state: optionalText(100),
  city: optionalText(100),
  area: optionalText(200),
  studentSource: optionalText(100),
  comments: optionalText(2000),
}

export const studentSchema = z.object({
  ...studentProfileFields,
  // No default: enrolment must name an existing course (the database rejects unknown names).
  course: z.string().trim().min(1, { message: 'Course is required' }),
  batch: z
    .string()
    .trim()
    .min(1)
    .max(50)
    .default(() => indiaToday()),
  // Staff enrol at the course fee, which the database sets; they send 0. Admins must send a fee.
  total: z.number().int().nonnegative({ message: 'Total must be a positive number' }).default(0),
  paid: z.number().int().nonnegative({ message: 'Paid must be a non-negative number' }).default(0),
  knowledgeTags: z.array(z.string().trim().min(1).max(60)).max(30).default([]),
})

/** PATCH /api/students: any subset of fields. Only admins may send `total`. */
export const studentUpdateSchema = z
  .object({
    ...studentProfileFields,
    course: z.string().trim().min(1).max(160),
    batch: z.string().trim().min(1).max(50),
    total: z.number().int().positive({ message: 'Total must be a positive number' }),
    knowledgeTags: z.array(z.string().trim().min(1).max(60)).max(30),
  })
  .partial()
  .refine((value) => Object.keys(value).length > 0, { message: 'Nothing to update.' })

/** What the enrolment form sends to POST /api/students (before schema defaults are applied). */
export type StudentFormValues = z.input<typeof studentSchema>

export const paymentSchema = z.object({
  studentId: z.number().int().positive({ message: 'Student ID must be a positive integer' }),
  amount: z.number().positive({ message: 'Amount must be a positive number' }),
  method: z.string().min(1, { message: 'Method is required' }),
  date: pastOrTodaySchema.optional(),
  transactionId: z.union([z.string().max(100), z.null()]).optional(),
  customNote: z.union([z.string().max(500), z.null()]).optional(),
  paymentType: z.union([z.string().max(100), z.null()]).optional(),
  // GST rate, CGST/SGST, invoice number and instalment number are decided by the database
  // (F-07, F-08, F-16). Unknown keys such as cgst are stripped, so older clients still work.
})

export const courseCategorySchema = z.object({
  name: z.string().min(1, { message: 'Category name is required' }).max(100),
  duration: z.string().min(1, { message: 'Duration is required' }).max(50),
})

export const courseSchema = z.object({
  name: z.string().min(1, { message: 'Name is required' }),
  fee: z.number().nonnegative({ message: 'Fee must be a non-negative number' }),
  duration: z.string().default('6 weeks'),
  description: z.string().default(''),
  gstInclusive: z.boolean().default(false),
  categoryId: z.union([z.guid(), z.string(), z.null()]).optional(),
})

/**
 * POST /api/certificates. The certificate number, student name and course come from the database
 * (issue_certificate); older clients may still send them and they are ignored.
 */
export const certificateSchema = z.object({
  certificateId: z.string().optional(),
  studentRegisterId: z.number().int().positive({ message: 'Student register ID must be a positive integer' }),
  courseName: z.string().optional(),
  studentName: z.string().optional(),
  issueDate: pastOrTodaySchema.optional(),
  studentRowId: z.union([z.string(), z.null()]).optional(),
  startDate: z.preprocess(blankToNull, z.union([isoDateSchema, z.null()]).optional()),
  endDate: z.preprocess(blankToNull, z.union([isoDateSchema, z.null()]).optional()),
  skills: z.array(z.string().trim().min(1).max(60)).max(30).default([]),
  directorName: optionalText(200),
  trainerName: optionalText(200),
  customNote: optionalText(500),
})

export const gstSchema = z.object({
  rate: z.number().min(0).max(100, { message: 'GST rate must be between 0 and 100' }),
  gstin: z.string().trim().nullable().optional(),
  enabled: z.boolean().optional(),
})

export const attendanceSchema = z.object({
  studentId: z.number().int().positive({ message: 'Student ID must be a positive integer' }),
  courseId: z.string().min(1, { message: 'Course ID is required' }),
  sessionDate: pastOrTodaySchema,
  status: z.enum(['Present', 'Absent', 'Exempt', 'Excused']).transform((val) => (val === 'Excused' ? 'Exempt' : val)),
})

/**
 * F-35: form and sheet links are rendered as links and QR codes, so only https Google Forms /
 * Sheets addresses are accepted. Empty strings mean "no link".
 */
const GOOGLE_FORM_HOSTS = ['docs.google.com', 'forms.gle', 'forms.google.com']
const GOOGLE_SHEET_HOSTS = ['docs.google.com']

export function isAllowedGoogleUrl(value: string, hosts: readonly string[]): boolean {
  try {
    const url = new URL(value)
    return url.protocol === 'https:' && hosts.includes(url.hostname.toLowerCase()) && !url.username && !url.password
  } catch {
    return false
  }
}

/** Returns a stored link only if it is still an allowed Google link; older rows are not trusted. */
export function safeFormUrl(value: unknown): string | null {
  return typeof value === 'string' && isAllowedGoogleUrl(value, GOOGLE_FORM_HOSTS) ? value : null
}
export function safeSheetUrl(value: unknown): string | null {
  return typeof value === 'string' && isAllowedGoogleUrl(value, GOOGLE_SHEET_HOSTS) ? value : null
}

function googleUrlSchema(hosts: readonly string[], label: string) {
  return z
    .string()
    .trim()
    .max(2048)
    .transform((value) => (value === '' ? null : value))
    .refine((value) => value === null || isAllowedGoogleUrl(value, hosts), {
      message: `${label} must be an https link on ${hosts.join(' or ')}`,
    })
    .optional()
    .nullable()
}

export const assessmentSchema = z.object({
  courseId: z.string().min(1, { message: 'Course ID is required' }),
  title: z.string().min(1, { message: 'Title is required' }),
  maxScore: z.number().positive({ message: 'Max score must be more than zero' }).max(10000),
  assessmentDate: isoDateSchema,
  formUrl: googleUrlSchema(GOOGLE_FORM_HOSTS, 'Form link'),
  sheetUrl: googleUrlSchema(GOOGLE_SHEET_HOSTS, 'Sheet link'),
})

export const assessmentResultSchema = z.object({
  studentId: z.number().int().positive({ message: 'Student ID must be a positive integer' }),
  score: z.number().nonnegative({ message: 'Score must be a non-negative number' }),
  remarks: z.string().optional(),
})

export const courseMaterialSchema = z.object({
  courseId: z.string().min(1, { message: 'Course ID is required' }),
  title: z.string().min(1, { message: 'Title is required' }),
  type: z.string().min(1, { message: 'Type is required' }), // e.g., 'pdf', 'video', etc.
  // Note: The actual file will be handled as a FormData field in the API route, not in this JSON schema.
})

// Schema for the course material metadata returned by the API (including storage path and signed URL)
export const courseMaterialResponseSchema = z.object({
  id: z.string(),
  courseId: z.string(),
  title: z.string(),
  type: z.string(),
  storagePath: z.string(),
  uploadedBy: z
    .object({
      id: z.string(),
      fullName: z.string().nullable(),
      role: z.string(),
    })
    .nullable(),
  createdAt: z.string(),
  // We'll add a signedUrl property in the API response, but it's not part of the database model.
})
