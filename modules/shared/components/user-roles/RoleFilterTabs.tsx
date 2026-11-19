'use client'

import { Clock, KeyRound, Plus, Shield, UserCheck, Users } from 'lucide-react'
import type { FilterTab } from './model'

export type RoleCounts = { all: number; pending: number; staff: number; admin: number; activeInvites: number }

export function RoleFilterTabs({
  activeTab,
  onChange,
  counts,
  onGenerateInvite,
}: {
  activeTab: FilterTab
  onChange: (tab: FilterTab) => void
  counts: RoleCounts
  onGenerateInvite: () => void
}) {
  return (
    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
      <div className="flex flex-nowrap overflow-x-auto no-scrollbar pb-1 sm:flex-wrap sm:pb-0 items-center gap-2 w-full sm:w-auto">
        <button
          type="button"
          onClick={() => onChange('all')}
          className={`flex items-center gap-2 px-3.5 py-1.5 rounded-full text-xs font-semibold transition-all cursor-pointer ${
            activeTab === 'all'
              ? 'bg-[var(--g1)] text-white shadow-xs'
              : 'bg-[var(--card)] text-[var(--ink)] border border-[var(--border)] hover:bg-[var(--panel)]'
          }`}
        >
          <Users size={13} />
          All Users
          <span
            className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
              activeTab === 'all' ? 'bg-white/20 text-white' : 'bg-[var(--panel)] text-[var(--mute)]'
            }`}
          >
            {counts.all}
          </span>
        </button>

        <button
          type="button"
          onClick={() => onChange('pending')}
          className={`flex items-center gap-2 px-3.5 py-1.5 rounded-full text-xs font-semibold transition-all cursor-pointer ${
            activeTab === 'pending'
              ? 'bg-[#854d0e] text-white shadow-xs'
              : counts.pending > 0
                ? 'bg-[rgba(133,77,14,0.08)] text-[#854d0e] border border-[rgba(133,77,14,0.25)] hover:bg-[rgba(133,77,14,0.15)]'
                : 'bg-[var(--card)] text-[var(--ink)] border border-[var(--border)] hover:bg-[var(--panel)]'
          }`}
        >
          <Clock size={13} className={counts.pending > 0 && activeTab !== 'pending' ? 'text-[#854d0e]' : ''} />
          Pending Approval
          {counts.pending > 0 && (
            <span
              className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                activeTab === 'pending' ? 'bg-white/20 text-white' : 'bg-[#854d0e] text-white animate-pulse'
              }`}
            >
              {counts.pending}
            </span>
          )}
        </button>

        <button
          type="button"
          onClick={() => onChange('staff')}
          className={`flex items-center gap-2 px-3.5 py-1.5 rounded-full text-xs font-semibold transition-all cursor-pointer ${
            activeTab === 'staff'
              ? 'bg-[var(--g1)] text-white shadow-xs'
              : 'bg-[var(--card)] text-[var(--ink)] border border-[var(--border)] hover:bg-[var(--panel)]'
          }`}
        >
          <UserCheck size={13} />
          Staff
          <span
            className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
              activeTab === 'staff' ? 'bg-white/20 text-white' : 'bg-[var(--panel)] text-[var(--mute)]'
            }`}
          >
            {counts.staff}
          </span>
        </button>

        <button
          type="button"
          onClick={() => onChange('admin')}
          className={`flex items-center gap-2 px-3.5 py-1.5 rounded-full text-xs font-semibold transition-all cursor-pointer ${
            activeTab === 'admin'
              ? 'bg-[var(--ink)] text-[var(--bg)] shadow-xs'
              : 'bg-[var(--card)] text-[var(--ink)] border border-[var(--border)] hover:bg-[var(--panel)]'
          }`}
        >
          <Shield size={13} />
          Admins
          <span
            className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
              activeTab === 'admin' ? 'bg-white/20 text-white' : 'bg-[var(--panel)] text-[var(--mute)]'
            }`}
          >
            {counts.admin}
          </span>
        </button>

        <div className="h-4 w-px bg-[var(--border)] mx-1 hidden sm:block" />

        <button
          type="button"
          onClick={() => onChange('invites')}
          className={`flex items-center gap-2 px-3.5 py-1.5 rounded-full text-xs font-semibold transition-all cursor-pointer ${
            activeTab === 'invites'
              ? 'bg-[var(--g1)] text-white shadow-xs'
              : 'bg-[var(--card)] text-[var(--ink)] border border-[var(--border)] hover:bg-[var(--panel)]'
          }`}
        >
          <KeyRound size={13} />
          One-Time Invite Codes
          {counts.activeInvites > 0 && (
            <span
              className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                activeTab === 'invites' ? 'bg-white/20 text-white' : 'bg-[var(--g1)] text-white'
              }`}
            >
              {counts.activeInvites}
            </span>
          )}
        </button>
      </div>

      <button
        type="button"
        onClick={onGenerateInvite}
        className="inline-flex items-center justify-center gap-1.5 px-4 py-2 rounded-full text-xs font-semibold bg-[var(--g1)] text-white hover:opacity-90 transition-opacity shadow-xs shrink-0 cursor-pointer"
      >
        <Plus size={14} className="mr-1" />
        Generate Invite Code
      </button>
    </div>
  )
}
