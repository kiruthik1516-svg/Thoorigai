import Link from 'next/link'
import { BookOpen, Clock, Sparkles } from 'lucide-react'
import type { Course } from '@/lib/types'
import { money } from '@/lib/formatters'
import { calculateGstForRupees } from '@/lib/money'
import { CategoryBadge } from '@/components/CategoryBadge'

export function CoursesGrid({
  courses,
  gstRate,
  canUpdate,
  onOpen,
}: {
  courses: Course[]
  gstRate: number
  canUpdate: boolean
  onOpen: (course: Course) => void
}) {
  return (
    <div className="p-5" role="region" aria-label="Course grid">
      {courses.length === 0 ? (
        <div className="text-center py-12 text-[var(--mute)]">
          <BookOpen size={32} className="mx-auto text-[var(--mute)] mb-2" />
          <p className="font-bold text-[var(--text)]">No courses found matching your criteria.</p>
          <p className="text-xs text-[var(--mute)] mt-1">Try switching categories or clearing search filters.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {courses.map((c) => {
            const isInclusive = Boolean(c.gstInclusive)
            const courseBreakdown = calculateGstForRupees(c.fee, gstRate, isInclusive)
            const courseGst = courseBreakdown.gstAmount
            const courseTotal = courseBreakdown.totalAmount
            const isElite = c.categoryName?.toLowerCase().includes('elite')

            return (
              <div
                key={c.id}
                role="button"
                tabIndex={0}
                onClick={() => onOpen(c)}
                onKeyDown={(e) => {
                  if (e.target === e.currentTarget && (e.key === 'Enter' || e.key === ' ')) {
                    e.preventDefault()
                    onOpen(c)
                  }
                }}
                className="bg-[var(--card)] border border-[var(--border)] rounded-[22px] p-5 shadow-xs hover:border-[var(--g1)] transition-all cursor-pointer group flex flex-col justify-between"
                title="Click to view & edit course details"
              >
                <div>
                  <div className="flex items-start justify-between gap-2 mb-3">
                    <div className="flex items-center gap-2.5 min-w-0">
                      <div
                        className="w-8 h-8 rounded-full flex items-center justify-center shrink-0 text-xs font-bold"
                        style={{
                          background: 'var(--panel)',
                          color: 'var(--g1)',
                        }}
                      >
                        {isElite ? <Sparkles size={16} /> : <BookOpen size={16} />}
                      </div>
                      <div className="min-w-0">
                        <strong className="block font-bold text-[var(--text)] group-hover:text-[var(--g1)] transition-colors leading-snug truncate">
                          {c.name}
                        </strong>
                        <small className="block text-[var(--mute)] font-mono text-xs">{c.id}</small>
                      </div>
                    </div>
                    {isInclusive ? (
                      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/15 text-[#1b7a4b] shrink-0">
                        GST Incl.
                      </span>
                    ) : (
                      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-amber-500/15 text-[#854d0e] shrink-0">
                        GST Excl.
                      </span>
                    )}
                  </div>

                  <div className="flex items-center justify-between text-xs mb-3">
                    <div className="flex items-center gap-1.5 text-[var(--text)] font-semibold">
                      <Clock size={13} className="text-[var(--mute)] shrink-0" />
                      <span>{c.duration}</span>
                    </div>
                    {c.categoryName ? (
                      <CategoryBadge categoryName={c.categoryName} />
                    ) : (
                      <span className="text-xs text-[var(--mute)] italic">Unassigned</span>
                    )}
                  </div>

                  <p className="text-[var(--mute)] text-xs line-clamp-2 leading-relaxed mb-3" title={c.description}>
                    {c.description || 'No course description provided.'}
                  </p>
                </div>

                <div className="pt-3 border-t border-[var(--border)] flex items-end justify-between">
                  <div>
                    <span className="text-[10px] font-bold uppercase tracking-wider text-[var(--mute)] block">
                      Fee {gstRate > 0 ? `(${gstRate}% GST)` : ''}
                    </span>
                    <div className="text-base font-extrabold text-[var(--text)] leading-tight">
                      {money(courseTotal)}
                    </div>
                    {gstRate > 0 && (
                      <div className="text-[11px] text-[var(--mute)] mt-0.5">
                        {isInclusive ? (
                          <span className="text-[#1b7a4b] font-semibold">Incl. {money(courseGst)} GST</span>
                        ) : (
                          <span>+{money(courseGst)} GST</span>
                        )}
                      </div>
                    )}
                  </div>

                  <div className="flex items-center gap-2">
                    <Link
                      href={`/courses/${encodeURIComponent(c.id)}/materials`}
                      onClick={(e) => e.stopPropagation()}
                      className="inline-flex items-center gap-1 px-3 py-1 text-xs font-bold text-[var(--text)] bg-[var(--panel)] hover:bg-[var(--card)] border border-[var(--border)] rounded-full transition-colors"
                      title="Manage course materials and syllabus"
                    >
                      <BookOpen size={12} />
                      <span>Materials</span>
                    </Link>
                    {canUpdate && (
                      <span className="text-xs font-bold group-hover:underline" style={{ color: 'var(--g1)' }}>
                        Edit
                      </span>
                    )}
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
