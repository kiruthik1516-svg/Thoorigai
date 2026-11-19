import { gradeDistribution, type AssessmentResult } from './model'

export function GradeDistribution({
  results,
  maxScore,
  enrolledCount,
}: {
  results: AssessmentResult[]
  maxScore: number
  enrolledCount: number
}) {
  const { bands, maxCount, gradedCount, averageScore, averagePercent } = gradeDistribution(results, maxScore)

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between text-xs text-slate-700">
        <span className="font-bold uppercase tracking-wider text-slate-500">Grade Distribution</span>
        <div className="flex items-center gap-3 font-semibold">
          <span>
            Graded:{' '}
            <strong>
              {gradedCount} / {enrolledCount}
            </strong>
          </span>
          <span>•</span>
          <span>
            Class Average:{' '}
            <strong className="text-indigo-600">
              {averageScore} / {maxScore} ({averagePercent}%)
            </strong>
          </span>
        </div>
      </div>

      <div className="grid gap-2.5 grid-cols-2 sm:grid-cols-4">
        {bands.map((band) => (
          <div key={band.label} className="rounded-xl border border-slate-200/90 p-3 bg-slate-50/60 shadow-2xs">
            <div className="flex justify-between text-xs">
              <span className="font-medium text-slate-600">{band.label}</span>
              <strong className="font-bold text-slate-900">{band.count} students</strong>
            </div>
            <div className="mt-2 h-2 rounded-full bg-slate-200/80 overflow-hidden">
              <div
                className={`h-full rounded-full transition-all ${band.color}`}
                style={{ width: `${(band.count / maxCount) * 100}%` }}
              />
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
