import { describe, expect, it } from 'vitest'
import type { Course, CourseCategory } from '@/lib/types'
import {
  availableDurations,
  courseFormFromCourse,
  courseNameMatches,
  coursePayload,
  coursesUrl,
  filterCourses,
  newCourseForm,
} from './model'

const categories = [
  { id: 'ess', name: 'Essential', duration: '6 weeks' },
  { id: 'eli', name: 'Elite', duration: '12 weeks' },
  { id: 'dup', name: 'Essential Plus', duration: '6 Weeks' },
] as CourseCategory[]

const course = (overrides: Partial<Course>): Course =>
  ({ id: 'CRS-1', name: 'Full Stack', fee: 42000, duration: '6 weeks', ...overrides }) as Course

describe('filterCourses', () => {
  it('matches name, description, duration and category case-insensitively', () => {
    const courses = [
      course({ id: '1', name: 'Full Stack', categoryName: 'Elite' }),
      course({ id: '2', name: 'UI Design', description: 'Figma basics', duration: '2 Months' }),
    ]
    expect(filterCourses(courses, 'figma').map((c) => c.id)).toEqual(['2'])
    expect(filterCourses(courses, 'ELITE').map((c) => c.id)).toEqual(['1'])
    expect(filterCourses(courses, 'months').map((c) => c.id)).toEqual(['2'])
    expect(filterCourses(courses, '')).toHaveLength(2)
  })
})

describe('availableDurations', () => {
  it('deduplicates category durations and keeps a custom current duration', () => {
    expect(availableDurations(categories, '6 weeks')).toEqual([
      { duration: '6 weeks', label: '6 weeks (Essential)' },
      { duration: '12 weeks', label: '12 weeks (Elite)' },
    ])
    expect(availableDurations(categories, '9 days').at(-1)).toEqual({ duration: '9 days', label: '9 days' })
  })
})

describe('course form', () => {
  it('starts a new course in the selected tab, or the first category', () => {
    expect(newCourseForm(categories, 'eli')).toMatchObject({ categoryId: 'eli', duration: '12 weeks' })
    expect(newCourseForm(categories, 'uncategorized')).toMatchObject({ categoryId: 'ess', duration: '6 weeks' })
    expect(newCourseForm([], undefined)).toMatchObject({ categoryId: '', duration: '6 weeks' })
  })

  it('validates and builds the save payload', () => {
    const form = courseFormFromCourse(course({ categoryId: 'eli', gstInclusive: true, description: ' x ' }))
    expect(coursePayload({ ...form, name: '  ' }, 'CRS-1')).toEqual({ error: 'Please provide a course name.' })
    expect(coursePayload({ ...form, fee: '0' }, 'CRS-1')).toEqual({
      error: 'Please enter a valid course fee greater than zero.',
    })
    expect(coursePayload({ ...form, categoryId: 'none', duration: ' ' }, 'CRS-1')).toEqual({
      course: {
        id: 'CRS-1',
        name: 'Full Stack',
        fee: 42000,
        duration: '6 weeks',
        description: 'x',
        gstInclusive: true,
        categoryId: null,
      },
    })
  })
})

describe('courseNameMatches', () => {
  it('requires the exact name, ignoring case and outer spaces', () => {
    expect(courseNameMatches(course({}), '  full stack ')).toBe(true)
    expect(courseNameMatches(course({}), 'Full')).toBe(false)
    expect(courseNameMatches(null, '')).toBe(false)
  })
})

describe('coursesUrl', () => {
  it('keeps the existing parameter order and skips empty values', () => {
    expect(coursesUrl({ search: 'aws', categoryId: 'eli', sort: 'fee', direction: 'asc', page: 2, pageSize: 25 })).toBe(
      '/courses?search=aws&categoryId=eli&sort=fee&direction=asc&page=2&pageSize=25',
    )
    expect(coursesUrl({ pageSize: 25 })).toBe('/courses?pageSize=25')
  })
})
