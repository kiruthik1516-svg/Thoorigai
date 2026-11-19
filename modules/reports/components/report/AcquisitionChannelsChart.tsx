'use client'

import { PolarAngleAxis, PolarGrid, Radar, RadarChart } from 'recharts'
import { type ChartConfig, ChartContainer, ChartTooltip, ChartTooltipContent } from '@/components/ui/chart'
import type { ReportMetrics } from './metrics'

const chartConfig = {
  students: {
    label: 'Students',
    color: 'var(--g1)',
  },
} satisfies ChartConfig

export function AcquisitionChannelsChart({ data }: { data: ReportMetrics['acquisitionChannels'] }) {
  return (
    <>
      {data.length === 0 ? (
        <p className="empty-note">No acquisition source data in this period.</p>
      ) : (
        <div className="p-4 sm:p-6 flex flex-col items-center justify-center">
          <ChartContainer config={chartConfig} className="mx-auto aspect-square max-h-[320px] w-full max-w-[440px]">
            <RadarChart data={data} outerRadius="70%">
              <ChartTooltip
                cursor={false}
                content={
                  <ChartTooltipContent
                    indicator="dot"
                    className="min-w-[10rem] p-3 rounded-2xl bg-[var(--card)] border border-[var(--border)] shadow-xl"
                    formatter={(value, name, item) => (
                      <div className="flex w-full items-center justify-between gap-3 text-xs">
                        <span className="text-[var(--mute)]">Students:</span>
                        <span className="font-bold text-[var(--ink)] font-mono">
                          {String(value ?? '')} ({String(item.payload?.sharePct ?? '')}%)
                        </span>
                      </div>
                    )}
                  />
                }
              />
              <PolarAngleAxis dataKey="channel" tick={{ fill: 'var(--ink)', fontSize: 11, fontWeight: 600 }} />
              <PolarGrid stroke="var(--mute)" strokeOpacity={0.35} strokeWidth={1.2} />
              <Radar
                name="Students"
                dataKey="students"
                stroke="var(--g1)"
                strokeWidth={2.5}
                fill="var(--g1)"
                fillOpacity={0.35}
                dot={{ fill: 'var(--card)', stroke: 'var(--g1)', strokeWidth: 2, r: 4 }}
                activeDot={{ fill: 'var(--g1)', stroke: 'var(--card)', strokeWidth: 2, r: 6 }}
              />
            </RadarChart>
          </ChartContainer>
        </div>
      )}
    </>
  )
}
