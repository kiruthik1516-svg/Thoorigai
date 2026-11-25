import { paiseToRupees } from '@/lib/money'

export type LedgerRow = {
  id: unknown
  amount: unknown
  payment_date: unknown
  instance_number: unknown
  created_at: unknown
  cancelled_at?: unknown
}

/**
 * Rupees still due once `paymentId` and every earlier payment of the student are counted.
 * Other cancelled payments never count; a cancelled invoice still shows the balance it was issued with.
 */
export function balanceAfterPayment(
  paymentId: string,
  ledger: LedgerRow[],
  student: { total: unknown; paid: unknown },
) {
  const ordered = ledger
    .filter((row) => !row.cancelled_at || String(row.id) === paymentId)
    .sort(
      (a, b) =>
        String(a.payment_date ?? '').localeCompare(String(b.payment_date ?? '')) ||
        Number(a.instance_number ?? 0) - Number(b.instance_number ?? 0) ||
        String(a.created_at ?? '').localeCompare(String(b.created_at ?? '')) ||
        String(a.id).localeCompare(String(b.id)),
    )
  const index = ordered.findIndex((row) => String(row.id) === paymentId)
  const paidThrough =
    index === -1
      ? Number(student.paid)
      : ordered.slice(0, index + 1).reduce((sum, row) => sum + Number(row.amount ?? 0), 0)
  return paiseToRupees(Math.max(0, Number(student.total) - paidThrough))
}
