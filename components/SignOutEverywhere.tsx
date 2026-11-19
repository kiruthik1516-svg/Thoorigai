'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { apiErrorMessage } from '@/lib/api/error-message'

/** F-45: ends every session for this account (other browsers and devices included). */
export function SignOutEverywhere() {
  const router = useRouter()
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  async function signOutEverywhere() {
    setBusy(true)
    setError('')
    try {
      const response = await fetch('/api/auth/logout?scope=global', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      })
      if (!response.ok) {
        setError(apiErrorMessage(await response.json().catch(() => null), 'Could not sign out of other devices.'))
        return
      }
      router.replace('/login')
      router.refresh()
    } finally {
      setBusy(false)
    }
  }

  return (
    <section
      aria-labelledby="sign-out-everywhere"
      className="panel p-5 flex flex-wrap items-center justify-between gap-3"
    >
      <div>
        <h3 id="sign-out-everywhere" className="text-sm font-bold text-[var(--ink)]">
          Sessions
        </h3>
        <p className="text-xs text-[var(--mute)]">Sign out of this account on every browser and device.</p>
        {error && (
          <p role="alert" className="text-xs text-rose-600 mt-1">
            {error}
          </p>
        )}
      </div>
      <button
        type="button"
        onClick={() => void signOutEverywhere()}
        disabled={busy}
        className="px-4 py-2 rounded-full text-xs font-semibold border border-rose-200 text-rose-700 bg-rose-50 hover:bg-rose-100 disabled:opacity-50"
      >
        {busy ? 'Signing out…' : 'Sign out everywhere'}
      </button>
    </section>
  )
}
