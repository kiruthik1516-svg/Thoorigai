import { describe, expect, it } from 'vitest'
import { jsonObject, normalizeJoined } from './relations'

describe('normalizeJoined', () => {
  it('returns the first row of an array join, the object itself, or null', () => {
    expect(normalizeJoined([{ id: 'a' }, { id: 'b' }])).toEqual({ id: 'a' })
    expect(normalizeJoined({ id: 'a' })).toEqual({ id: 'a' })
    expect(normalizeJoined([])).toBeNull()
    expect(normalizeJoined(null)).toBeNull()
  })
})

describe('jsonObject', () => {
  it('keeps plain objects and turns everything else into an empty object', () => {
    expect(jsonObject({ phone: '1' })).toEqual({ phone: '1' })
    expect(jsonObject(null)).toEqual({})
    expect(jsonObject(['a'])).toEqual({})
    expect(jsonObject('text')).toEqual({})
  })
})
