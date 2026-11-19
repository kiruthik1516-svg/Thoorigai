'use client'

import { useState, useMemo, useRef, useEffect } from 'react'
import { cn } from '@/lib/utils'
import { Area, Label } from 'recharts'
import type { Course } from '@/lib/types'

function getCourseShortName(name: string): string {
  const clean = name
    .replace(/^[-–—\s]+/, '')
    .replace(/^ThoorigAI\s+/i, '')
    .replace(/\s+Course$/i, '')
    .trim()
  if (clean.length <= 14) return clean
  if (/data science/i.test(clean) || /ai/i.test(clean)) return 'AI & DS'
  if (/full\s*stack/i.test(clean)) return 'Full Stack'
  return clean.slice(0, 12) + '…'
}

type CourseEnrollmentChartProps = {
  courseCounts: Record<string, number>
  totalStudents: number
}

export function CourseEnrollmentChart({ courseCounts, totalStudents }: CourseEnrollmentChartProps) {
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null)
  const [displayValue, setDisplayValue] = useState<number | null>(null)
  const [isHovering, setIsHovering] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)

  const courses = useMemo(() => {
    return Object.entries(courseCounts)
      .sort((a, b) => b[1] - a[1])
      .map(([name, count]) => {
        const shortName = getCourseShortName(name)
        const sharePct = totalStudents > 0 ? Math.round((count / totalStudents) * 100) : 0
        return {
          name,
          shortName,
          count,
          sharePct,
        }
      })
  }, [courseCounts, totalStudents])

  const maxValue = useMemo(() => Math.max(...courses.map((c) => c.count), 1), [courses])

  useEffect(() => {
    if (hoveredIndex !== null && courses[hoveredIndex]) {
      setDisplayValue(courses[hoveredIndex].count)
    }
  }, [hoveredIndex, courses])

  const handleContainerEnter = () => setIsHovering(true)
  const handleContainerLeave = () => {
    setIsHovering(false)
    setHoveredIndex(null)
    setTimeout(() => {
      setDisplayValue(null)
    }, 150)
  }

  const activeCourse = hoveredIndex !== null ? courses[hoveredIndex] : null

  if (courses.length === 0) {
    return <p className="empty-note">No course enrollment data in this period.</p>
  }

  return (
    <div
      ref={containerRef}
      onMouseEnter={handleContainerEnter}
      onMouseLeave={handleContainerLeave}
      className="group relative w-full p-4 sm:p-5 rounded-2xl bg-[var(--card)] border border-[var(--border)] transition-all duration-500 hover:border-[var(--g5)] flex flex-col gap-4 overflow-hidden"
    >
      {/* Header */}
      <div className="flex items-center justify-end mb-1">
        <div className="relative h-7 flex items-center">
          {activeCourse ? (
            <div className="flex items-center gap-1.5 animate-fadeIn">
              <span className="text-xs font-medium text-[var(--mute)] max-w-[120px] sm:max-w-[180px] truncate">
                {activeCourse.shortName}:
              </span>
              <span className="text-base sm:text-lg font-bold font-mono text-[var(--ink)] tabular-nums">
                {activeCourse.count}
                <span className="text-xs font-normal text-[var(--mute)] ml-0.5">std</span>
              </span>
              <span
                className="text-[10px] font-bold px-1.5 py-0.5 rounded-full border border-[var(--g5)] text-[var(--g1b)]"
                style={{ background: 'linear-gradient(135deg, var(--g4) 0%, var(--panel) 100%)' }}
              >
                {activeCourse.sharePct}%
              </span>
            </div>
          ) : (
            <div className="flex items-center gap-1.5 text-xs text-[var(--mute)]">
              <span>Total Cohort:</span>
              <span className="text-base font-bold font-mono text-[var(--ink)] tabular-nums">{totalStudents}</span>
              <span className="text-xs">std</span>
            </div>
          )}
        </div>
      </div>

      {/* Interactive Bar Chart Area */}
      <div className="relative h-44 w-full pt-4 pb-8 flex items-end">
        {/* Dashed background guidelines */}
        <div className="absolute inset-x-0 top-4 bottom-8 flex flex-col justify-between pointer-events-none">
          <div className="border-b border-dashed border-[var(--border)] w-full relative">
            <span className="absolute right-0 -top-4 text-[10px] font-mono text-[var(--mute)]">{maxValue} std</span>
          </div>
          <div className="border-b border-dashed border-[var(--border)] w-full relative">
            <span className="absolute right-0 -top-4 text-[10px] font-mono text-[var(--mute)]">
              {Math.max(1, Math.round(maxValue / 2))} std
            </span>
          </div>
          <div className="border-b border-dashed border-[var(--border)] w-full relative">
            <span className="absolute right-0 -top-4 text-[10px] font-mono text-[var(--mute)]">0</span>
          </div>
        </div>

        {/* Bars */}
        <div className="relative z-10 w-full h-full flex items-end justify-around gap-2 sm:gap-3 px-1">
          {courses.map((item, index) => {
            const heightPx = Math.max(22, Math.round((item.count / maxValue) * 105))
            const isHovered = hoveredIndex === index
            const isAnyHovered = hoveredIndex !== null
            const isNeighbor = hoveredIndex !== null && (index === hoveredIndex - 1 || index === hoveredIndex + 1)

            return (
              <div
                key={item.name}
                className="relative flex-1 flex flex-col items-center justify-end h-full"
                onMouseEnter={() => setHoveredIndex(index)}
              >
                {/* Count badge on top of bar */}
                <span
                  className={cn(
                    'text-[10px] font-bold font-mono mb-1.5 transition-all duration-300',
                    isHovered ? 'text-[var(--g1b)] scale-110' : 'text-[var(--mute)]',
                  )}
                >
                  {item.count}
                </span>

                {/* Pill-shaped Bar */}
                <div
                  className={cn(
                    'w-full max-w-[34px] sm:max-w-[42px] rounded-full cursor-pointer transition-all duration-300 ease-out origin-bottom',
                  )}
                  style={{
                    height: `${heightPx}px`,
                    background: isHovered
                      ? 'linear-gradient(180deg, var(--g1) 0%, var(--g1b) 100%)'
                      : isNeighbor
                        ? 'var(--g1)'
                        : isAnyHovered
                          ? 'var(--g1)'
                          : 'linear-gradient(180deg, var(--g1) 0%, var(--g3) 100%)',
                    opacity: isHovered ? 1 : isNeighbor ? 0.6 : isAnyHovered ? 0.2 : 0.85,
                    boxShadow: isHovered ? '0 0 16px var(--g4)' : 'none',
                    transform: isHovered ? 'scaleX(1.15) scaleY(1.03)' : isNeighbor ? 'scaleX(1.05)' : 'scaleX(1)',
                  }}
                />

                {/* Label under bar */}
                <span
                  className={cn(
                    'absolute -bottom-6 w-full text-[10px] font-medium text-center truncate transition-all duration-300 select-none',
                    isHovered ? 'text-[var(--g1b)] font-bold' : 'text-[var(--mute)]',
                  )}
                  title={item.name}
                >
                  {item.shortName}
                </span>

                {/* Floating Tooltip */}
                <div
                  className={cn(
                    'absolute -top-12 left-1/2 -translate-x-1/2 px-2.5 py-1.5 rounded-xl bg-[var(--card)] border border-[var(--border)] shadow-xl text-xs font-medium transition-all duration-200 whitespace-nowrap z-30 pointer-events-none flex flex-col items-center gap-0.5',
                    isHovered
                      ? 'opacity-100 translate-y-0 scale-100'
                      : 'opacity-0 translate-y-2 scale-95 pointer-events-none',
                  )}
                >
                  <span className="text-[11px] font-bold text-[var(--ink)]">{item.name}</span>
                  <span className="text-[10px] text-[var(--g1b)] font-mono font-semibold">
                    {item.count} std ({item.sharePct}%)
                  </span>
                </div>
              </div>
            )
          })}
        </div>
      </div>

      {/* Subtle glow effect on hover */}
      <div className="absolute inset-0 rounded-2xl bg-gradient-to-b from-[var(--g4)]/15 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none" />
    </div>
  )
}
