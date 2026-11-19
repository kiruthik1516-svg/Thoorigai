import { z } from 'zod'

export const passwordSchema = z
  .string()
  .min(8, 'Password must be at least 8 characters long')
  .max(128, 'Password cannot exceed 128 characters')
  .regex(/[A-Za-z]/, 'Password must contain at least one letter')
  .regex(/[0-9]/, 'Password must contain at least one number')

export const studentSchema = z.object({
  name: z.string().min(1, { message: 'Name is required' }),
  phone: z.string().min(1, { message: 'Phone is required' }),
  course: z.string().default('Professional Course'),
  batch: z.string().default(() => new Date().toISOString().slice(0, 10)),
  total: z.number().int().positive({ message: 'Total must be a positive number' }),
  paid: z.number().int().nonnegative({ message: 'Paid must be a non-negative number' }).default(0),
  gender: z.union([z.string(), z.null()]).optional(),
  dob: z.union([z.string(), z.null()]).optional(),
  altPhone: z.union([z.string(), z.null()]).optional(),
  maritalStatus: z.union([z.string(), z.null()]).optional(),
  email: z.union([z.string(), z.null()]).optional(),
  country: z.union([z.string(), z.null()]).optional(),
  state: z.union([z.string(), z.null()]).optional(),
  city: z.union([z.string(), z.null()]).optional(),
  area: z.union([z.string(), z.null()]).optional(),
  studentSource: z.union([z.string(), z.null()]).optional(),
  comments: z.union([z.string(), z.null()]).optional(),
  knowledgeTags: z.array(z.string()).default([]),
})

/** What the enrolment form sends to POST /api/students (before schema defaults are applied). */
export type StudentFormValues = z.input<typeof studentSchema>

export const paymentSchema = z.object({
  studentId: z.number().int().positive({ message: 'Student ID must be a positive integer' }),
  amount: z.number().positive({ message: 'Amount must be a positive number' }),
  method: z.string().min(1, { message: 'Method is required' }),
  date: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, { message: 'Date must be in YYYY-MM-DD format' })
    .optional(),
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

export const certificateSchema = z.object({
  certificateId: z.string().min(1, { message: 'Certificate ID is required' }),
  studentRegisterId: z.number().int().positive({ message: 'Student register ID must be a positive integer' }),
  courseName: z.string().min(1, { message: 'Course name is required' }),
  studentName: z.string().min(1, { message: 'Student name is required' }),
  issueDate: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, { message: 'Issue date must be in YYYY-MM-DD format' })
    .optional(),
  studentRowId: z.union([z.string(), z.null()]).optional(),
  startDate: z.union([z.string(), z.null()]).optional(),
  endDate: z.union([z.string(), z.null()]).optional(),
  skills: z.array(z.string()).default([]),
  directorName: z.union([z.string(), z.null()]).optional(),
  trainerName: z.union([z.string(), z.null()]).optional(),
  customNote: z.union([z.string(), z.null()]).optional(),
})

export const gstSchema = z.object({
  rate: z.number().min(0).max(100, { message: 'GST rate must be between 0 and 100' }),
  gstin: z.string().trim().nullable().optional(),
  enabled: z.boolean().optional(),
})

export const attendanceSchema = z.object({
  studentId: z.number().int().positive({ message: 'Student ID must be a positive integer' }),
  courseId: z.string().min(1, { message: 'Course ID is required' }),
  sessionDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, { message: 'Date must be in YYYY-MM-DD format' }),
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
  maxScore: z.number().nonnegative({ message: 'Max score must be a non-negative number' }),
  assessmentDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, { message: 'Date must be in YYYY-MM-DD format' }),
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
