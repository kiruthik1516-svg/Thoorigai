'use client'

import { Area, AreaChart, CartesianGrid, XAxis, YAxis } from 'recharts'
import { type ChartConfig, ChartContainer, ChartTooltip, ChartTooltipContent } from '@/components/ui/chart'
import { money } from '@/lib/formatters'
import type { ReportMetrics } from './metrics'

const chartConfig = {
  amount: {
    label: 'Inflow',
    color: 'var(--g1)',
  },
} satisfies ChartConfig

export function PaymentVelocityChart({
  data,
  revenue,
  transactionCount,
}: {
  data: ReportMetrics['velocity']
  revenue: number
  transactionCount: number
}) {
  return (
    <>
      {data.length === 0 ? (
        <p className="empty-note">No payment velocity data in this period.</p>
      ) : (
        <div className="p-3 sm:p-5 flex flex-col gap-3">
          <ChartContainer config={chartConfig} className="aspect-auto h-[240px] w-full">
            <AreaChart data={data} margin={{ top: 12, right: 16, left: 10, bottom: 0 }}>
              <defs>
                <linearGradient id="velocityFill" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="var(--g1)" stopOpacity={0.35} />
                  <stop offset="95%" stopColor="var(--g1)" stopOpacity={0.02} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--border)" />
              <XAxis
                dataKey="date"
                tickLine={false}
                axisLine={false}
                tickMargin={8}
                tick={{ fill: 'var(--mute)', fontSize: 11 }}
              />
              <YAxis
                tickLine={false}
                axisLine={false}
                tickMargin={6}
                width={75}
                tick={{ fill: 'var(--mute)', fontSize: 10 }}
                tickFormatter={(val) => money(Number(val))}
              />
              <ChartTooltip
                cursor={{ stroke: 'var(--border)', strokeWidth: 1 }}
                content={
                  <ChartTooltipContent
                    indicator="dot"
                    className="min-w-[10rem] p-3 rounded-2xl bg-[var(--card)] border border-[var(--border)] shadow-xl"
                    formatter={(value) => (
                      <div className="flex w-full items-center justify-between gap-3 text-xs">
                        <span className="text-[var(--mute)]">Inflow:</span>
                        <span className="font-bold text-[var(--ink)] font-mono">{money(Number(value))}</span>
                      </div>
                    )}
                    labelFormatter={(_, payload) => (
                      <span className="font-semibold text-xs text-[var(--ink)]">
                        {String(payload?.[0]?.payload?.fullDate ?? '')}
                      </span>
                    )}
                  />
                }
              />
              <Area
                type="monotone"
                dataKey="amount"
                stroke="var(--g1)"
                strokeWidth={2.5}
                fill="url(#velocityFill)"
                dot={{ fill: 'var(--card)', stroke: 'var(--g1)', strokeWidth: 2, r: 3.5 }}
                activeDot={{ fill: 'var(--g1)', stroke: 'var(--card)', strokeWidth: 2, r: 5.5 }}
              />
            </AreaChart>
          </ChartContainer>

          <div className="flex items-center justify-between pt-3 border-t border-[var(--border)] text-xs text-[var(--mute)]">
            <span>
              Period Inflow: <strong className="text-[var(--ink)] font-mono">{money(revenue)}</strong>
            </span>
            <span>
              Avg Transaction:{' '}
              <strong className="text-[var(--ink)] font-mono">
                {money(transactionCount ? Math.round(revenue / transactionCount) : 0)}
              </strong>
            </span>
          </div>
        </div>
      )}
    </>
  )
}
