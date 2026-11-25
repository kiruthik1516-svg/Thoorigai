import type { SupabaseClient } from '@supabase/supabase-js'

export type ProfileName = { id: string; fullName: string | null; role: string }

/**
 * Names of the people who marked, graded or created records. Staff may only read their own
 * profile row, so embeds like profiles!attendance_marked_by_fkey come back empty for them; this
 * uses profile_display_names(), which returns just id, name and role to active admin/staff.
 */
export async function lookupProfileNames(
  supabase: SupabaseClient,
  ids: Iterable<string | null | undefined>,
): Promise<Map<string, ProfileName>> {
  const unique = [...new Set([...ids].filter((id): id is string => Boolean(id)))]
  const names = new Map<string, ProfileName>()
  if (unique.length === 0) return names
  const { data, error } = await supabase.rpc('profile_display_names', { p_ids: unique })
  if (error) throw error
  for (const row of (data ?? []) as { id: string; full_name: string | null; role: string }[]) {
    names.set(String(row.id), { id: String(row.id), fullName: row.full_name, role: String(row.role) })
  }
  return names
}
