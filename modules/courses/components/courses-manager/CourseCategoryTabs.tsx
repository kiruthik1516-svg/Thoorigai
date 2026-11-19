import Link from 'next/link'
import type { CourseCategory } from '@/lib/types'

export function CourseCategoryTabs({
  categories,
  selectedCategoryId,
  visibleCount,
  tabUrl,
}: {
  categories: CourseCategory[]
  selectedCategoryId?: string
  visibleCount: number
  tabUrl: (categoryId?: string) => string
}) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 mb-6 p-1.5 rounded-full bg-[var(--panel)] border border-[var(--border)]">
      <div className="flex flex-wrap items-center gap-1.5">
        <Link
          href={tabUrl(undefined)}
          className={`px-3.5 py-1.5 rounded-full text-xs font-bold transition-all ${
            !selectedCategoryId ? 'text-white shadow-xs' : 'text-[var(--mute)] hover:text-[var(--text)]'
          }`}
          style={!selectedCategoryId ? { background: 'linear-gradient(135deg, var(--g1), var(--g1b))' } : {}}
        >
          All Courses
        </Link>
        {categories.map((cat) => {
          const isSelected = selectedCategoryId === cat.id

          return (
            <Link
              key={cat.id}
              href={tabUrl(cat.id)}
              className={`inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-xs font-bold transition-all ${
                isSelected ? 'text-white shadow-xs' : 'text-[var(--mute)] hover:text-[var(--text)]'
              }`}
              style={isSelected ? { background: 'linear-gradient(135deg, var(--g1), var(--g1b))' } : {}}
            >
              <span>{cat.name}</span>
              <span
                className={`text-[10px] px-2 py-0.2 rounded-full font-bold ${
                  isSelected ? 'bg-white/20 text-white' : 'bg-[var(--card)] text-[var(--mute)]'
                }`}
              >
                {cat.duration}
              </span>
            </Link>
          )
        })}
        <Link
          href={tabUrl('uncategorized')}
          className={`px-3.5 py-1.5 rounded-full text-xs font-bold transition-all ${
            selectedCategoryId === 'uncategorized'
              ? 'text-white shadow-xs'
              : 'text-[var(--mute)] hover:text-[var(--text)]'
          }`}
          style={
            selectedCategoryId === 'uncategorized'
              ? { background: 'linear-gradient(135deg, var(--g1), var(--g1b))' }
              : {}
          }
        >
          Uncategorized
        </Link>
      </div>

      <div className="text-xs text-[var(--mute)] font-semibold px-3">
        Showing {visibleCount} {visibleCount === 1 ? 'course' : 'courses'}
      </div>
    </div>
  )
}
