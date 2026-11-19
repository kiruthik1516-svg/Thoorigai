import { describe, expect, it } from 'vitest'
import { safeNextPath } from './next-path'

describe('safeNextPath (F-45)', () => {
  it('keeps internal paths with their query', () => {
    expect(safeNextPath('/students/1001?tab=payments')).toBe('/students/1001?tab=payments')
    expect(safeNextPath('/invoices/TAI%2F2026%2FINV000001')).toBe('/invoices/TAI%2F2026%2FINV000001')
  })

  it.each([
    '//evil.example',
    '/\\evil.example',
    'https://evil.example',
    'javascript:alert(1)',
    'students',
    '/api/payments',
    '/login',
    '',
    null,
    '/\u0000x',
  ])('falls back for %j', (value) => {
    expect(safeNextPath(value as string | null)).toBe('/')
  })
})
