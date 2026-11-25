import { describe, expect, it, vi } from 'vitest'
import { fetchAllRows } from './fetch-all'

describe('fetchAllRows', () => {
  it('keeps reading past a server row cap until an empty page', async () => {
    const rows = Array.from({ length: 250 }, (_, i) => i)
    // The server returns at most 100 rows whatever range is asked for.
    const build = vi.fn(async (from: number) => ({ data: rows.slice(from, from + 100), error: null }))
    await expect(fetchAllRows(build)).resolves.toEqual(rows)
    expect(build).toHaveBeenCalledTimes(4)
  })

  it('throws query errors', async () => {
    await expect(fetchAllRows(async () => ({ data: null, error: new Error('boom') }))).rejects.toThrow('boom')
  })
})
