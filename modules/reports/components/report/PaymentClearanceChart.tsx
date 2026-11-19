'use client'

import { useState, useMemo } from 'react'
import { cn } from '@/lib/utils'
import { CheckCircle2, Clock } from 'lucide-react'
import { Cell, Pie, PieChart } from 'recharts'
import { type ChartConfig, ChartContainer, ChartTooltip, ChartTooltipContent } from '@/components/ui/chart'
import { money } from '@/lib/formatters'

type PaymentClearanceProps = {
  collectionRate: number
  fullyPaid: number
  pending: number
  totalStudents: number
  totalPaid: number
  outstanding: number
}

export function PaymentClearanceChart({
  collectionRate,
  fullyPaid,
  pending,
  totalStudents,
  totalPaid,
  outstanding,
}: PaymentClearanceProps) {
  const [activeName, setActiveName] = useState<string | null>(null)

  const data = useMemo(() => {
    return [
      {
        name: 'Fully Cleared',
        value: Math.max(0, fullyPaid),
        count: fullyPaid,
        pct: totalStudents ? Math.round((fullyPaid / totalStudents) * 100) : 0,
        fill: 'var(--g1)',
      },
      {
        name: 'Pending Dues',
        value: Math.max(0, pending),
        count: pending,
        pct: totalStudents ? Math.round((pending / totalStudents) * 100) : 0,
        fill: 'var(--g3)',
      },
    ]
  }, [fullyPaid, pending, totalStudents])

  const chartConfig = {
    fullyCleared: { label: 'Fully Cleared', color: 'var(--g1)' },
    pendingDues: { label: 'Pending Dues', color: 'var(--g3)' },
  } satisfies ChartConfig

  return (
    <div className="grid grid-cols-1 md:grid-cols-12 gap-6 p-4 sm:p-5 items-center">
      {/* Padded Donut Chart with Centered Clearance Ratio */}
      <div className="md:col-span-5 relative flex items-center justify-center">
        <ChartContainer config={chartConfig} className="mx-auto aspect-square max-h-[220px] w-full">
          <PieChart>
            <ChartTooltip
              content={
                <ChartTooltipContent
                  indicator="dot"
                  className="min-w-[10rem] p-3 rounded-2xl bg-[var(--card)] border border-[var(--border)] shadow-xl"
                  formatter={(value, name, item) => (
                    <div className="flex w-full items-center justify-between gap-3 text-xs">
                      <span className="text-[var(--mute)]">Students:</span>
                      <span className="font-bold text-[var(--ink)] font-mono">
                        {String(item.payload?.count ?? '')} ({String(item.payload?.pct ?? '')}%)
                      </span>
                    </div>
                  )}
                />
              }
            />
            <Pie
              data={data}
              dataKey="value"
              nameKey="name"
              innerRadius={58}
              outerRadius={85}
              paddingAngle={6}
              cornerRadius={8}
              animationDuration={800}
              onMouseLeave={() => setActiveName(null)}
            >
              {data.map((entry) => (
                <Cell
                  key={entry.name}
                  fill={entry.fill}
                  stroke="var(--card)"
                  strokeWidth={2}
                  style={{
                    opacity: activeName === null || activeName === entry.name ? 1 : 0.35,
                    transition: 'all 0.3s ease',
                    cursor: 'pointer',
                  }}
                  onMouseEnter={() => setActiveName(entry.name)}
                />
              ))}
            </Pie>
          </PieChart>
        </ChartContainer>

        {/* Center ratio label */}
        <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none transition-all duration-300">
          <span className="text-2xl font-extrabold font-mono text-[var(--ink)] tracking-tight">
            {activeName === 'Fully Cleared'
              ? `${totalStudents ? Math.round((fullyPaid / totalStudents) * 100) : 0}%`
              : activeName === 'Pending Dues'
                ? `${totalStudents ? Math.round((pending / totalStudents) * 100) : 0}%`
                : `${collectionRate}%`}
          </span>
          <span className="text-[9px] font-bold uppercase tracking-wider text-[var(--mute)] max-w-[100px] truncate text-center">
            {activeName ? activeName : 'Settled'}
          </span>
        </div>
      </div>

      {/* Modern Status Cards Stack */}
      <div className="md:col-span-7 flex flex-col gap-3">
        {/* Card 1: Fully Cleared */}
        <div
          className={cn(
            'p-3.5 rounded-2xl border transition-all duration-300 cursor-pointer',
            activeName === 'Fully Cleared'
              ? 'border-[var(--g1)] bg-[var(--card)] shadow-lg scale-[1.02] -translate-y-0.5'
              : activeName !== null
                ? 'border-[var(--border)] bg-[var(--panel)]/40 opacity-40'
                : 'border-[var(--border)] bg-[var(--panel)]/50 hover:bg-[var(--card)] hover:border-[var(--g5)]',
          )}
          onMouseEnter={() => setActiveName('Fully Cleared')}
          onMouseLeave={() => setActiveName(null)}
        >
          <div className="flex items-center justify-between gap-2 mb-2">
            <div className="flex items-center gap-2">
              <div
                className={cn(
                  'w-8 h-8 rounded-xl flex items-center justify-center shrink-0 border transition-all',
                  activeName === 'Fully Cleared'
                    ? 'border-[var(--g1)] ring-2 ring-[var(--g1)]/30 text-[var(--g1)]'
                    : 'border-[var(--g5)] text-[var(--g1)]',
                )}
                style={{ background: 'linear-gradient(135deg, var(--g4) 0%, var(--panel) 100%)' }}
              >
                <CheckCircle2 size={16} />
              </div>
              <div>
                <h4 className="text-xs font-bold text-[var(--ink)]">Fully Cleared</h4>
                <p className="text-[10px] text-[var(--mute)]">Ready for certificate</p>
              </div>
            </div>
            <div className="text-right">
              <span
                className={cn(
                  'text-base font-mono block transition-transform',
                  activeName === 'Fully Cleared'
                    ? 'font-extrabold text-[var(--ink)] scale-110'
                    : 'font-bold text-[var(--ink)]',
                )}
              >
                {fullyPaid}
              </span>
              <span
                className="text-[10px] font-bold px-1.5 py-0.5 rounded-full border transition-all inline-block"
                style={{
                  background:
                    activeName === 'Fully Cleared'
                      ? 'var(--g1)'
                      : 'linear-gradient(135deg, var(--g4) 0%, var(--panel) 100%)',
                  color: activeName === 'Fully Cleared' ? '#fff' : 'var(--g1b)',
                  borderColor: activeName === 'Fully Cleared' ? 'var(--g1)' : 'var(--g5)',
                }}
              >
                {totalStudents ? Math.round((fullyPaid / totalStudents) * 100) : 0}% cohort
              </span>
            </div>
          </div>
          <div className="flex items-center justify-between pt-2 border-t border-[var(--border)] text-[10px] text-[var(--mute)]">
            <span>Collected Fees</span>
            <span
              className={cn(
                'font-mono font-bold transition-colors',
                activeName === 'Fully Cleared' ? 'text-[var(--g1b)]' : 'text-[var(--ink)]',
              )}
            >
              {money(totalPaid)}
            </span>
          </div>
        </div>

        {/* Card 2: Pending Dues */}
        <div
          className={cn(
            'p-3.5 rounded-2xl border transition-all duration-300 cursor-pointer',
            activeName === 'Pending Dues'
              ? 'border-[var(--g1b)] bg-[var(--card)] shadow-lg scale-[1.02] -translate-y-0.5'
              : activeName !== null
                ? 'border-[var(--border)] bg-[var(--panel)]/40 opacity-40'
                : 'border-[var(--border)] bg-[var(--panel)]/50 hover:bg-[var(--card)] hover:border-[var(--g5)]',
          )}
          onMouseEnter={() => setActiveName('Pending Dues')}
          onMouseLeave={() => setActiveName(null)}
        >
          <div className="flex items-center justify-between gap-2 mb-2">
            <div className="flex items-center gap-2">
              <div
                className={cn(
                  'w-8 h-8 rounded-xl flex items-center justify-center shrink-0 border transition-all',
                  activeName === 'Pending Dues'
                    ? 'border-[var(--g1b)] ring-2 ring-[var(--g1b)]/30 text-[var(--g1b)]'
                    : 'border-[var(--g5)] text-[var(--g1b)]',
                )}
                style={{ background: 'linear-gradient(135deg, var(--g4) 0%, var(--panel) 100%)' }}
              >
                <Clock size={16} />
              </div>
              <div>
                <h4 className="text-xs font-bold text-[var(--ink)]">Pending Dues</h4>
                <p className="text-[10px] text-[var(--mute)]">{money(outstanding)} due</p>
              </div>
            </div>
            <div className="text-right">
              <span
                className={cn(
                  'text-base font-mono block transition-transform',
                  activeName === 'Pending Dues'
                    ? 'font-extrabold text-[var(--ink)] scale-110'
                    : 'font-bold text-[var(--ink)]',
                )}
              >
                {pending}
              </span>
              <span
                className="text-[10px] font-bold px-1.5 py-0.5 rounded-full border transition-all inline-block"
                style={{
                  background:
                    activeName === 'Pending Dues'
                      ? 'var(--g1b)'
                      : 'linear-gradient(135deg, var(--g4) 0%, var(--panel) 100%)',
                  color: activeName === 'Pending Dues' ? '#fff' : 'var(--g1b)',
                  borderColor: activeName === 'Pending Dues' ? 'var(--g1b)' : 'var(--g5)',
                }}
              >
                {totalStudents ? Math.round((pending / totalStudents) * 100) : 0}% cohort
              </span>
            </div>
          </div>
          <div className="flex items-center justify-between pt-2 border-t border-[var(--border)] text-[10px] text-[var(--mute)]">
            <span>Receivable Balance</span>
            <span
              className={cn(
                'font-mono font-bold transition-colors',
                activeName === 'Pending Dues' ? 'text-[var(--g1b)]' : 'text-[var(--ink)]',
              )}
            >
              {money(outstanding)}
            </span>
          </div>
        </div>
      </div>
    </div>
  )
}
