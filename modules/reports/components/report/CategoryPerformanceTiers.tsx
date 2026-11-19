import type { CategoryStat } from './metrics'
import { money } from '@/lib/formatters'

export function CategoryPerformanceTiers({ categoryStats }: { categoryStats: CategoryStat[] }) {
  if (categoryStats.length === 0) return null
  return (
    <section className="panel mb-6 p-5">
      <div className="panel-header border-b border-gray-100 pb-3 mb-4 flex items-center justify-between">
        <div>
          <h2 className="text-lg font-bold text-gray-900">Curriculum Tier Performance</h2>
          <p className="text-xs text-gray-500">
            Enrollment volume, total tuition value, and fee realization by duration tier
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
        {categoryStats.map((cat) => {
          const isInternship = cat.name.toLowerCase().includes('internship')
          const isElite = cat.name.toLowerCase().includes('elite')
          const isEssential = cat.name.toLowerCase().includes('essential')
          const dotColor = isInternship
            ? 'bg-emerald-500'
            : isElite
              ? 'bg-purple-500'
              : isEssential
                ? 'bg-amber-500'
                : 'bg-blue-500'
          const barColor = isInternship
            ? 'bg-emerald-600'
            : isElite
              ? 'bg-purple-600'
              : isEssential
                ? 'bg-amber-500'
                : 'bg-blue-600'

          return (
            <div
              key={cat.id}
              className="border border-gray-200/90 rounded-xl p-4 bg-gradient-to-br from-white to-slate-50/50 shadow-xs flex flex-col justify-between"
            >
              <div>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className={`w-2.5 h-2.5 rounded-full ${dotColor}`} />
                    <h3 className="font-bold text-gray-900 text-base">{cat.name}</h3>
                  </div>
                  <span className="text-xs font-semibold text-gray-600 bg-gray-100 px-2 py-0.5 rounded-full">
                    {cat.duration}
                  </span>
                </div>

                <div className="mt-4 grid grid-cols-2 gap-3 pb-3 border-b border-gray-100">
                  <div>
                    <span className="text-[11px] text-gray-400 uppercase font-medium">Students</span>
                    <div className="text-lg font-bold text-gray-900 mt-0.5">{cat.studentCount}</div>
                    <span className="text-[10px] text-gray-500">{cat.enrollmentShare}% of cohort</span>
                  </div>
                  <div>
                    <span className="text-[11px] text-gray-400 uppercase font-medium">Realization</span>
                    <div className="text-lg font-bold text-emerald-600 mt-0.5">{cat.collectionRate}%</div>
                    <span className="text-[10px] text-gray-500">Collected vs Total</span>
                  </div>
                </div>

                <div className="mt-3 space-y-1.5 text-xs">
                  <div className="flex justify-between text-gray-600">
                    <span>Total Tuition:</span>
                    <strong className="text-gray-900">{money(cat.totalFees)}</strong>
                  </div>
                  <div className="flex justify-between text-gray-600">
                    <span>Collected:</span>
                    <strong className="text-emerald-700">{money(cat.collected)}</strong>
                  </div>
                  <div className="flex justify-between text-gray-600">
                    <span>Pending Balance:</span>
                    <strong className="text-amber-700">{money(cat.outstanding)}</strong>
                  </div>
                </div>
              </div>

              <div className="mt-4">
                <div className="w-full bg-gray-200 h-2 rounded-full overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all duration-500 ${barColor}`}
                    style={{ width: `${Math.min(100, cat.collectionRate)}%` }}
                  />
                </div>
              </div>
            </div>
          )
        })}
      </div>
    </section>
  )
}
