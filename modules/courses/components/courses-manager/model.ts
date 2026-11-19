import type { Course, CourseCategory } from '@/lib/types'

export type CourseForm = {
  name: string
  fee: string
  duration: string
  categoryId: string
  description: string
  gstInclusive: boolean
}

export type CourseListParams = {
  search?: string
  categoryId?: string
  sort?: string
  direction?: string
  page?: number
  pageSize: number
}

const DEFAULT_DURATION = '6 weeks'

export function filterCourses(courses: Course[], query: string): Course[] {
  const q = query.toLowerCase()
  return courses.filter(
    (c) =>
      c.name.toLowerCase().includes(q) ||
      (c.description && c.description.toLowerCase().includes(q)) ||
      c.duration.toLowerCase().includes(q) ||
      (c.categoryName && c.categoryName.toLowerCase().includes(q)),
  )
}

/** Category durations (deduplicated, case-insensitively) plus the current value if it is custom. */
export function availableDurations(categories: CourseCategory[], current: string) {
  const list: { duration: string; label: string }[] = []
  const seen = new Set<string>()
  categories.forEach((cat) => {
    const duration = cat.duration.trim()
    if (duration && !seen.has(duration.toLowerCase())) {
      seen.add(duration.toLowerCase())
      list.push({ duration, label: `${duration} (${cat.name})` })
    }
  })
  if (current && !seen.has(current.trim().toLowerCase())) {
    list.push({ duration: current.trim(), label: current.trim() })
  }
  return list
}

/** A new course starts in the selected category tab (or the first category) with its duration. */
export function newCourseForm(categories: CourseCategory[], selectedCategoryId?: string): CourseForm {
  const category =
    selectedCategoryId && selectedCategoryId !== 'uncategorized'
      ? categories.find((c) => c.id === selectedCategoryId)
      : categories[0]
  return {
    name: '',
    fee: '',
    duration: category ? category.duration : DEFAULT_DURATION,
    categoryId: category ? category.id : '',
    description: '',
    gstInclusive: false,
  }
}

export function courseFormFromCourse(course: Course): CourseForm {
  return {
    name: course.name,
    fee: String(course.fee),
    duration: course.duration,
    categoryId: course.categoryId || '',
    description: course.description || '',
    gstInclusive: Boolean(course.gstInclusive),
  }
}

/** Validates the form and builds the save payload, or returns the message to show. */
export function coursePayload(
  form: CourseForm,
  courseId: string | undefined,
): { error: string } | { course: Partial<Course> } {
  if (!form.name.trim()) return { error: 'Please provide a course name.' }
  const fee = Number(form.fee)
  if (isNaN(fee) || fee <= 0) return { error: 'Please enter a valid course fee greater than zero.' }
  return {
    course: {
      id: courseId,
      name: form.name.trim(),
      fee,
      duration: form.duration.trim() || DEFAULT_DURATION,
      description: form.description.trim(),
      gstInclusive: form.gstInclusive,
      categoryId: form.categoryId && form.categoryId !== 'none' ? form.categoryId : null,
    },
  }
}

export function courseNameMatches(course: Course | null, typed: string) {
  return Boolean(course?.name) && typed.trim().toLowerCase() === (course?.name || '').trim().toLowerCase()
}

/** /courses URL for a category tab, the sort control or a pagination link. */
export function coursesUrl({ search, categoryId, sort, direction, page, pageSize }: CourseListParams) {
  const params = new URLSearchParams()
  if (search) params.set('search', search)
  if (categoryId) params.set('categoryId', categoryId)
  if (sort) params.set('sort', sort)
  if (direction) params.set('direction', direction)
  if (page !== undefined) params.set('page', String(page))
  params.set('pageSize', String(pageSize))
  return `/courses?${params.toString()}`
}
