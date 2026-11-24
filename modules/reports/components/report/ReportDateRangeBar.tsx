'use client'

import Link from 'next/link'
import { Calendar, Download } from 'lucide-react'
import { REPORT_RANGE_PRESETS, matchingPreset, presetRange, type ReportDateRange } from './dateRange'

const inputClass =
  'text-xs border border-[var(--border)] rounded-full px-2.5 py-1 bg-[var(--card)] text-[var(--text)] focus:outline-none focus:ring-1 focus:ring-[var(--g1)]'
const downloadClass =
  'inline-flex items-center gap-1.5 px-3.5 py-1 text-xs font-bold rounded-full border border-[var(--border)] bg-[var(--panel)] text-[var(--text)] hover:bg-[var(--card)] transition-colors shadow-2xs cursor-pointer'

/**
 * Shared date filter for every report section: start/end dates, quick ranges
 * (7d, 30d, this month, YTD) and a CSV download for the selected window.
 */
export function ReportDateRangeBar({
  idPrefix,
  range,
  onChange,
  downloadHref,
  onDownload,
}: {
  idPrefix: string
  range: ReportDateRange
  onChange: (range: ReportDateRange) => void
  /** Server export link (rendered as a link). */
  downloadHref?: string
  /** Client-side export (rendered as a button). */
  onDownload?: () => void
}) {
  const active = matchingPreset(range)

  return (
    <div className="flex flex-wrap items-center gap-2.5 p-1.5 bg-[var(--card)] rounded-2xl sm:rounded-full border border-[var(--border)] shadow-2xs min-w-0">
      <div className="flex flex-wrap items-center gap-1.5 text-xs text-[var(--mute)] px-2">
        <Calendar size={14} className="text-[var(--mute)]" aria-hidden />
        <input
          id={`${idPrefix}-start-date`}
          aria-label="Start date"
          type="date"
          value={range.start}
          max={range.end || undefined}
          onChange={(e) => e.target.value && onChange({ ...range, start: e.target.value })}
          className={inputClass}
        />
        <span>to</span>
        <input
          id={`${idPrefix}-end-date`}
          aria-label="End date"
          type="date"
          value={range.end}
          min={range.start || undefined}
          onChange={(e) => e.target.value && onChange({ ...range, end: e.target.value })}
          className={inputClass}
        />
      </div>

      <div className="flex items-center gap-1" role="group" aria-label="Quick date ranges">
        {REPORT_RANGE_PRESETS.map((preset) => {
          const isActive = active === preset.id
          return (
            <button
              key={preset.id}
              type="button"
              title={preset.title}
              aria-pressed={isActive}
              onClick={() => onChange(presetRange(preset.id))}
              className={`px-2.5 py-1 text-xs font-bold rounded-full transition-colors cursor-pointer ${
                isActive ? 'text-white shadow-xs' : 'bg-[var(--panel)] hover:bg-[var(--border)] text-[var(--text)]'
              }`}
              style={isActive ? { background: 'linear-gradient(135deg, var(--g1), var(--g1b))' } : undefined}
            >
              {preset.label}
            </button>
          )
        })}
      </div>

      {downloadHref ? (
        <Link href={downloadHref} className={downloadClass}>
          <Download size={13} aria-hidden />
          Download CSV
        </Link>
      ) : onDownload ? (
        <button type="button" onClick={onDownload} className={downloadClass}>
          <Download size={13} aria-hidden />
          Download CSV
        </button>
      ) : null}
    </div>
  )
}
