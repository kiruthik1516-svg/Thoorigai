'use client'

import { useRef, useState } from 'react'
import { useDialog } from '@/lib/hooks/useDialog'
import { Check, Copy, ExternalLink, KeyRound, Shield, Sparkles, UserCheck, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { inviteSignupUrl, type GeneratedInvite } from './model'
import { useCopyFeedback } from './useCopyFeedback'
import type { GenerateInviteInput } from './useInviteCodes'

export function GenerateInviteModal({
  onGenerate,
  onClose,
}: {
  /** Creates the invite; resolves to null when it failed (the error is shown by the page). */
  onGenerate: (input: GenerateInviteInput) => Promise<GeneratedInvite | null>
  onClose: () => void
}) {
  const dialogRef = useRef<HTMLDivElement>(null)
  useDialog(true, onClose, dialogRef)
  const [role, setRole] = useState<'staff' | 'admin'>('staff')
  const [expiresInHours, setExpiresInHours] = useState(24)
  const [recipientEmail, setRecipientEmail] = useState('')
  const [generating, setGenerating] = useState(false)
  const [generatedInvite, setGeneratedInvite] = useState<GeneratedInvite | null>(null)
  const { copy, copiedCodeId, copiedLinkId } = useCopyFeedback()

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setGenerating(true)
    try {
      const invite = await onGenerate({ role, expiresInHours, recipientEmail })
      if (invite) setGeneratedInvite(invite)
    } finally {
      setGenerating(false)
    }
  }

  return (
    <div
      ref={dialogRef}
      role="dialog"
      aria-modal="true"
      aria-label="Invite code"
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-xs p-3 sm:p-4 animate-in fade-in"
    >
      <div className="bg-white rounded-2xl shadow-xl border border-slate-200 max-w-md w-full max-h-[92vh] overflow-y-auto p-4 sm:p-6 relative">
        <button
          type="button"
          onClick={onClose}
          className="absolute top-4 right-4 p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100"
        >
          <X size={18} />
        </button>

        {generatedInvite ? (
          <div className="space-y-4 text-center">
            <div className="w-12 h-12 rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-600 flex items-center justify-center mx-auto shadow-xs">
              <Sparkles size={24} />
            </div>

            <div>
              <h3 className="text-base font-bold text-slate-900">Invite Code Created</h3>
              <p className="text-xs text-slate-500 mt-1">
                Share this one-time code or direct link with your new{' '}
                <strong className="text-slate-800 uppercase">{generatedInvite.role}</strong>. It expires automatically.
              </p>
            </div>

            <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200">
              <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider block mb-1">
                One-Time Code
              </span>
              <p className="font-mono text-xl font-extrabold text-indigo-700 tracking-wider select-all">
                {generatedInvite.code}
              </p>
              <span className="text-[10px] text-slate-500 block mt-1">
                Expires {new Date(generatedInvite.expiresAt).toLocaleString('en-IN')} · Single use only
              </span>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => copy(generatedInvite.code, 'modal', 'code')}
                className="text-xs font-semibold"
              >
                {copiedCodeId === 'modal' ? (
                  <>
                    <Check size={14} className="mr-1 text-emerald-600" /> Copied Code
                  </>
                ) : (
                  <>
                    <Copy size={14} className="mr-1" /> Copy Code
                  </>
                )}
              </Button>

              <Button
                type="button"
                variant="default"
                onClick={() => copy(inviteSignupUrl(generatedInvite.code), 'modal-link', 'link')}
                className="text-xs font-semibold bg-indigo-600 hover:bg-indigo-700 text-white"
              >
                {copiedLinkId === 'modal-link' ? (
                  <>
                    <Check size={14} className="mr-1 text-emerald-200" /> Copied Link
                  </>
                ) : (
                  <>
                    <ExternalLink size={14} className="mr-1" /> Copy Link
                  </>
                )}
              </Button>
            </div>

            <Button
              type="button"
              variant="ghost"
              onClick={onClose}
              className="w-full text-xs text-slate-600 hover:text-slate-900"
            >
              Done
            </Button>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="flex items-center gap-2">
              <div className="w-9 h-9 rounded-xl bg-indigo-50 border border-indigo-200 text-indigo-600 flex items-center justify-center">
                <KeyRound size={18} />
              </div>
              <div>
                <h3 className="text-base font-bold text-slate-900">Generate Invite Code</h3>
                <p className="text-xs text-slate-500">Create an expiring, one-time invitation code.</p>
              </div>
            </div>

            <div className="space-y-3 pt-2">
              <div>
                <label htmlFor="invite-role-select" className="block text-xs font-semibold text-slate-700 mb-1.5">
                  Assigned Role
                </label>
                <div className="grid grid-cols-2 gap-2 mb-2">
                  <button
                    type="button"
                    onClick={() => setRole('staff')}
                    className={`flex items-start gap-2 p-2.5 rounded-xl border text-left transition-all ${
                      role === 'staff'
                        ? 'bg-indigo-50/80 border-indigo-300 ring-2 ring-indigo-500/20 shadow-xs'
                        : 'bg-white border-slate-200 hover:bg-slate-50'
                    }`}
                  >
                    <UserCheck
                      size={16}
                      className={`mt-0.5 shrink-0 ${role === 'staff' ? 'text-indigo-600' : 'text-slate-400'}`}
                    />
                    <div>
                      <span
                        className={`block text-xs font-bold ${role === 'staff' ? 'text-indigo-950' : 'text-slate-700'}`}
                      >
                        Staff Access
                      </span>
                      <span className="block text-[10px] text-slate-500 font-mono mt-0.5">Code: STAFF-XXXX</span>
                    </div>
                  </button>

                  <button
                    type="button"
                    onClick={() => setRole('admin')}
                    className={`flex items-start gap-2 p-2.5 rounded-xl border text-left transition-all ${
                      role === 'admin'
                        ? 'bg-purple-50/90 border-purple-300 ring-2 ring-purple-500/20 shadow-xs'
                        : 'bg-white border-slate-200 hover:bg-slate-50'
                    }`}
                  >
                    <Shield
                      size={16}
                      className={`mt-0.5 shrink-0 ${role === 'admin' ? 'text-purple-600' : 'text-slate-400'}`}
                    />
                    <div>
                      <span
                        className={`block text-xs font-bold ${role === 'admin' ? 'text-purple-950' : 'text-slate-700'}`}
                      >
                        Admin Access
                      </span>
                      <span className="block text-[10px] text-purple-600 font-mono font-medium mt-0.5">
                        Code: ADMIN-XXXX
                      </span>
                    </div>
                  </button>
                </div>

                <select
                  id="invite-role-select"
                  aria-label="Assigned Role"
                  value={role}
                  onChange={(e) => setRole(e.target.value as 'staff' | 'admin')}
                  className="sr-only"
                >
                  <option value="staff">Staff (Standard Academy Access)</option>
                  <option value="admin">Admin (Full System Privilege)</option>
                </select>
              </div>

              <div>
                <label htmlFor="invite-expiry-select" className="block text-xs font-semibold text-slate-700 mb-1">
                  Expiration Window
                </label>
                <select
                  id="invite-expiry-select"
                  aria-label="Expiration Window"
                  value={expiresInHours}
                  onChange={(e) => setExpiresInHours(Number(e.target.value))}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs font-medium text-slate-900 bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-600"
                >
                  <option value={24}>24 Hours (Recommended)</option>
                  <option value={72}>3 Days (72 Hours)</option>
                  <option value={168}>7 Days (1 Week)</option>
                  <option value={1}>1 Hour (Express Access)</option>
                </select>
              </div>

              <div>
                <label htmlFor="invite-recipient-email" className="block text-xs font-semibold text-slate-700 mb-1">
                  Restrict to Email <span className="font-normal text-slate-400">(Optional)</span>
                </label>
                <input
                  id="invite-recipient-email"
                  type="email"
                  placeholder="e.g. rajesh@thoorigai.local (leave blank for any email)"
                  value={recipientEmail}
                  onChange={(e) => setRecipientEmail(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs text-slate-900 placeholder:text-slate-400 bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-600"
                />
                <span className="text-[11px] text-slate-500 mt-1 block">
                  If set, only a user registering with this exact email can redeem this code.
                </span>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
              <Button type="button" variant="ghost" size="sm" onClick={onClose} className="text-xs text-slate-600">
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={generating}
                size="sm"
                className={`text-xs font-semibold text-white shadow-xs ${
                  role === 'admin' ? 'bg-purple-600 hover:bg-purple-700' : 'bg-indigo-600 hover:bg-indigo-700'
                }`}
              >
                {generating ? 'Generating...' : `Generate ${role === 'admin' ? 'Admin' : 'Staff'} Code`}
              </Button>
            </div>
          </form>
        )}
      </div>
    </div>
  )
}
