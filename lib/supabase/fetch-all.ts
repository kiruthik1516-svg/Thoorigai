/**
 * Reads every row of a query in pages. PostgREST caps one response (max_rows: 1000 hosted, 100
 * locally), so a single unpaged select silently drops rows once a table grows past the cap.
 * `build` must apply a stable order with a unique tiebreaker (for example `.order('id')`).
 *
 * The next page starts where the previous one ended, so a server cap below `pageSize` is handled;
 * the loop stops at the first empty page.
 */
export async function fetchAllRows<T>(
  build: (from: number, to: number) => PromiseLike<{ data: T[] | null; error: unknown }>,
  { pageSize = 1000, maxRows = 100_000 }: { pageSize?: number; maxRows?: number } = {},
): Promise<T[]> {
  const rows: T[] = []
  while (rows.length < maxRows) {
    const { data, error } = await build(rows.length, rows.length + pageSize - 1)
    if (error) throw error
    if (!data || data.length === 0) break
    rows.push(...data)
  }
  return rows
}
