export type JoinedRelation<T> = T | T[] | null | undefined

export function normalizeJoined<T>(value: JoinedRelation<T>): T | null {
  if (Array.isArray(value)) return value[0] ?? null
  return value ?? null
}

/** A JSONB column as a plain object; anything else (null, arrays, scalars) becomes {}. */
export function jsonObject(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value) ? (value as Record<string, unknown>) : {}
}
