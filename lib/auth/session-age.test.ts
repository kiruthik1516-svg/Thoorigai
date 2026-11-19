import { describe, expect, it } from 'vitest'
import { ADMIN_SESSION_MAX_AGE_SECONDS, authenticatedAt, isAdminSessionExpired } from './session-age'

const now = 1_800_000_000

describe('admin session age (F-27)', () => {
  it('reads the latest sign-in time from amr', () => {
    expect(
      authenticatedAt({
        amr: [
          { method: 'password', timestamp: 100 },
          { method: 'otp', timestamp: 200 },
        ],
      }),
    ).toBe(200)
    expect(authenticatedAt({})).toBeNull()
  })

  it('expires admin sessions older than 12 hours', () => {
    const old = now - ADMIN_SESSION_MAX_AGE_SECONDS - 1
    const fresh = now - 60
    expect(isAdminSessionExpired({ app_metadata: { role: 'admin' }, amr: [{ timestamp: old }] }, now)).toBe(true)
    expect(isAdminSessionExpired({ app_metadata: { role: 'admin' }, amr: [{ timestamp: fresh }] }, now)).toBe(false)
  })

  it('leaves staff sessions and tokens without amr alone', () => {
    const old = now - ADMIN_SESSION_MAX_AGE_SECONDS * 3
    expect(isAdminSessionExpired({ app_metadata: { role: 'staff' }, amr: [{ timestamp: old }] }, now)).toBe(false)
    expect(isAdminSessionExpired({ app_metadata: { role: 'admin' } }, now)).toBe(false)
  })
})
