'use client'

import { useState } from 'react'
import { cn } from '@/lib/utils'
import { Cell, Label, Pie, PieChart } from 'recharts'
import { type ChartConfig, ChartContainer, ChartTooltip, ChartTooltipContent } from '@/components/ui/chart'
import { money } from '@/lib/formatters'

type PaymentMethodTotalsProps = {
  paymentChartData: Array<{
    key: string
    method: string
    amount: number
    count: number
    fill: string
  }>
  paymentChartConfig: ChartConfig
  revenue: number
}

export function PaymentMethodTotalsChart({ paymentChartData, paymentChartConfig, revenue }: PaymentMethodTotalsProps) {
  const [activeMethod, setActiveMethod] = useState<string | null>(null)

  const activeItem = activeMethod ? paymentChartData.find((item) => item.method === activeMethod) : null

  if (paymentChartData.length === 0) {
    return <p className="empty-note">No payments recorded in selected period.</p>
  }

  return (
    <div className="flex flex-col md:flex-row items-center justify-between gap-6 p-2 sm:p-4">
      {/* Donut Chart */}
      <div className="w-full md:w-1/2 flex items-center justify-center">
        <ChartContainer
          config={paymentChartConfig}
          className="mx-auto aspect-square max-h-[280px] min-h-[220px] w-full max-w-[280px]"
        >
          <PieChart onMouseLeave={() => setActiveMethod(null)}>
            <ChartTooltip
              cursor={false}
              content={
                <ChartTooltipContent
                  hideLabel
                  className="min-w-[12rem] p-3 rounded-2xl bg-[var(--card)] border border-[var(--border)] shadow-xl"
                  formatter={(value, name, item) => (
                    <div className="flex w-full items-center justify-between gap-3 text-xs">
                      <div className="flex items-center gap-2">
                        <span
                          className="h-2.5 w-2.5 rounded-full shrink-0"
                          style={{ background: item.payload?.fill || 'var(--g1)' }}
                        />
                        <span className="font-semibold text-[var(--ink)]">
                          {String(item.payload?.method || name || '')}
                        </span>
                        <span className="text-[10px] text-[var(--mute)]">({String(item.payload?.count ?? 1)} tx)</span>
                      </div>
                      <span className="font-bold text-[var(--ink)] font-mono">{money(Number(value))}</span>
                    </div>
                  )}
                />
              }
            />
            <Pie
              data={paymentChartData}
              dataKey="amount"
              nameKey="method"
              innerRadius={65}
              outerRadius={95}
              paddingAngle={4}
              cornerRadius={8}
              strokeWidth={2}
              stroke="var(--card)"
              animationDuration={800}
              onMouseLeave={() => setActiveMethod(null)}
            >
              {paymentChartData.map((entry) => {
                const isHovered = activeMethod === entry.method
                const isAnyHovered = activeMethod !== null

                return (
                  <Cell
                    key={entry.method}
                    fill={entry.fill}
                    stroke="var(--card)"
                    strokeWidth={isHovered ? 3 : 2}
                    style={{
                      opacity: isAnyHovered ? (isHovered ? 1 : 0.35) : 1,
                      transition: 'all 0.3s ease',
                      cursor: 'pointer',
                    }}
                    onMouseEnter={() => setActiveMethod(entry.method)}
                  />
                )
              })}
              <Label
                content={({ viewBox }) => {
                  if (viewBox && 'cx' in viewBox && 'cy' in viewBox) {
                    return (
                      <text x={viewBox.cx} y={viewBox.cy} textAnchor="middle" dominantBaseline="middle">
                        <tspan
                          x={viewBox.cx}
                          y={(viewBox.cy || 0) - 2}
                          className="fill-[var(--ink)] text-xl sm:text-2xl font-bold font-mono tracking-tight"
                        >
                          {activeItem ? money(activeItem.amount) : money(revenue)}
                        </tspan>
                        <tspan
                          x={viewBox.cx}
                          y={(viewBox.cy || 0) + 20}
                          className="fill-[var(--mute)] text-xs font-semibold uppercase tracking-wider"
                        >
                          {activeItem
                            ? `${activeItem.method} (${revenue > 0 ? Math.round((activeItem.amount / revenue) * 100) : 0}%)`
                            : 'Collected'}
                        </tspan>
                      </text>
                    )
                  }
                }}
              />
            </Pie>
          </PieChart>
        </ChartContainer>
      </div>

      {/* Options List with Interactive Synchronized Hover */}
      <div className="w-full md:w-1/2 flex flex-col gap-2.5">
        {paymentChartData.map((item) => {
          const isHovered = activeMethod === item.method
          const isAnyHovered = activeMethod !== null
          const pct = revenue > 0 ? Math.round((item.amount / revenue) * 100) : 0

          return (
            <div
              key={item.method}
              onMouseEnter={() => setActiveMethod(item.method)}
              onMouseLeave={() => setActiveMethod(null)}
              className={cn(
                'flex items-center justify-between p-2.5 sm:p-3 rounded-2xl border transition-all duration-300 cursor-pointer',
                isHovered
                  ? 'bg-[var(--card)] shadow-lg scale-[1.02] -translate-y-0.5'
                  : isAnyHovered
                    ? 'bg-[var(--panel)]/40 border-[var(--border)] opacity-40'
                    : 'bg-[var(--panel)] border-[var(--border)] hover:bg-[var(--card)]',
              )}
              style={{
                borderColor: isHovered ? item.fill : undefined,
                boxShadow: isHovered ? `0 4px 18px -2px ${item.fill}40` : undefined,
              }}
            >
              <div className="flex items-center gap-2.5 min-w-0">
                <span
                  className={cn(
                    'rounded-full shrink-0 transition-all duration-300',
                    isHovered ? 'w-3 h-3 ring-4 ring-[var(--g4)]' : 'w-2.5 h-2.5',
                  )}
                  style={{ background: item.fill }}
                />
                <strong
                  className={cn(
                    'text-xs transition-colors truncate',
                    isHovered ? 'text-[var(--ink)] font-bold' : 'text-[var(--ink)] font-semibold',
                  )}
                >
                  {item.method}
                </strong>
                <span className="text-[10px] text-[var(--mute)] shrink-0 font-medium font-mono">({item.count} tx)</span>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <span className="text-xs font-bold font-mono text-[var(--ink)]">{money(item.amount)}</span>
                <span
                  className="text-[10px] font-bold px-2 py-0.5 rounded-full border transition-all"
                  style={{
                    background: isHovered ? item.fill : 'linear-gradient(135deg, var(--g4) 0%, var(--panel) 100%)',
                    color: isHovered ? '#fff' : 'var(--g1b)',
                    borderColor: isHovered ? item.fill : 'var(--g5)',
                  }}
                >
                  {pct}%
                </span>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
