import { describe, expect, it } from 'vitest'
import { apiErrorMessage, errorMessage } from './error-message'

describe('apiErrorMessage (F-22)', () => {
  it('reads every error shape the API returns', () => {
    expect(apiErrorMessage({ error: { message: 'Payment exceeds the remaining balance.' } }, 'x')).toBe(
      'Payment exceeds the remaining balance.',
    )
    expect(apiErrorMessage({ error: 'Course not found' }, 'x')).toBe('Course not found')
    expect(apiErrorMessage({ error: [{ path: ['amount'], message: 'Too small' }] }, 'x')).toBe('Too small')
    expect(apiErrorMessage({ message: 'Saved' }, 'x')).toBe('Saved')
  })

  it('falls back instead of showing [object Object]', () => {
    expect(apiErrorMessage({ error: { code: 'X' } }, 'Failed.')).toBe('Failed.')
    expect(apiErrorMessage(null, 'Failed.')).toBe('Failed.')
    expect(apiErrorMessage('oops', 'Failed.')).toBe('Failed.')
  })
})

describe('errorMessage', () => {
  it('uses the message of an Error and falls back otherwise', () => {
    expect(errorMessage(new Error('Course name already exists'), 'Failed')).toBe('Course name already exists')
    expect(errorMessage(new Error('  '), 'Failed')).toBe('Failed')
    expect(errorMessage('boom', 'Failed')).toBe('Failed')
    expect(errorMessage(null, 'Failed')).toBe('Failed')
  })
})
