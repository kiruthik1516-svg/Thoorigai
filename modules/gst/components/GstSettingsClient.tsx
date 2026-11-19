'use client'

import { useRouter } from 'next/navigation'
import type { GstSettings } from '@/lib/types'
import { GstSettingsPage } from '@/modules/gst/components/GstSettings'
import { apiErrorMessage } from '@/lib/api/error-message'

export function GstSettingsClient({ settings, editable }: { settings: GstSettings | null; editable: boolean }) {
  const router = useRouter()
  return (
    <GstSettingsPage
      settings={settings}
      editable={editable}
      onSave={async (value) => {
        const response = await fetch('/api/gst', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(value),
        })
        const result = await response.json()
        if (!response.ok) throw new Error(apiErrorMessage(result, 'Unable to save GST settings.'))
        router.refresh()
      }}
    />
  )
}
