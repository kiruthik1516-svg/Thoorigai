'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { usePathname, useRouter } from 'next/navigation'
import { ArrowLeft, Award, ClipboardList, FileSpreadsheet, GraduationCap, Plus } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { ConfirmDialog } from '@/components/ui/ConfirmDialog'
import { KpiCard } from '@/components/ui/KpiCard'
import type { CourseCategory } from '@/lib/types'
import { apiErrorMessage } from '@/lib/api/error-message'
import { GoogleFormsImportModal } from './GoogleFormsImportModal'
import { ClassroomQRModal } from './ClassroomQRModal'
import { assessmentKpis, type Assessment, type Course, type NewAssessmentInput } from './assessments/model'
import { useGradingStudio } from './assessments/useGradingStudio'
import { CreateAssessmentForm } from './assessments/CreateAssessmentForm'
import { AssessmentLibrary } from './assessments/AssessmentLibrary'
import { GradingStudio } from './assessments/GradingStudio'

export type { Assessment, Course } from './assessments/model'

export function Assessments({
  initialAssessments = [],
  initialCourses = [],
  categories = [],
  initialTotalCount = 0,
  initialPage = 1,
  initialPageSize = 25,
  initialCourseId = '',
  initialSearch = '',
  initialDataLoaded = false,
}: {
  initialAssessments?: Assessment[]
  initialCourses?: Course[]
  categories?: CourseCategory[]
  initialTotalCount?: number
  initialPage?: number
  initialPageSize?: number
  initialCourseId?: string
  initialSearch?: string
  initialDataLoaded?: boolean
}) {
  const router = useRouter()
  const pathname = usePathname()

  const [assessments, setAssessments] = useState<Assessment[]>(initialAssessments)
  const [courses, setCourses] = useState<Course[]>(initialCourses)
  const [selectedCategoryFilter, setSelectedCategoryFilter] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [selectedAssessmentId, setSelectedAssessmentId] = useState<string | null>(null)
  const [deleteResultId, setDeleteResultId] = useState<string | null>(null)
  const [notice, setNotice] = useState('')
  const [activeTab, setActiveTab] = useState<'library' | 'create'>('library')
  const [isImportModalOpen, setIsImportModalOpen] = useState(false)
  const [isQRModalOpen, setIsQRModalOpen] = useState(false)

  const [assessmentFilters, setAssessmentFilters] = useState({
    courseId: initialCourseId,
    pageSize: initialPageSize,
    page: initialPage,
  })
  const [assessmentTotalCount, setAssessmentTotalCount] = useState(initialTotalCount)
  const [assessmentHasMore, setAssessmentHasMore] = useState(initialTotalCount > initialPage * initialPageSize)

  const selectedAssessment = useMemo(
    () => assessments.find((a) => a.id === selectedAssessmentId) || null,
    [assessments, selectedAssessmentId],
  )
  const kpis = useMemo(() => assessmentKpis(assessments), [assessments])
  const studio = useGradingStudio(selectedAssessment, { onError: setError, onNotice: setNotice })

  // Without server-rendered data, load courses and the first page in the browser.
  const loadInitialData = useCallback(async () => {
    try {
      const response = await fetch('/api/courses?page=1&pageSize=100')
      if (!response.ok) throw new Error('Failed to fetch courses')
      const data = await response.json()
      setCourses(data.data || [])
    } catch {
      // Non-fatal fallback
    }

    setLoading(true)
    setError(null)
    try {
      const queryParams = new URLSearchParams()
      if (initialCourseId) queryParams.append('courseId', initialCourseId)
      queryParams.append('pageSize', String(initialPageSize))
      queryParams.append('page', String(initialPage))
      const response = await fetch(`/api/assessments?${queryParams.toString()}`)
      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(apiErrorMessage(errorData, 'Failed to fetch assessments'))
      }
      const data = await response.json()
      setAssessments(data.data || [])
      setAssessmentTotalCount(data.totalCount || 0)
      setAssessmentHasMore(data.hasMore || false)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An unknown error occurred')
    } finally {
      setLoading(false)
    }
  }, [initialCourseId, initialPage, initialPageSize])

  useEffect(() => {
    if (!initialDataLoaded) void loadInitialData()
  }, [initialDataLoaded, loadInitialData])

  const navigateToPage = (courseId: string, page: number) => {
    const params = new URLSearchParams()
    if (courseId) params.set('courseId', courseId)
    if (initialSearch) params.set('search', initialSearch)
    params.set('page', String(page))
    params.set('pageSize', String(assessmentFilters.pageSize))
    router.push(`${pathname}?${params}`)
  }

  const handleCourseFilterChange = (courseId: string) => {
    setAssessmentFilters((prev) => ({ ...prev, courseId, page: 1 }))
    navigateToPage(courseId, 1)
  }

  const handleCategoryFilterChange = (categoryId: string) => {
    setSelectedCategoryFilter(categoryId)
    if (categoryId) {
      const currentCourse = courses.find((c) => c.id === assessmentFilters.courseId)
      if (currentCourse && currentCourse.categoryId !== categoryId) handleCourseFilterChange('')
    }
  }

  const handleCreateAssessment = async (input: NewAssessmentInput) => {
    if (!input.courseId || !input.title || !input.maxScore || !input.assessmentDate) {
      setError('Please fill in all required fields.')
      return false
    }

    setLoading(true)
    setError(null)
    try {
      const response = await fetch('/api/assessments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          courseId: input.courseId,
          title: input.title,
          maxScore: parseFloat(input.maxScore),
          assessmentDate: input.assessmentDate,
          formUrl: input.formUrl || null,
          sheetUrl: input.sheetUrl || null,
        }),
      })
      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(apiErrorMessage(errorData, 'Failed to create assessment'))
      }
      const data = await response.json()
      setAssessments((prev) => [data.data, ...prev])
      setActiveTab('library')
      setNotice('Assessment created successfully.')
      return true
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred while creating assessment')
      return false
    } finally {
      setLoading(false)
    }
  }

  const handleDeleteResult = async () => {
    if (!deleteResultId) return
    if (await studio.removeResult(deleteResultId)) setDeleteResultId(null)
  }

  const openAssessment = (assessmentId: string | null) => {
    setError(null)
    setSelectedAssessmentId(assessmentId)
  }

  return (
    <div className="space-y-6">
      {/* 1. Page Header & KPI Summary */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-2">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wider text-[var(--mute)] mb-1">
            ACADEMIC EVALUATIONS & QUIZZES
          </p>
          <h1 className="text-3xl sm:text-4xl font-extrabold tracking-tight text-[var(--text-heading)]">Assessments</h1>
          <p className="text-sm text-[var(--mute)] mt-1">
            Create evaluations, distribute Google Forms quizzes, and import graded responses in seconds.
          </p>
        </div>

        {selectedAssessmentId ? (
          <Button
            variant="outline"
            onClick={() => openAssessment(null)}
            className="btn-secondary self-start md:self-auto cursor-pointer"
          >
            <ArrowLeft size={15} />
            <span>Back to Assessments</span>
          </Button>
        ) : (
          <div className="flex items-center gap-2 p-1 rounded-full bg-[var(--card)] border border-[var(--border)] shadow-xs">
            <button
              type="button"
              onClick={() => setActiveTab('library')}
              className={`inline-flex items-center gap-1.5 px-4 py-2 rounded-full text-xs font-bold transition-all cursor-pointer ${
                activeTab === 'library' ? 'text-white shadow-md' : 'text-[var(--mute)] hover:text-[var(--text)]'
              }`}
              style={{
                background: activeTab === 'library' ? 'linear-gradient(135deg, var(--g1), var(--g1b))' : 'transparent',
              }}
            >
              <ClipboardList size={14} />
              <span>Catalog & Library</span>
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('create')}
              className={`inline-flex items-center gap-1.5 px-4 py-2 rounded-full text-xs font-bold transition-all cursor-pointer ${
                activeTab === 'create' ? 'text-white shadow-md' : 'text-[var(--mute)] hover:text-[var(--text)]'
              }`}
              style={{
                background: activeTab === 'create' ? 'linear-gradient(135deg, var(--g1), var(--g1b))' : 'transparent',
              }}
            >
              <Plus size={14} />
              <span>Create Assessment</span>
            </button>
          </div>
        )}
      </div>

      {/* KPI Tiles (shown in library/create views) */}
      {!selectedAssessmentId && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <KpiCard
            title="Total Assessments"
            value={kpis.total}
            subtitle="Across active course batches"
            icon={<ClipboardList size={18} />}
          />
          <KpiCard
            title="Google Form Quizzes"
            value={kpis.withGoogleForms}
            subtitle="Live QR quiz integrations"
            icon={<FileSpreadsheet size={18} />}
            badge={{ text: 'Connected', variant: 'accent' }}
          />
          <KpiCard
            title="Batches Evaluated"
            value={kpis.uniqueCourses}
            subtitle="Programs with completed marks"
            icon={<GraduationCap size={18} />}
          />
          <KpiCard
            title="Grading Pipeline"
            value="Instant CSV"
            subtitle="Auto-score and sync responses"
            icon={<Award size={18} />}
            badge={{ text: 'Active', variant: 'success' }}
          />
        </div>
      )}

      {/* 2. Main Viewport */}
      {!selectedAssessment ? (
        <>
          {activeTab === 'create' && (
            <CreateAssessmentForm
              courses={courses}
              categories={categories}
              error={error}
              creating={loading}
              onCreate={handleCreateAssessment}
              onCancel={() => setActiveTab('library')}
            />
          )}

          {activeTab === 'library' && (
            <AssessmentLibrary
              assessments={assessments}
              courses={courses}
              categories={categories}
              courseFilter={assessmentFilters.courseId}
              categoryFilter={selectedCategoryFilter}
              totalCount={assessmentTotalCount}
              hasMore={assessmentHasMore}
              onCourseChange={handleCourseFilterChange}
              onCategoryChange={handleCategoryFilterChange}
              onLoadMore={() => navigateToPage(assessmentFilters.courseId, assessmentFilters.page + 1)}
              onOpen={openAssessment}
            />
          )}
        </>
      ) : (
        /* 3. GRADING & RESULTS STUDIO */
        <GradingStudio
          assessment={selectedAssessment}
          students={studio.students}
          results={studio.results}
          bulkScores={studio.bulkScores}
          saving={studio.saving}
          error={error}
          onScoreChange={studio.setScore}
          onSaveScores={studio.saveScores}
          onDeleteResult={setDeleteResultId}
          onRefresh={studio.refreshResults}
          onOpenImport={() => setIsImportModalOpen(true)}
          onOpenQr={() => setIsQRModalOpen(true)}
        />
      )}

      {/* Global Modals & Live Region */}
      <GoogleFormsImportModal
        isOpen={isImportModalOpen}
        onClose={() => setIsImportModalOpen(false)}
        assessmentId={selectedAssessment?.id || ''}
        assessmentTitle={selectedAssessment?.title || ''}
        maxScore={selectedAssessment?.maxScore || 100}
        enrolledStudents={studio.students}
        existingResults={studio.results}
        onImportSuccess={() => {
          studio.refreshResults()
          setNotice('Google Forms responses imported successfully.')
        }}
      />

      <ClassroomQRModal
        isOpen={isQRModalOpen}
        onClose={() => setIsQRModalOpen(false)}
        formUrl={selectedAssessment?.formUrl || ''}
        title={selectedAssessment?.title || ''}
        courseName={selectedAssessment?.courseName || ''}
      />

      <p role="status" aria-live="polite" className="sr-only">
        {notice}
      </p>

      <ConfirmDialog
        isOpen={deleteResultId !== null}
        title="Delete assessment result?"
        description="This removes the recorded score for this student."
        confirmText="Delete result"
        destructive
        onCancel={() => setDeleteResultId(null)}
        onConfirm={() => void handleDeleteResult()}
      />
    </div>
  )
}
