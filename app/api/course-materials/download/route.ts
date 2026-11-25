import { NextResponse } from 'next/server'
import { z } from 'zod'
import { withApi } from '@/lib/http/handler'
import { rolesFor } from '@/lib/auth/permissions'
import { getSupabaseAdminClient } from '@/lib/supabase/admin'

const querySchema = z.object({ id: z.guid() })

/**
 * Opens a course material. The record is read with the caller's own client, so RLS decides
 * access (staff: their courses only); then a one-minute signed URL is issued and followed.
 */
export const GET = withApi(
  { roles: rolesFor('materials', 'read'), query: querySchema },
  async ({ query, supabase, requestId }) => {
    const { data: material, error } = await supabase!
      .from('course_materials')
      .select('id, storage_path')
      .eq('id', query.id)
      .maybeSingle()
    if (error) throw error
    if (!material) return NextResponse.json({ error: { message: 'Material not found.' } }, { status: 404 })
    const { data, error: signError } = await getSupabaseAdminClient(requestId)
      .storage.from('course-materials')
      .createSignedUrl(String(material.storage_path), 60)
    if (signError || !data?.signedUrl) {
      return NextResponse.json({ error: { message: 'The file is not available.' } }, { status: 404 })
    }
    return NextResponse.redirect(data.signedUrl, { status: 302, headers: { 'Cache-Control': 'private, no-store' } })
  },
)
