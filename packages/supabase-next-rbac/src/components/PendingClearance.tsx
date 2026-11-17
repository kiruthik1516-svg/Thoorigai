'use client'

import React from 'react'
import { Clock, ShieldAlert } from 'lucide-react'

export function PendingClearance({
  fullName,
  email,
  loginUrl = '/login',
}: {
  fullName?: string
  email?: string
  loginUrl?: string
}) {
  return (
    <div className="w-full text-left">
      <div className="w-12 h-12 rounded-2xl bg-amber-50 border border-amber-200 text-amber-600 flex items-center justify-center mb-5 shadow-xs">
        <Clock size={24} aria-hidden="true" />
      </div>

      <span className="inline-block px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-900 uppercase tracking-wider mb-2">
        Awaiting Clearance
      </span>

      <h1 className="text-2xl font-extrabold text-slate-900 tracking-tight mb-2">Request Submitted</h1>

      <p className="text-xs sm:text-sm text-slate-600 mb-6 leading-relaxed">
        {fullName ? (
          <>
            Thank you, <strong className="text-slate-900 font-semibold">{fullName}</strong>. Your registration
            {email ? (
              <>
                {' '}
                for <strong className="text-slate-900 font-semibold">{email}</strong>
              </>
            ) : null}{' '}
            has been submitted to administrators.
          </>
        ) : (
          'Your account registration has been submitted to academy administrators for review.'
        )}
      </p>

      <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 text-left text-xs text-slate-700 mb-6 space-y-2">
        <div className="flex items-center gap-2 text-slate-900 font-semibold">
          <ShieldAlert size={15} className="text-amber-600 shrink-0" aria-hidden="true" />
          <span>What happens next?</span>
        </div>
        <p className="text-xs text-slate-600 leading-relaxed">
          An administrator will verify your access privileges and approve your account. Once cleared, you can sign in
          directly with your email and password.
        </p>
      </div>

      <a
        href={loginUrl}
        className="w-full inline-flex items-center justify-center py-2.5 px-4 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold shadow-xs transition-colors"
      >
        Return to Sign In
      </a>
    </div>
  )
}
