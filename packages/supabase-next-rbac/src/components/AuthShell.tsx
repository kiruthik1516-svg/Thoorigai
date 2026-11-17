'use client'

import React from 'react'
import type { AuthShellProps } from './types'

export function AuthShell({ children, brand }: AuthShellProps) {
  return (
    <div className="min-h-screen w-full flex flex-col justify-center items-center p-4 bg-slate-50 text-slate-900">
      <div className="w-full max-w-md bg-white border border-slate-200/80 rounded-2xl shadow-xl shadow-slate-200/50 p-6 sm:p-8">
        {brand && (
          <div className="flex flex-col items-center mb-6 text-center">
            {brand.logo ? (
              <div className="mb-3">{brand.logo}</div>
            ) : brand.logoUrl ? (
              <img src={brand.logoUrl} alt={brand.displayName} className="h-12 w-auto mb-3 object-contain" />
            ) : null}
            <h2 className="text-xl font-bold tracking-tight text-slate-800">{brand.displayName}</h2>
          </div>
        )}
        {children}
      </div>
    </div>
  )
}
