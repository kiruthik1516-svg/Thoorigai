'use client'

import React, { useState } from 'react'
import { Eye, EyeOff, Lock, Mail, AlertCircle, Clock } from 'lucide-react'
import type { LoginFormProps } from './types'
import { PendingClearance } from './PendingClearance'

export function LoginForm({ signupUrl = '/signup', loginApiEndpoint = '/api/auth/login', onSuccess }: LoginFormProps) {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [isPendingApproval, setIsPendingApproval] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    setIsPendingApproval(false)
    setLoading(true)

    try {
      const response = await fetch(loginApiEndpoint, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ email, password }),
      })

      if (!response.ok) {
        const body = await response.json().catch(() => null)
        if (response.status === 403 && body?.code === 'ACCOUNT_PENDING_APPROVAL') {
          setIsPendingApproval(true)
          return
        }
        const message =
          typeof body?.error === 'string'
            ? body.error
            : typeof body?.error === 'object' && body?.error !== null
              ? body.error.message
              : 'Unable to sign in. Please verify your credentials.'
        throw new Error(message || 'Unable to sign in. Please verify your credentials.')
      }

      if (onSuccess) {
        onSuccess()
      } else {
        window.location.href = '/'
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to sign in. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  if (isPendingApproval) {
    return <PendingClearance email={email} />
  }

  return (
    <form method="post" onSubmit={handleSubmit} className="space-y-4">
      {error && (
        <div className="flex items-start gap-2.5 p-3 rounded-xl bg-red-50 border border-red-200 text-red-700 text-xs leading-relaxed">
          <AlertCircle size={16} className="shrink-0 mt-0.5" />
          <span>{error}</span>
        </div>
      )}

      <div>
        <label className="block text-xs font-semibold text-slate-700 mb-1">Email address</label>
        <div className="relative">
          <Mail size={16} className="absolute left-3 top-3 text-slate-400 pointer-events-none" />
          <input
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@domain.com"
            className="w-full pl-9 pr-3 py-2 text-xs rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-slate-900 focus:border-transparent text-slate-900 placeholder:text-slate-400"
          />
        </div>
      </div>

      <div>
        <label className="block text-xs font-semibold text-slate-700 mb-1">Password</label>
        <div className="relative">
          <Lock size={16} className="absolute left-3 top-3 text-slate-400 pointer-events-none" />
          <input
            type={showPassword ? 'text' : 'password'}
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="••••••••"
            className="w-full pl-9 pr-10 py-2 text-xs rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-slate-900 focus:border-transparent text-slate-900 placeholder:text-slate-400"
          />
          <button
            type="button"
            onClick={() => setShowPassword(!showPassword)}
            className="absolute right-3 top-2.5 text-slate-400 hover:text-slate-600 focus:outline-none"
            aria-label={showPassword ? 'Hide password' : 'Show password'}
          >
            {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
          </button>
        </div>
      </div>

      <button
        type="submit"
        disabled={loading}
        className="w-full mt-2 py-2.5 px-4 rounded-xl bg-slate-900 hover:bg-slate-800 disabled:bg-slate-400 text-white text-xs font-semibold shadow-xs transition-colors flex items-center justify-center gap-2"
      >
        {loading ? (
          <span className="inline-block w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
        ) : null}
        <span>Sign In</span>
      </button>

      {signupUrl && (
        <p className="text-center text-xs text-slate-500 mt-4">
          Need an account?{' '}
          <a href={signupUrl} className="font-semibold text-slate-900 hover:underline">
            Request access
          </a>
        </p>
      )}
    </form>
  )
}
