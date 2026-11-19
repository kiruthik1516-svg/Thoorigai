import { NextResponse } from 'next/server'
import { gstSchema } from '@/lib/validation'
import { unexpectedApiError } from '@/lib/api-response'
import { withApi } from '@/lib/http/handler'
import { rolesFor } from '@/lib/auth/permissions'
import { revalidateTag } from 'next/cache'

function gstResponse(data: Record<string, unknown>) {
  return { rate: Number(data.rate), gstin: data.gstin ? String(data.gstin) : null, enabled: Boolean(data.enabled) }
}

// F-29: authentication, the role check, CSRF and body validation all happen in withApi.
export const GET = withApi({ roles: rolesFor('gst', 'read') }, async ({ supabase }) => {
  try {
    const { data, error } = await supabase!.from('gst_settings').select('*').limit(1).maybeSingle()
    if (error) throw error
    return NextResponse.json({ data: data ? gstResponse(data) : null })
  } catch (error) {
    return unexpectedApiError(error, 'Failed to fetch GST settings')
  }
})

export const POST = withApi({ roles: rolesFor('gst', 'update'), body: gstSchema }, async ({ body, supabase }) => {
  try {
    const { data, error } = await supabase!
      .from('gst_settings')
      .upsert({
        id: 'default',
        rate: body.rate,
        gstin: body.gstin?.trim() || null,
        enabled: body.enabled,
        updated_at: new Date().toISOString(),
      })
      .select()
      .single()
    if (error || !data) throw error ?? new Error('No GST settings row was returned after save.')
    revalidateTag('gst-settings', { expire: 0 })
    return NextResponse.json({ data: gstResponse(data), message: 'GST settings updated' })
  } catch (error) {
    return unexpectedApiError(error, 'Failed to update GST settings')
  }
})
