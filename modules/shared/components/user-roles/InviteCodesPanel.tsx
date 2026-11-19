'use client'

import { Check, Copy, ExternalLink, KeyRound, Plus, Trash2 } from 'lucide-react'
import type { InviteCode } from '@/lib/types'
import { Button } from '@/components/ui/button'
import { inviteSignupUrl, inviteStatus } from './model'
import { useCopyFeedback } from './useCopyFeedback'

export function InviteCodesPanel({
  inviteCodes,
  loading,
  revokingId,
  onRevoke,
  onNewCode,
}: {
  inviteCodes: InviteCode[]
  loading: boolean
  revokingId: string | null
  onRevoke: (id: string) => void
  onNewCode: () => void
}) {
  const { copy, copiedCodeId, copiedLinkId } = useCopyFeedback()

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 p-4 rounded-xl border border-teal-200/80 bg-teal-50/40 text-xs text-teal-900">
        <div>
          <p className="font-semibold text-teal-950 flex items-center gap-1.5 text-sm">
            <KeyRound size={16} className="text-teal-700" />
            One-Time Disposable Invite Codes (OTP)
          </p>
          <p className="text-teal-700 mt-0.5 text-xs">
            Invite codes expire automatically and are permanently burned after a single registration. Users signing up
            with an active code receive instant access without waiting for admin approval.
          </p>
        </div>
        <Button
          type="button"
          size="sm"
          onClick={onNewCode}
          className="text-xs font-semibold bg-teal-700 hover:bg-teal-800 text-white shrink-0"
        >
          <Plus size={13} className="mr-1" />
          New Code
        </Button>
      </div>

      <div
        className="bg-white rounded-xl shadow-xs border border-slate-200/80 overflow-x-auto w-full"
        role="region"
        aria-label="One-time invite codes"
        tabIndex={0}
      >
        <table className="min-w-[640px] w-full divide-y divide-gray-200">
          <thead className="bg-gray-50/80">
            <tr>
              <th
                scope="col"
                className="px-6 py-3.5 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider"
              >
                Invite Code
              </th>
              <th
                scope="col"
                className="px-6 py-3.5 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider"
              >
                Assigned Role
              </th>
              <th
                scope="col"
                className="px-6 py-3.5 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider"
              >
                Restriction / Recipient
              </th>
              <th
                scope="col"
                className="px-6 py-3.5 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider"
              >
                Status
              </th>
              <th
                scope="col"
                className="px-6 py-3.5 text-right text-xs font-semibold text-gray-500 uppercase tracking-wider"
              >
                Actions
              </th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-100">
            {inviteCodes.map((invite) => {
              const status = inviteStatus(invite)
              const isRevoking = revokingId === invite.id
              const isCopiedCode = copiedCodeId === invite.id
              const isCopiedLink = copiedLinkId === invite.id

              return (
                <tr key={invite.id} className="hover:bg-gray-50/70 transition-colors">
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="flex items-center gap-2">
                      <span className="font-mono font-bold text-xs bg-slate-100 text-slate-800 px-2 py-1 rounded border border-slate-200 tracking-wide select-all">
                        {invite.code}
                      </span>
                      <button
                        type="button"
                        onClick={() => copy(invite.code, invite.id, 'code')}
                        className="p-1 rounded text-slate-400 hover:text-slate-700 hover:bg-slate-100"
                        title="Copy code"
                      >
                        {isCopiedCode ? <Check size={13} className="text-emerald-600" /> : <Copy size={13} />}
                      </button>
                    </div>
                    <span className="text-[10px] text-slate-400 block mt-0.5">
                      Created {new Date(invite.createdAt).toLocaleDateString('en-IN')}
                    </span>
                  </td>

                  <td className="px-6 py-4 whitespace-nowrap">
                    <span
                      className={`inline-flex items-center px-2 py-0.5 rounded text-[11px] font-bold uppercase tracking-wider ${
                        invite.role === 'admin'
                          ? 'bg-purple-100 text-purple-800 border border-purple-200'
                          : 'bg-indigo-100 text-indigo-800 border border-indigo-200'
                      }`}
                    >
                      {invite.role}
                    </span>
                  </td>

                  <td className="px-6 py-4 whitespace-nowrap text-xs text-slate-600">
                    {invite.recipientEmail ? (
                      <span className="font-mono font-medium text-slate-800">{invite.recipientEmail}</span>
                    ) : (
                      <span className="text-slate-400 italic">Anyone with code</span>
                    )}
                  </td>

                  <td className="px-6 py-4 whitespace-nowrap">
                    <span
                      className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-semibold border ${status.badge}`}
                    >
                      {status.label}
                    </span>
                    <span className="text-[11px] text-slate-500 block mt-0.5">{status.detail}</span>
                  </td>

                  <td className="px-6 py-4 whitespace-nowrap text-right space-x-1.5">
                    {!invite.isUsed ? (
                      <>
                        {new Date(invite.expiresAt).getTime() > Date.now() && (
                          <Button
                            type="button"
                            size="sm"
                            variant="outline"
                            onClick={() => copy(inviteSignupUrl(invite.code), invite.id, 'link')}
                            className="text-xs border-slate-300 hover:bg-slate-50"
                          >
                            {isCopiedLink ? (
                              <>
                                <Check size={13} className="mr-1 text-emerald-600" /> Copied Link
                              </>
                            ) : (
                              <>
                                <ExternalLink size={13} className="mr-1" /> Copy Link
                              </>
                            )}
                          </Button>
                        )}
                        <Button
                          type="button"
                          size="sm"
                          variant="ghost"
                          disabled={isRevoking}
                          onClick={() => onRevoke(invite.id)}
                          className="text-xs text-rose-600 hover:bg-rose-50 hover:text-rose-700"
                        >
                          <Trash2 size={13} className="mr-1" />
                          {isRevoking ? 'Revoking...' : 'Revoke'}
                        </Button>
                      </>
                    ) : (
                      <span className="text-xs text-slate-400">—</span>
                    )}
                  </td>
                </tr>
              )
            })}

            {inviteCodes.length === 0 && (
              <tr>
                <td colSpan={5} className="px-6 py-12 text-center text-sm text-gray-500">
                  {loading ? (
                    'Loading invite codes...'
                  ) : (
                    <div className="flex flex-col items-center justify-center space-y-2">
                      <div className="w-10 h-10 rounded-full bg-teal-50 text-teal-600 flex items-center justify-center">
                        <KeyRound size={20} />
                      </div>
                      <p className="font-semibold text-slate-800">No invite codes generated yet</p>
                      <p className="text-xs text-slate-500">
                        Create one-time expiring codes to invite staff members with instant authorization.
                      </p>
                      <Button
                        type="button"
                        size="sm"
                        onClick={onNewCode}
                        className="text-xs font-semibold bg-teal-700 hover:bg-teal-800 text-white mt-2"
                      >
                        <Plus size={13} className="mr-1" />
                        Generate First Code
                      </Button>
                    </div>
                  )}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
