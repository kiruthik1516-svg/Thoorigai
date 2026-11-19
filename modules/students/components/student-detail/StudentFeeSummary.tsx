import type { Payment, Student } from '@/lib/types'
import { ArrowRight, CheckCircle2, CircleDollarSign, FileCheck2 } from 'lucide-react'
import Link from 'next/link'
import { Button, buttonVariants } from '@/components/ui/button'
import { money } from '@/lib/formatters'
import { Status } from '@/components/Status'
import { PaymentsTable } from '@/components/shared/PaymentsTable'
import { percentageOfRupees } from '@/lib/money'

export function StudentFeeSummary({
  student,
  history,
  balance,
  gstRate,
  isStaff,
  canRecordPayment,
  onCertificate,
  onInvoice,
}: {
  student: Student
  /** This student's payments. */
  history: Payment[]
  balance: number
  gstRate: number
  isStaff: boolean
  canRecordPayment: boolean
  onCertificate: () => void
  onInvoice?: (p: Payment) => void
}) {
  return (
    <section aria-labelledby="section-fees-heading" className="space-y-4">
      <div className="flex items-center justify-between pb-3 border-b border-slate-200">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-xl bg-emerald-50 text-emerald-700 border border-emerald-200/80">
            <CircleDollarSign size={20} />
          </div>
          <div>
            <h2 id="section-fees-heading" className="text-base font-bold text-slate-900 tracking-tight">
              Fee Summary & Payment History
            </h2>
            <p className="text-xs text-slate-500">Live account balance, installment milestones, and tax invoices</p>
          </div>
        </div>

        {canRecordPayment && balance > 0 && (
          <Link
            href={`/invoices/record?studentId=${student.registerId}`}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700 shadow-xs transition-colors shrink-0"
          >
            <CircleDollarSign size={15} />
            <span>Record Payment</span>
          </Link>
        )}
      </div>

      {/* Fee Summary Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Balance Hero Card */}
        <div className="p-5 rounded-2xl bg-white border border-slate-200/90 shadow-xs flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div>
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 block">
                  Account Balance
                </span>
                <h3 className="text-sm font-bold text-slate-900">Live Fee Status</h3>
              </div>
              <Status status={student.status} />
            </div>

            <div className="py-4 text-center">
              <span className="text-xs uppercase tracking-wider font-semibold text-slate-400 block mb-1">
                {balance === 0 ? 'All Fees Cleared' : 'Outstanding Dues'}
              </span>
              <div className={`text-3xl font-extrabold ${balance === 0 ? 'text-emerald-600' : 'text-amber-600'}`}>
                {money(balance)}
              </div>

              <div className="mt-4 px-2">
                <div className="h-2.5 w-full rounded-full bg-slate-100 overflow-hidden">
                  <div
                    className="h-full bg-emerald-500 rounded-full transition-all duration-500"
                    style={{ width: `${percentageOfRupees(student.paid, student.total)}%` }}
                  />
                </div>
                <div className="flex justify-between items-center text-xs text-slate-500 mt-2 font-medium">
                  <span>
                    Paid: <strong className="text-slate-900">{money(student.paid)}</strong>
                  </span>
                  <span>
                    Total: <strong className="text-slate-900">{money(student.total)}</strong>
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Billing Info & Action Card */}
        <div className="p-5 rounded-2xl bg-white border border-slate-200/90 shadow-xs flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div>
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 block">
                  Ledger Overview
                </span>
                <h3 className="text-sm font-bold text-slate-900">Financial Status</h3>
              </div>
              <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-slate-100 text-slate-700">
                GST Rate: {gstRate}%
              </span>
            </div>

            <div className="py-3 text-xs space-y-2.5 text-slate-600">
              <div className="flex justify-between">
                <span>Curriculum Course:</span>
                <strong className="text-slate-900 font-semibold">{student.course}</strong>
              </div>
              <div className="flex justify-between">
                <span>Recorded Payments:</span>
                <strong className="text-slate-900 font-semibold">
                  {history.length} installment{history.length === 1 ? '' : 's'}
                </strong>
              </div>
              <div className="flex justify-between">
                <span>Settlement Progress:</span>
                <strong className="text-emerald-700 font-semibold">
                  {percentageOfRupees(student.paid, student.total)}% Complete
                </strong>
              </div>
            </div>
          </div>

          <div className="pt-3 border-t border-slate-100">
            {canRecordPayment && balance > 0 ? (
              <Link
                href={`/invoices/record?studentId=${student.registerId}`}
                className="w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700 shadow-xs transition-colors"
              >
                <CircleDollarSign size={16} />
                <span>Record Payment ({money(balance)} Due)</span>
                <ArrowRight size={14} className="ml-1" />
              </Link>
            ) : balance === 0 ? (
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-emerald-50/80 p-3 rounded-xl border border-emerald-200">
                <div className="flex items-center gap-2 flex-wrap text-emerald-800 text-xs font-semibold">
                  <CheckCircle2 size={16} className="text-emerald-600 shrink-0" />
                  <span>Account settled in full</span>
                  <span className="text-emerald-400 font-normal">•</span>
                  <span className="text-emerald-700 font-medium">Eligible for certificate</span>
                </div>
                <Button
                  variant="default"
                  size="sm"
                  onClick={onCertificate}
                  className="text-xs font-bold bg-emerald-600 hover:bg-emerald-700 text-white shrink-0 shadow-xs"
                >
                  <FileCheck2 size={14} className="mr-1.5" />
                  Generate Certificate
                </Button>
              </div>
            ) : (
              <p className="text-xs text-slate-400 italic">No outstanding actions required.</p>
            )}
          </div>
        </div>
      </div>

      {/* Payment History Table */}
      <div className="panel mt-4">
        <div className="panel-header">
          <div>
            <h2>Payment history</h2>
            <p>
              {history.length} payment{history.length === 1 ? '' : 's'} · Most recent first
            </p>
          </div>
          {canRecordPayment && balance > 0 && (
            <Link
              href={`/invoices/record?studentId=${student.registerId}`}
              className={buttonVariants({ variant: 'outline', size: 'sm', className: 'text-xs font-semibold' })}
            >
              <CircleDollarSign size={14} className="mr-1.5 text-emerald-600" />
              Record Payment
            </Link>
          )}
        </div>
        <PaymentsTable payments={history} onInvoice={onInvoice} />
      </div>
    </section>
  )
}
