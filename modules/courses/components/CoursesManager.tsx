import { useMemo, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { ChevronDown, Layers, LayoutGrid, List as ListIcon, Plus, Search, X } from 'lucide-react'
import type { Course, CourseCategory } from '@/lib/types'
import { coursesUrl, filterCourses } from './courses-manager/model'
import { CourseCategoryTabs } from './courses-manager/CourseCategoryTabs'
import { CoursesTable } from './courses-manager/CoursesTable'
import { CoursesGrid } from './courses-manager/CoursesGrid'
import { CourseFormModal } from './courses-manager/CourseFormModal'
import { DeleteCourseModal } from './courses-manager/DeleteCourseModal'

export function CoursesManager({
  courses,
  categories = [],
  selectedCategoryId,
  onSaveCourse,
  onDeleteCourse,
  gstRate = 18,
  search = '',
  page = 1,
  pageSize = 25,
  totalCount = courses.length,
  canCreate = true,
  canUpdate = true,
  canDelete = true,
  canManageCategories = false,
  sort = 'name',
  direction = 'asc',
}: {
  courses: Course[]
  categories?: CourseCategory[]
  selectedCategoryId?: string
  onSaveCourse: (course: Partial<Course>) => Promise<void>
  onDeleteCourse: (id: string) => Promise<void>
  gstRate?: number
  search?: string
  page?: number
  pageSize?: number
  totalCount?: number
  canCreate?: boolean
  canUpdate?: boolean
  canDelete?: boolean
  canManageCategories?: boolean
  sort?: string
  direction?: 'asc' | 'desc'
}) {
  const router = useRouter()
  const [query, setQuery] = useState(search)
  const [viewMode, setViewMode] = useState<'table' | 'grid'>('table')
  /** The add/edit modal: course is null when adding. */
  const [editor, setEditor] = useState<{ course: Course | null } | null>(null)
  const [deletingCourse, setDeletingCourse] = useState<Course | null>(null)

  const visibleCourses = useMemo(() => filterCourses(courses, query), [courses, query])
  const listParams = { search, categoryId: selectedCategoryId, sort, direction, pageSize }
  const tabUrl = (categoryId?: string) => coursesUrl({ search: query, categoryId, sort, direction, pageSize })
  const openCourse = (course: Course) => setEditor({ course })

  return (
    <>
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 pb-4 border-b border-[var(--border)] mb-6">
        <div>
          <p className="text-xs font-bold uppercase tracking-wider text-[var(--mute)]">ACADEMY CURRICULUM</p>
          <h1 className="text-3xl font-extrabold tracking-tight text-[var(--text)]">Manage Courses</h1>
          <p className="text-xs text-[var(--mute)] mt-1">
            Configure academy curriculum programs, duration tiers, tuition fees, and GST pricing.
          </p>
        </div>
        <div className="flex items-center gap-2.5">
          {canManageCategories && (
            <Link
              href="/settings/course-categories"
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-full border border-[var(--border)] bg-[var(--panel)] text-xs font-bold text-[var(--text)] hover:bg-[var(--card)] transition-colors"
            >
              <Layers size={14} className="text-[var(--mute)]" />
              <span>Configure Categories</span>
            </Link>
          )}
          {canCreate && (
            <button
              onClick={() => setEditor({ course: null })}
              className="inline-flex items-center gap-1.5 px-5 py-2 rounded-full text-xs font-bold text-white shadow-xs transition-opacity hover:opacity-90 cursor-pointer"
              style={{ background: 'linear-gradient(135deg, var(--g1), var(--g1b))' }}
            >
              <Plus size={14} />
              <span>Add Course</span>
            </button>
          )}
        </div>
      </div>

      {/* Category Filter Tabs */}
      <CourseCategoryTabs
        categories={categories}
        selectedCategoryId={selectedCategoryId}
        visibleCount={visibleCourses.length}
        tabUrl={tabUrl}
      />

      <section className="bg-[var(--card)] rounded-[22px] border border-[var(--border)] shadow-xs mb-6">
        <div className="p-5 border-b border-[var(--border)] flex flex-col md:flex-row md:items-center justify-between gap-3">
          <div>
            <h2 className="text-base font-bold text-[var(--text)]">
              {selectedCategoryId
                ? selectedCategoryId === 'uncategorized'
                  ? 'Uncategorized Courses'
                  : `${categories.find((c) => c.id === selectedCategoryId)?.name || 'Filtered'} Courses (${visibleCourses.length})`
                : `Course Catalog (${visibleCourses.length})`}
            </h2>
            <p className="text-xs text-[var(--mute)] mt-0.5">
              Academy curriculum with GST Inclusive and Exclusive pricing (
              {gstRate > 0 ? `${gstRate}% GST applicable` : 'GST disabled'})
            </p>
          </div>
          <div className="flex items-center gap-3">
            <form action="/courses" method="get" className="flex items-center gap-2">
              <div className="relative">
                <Search
                  size={15}
                  className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--mute)] pointer-events-none"
                />
                <input
                  name="search"
                  aria-label="Search courses"
                  type="text"
                  placeholder="Search courses..."
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  className="w-48 sm:w-60 pl-9 pr-8 py-2 rounded-full border border-[var(--border)] bg-[var(--panel)] text-xs font-medium text-[var(--text)] placeholder:text-[var(--mute)] focus:outline-none focus:ring-1 focus:ring-[var(--g1)] shadow-2xs"
                />
                {query && (
                  <button
                    type="button"
                    onClick={() => {
                      setQuery('')
                      const params = new URLSearchParams()
                      if (selectedCategoryId) params.set('categoryId', selectedCategoryId)
                      if (sort) params.set('sort', sort)
                      const qs = params.toString()
                      router.push('/courses' + (qs ? `?${qs}` : ''))
                    }}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[var(--mute)] hover:text-[var(--text)] p-0.5 cursor-pointer"
                    aria-label="Clear search input"
                  >
                    <X size={14} />
                  </button>
                )}
              </div>
              {selectedCategoryId && <input type="hidden" name="categoryId" value={selectedCategoryId} />}
              <input type="hidden" name="pageSize" value={pageSize} />
              <input type="hidden" name="direction" value={direction} />

              <div className="relative">
                <label className="sr-only" htmlFor="course-sort">
                  Sort courses by
                </label>
                <select
                  id="course-sort"
                  name="sort"
                  defaultValue={sort}
                  onChange={(e) =>
                    router.push(
                      coursesUrl({ search: query, categoryId: selectedCategoryId, sort: e.target.value, pageSize }),
                    )
                  }
                  className="py-2 pl-3.5 pr-8 rounded-full border border-[var(--border)] bg-[var(--panel)] text-xs font-semibold text-[var(--text)] focus:outline-none focus:ring-1 focus:ring-[var(--g1)] shadow-2xs appearance-none cursor-pointer"
                >
                  <option value="name">Name</option>
                  <option value="fee">Fee</option>
                  <option value="duration">Duration</option>
                </select>
                <ChevronDown
                  size={14}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-[var(--mute)] pointer-events-none"
                />
              </div>

              <button type="submit" className="sr-only">
                Search
              </button>
            </form>

            {/* View Mode Toggle: Table List vs Grid Cards */}
            <div className="flex items-center bg-[var(--panel)] p-1 rounded-full border border-[var(--border)] shrink-0 gap-1">
              <button
                type="button"
                onClick={() => setViewMode('table')}
                className={`p-1.5 rounded-full text-xs font-bold transition-all cursor-pointer ${
                  viewMode === 'table' ? 'text-white shadow-2xs' : 'text-[var(--mute)] hover:text-[var(--text)]'
                }`}
                style={viewMode === 'table' ? { background: 'linear-gradient(135deg, var(--g1), var(--g1b))' } : {}}
                title="Table List View"
                aria-label="Table List View"
              >
                <ListIcon size={15} />
              </button>
              <button
                type="button"
                onClick={() => setViewMode('grid')}
                className={`p-1.5 rounded-full text-xs font-bold transition-all cursor-pointer ${
                  viewMode === 'grid' ? 'text-white shadow-2xs' : 'text-[var(--mute)] hover:text-[var(--text)]'
                }`}
                style={viewMode === 'grid' ? { background: 'linear-gradient(135deg, var(--g1), var(--g1b))' } : {}}
                title="Course Cards Grid View"
                aria-label="Course Cards Grid View"
              >
                <LayoutGrid size={15} />
              </button>
            </div>
          </div>
        </div>

        {viewMode === 'table' ? (
          <CoursesTable courses={visibleCourses} gstRate={gstRate} onOpen={openCourse} />
        ) : (
          <CoursesGrid courses={visibleCourses} gstRate={gstRate} canUpdate={canUpdate} onOpen={openCourse} />
        )}

        <div className="p-4 border-t border-[var(--border)] bg-[var(--panel)] flex items-center justify-between text-xs text-[var(--mute)]">
          <span>
            {totalCount} courses · Page {page} of {Math.max(1, Math.ceil(totalCount / pageSize))}
          </span>
          <div className="flex items-center gap-2">
            <Link
              aria-disabled={page <= 1}
              className={`px-4 py-1.5 rounded-full font-bold border border-[var(--border)] bg-[var(--card)] text-[var(--text)] transition-colors ${
                page <= 1 ? 'pointer-events-none opacity-40' : 'hover:bg-[var(--panel)]'
              }`}
              href={coursesUrl({ ...listParams, page: Math.max(1, page - 1) })}
            >
              Previous
            </Link>
            <Link
              aria-disabled={page >= Math.ceil(totalCount / pageSize)}
              className={`px-4 py-1.5 rounded-full font-bold border border-[var(--border)] bg-[var(--card)] text-[var(--text)] transition-colors ${
                page >= Math.ceil(totalCount / pageSize) ? 'pointer-events-none opacity-40' : 'hover:bg-[var(--panel)]'
              }`}
              href={coursesUrl({ ...listParams, page: page + 1 })}
            >
              Next
            </Link>
          </div>
        </div>
      </section>

      {/* Add / Edit Course Modal */}
      {editor && (
        <CourseFormModal
          editingCourse={editor.course}
          categories={categories}
          selectedCategoryId={selectedCategoryId}
          gstRate={gstRate}
          canManageCategories={canManageCategories}
          canDelete={canDelete}
          onSave={onSaveCourse}
          onClose={() => setEditor(null)}
          onRequestDelete={setDeletingCourse}
        />
      )}

      {/* Deletion requires typing the course name */}
      {deletingCourse && (
        <DeleteCourseModal
          course={deletingCourse}
          onDelete={onDeleteCourse}
          onClose={() => setDeletingCourse(null)}
          onDeleted={() => {
            setDeletingCourse(null)
            setEditor(null)
          }}
        />
      )}
    </>
  )
}
