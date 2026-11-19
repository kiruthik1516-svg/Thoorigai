import { format, parseISO } from 'date-fns'
import { csvCell } from '@/lib/csv'
import type { StudentOption } from '../../utils/google-form-parser'

export type Assessment = {
  id: string
  courseId: string
  courseName: string
  title: string
  maxScore: number
  assessmentDate: string
  formUrl?: string | null
  sheetUrl?: string | null
  createdBy: {
    id: string
    fullName: string
    role: string
  } | null
  createdAt: string
}

export type AssessmentResult = {
  id: string
  studentId: number
  studentName: string
  score: number
  remarks: string | null
  gradedBy: {
    id: string
    fullName: string
    role: string
  } | null
  gradedAt: string
}

export type Course = {
  id: string
  name: string
  categoryId?: string | null
  categoryName?: string | null
}

export type ResultsFilter = 'all' | 'graded' | 'unmarked'

export type NewAssessmentInput = {
  courseId: string
  title: string
  maxScore: string
  assessmentDate: string
  formUrl: string
  sheetUrl: string
}

export function emptyAssessmentInput(): NewAssessmentInput {
  return {
    courseId: '',
    title: '',
    maxScore: '30',
    assessmentDate: new Date().toISOString().slice(0, 10),
    formUrl: '',
    sheetUrl: '',
  }
}

export function formatDate(dateString: string) {
  try {
    const parts = dateString.split('-').map(Number)
    if (parts.length === 3 && parts[0] && parts[1] && parts[2]) {
      const d = new Date(parts[0], parts[1] - 1, parts[2])
      return d.toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
      })
    }
    return format(parseISO(dateString), 'MMM d, yyyy')
  } catch {
    return dateString
  }
}

export function getInitials(name: string) {
  const parts = name.trim().split(/\s+/)
  if (parts.length >= 2 && parts[0] && parts[parts.length - 1]) {
    return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase()
  }
  return (name.slice(0, 2) || 'ST').toUpperCase()
}

export function assessmentKpis(assessments: Assessment[]) {
  return {
    total: assessments.length,
    withGoogleForms: assessments.filter((a) => !!a.formUrl).length,
    uniqueCourses: new Set(assessments.map((a) => a.courseId)).size,
  }
}

/** Roster rows for the Grading Studio after the graded/unmarked chip and the search box. */
export function filterRoster(
  students: StudentOption[],
  results: AssessmentResult[],
  filter: ResultsFilter,
  search: string,
): StudentOption[] {
  const gradedIds = new Set(results.map((r) => r.studentId))
  const list =
    filter === 'graded'
      ? students.filter((s) => gradedIds.has(s.register_id))
      : filter === 'unmarked'
        ? students.filter((s) => !gradedIds.has(s.register_id))
        : students
  const query = search.toLowerCase().trim()
  if (!query) return list
  return list.filter((s) => s.name.toLowerCase().includes(query) || String(s.register_id).includes(query))
}

/** Score inputs keyed by register id -> the entries to save (blank inputs are skipped). */
export function bulkScoreEntries(bulkScores: Record<string, string>) {
  return Object.entries(bulkScores)
    .filter(([, score]) => score.trim() !== '')
    .map(([studentId, score]) => ({ studentId: parseInt(studentId, 10), score: parseFloat(score) }))
}

export function scoresByStudent(results: AssessmentResult[]): Record<string, string> {
  return Object.fromEntries(results.map((item) => [String(item.studentId), String(item.score)]))
}

const GRADE_BANDS = [
  { label: '0–49%', min: 0, max: 50, color: 'bg-rose-500' },
  { label: '50–69%', min: 50, max: 70, color: 'bg-amber-500' },
  { label: '70–84%', min: 70, max: 85, color: 'bg-indigo-500' },
  { label: '85–100%', min: 85, max: 101, color: 'bg-emerald-500' },
]

export function gradeDistribution(results: AssessmentResult[], maxScore: number) {
  const bands = GRADE_BANDS.map((band) => ({
    ...band,
    count: results.filter((result) => {
      const percent = maxScore > 0 ? (result.score / maxScore) * 100 : 0
      return percent >= band.min && percent < band.max
    }).length,
  }))
  const gradedCount = results.length
  const averageScore = gradedCount > 0 ? (results.reduce((acc, r) => acc + r.score, 0) / gradedCount).toFixed(1) : '0'
  return {
    bands,
    maxCount: Math.max(1, ...bands.map((band) => band.count)),
    gradedCount,
    averageScore,
    averagePercent: maxScore > 0 ? ((Number(averageScore) / maxScore) * 100).toFixed(1) : '0',
  }
}

export function resultsCsv(results: AssessmentResult[], maxScore: number) {
  const headers = ['Student ID', 'Student Name', 'Score', 'Max Score', 'Percentage', 'Remarks', 'Graded At']
  const rows = results.map((r) => [
    r.studentId,
    csvCell(r.studentName),
    r.score,
    maxScore,
    `${((r.score / maxScore) * 100).toFixed(1)}%`,
    csvCell(r.remarks || ''),
    r.gradedAt,
  ])
  return [headers.join(','), ...rows.map((row) => row.join(','))].join('\n')
}
