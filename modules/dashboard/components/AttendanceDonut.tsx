'use client'

import { Cell, Pie, PieChart } from 'recharts'
import {
  ChartContainer,
  ChartLegend,
  ChartLegendContent,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from '@/components/ui/chart'

const chartConfig = {
  present: {
    label: 'Present',
    color: '#10b981',
  },
  absent: {
    label: 'Absent',
    color: '#f43f5e',
  },
} satisfies ChartConfig

export interface AttendanceDonutDatum {
  status: string
  count: number
  fill: string
}

/** The recharts donut, split out so the dashboard can load it after the first paint (mobile audit). */
export function AttendanceDonut({ chartData, isEmpty }: { chartData: AttendanceDonutDatum[]; isEmpty: boolean }) {
  return (
    <ChartContainer config={chartConfig} className="mx-auto aspect-square w-full max-w-[170px] max-h-[170px]">
      <PieChart accessibilityLayer>
        <defs>
          {/* Present Pattern: Subtle diagonal hatch on emerald */}
          <pattern id="attendance-present-pattern" patternUnits="userSpaceOnUse" width="6" height="6">
            <rect width="6" height="6" fill="#10b981" opacity="0.25" />
            <path d="M0,6 L6,0 M-2,2 L2,-2 M4,8 L8,4" stroke="#10b981" strokeWidth="1.5" opacity="0.95" />
          </pattern>

          {/* Absent Pattern: Dot matrix on rose */}
          <pattern id="attendance-absent-pattern" patternUnits="userSpaceOnUse" width="5" height="5">
            <rect width="5" height="5" fill="#f43f5e" opacity="0.2" />
            <circle cx="2.5" cy="2.5" r="1.3" fill="#f43f5e" opacity="0.9" />
          </pattern>
        </defs>

        {!isEmpty && (
          <ChartTooltip
            content={
              <ChartTooltipContent
                className="min-w-36 gap-2"
                formatter={(value, name) => {
                  const total = chartData.reduce((sum, d) => sum + d.count, 0)
                  const pct = total > 0 ? Math.round((Number(value) / total) * 100) : 0
                  const label = chartConfig[name as keyof typeof chartConfig]?.label || name
                  const color = name === 'present' ? '#10b981' : '#f43f5e'
                  return (
                    <div className="flex w-full items-center justify-between gap-3">
                      <div className="flex items-center gap-1.5">
                        <span className="h-2.5 w-2.5 rounded-[2px]" style={{ backgroundColor: color }} />
                        <span className="text-muted-foreground font-medium">{label}</span>
                      </div>
                      <span className="font-semibold tabular-nums text-foreground">
                        {Number(value)} ({pct}%)
                      </span>
                    </div>
                  )
                }}
              />
            }
          />
        )}

        <Pie
          data={chartData}
          dataKey="count"
          nameKey="status"
          innerRadius={40}
          outerRadius={65}
          cornerRadius={4}
          paddingAngle={isEmpty ? 0 : 3}
          stroke="var(--card)"
          strokeWidth={2.5}
        >
          {chartData.map((entry, idx) => (
            <Cell key={`cell-${idx}`} fill={entry.fill} />
          ))}
        </Pie>
      </PieChart>
    </ChartContainer>
  )
}
