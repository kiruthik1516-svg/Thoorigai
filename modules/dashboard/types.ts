export type DashboardSummary = {
  studentCount: number
  revenuePaise: number
  /** CGST + SGST recorded on payments (F-18: reported separately from fee revenue). */
  gstCollectedPaise?: number
  outstandingPaise: number
  eligibleCount: number
  monthlyRevenuePaise: number
  courseMix: { course: string; studentCount: number }[]
}
