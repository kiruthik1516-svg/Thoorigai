import { useCallback, useEffect, useRef, useState } from 'react'
import { useDialog } from '@/lib/hooks/useDialog'
import { createPortal } from 'react-dom'
import { useRouter, useSearchParams } from 'next/navigation'
import { ArrowLeft, CheckCircle2, FileCheck2, FileText, Pencil, Printer, Receipt, Trash2, X } from 'lucide-react'
import { apiErrorMessage } from '@/lib/api/error-message'
import { EditStudentModal } from './student-detail/EditStudentModal'
import { Button } from '@/components/ui/button'
import type { Course, Payment, Receipt as ReceiptType, Student, Role } from '@/lib/types'
import { differenceRupees } from '@/lib/money'
import { StudentPrintDossier } from './StudentPrintDossier'
import type { AssessmentRecord, AttendanceRecord } from './student-detail/model'
import { StudentProfileHero } from './student-detail/StudentProfileHero'
import { StudentFeeSummary } from './student-detail/StudentFeeSummary'
import { AttendancePanel } from './student-detail/AttendancePanel'
import { AcademicsPanel } from './student-detail/AcademicsPanel'

export function StudentDetail({
  student,
  payments,
  onBack,
  onPayment: _onPayment,
  onCertificate,
  onInvoice,
  gstRate = 18,
  courses,
  canRecordPayment = true,
  role = 'admin',
  attendance = [],
  assessments = [],
  certificateVerificationCode = null,
}: {
  student: Student
  payments: Payment[]
  onBack: () => void
  onPayment?: (amount: number, method: string, paymentType?: string) => Promise<ReceiptType | string>
  onCertificate: () => void
  onInvoice?: (p: Payment) => void
  gstRate?: number
  courses?: Course[]
  canRecordPayment?: boolean
  role?: Role
  attendance?: AttendanceRecord[]
  assessments?: AssessmentRecord[]
  /** Active verification code of the student's latest certificate (admin only). */
  certificateVerificationCode?: string | null
}) {
  const isStaff = role === 'staff' || Boolean(student.moneyHidden)
  const balance = differenceRupees(student.total, student.paid)
  const history = payments.filter((p) => p.studentId === student.registerId)

  // Celebration banner when redirected from /invoices/record
  const searchParams = useSearchParams()
  const isPaymentSuccess = searchParams?.get('paymentSuccess') === 'true'
  const successInvoice = searchParams?.get('invoice')
  const [showSuccessBanner, setShowSuccessBanner] = useState(true)

  const matchedCourse = courses?.find(
    (c) => c.name.toLowerCase().trim() === (student.course || '').toLowerCase().trim(),
  )
  const categoryName = matchedCourse?.categoryName
  const courseDuration = matchedCourse?.duration

  const router = useRouter()
  const [editing, setEditing] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const isAdmin = role === 'admin'
  const deleteStudent = async () => {
    if (
      !window.confirm(
        `Delete ${student.name} (TAI-${student.registerId})? Their attendance and scores are removed too. Students with invoices or certificates cannot be deleted.`,
      )
    )
      return
    setDeleting(true)
    try {
      const res = await fetch(`/api/students?registerId=${student.registerId}`, { method: 'DELETE' })
      if (!res.ok) throw new Error(apiErrorMessage(await res.json().catch(() => null), 'Could not delete the student.'))
      router.push('/students')
      router.refresh()
    } catch (err) {
      window.alert(err instanceof Error ? err.message : 'Could not delete the student.')
    } finally {
      setDeleting(false)
    }
  }

  const [showPrintPreviewModal, setShowPrintPreviewModal] = useState(false)
  const printPreviewRef = useRef<HTMLDivElement>(null)
  const closePrintPreview = useCallback(() => setShowPrintPreviewModal(false), [])
  useDialog(showPrintPreviewModal, closePrintPreview, printPreviewRef)
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
  }, [])

  const handlePrint = () => {
    document.body.classList.add('printing-student-dossier')
    window.print()
  }

  useEffect(() => {
    const handleAfterPrint = () => {
      document.body.classList.remove('printing-student-dossier')
    }
    window.addEventListener('afterprint', handleAfterPrint)
    return () => {
      window.removeEventListener('afterprint', handleAfterPrint)
    }
  }, [])

  return (
    <>
      {/* ─── SCREEN INTERACTIVE VIEW (Hidden during print) ─── */}
      <div className="print:hidden space-y-8 pb-12">
        {/* Top Action Bar */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <button
            type="button"
            className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-500 hover:text-slate-900 transition-colors cursor-pointer"
            onClick={onBack}
          >
            <ArrowLeft size={16} />
            <span>Back to Students Roster</span>
          </button>

          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setEditing(true)}
              className="text-xs font-semibold shadow-xs"
              title="Edit this student's details"
            >
              <Pencil size={15} />
              <span className="ml-1.5 hidden sm:inline">Edit</span>
            </Button>
            {isAdmin && (
              <Button
                variant="outline"
                size="sm"
                onClick={deleteStudent}
                disabled={deleting}
                className="text-xs font-semibold text-red-700 shadow-xs"
                title="Delete a student who has no invoices or certificates"
              >
                <Trash2 size={15} />
                <span className="ml-1.5 hidden sm:inline">{deleting ? 'Deleting…' : 'Delete'}</span>
              </Button>
            )}
            <Button
              variant="outline"
              size="sm"
              onClick={handlePrint}
              className="text-xs font-semibold shadow-xs"
              title="Print official academic and financial transcript"
            >
              <Printer size={15} />
              <span className="ml-1.5 hidden sm:inline">Print Profile</span>
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowPrintPreviewModal(true)}
              className="text-xs text-slate-700 hover:text-slate-900 shadow-xs"
              title="Preview printable A4 PDF dossier on screen"
            >
              <FileText size={15} />
              <span className="ml-1.5 hidden sm:inline">Preview PDF</span>
            </Button>
            {!isStaff && !student.moneyHidden && student.total > 0 && balance === 0 && (
              <Button
                variant="default"
                size="sm"
                onClick={onCertificate}
                className="text-xs font-semibold bg-emerald-600 hover:bg-emerald-700 text-white shadow-xs"
              >
                <FileCheck2 size={15} />
                <span className="ml-1.5">Certificate</span>
              </Button>
            )}
          </div>
        </div>

        {/* Payment Success Celebration Banner */}
        {isPaymentSuccess && showSuccessBanner && (
          <div className="p-4 rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-950 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-xs animate-in fade-in duration-200">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-xl bg-emerald-100 text-emerald-700 shrink-0">
                <CheckCircle2 size={20} />
              </div>
              <div>
                <strong className="text-xs font-bold block text-emerald-950">Payment Recorded Successfully!</strong>
                <p className="text-xs text-emerald-800">
                  {successInvoice
                    ? `Verified tax invoice #${successInvoice} has been issued and posted to the financial ledger.`
                    : 'Fee installment has been successfully credited to this student account.'}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              {successInvoice && onInvoice && (
                <Button
                  variant="default"
                  size="sm"
                  onClick={() =>
                    onInvoice({
                      id: successInvoice,
                      student: student.name,
                      method: 'Ledger',
                      date: new Date().toLocaleDateString('en-IN'),
                      amount: 0,
                      invoice: successInvoice,
                      studentId: student.registerId,
                    })
                  }
                  className="text-xs font-bold bg-emerald-600 hover:bg-emerald-700 text-white cursor-pointer"
                >
                  <Receipt size={14} className="mr-1.5" />
                  <span>View Invoice</span>
                </Button>
              )}
              <button
                type="button"
                onClick={() => setShowSuccessBanner(false)}
                className="p-1 rounded-lg hover:bg-emerald-100 text-emerald-600 cursor-pointer"
                aria-label="Dismiss banner"
              >
                <X size={16} />
              </button>
            </div>
          </div>
        )}

        <StudentProfileHero
          student={student}
          balance={balance}
          categoryName={categoryName}
          courseDuration={courseDuration}
          isStaff={isStaff}
          canRecordPayment={canRecordPayment}
        />

        {/* ─── FEE SUMMARY & PAYMENT HISTORY ─── */}
        {!isStaff && (
          <StudentFeeSummary
            student={student}
            history={history}
            balance={balance}
            gstRate={gstRate}
            isStaff={isStaff}
            canRecordPayment={canRecordPayment}
            onCertificate={onCertificate}
            onInvoice={onInvoice}
          />
        )}

        {editing && (
          <EditStudentModal
            student={student}
            courses={courses ?? []}
            canEditFee={isAdmin && !student.moneyHidden}
            onClose={() => setEditing(false)}
          />
        )}

        {/* ─── CLASSROOM ATTENDANCE ─── */}
        <AttendancePanel student={student} attendance={attendance} />

        {/* ─── ACADEMIC ASSESSMENTS & MATERIALS ─── */}
        <AcademicsPanel student={student} assessments={assessments} />
      </div>

      {/* ─── OFFICIAL PRINT DOSSIER PORTAL (Directly mounted on document.body for multi-page isolation) ─── */}
      {mounted &&
        createPortal(
          <div id="student-dossier-print-portal" className="student-dossier-print-portal">
            <StudentPrintDossier
              student={student}
              payments={payments}
              attendance={attendance}
              assessments={assessments}
              categoryName={categoryName}
              courseDuration={courseDuration}
              gstRate={gstRate}
              isPortalPrint={true}
              certificateVerificationCode={certificateVerificationCode}
            />
          </div>,
          document.body,
        )}

      {/* ─── ON-SCREEN PDF PREVIEW MODAL ─── */}
      {showPrintPreviewModal && (
        <div
          ref={printPreviewRef}
          role="dialog"
          aria-modal="true"
          aria-labelledby="print-preview-modal-title"
          className="print:hidden fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-xs flex flex-col items-center justify-start p-4 sm:p-6 overflow-y-auto"
        >
          {/* Top Modal Controls */}
          <div className="w-full max-w-4xl bg-slate-900 text-white rounded-t-2xl px-5 py-3.5 flex items-center justify-between border-b border-slate-800 shadow-lg sticky top-0 z-10">
            <div className="flex items-center gap-2">
              <FileText size={18} className="text-emerald-400" />
              <div>
                <h3 id="print-preview-modal-title" className="text-sm font-bold tracking-tight">
                  Academic &amp; Financial Dossier Preview
                </h3>
                <p className="text-[11px] text-slate-400">A4 Structured Multi-Page PDF Document for {student.name}</p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <Button
                type="button"
                variant="default"
                size="sm"
                onClick={handlePrint}
                className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs shadow-xs"
              >
                <Printer size={15} className="mr-1.5" />
                Print / Save PDF
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => setShowPrintPreviewModal(false)}
                className="text-slate-400 hover:text-white hover:bg-slate-800"
                aria-label="Close Preview"
              >
                <X size={18} />
              </Button>
            </div>
          </div>

          {/* Dossier Document Paper */}
          <div className="w-full max-w-4xl bg-slate-100 p-4 sm:p-8 rounded-b-2xl shadow-2xl border border-slate-700/50 mb-12">
            <div className="bg-white rounded-xl shadow-md border border-slate-200 overflow-hidden">
              <StudentPrintDossier
                student={student}
                payments={payments}
                attendance={attendance}
                assessments={assessments}
                categoryName={categoryName}
                courseDuration={courseDuration}
                gstRate={gstRate}
                certificateVerificationCode={certificateVerificationCode}
              />
            </div>
          </div>
        </div>
      )}
    </>
  )
}
