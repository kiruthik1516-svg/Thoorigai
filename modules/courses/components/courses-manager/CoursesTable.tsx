import { BookOpen, Clock, Sparkles } from 'lucide-react'
import type { Course } from '@/lib/types'
import { money } from '@/lib/formatters'
import { calculateGstForRupees } from '@/lib/money'
import { CategoryBadge } from '@/components/CategoryBadge'

export function CoursesTable({
  courses,
  gstRate,
  onOpen,
}: {
  courses: Course[]
  gstRate: number
  onOpen: (course: Course) => void
}) {
  return (
    <div
      className="overflow-x-auto w-full rounded-xl border border-[var(--border)] bg-[var(--card)] shadow-xs"
      role="region"
      aria-label="Course list"
    >
      <table className="w-full min-w-[760px] text-left text-xs" style={{ whiteSpace: 'normal' }}>
        <thead className="bg-[var(--panel)] border-b border-[var(--border)] text-[var(--mute)] font-bold uppercase tracking-wider text-[11px]">
          <tr>
            <th className="py-3.5 px-4" style={{ width: '28%' }}>
              Course
            </th>
            <th className="py-3.5 px-4" style={{ width: '15%' }}>
              Category
            </th>
            <th className="py-3.5 px-4" style={{ width: '12%' }}>
              Duration
            </th>
            <th className="py-3.5 px-4" style={{ width: '13%' }}>
              Tax Mode
            </th>
            <th className="py-3.5 px-4" style={{ width: '20%' }}>
              Description
            </th>
            <th className="py-3.5 px-4 text-right" style={{ width: '12%', whiteSpace: 'nowrap' }}>
              Fee {gstRate > 0 ? `(${gstRate}% GST)` : ''}
            </th>
          </tr>
        </thead>
        <tbody className="divide-y divide-[var(--border)]">
          {courses.length === 0 ? (
            <tr>
              <td colSpan={6} className="text-center py-12 text-[var(--mute)]">
                <BookOpen size={32} className="mx-auto text-[var(--mute)] mb-2" />
                <p className="font-bold text-[var(--text)]">No courses found matching your criteria.</p>
                <p className="text-xs text-[var(--mute)] mt-1">Try switching categories or clearing search filters.</p>
              </td>
            </tr>
          ) : (
            courses.map((c) => {
              const isInclusive = Boolean(c.gstInclusive)
              const courseBreakdown = calculateGstForRupees(c.fee, gstRate, isInclusive)
              const courseBase = courseBreakdown.taxableAmount
              const courseGst = courseBreakdown.gstAmount
              const courseTotal = courseBreakdown.totalAmount
              const isElite = c.categoryName?.toLowerCase().includes('elite')

              return (
                <tr
                  key={c.id}
                  className="cursor-pointer hover:bg-[var(--panel)] transition-colors group"
                  onClick={() => onOpen(c)}
                  title="Click to view & edit course details"
                >
                  <td className="py-3.5 px-4">
                    <div className="flex items-center gap-2.5">
                      <div
                        className="w-8 h-8 rounded-full flex items-center justify-center shrink-0 text-xs font-bold"
                        style={{
                          background: isElite ? 'var(--panel)' : 'var(--panel)',
                          color: 'var(--g1)',
                        }}
                      >
                        {isElite ? <Sparkles size={16} /> : <BookOpen size={16} />}
                      </div>
                      <div className="min-w-0">
                        <strong className="block font-bold text-[var(--text)] group-hover:text-[var(--g1)] transition-colors leading-snug">
                          {c.name}
                        </strong>
                        <small className="block text-[var(--mute)] font-mono text-xs">{c.id}</small>
                      </div>
                    </div>
                  </td>
                  <td className="py-3.5 px-4">
                    {c.categoryName ? (
                      <CategoryBadge categoryName={c.categoryName} />
                    ) : (
                      <span className="text-xs text-[var(--mute)] italic">Unassigned</span>
                    )}
                  </td>
                  <td className="py-3.5 px-4" style={{ whiteSpace: 'nowrap' }}>
                    <div className="flex items-center gap-1.5 text-[var(--text)] text-xs font-semibold">
                      <Clock size={13} className="text-[var(--mute)] shrink-0" />
                      <span>{c.duration}</span>
                    </div>
                  </td>
                  <td className="py-3.5 px-4">
                    {isInclusive ? (
                      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/15 text-[#1b7a4b]">
                        GST Inclusive
                      </span>
                    ) : (
                      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-amber-500/15 text-[#854d0e]">
                        GST Exclusive
                      </span>
                    )}
                  </td>
                  <td className="py-3.5 px-4">
                    <p className="text-[var(--mute)] text-xs line-clamp-2 leading-relaxed" title={c.description}>
                      {c.description || '—'}
                    </p>
                  </td>
                  <td className="py-3.5 px-4 text-right" style={{ whiteSpace: 'nowrap' }}>
                    <div className="text-sm font-bold text-[var(--text)] leading-tight">{money(courseTotal)}</div>
                    {gstRate > 0 && (
                      <div className="text-[11px] text-[var(--mute)] mt-0.5">
                        {isInclusive ? (
                          <>
                            Base: {money(courseBase)}{' '}
                            <span className="text-[#1b7a4b] font-bold">({money(courseGst)} GST incl.)</span>
                          </>
                        ) : (
                          <>
                            Base: {money(c.fee)} <span>+{money(courseGst)}</span>
                          </>
                        )}
                      </div>
                    )}
                  </td>
                </tr>
              )
            })
          )}
        </tbody>
      </table>
    </div>
  )
}
