'use client'

import React, { useState, useEffect } from 'react'
import { Eye, EyeOff, Lock, Mail, User, CheckCircle2, AlertCircle, Sparkles, ShieldCheck } from 'lucide-react'
import type { SignupFormProps } from './types'
import { PendingClearance } from './PendingClearance'

export function SignupForm({
  loginUrl = '/login',
  signupApiEndpoint = '/api/auth/signup',
  verifyInviteApiEndpoint = '/api/auth/verify-invite',
  onSuccess,
}: SignupFormProps) {
  const [activeTab, setActiveTab] = useState<'request' | 'invite'>('request')
  const [fullName, setFullName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [inviteCode, setInviteCode] = useState('')

  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [submittedStatus, setSubmittedStatus] = useState<'pending' | 'active' | null>(null)
  const [registeredRole, setRegisteredRole] = useState<string | null>(null)
  const [verifiedCode, setVerifiedCode] = useState<{ valid: boolean; role?: string; error?: string } | null>(null)

  // Live code checking
  useEffect(() => {
    const trimmed = inviteCode.trim()
    if (!trimmed || trimmed.length < 3) {
      setVerifiedCode(null)
      return
    }

    const timer = setTimeout(async () => {
      try {
        const res = await fetch(`${verifyInviteApiEndpoint}?code=${encodeURIComponent(trimmed)}`)
        const data = await res.json().catch(() => null)
        if (data) {
          setVerifiedCode({
            valid: Boolean(data.valid),
            role: data.role,
            error: data.error,
          })
        }
      } catch {
        // Silently skip transient check errors
      }
    }, 400)

    return () => clearTimeout(timer)
  }, [inviteCode, verifyInviteApiEndpoint])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)

    if (password !== confirmPassword) {
      setError('Passwords do not match.')
      return
    }

    if (password.length < 8) {
      setError('Password must be at least 8 characters.')
      return
    }

    if (activeTab === 'invite' && !inviteCode.trim()) {
      setError('Please enter your invite code or switch to the Request Access tab.')
      return
    }

    setLoading(true)

    try {
      const response = await fetch(signupApiEndpoint, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          fullName: fullName.trim(),
          email: email.trim().toLowerCase(),
          password,
          inviteCode: activeTab === 'invite' && inviteCode.trim() ? inviteCode.trim() : undefined,
        }),
      })

      const result = await response.json().catch(() => null)
      if (!response.ok) {
        throw new Error(result?.error || 'Unable to complete registration. Please try again.')
      }

      const role = result?.data?.role
      const status = result?.data?.status === 'active' ? 'active' : 'pending'
      setRegisteredRole(role)
      setSubmittedStatus(status)

      if (onSuccess) {
        onSuccess({ status, role })
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to complete registration.')
    } finally {
      setLoading(false)
    }
  }

  if (submittedStatus === 'pending') {
    return <PendingClearance fullName={fullName} email={email} loginUrl={loginUrl} />
  }

  if (submittedStatus === 'active') {
    return (
      <div className="w-full text-left">
        <div className="w-12 h-12 rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-600 flex items-center justify-center mb-5 shadow-xs">
          <CheckCircle2 size={24} aria-hidden="true" />
        </div>

        <span className="inline-block px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-900 uppercase tracking-wider mb-2">
          Authorized as {registeredRole?.toUpperCase()}
        </span>

        <h1 className="text-2xl font-extrabold text-slate-900 tracking-tight mb-2">Account Ready!</h1>

        <p className="text-xs sm:text-sm text-slate-600 mb-6 leading-relaxed">
          Welcome aboard, <strong className="text-slate-900 font-semibold">{fullName}</strong>. Your invite code has
          been verified and your account is active.
        </p>

        <a
          href={loginUrl}
          className="w-full inline-flex items-center justify-center py-2.5 px-4 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold shadow-xs transition-colors"
        >
          Sign In Now
        </a>
      </div>
    )
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {/* 2-Tab Mode Selector */}
      <div className="grid grid-cols-2 gap-1 p-1 bg-slate-100 rounded-xl mb-4 text-xs font-semibold">
        <button
          type="button"
          onClick={() => setActiveTab('request')}
          className={`py-1.5 px-3 rounded-lg transition-all ${
            activeTab === 'request' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-500 hover:text-slate-800'
          }`}
        >
          Request Access
        </button>
        <button
          type="button"
          onClick={() => setActiveTab('invite')}
          className={`py-1.5 px-3 rounded-lg transition-all ${
            activeTab === 'invite' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-500 hover:text-slate-800'
          }`}
        >
          Have Invite Code
        </button>
      </div>

      {error && (
        <div className="flex items-start gap-2.5 p-3 rounded-xl bg-red-50 border border-red-200 text-red-700 text-xs leading-relaxed">
          <AlertCircle size={16} className="shrink-0 mt-0.5" />
          <span>{error}</span>
        </div>
      )}

      {activeTab === 'invite' && (
        <div>
          <label className="block text-xs font-semibold text-slate-700 mb-1">Invite Code / Passcode</label>
          <div className="relative">
            <Sparkles size={16} className="absolute left-3 top-3 text-indigo-500 pointer-events-none" />
            <input
              type="text"
              required={activeTab === 'invite'}
              value={inviteCode}
              onChange={(e) => setInviteCode(e.target.value.toUpperCase())}
              placeholder="e.g. INV-A1B2C3"
              className="w-full pl-9 pr-3 py-2 text-xs font-mono uppercase tracking-wider rounded-xl border border-indigo-200 focus:outline-none focus:ring-2 focus:ring-indigo-600 focus:border-transparent text-slate-900 placeholder:text-slate-400 bg-indigo-50/20"
            />
          </div>
          {verifiedCode && (
            <p className={`mt-1 text-[11px] font-medium ${verifiedCode.valid ? 'text-emerald-600' : 'text-red-500'}`}>
              {verifiedCode.valid
                ? `Valid: Grants ${verifiedCode.role?.toUpperCase()} permissions`
                : verifiedCode.error || 'Invalid invite code'}
            </p>
          )}
        </div>
      )}

      <div>
        <label className="block text-xs font-semibold text-slate-700 mb-1">Full Name</label>
        <div className="relative">
          <User size={16} className="absolute left-3 top-3 text-slate-400 pointer-events-none" />
          <input
            type="text"
            required
            value={fullName}
            onChange={(e) => setFullName(e.target.value)}
            placeholder="Jane Doe"
            className="w-full pl-9 pr-3 py-2 text-xs rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-slate-900 focus:border-transparent text-slate-900 placeholder:text-slate-400"
          />
        </div>
      </div>

      <div>
        <label className="block text-xs font-semibold text-slate-700 mb-1">Work Email</label>
        <div className="relative">
          <Mail size={16} className="absolute left-3 top-3 text-slate-400 pointer-events-none" />
          <input
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="jane@organization.com"
            className="w-full pl-9 pr-3 py-2 text-xs rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-slate-900 focus:border-transparent text-slate-900 placeholder:text-slate-400"
          />
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div>
          <label className="block text-xs font-semibold text-slate-700 mb-1">Password</label>
          <div className="relative">
            <Lock size={16} className="absolute left-3 top-3 text-slate-400 pointer-events-none" />
            <input
              type={showPassword ? 'text' : 'password'}
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Min 8 chars"
              className="w-full pl-9 pr-8 py-2 text-xs rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-slate-900 focus:border-transparent text-slate-900 placeholder:text-slate-400"
            />
          </div>
        </div>
        <div>
          <label className="block text-xs font-semibold text-slate-700 mb-1">Confirm Password</label>
          <div className="relative">
            <Lock size={16} className="absolute left-3 top-3 text-slate-400 pointer-events-none" />
            <input
              type={showPassword ? 'text' : 'password'}
              required
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              placeholder="Re-enter password"
              className="w-full pl-9 pr-8 py-2 text-xs rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-slate-900 focus:border-transparent text-slate-900 placeholder:text-slate-400"
            />
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              className="absolute right-2.5 top-2.5 text-slate-400 hover:text-slate-600 focus:outline-none"
            >
              {showPassword ? <EyeOff size={15} /> : <Eye size={15} />}
            </button>
          </div>
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
        <span>{activeTab === 'invite' ? 'Activate Account' : 'Submit Access Request'}</span>
      </button>

      {loginUrl && (
        <p className="text-center text-xs text-slate-500 mt-4">
          Already registered?{' '}
          <a href={loginUrl} className="font-semibold text-slate-900 hover:underline">
            Sign in
          </a>
        </p>
      )}
    </form>
  )
}
