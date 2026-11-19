import { describe, expect, it } from 'vitest'
import { normalizeCourseName, sameCourse } from './match'

describe('course matching (F-20)', () => {
  it('matches names case- and space-insensitively, or by course id', () => {
    expect(sameCourse('  web development ', { id: 'CRS-1', name: 'Web Development' })).toBe(true)
    expect(sameCourse('crs-1', { id: 'CRS-1', name: 'Web Development' })).toBe(true)
  })

  it('never matches by substring or on empty names', () => {
    expect(sameCourse('Web', { id: 'CRS-1', name: 'Web Development' })).toBe(false)
    expect(sameCourse('Web Development Advanced', { id: 'CRS-1', name: 'Web Development' })).toBe(false)
    expect(sameCourse('', { id: 'CRS-1', name: '' })).toBe(false)
    expect(sameCourse('Anything', { id: '', name: '' })).toBe(false)
    expect(normalizeCourseName(null)).toBe('')
  })
})
