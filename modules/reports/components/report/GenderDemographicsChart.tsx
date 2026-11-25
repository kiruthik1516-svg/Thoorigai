'use client'

import { useState } from 'react'
import { cn } from '@/lib/utils'
import { User } from 'lucide-react'
import type { Student } from '@/lib/types'
import { money } from '@/lib/formatters'

type GenderDemographicsProps = {
  femaleStudents: Student[]
  maleStudents: Student[]
  otherStudents: Student[]
  femalePct: number
  malePct: number
  otherPct: number
  /** Students with no gender recorded; shown separately so they are not counted as "Other". */
  unspecifiedCount?: number
}

export function GenderDemographicsChart({
  femaleStudents,
  maleStudents,
  otherStudents,
  femalePct,
  malePct,
  otherPct,
  unspecifiedCount = 0,
}: GenderDemographicsProps) {
  const [activeGender, setActiveGender] = useState<'Female' | 'Male' | 'Other' | null>(null)

  const femaleAvg = femaleStudents.length
    ? Math.round(femaleStudents.reduce((a, s) => a + s.total, 0) / femaleStudents.length)
    : 0
  const maleAvg = maleStudents.length
    ? Math.round(maleStudents.reduce((a, s) => a + s.total, 0) / maleStudents.length)
    : 0

  const total = femaleStudents.length + maleStudents.length + otherStudents.length

  if (total === 0 && unspecifiedCount === 0) {
    return <p className="empty-note">No demographic data in this period.</p>
  }

  return (
    <div className="p-4 sm:p-5 flex flex-col gap-5">
      {/* ── Partition Bar ── */}
      <div className="w-full flex flex-col gap-2">
        {/* Track with proportional pills forming a light-to-dark gradient strip */}
        <div className="w-full flex items-center gap-1.5 h-3.5">
          {femalePct > 0 && (
            <div
              className={cn(
                'h-full rounded-full transition-all duration-300 cursor-pointer',
                activeGender === 'Female' ? 'ring-2 ring-[var(--g1)] shadow-md' : '',
              )}
              style={{
                width: `${femalePct}%`,
                background: 'linear-gradient(90deg, var(--g3) 0%, var(--g1) 100%)',
                opacity: activeGender === null || activeGender === 'Female' ? 1 : 0.35,
              }}
              onMouseEnter={() => setActiveGender('Female')}
              onMouseLeave={() => setActiveGender(null)}
              title={`Female: ${femaleStudents.length} (${femalePct}%) — Light Theme Tone`}
            />
          )}
          {malePct > 0 && (
            <div
              className={cn(
                'h-full rounded-full transition-all duration-300 cursor-pointer',
                activeGender === 'Male' ? 'ring-2 ring-[var(--g1b)] shadow-md' : '',
              )}
              style={{
                width: `${malePct}%`,
                background: 'linear-gradient(90deg, var(--g1b) 0%, var(--g2b) 100%)',
                opacity: activeGender === null || activeGender === 'Male' ? 1 : 0.35,
              }}
              onMouseEnter={() => setActiveGender('Male')}
              onMouseLeave={() => setActiveGender(null)}
              title={`Male: ${maleStudents.length} (${malePct}%) — Dark Theme Tone`}
            />
          )}
          {otherPct > 0 && (
            <div
              className={cn(
                'h-full rounded-full transition-all duration-300 cursor-pointer',
                activeGender === 'Other' ? 'ring-2 ring-[var(--g5)] shadow-md' : '',
              )}
              style={{
                width: `${otherPct}%`,
                background: 'var(--g5)',
                opacity: activeGender === null || activeGender === 'Other' ? 1 : 0.35,
              }}
              onMouseEnter={() => setActiveGender('Other')}
              onMouseLeave={() => setActiveGender(null)}
              title={`Other: ${otherStudents.length} (${otherPct}%)`}
            />
          )}
        </div>

        {/* Partition Labels directly below bar */}
        <div className="flex items-center justify-between text-xs text-[var(--mute)] px-0.5">
          <div
            className={cn(
              'flex flex-col items-start transition-all duration-200 cursor-pointer',
              activeGender === 'Female'
                ? 'text-[var(--g1)] font-bold scale-105'
                : activeGender !== null
                  ? 'opacity-40'
                  : '',
            )}
            onMouseEnter={() => setActiveGender('Female')}
            onMouseLeave={() => setActiveGender(null)}
          >
            <span className="font-semibold text-xs text-[var(--ink)]">Female</span>
            <span className="text-[11px] font-mono font-medium">
              {femaleStudents.length} ({femalePct}%)
            </span>
          </div>

          <div
            className={cn(
              'flex flex-col items-end transition-all duration-200 cursor-pointer',
              activeGender === 'Male'
                ? 'text-[var(--g1b)] font-bold scale-105'
                : activeGender !== null
                  ? 'opacity-40'
                  : '',
            )}
            onMouseEnter={() => setActiveGender('Male')}
            onMouseLeave={() => setActiveGender(null)}
          >
            <span className="font-semibold text-xs text-[var(--ink)]">Male</span>
            <span className="text-[11px] font-mono font-medium">
              {maleStudents.length} ({malePct}%)
            </span>
          </div>
        </div>
        {(otherStudents.length > 0 || unspecifiedCount > 0) && (
          <p className="text-[11px] text-[var(--mute)] px-0.5">
            {otherStudents.length > 0 && `Other: ${otherStudents.length} (${otherPct}%)`}
            {otherStudents.length > 0 && unspecifiedCount > 0 && ' · '}
            {unspecifiedCount > 0 && `Not recorded: ${unspecifiedCount}`}
          </p>
        )}
      </div>

      {/* ── Interactive Demographic Profile Cards ── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {/* Female Card */}
        <div
          className={cn(
            'p-3.5 rounded-2xl border transition-all duration-300 cursor-pointer flex flex-col gap-2',
            activeGender === 'Female'
              ? 'border-[var(--g1)] bg-[var(--card)] shadow-lg scale-[1.02] -translate-y-0.5'
              : activeGender !== null
                ? 'border-[var(--border)] bg-[var(--panel)]/40 opacity-40'
                : 'border-[var(--border)] bg-[var(--panel)]/50 hover:bg-[var(--card)] hover:border-[var(--g5)]',
          )}
          onMouseEnter={() => setActiveGender('Female')}
          onMouseLeave={() => setActiveGender(null)}
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div
                className={cn(
                  'w-8 h-8 rounded-xl flex items-center justify-center shrink-0 border transition-all',
                  activeGender === 'Female'
                    ? 'border-[var(--g1)] ring-2 ring-[var(--g1)]/30 text-[var(--g1)]'
                    : 'border-[var(--g5)] text-[var(--g1)]',
                )}
                style={{ background: 'linear-gradient(135deg, var(--g4) 0%, var(--panel) 100%)' }}
              >
                <User size={16} />
              </div>
              <div>
                <span className="text-xs font-bold text-[var(--ink)] block">Female</span>
                <span className="text-[10px] text-[var(--mute)]">Cohort ratio</span>
              </div>
            </div>
            <div className="text-right">
              <span
                className={cn(
                  'text-base font-mono block transition-transform',
                  activeGender === 'Female'
                    ? 'font-extrabold text-[var(--ink)] scale-110'
                    : 'font-bold text-[var(--ink)]',
                )}
              >
                {femaleStudents.length}
              </span>
              <span
                className="text-[10px] font-bold px-1.5 py-0.5 rounded-full border transition-all inline-block"
                style={{
                  background:
                    activeGender === 'Female'
                      ? 'var(--g1)'
                      : 'linear-gradient(135deg, var(--g4) 0%, var(--panel) 100%)',
                  color: activeGender === 'Female' ? '#fff' : 'var(--g1b)',
                  borderColor: activeGender === 'Female' ? 'var(--g1)' : 'var(--g5)',
                }}
              >
                {femalePct}%
              </span>
            </div>
          </div>
          <div className="flex items-center justify-between pt-2 border-t border-[var(--border)] text-[10px] text-[var(--mute)]">
            <span>Avg Tuition</span>
            <span
              className={cn(
                'font-mono font-bold transition-colors',
                activeGender === 'Female' ? 'text-[var(--g1b)]' : 'text-[var(--ink)]',
              )}
            >
              {money(femaleAvg)}
            </span>
          </div>
        </div>

        {/* Male Card */}
        <div
          className={cn(
            'p-3.5 rounded-2xl border transition-all duration-300 cursor-pointer flex flex-col gap-2',
            activeGender === 'Male'
              ? 'border-[var(--g1)] bg-[var(--card)] shadow-lg scale-[1.02] -translate-y-0.5'
              : activeGender !== null
                ? 'border-[var(--border)] bg-[var(--panel)]/40 opacity-40'
                : 'border-[var(--border)] bg-[var(--panel)]/50 hover:bg-[var(--card)] hover:border-[var(--g5)]',
          )}
          onMouseEnter={() => setActiveGender('Male')}
          onMouseLeave={() => setActiveGender(null)}
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div
                className={cn(
                  'w-8 h-8 rounded-xl flex items-center justify-center shrink-0 border transition-all',
                  activeGender === 'Male'
                    ? 'border-[var(--g1)] ring-2 ring-[var(--g1)]/30 text-[var(--g1)]'
                    : 'border-[var(--g5)] text-[var(--g1)]',
                )}
                style={{ background: 'linear-gradient(135deg, var(--g4) 0%, var(--panel) 100%)' }}
              >
                <User size={16} />
              </div>
              <div>
                <span className="text-xs font-bold text-[var(--ink)] block">Male</span>
                <span className="text-[10px] text-[var(--mute)]">Cohort ratio</span>
              </div>
            </div>
            <div className="text-right">
              <span
                className={cn(
                  'text-base font-mono block transition-transform',
                  activeGender === 'Male'
                    ? 'font-extrabold text-[var(--ink)] scale-110'
                    : 'font-bold text-[var(--ink)]',
                )}
              >
                {maleStudents.length}
              </span>
              <span
                className="text-[10px] font-bold px-1.5 py-0.5 rounded-full border transition-all inline-block"
                style={{
                  background:
                    activeGender === 'Male' ? 'var(--g1)' : 'linear-gradient(135deg, var(--g4) 0%, var(--panel) 100%)',
                  color: activeGender === 'Male' ? '#fff' : 'var(--g1b)',
                  borderColor: activeGender === 'Male' ? 'var(--g1)' : 'var(--g5)',
                }}
              >
                {malePct}%
              </span>
            </div>
          </div>
          <div className="flex items-center justify-between pt-2 border-t border-[var(--border)] text-[10px] text-[var(--mute)]">
            <span>Avg Tuition</span>
            <span
              className={cn(
                'font-mono font-bold transition-colors',
                activeGender === 'Male' ? 'text-[var(--g1b)]' : 'text-[var(--ink)]',
              )}
            >
              {money(maleAvg)}
            </span>
          </div>
        </div>
      </div>
    </div>
  )
}
