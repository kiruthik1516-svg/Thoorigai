import { ArrowLeft, Ban, Printer, Plus, RefreshCw } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { apiErrorMessage } from '@/lib/api/error-message'
import { Button } from '@/components/ui/button'
import type { Course, Payment, Student } from '@/lib/types'
import { money } from '@/lib/formatters'
import { amountInWords, calculateGstExclusive, calculateGstInclusive, paiseToRupees, rupeesToPaise } from '@/lib/money'
import { useEffect, useRef, useState } from 'react'
import { brand } from '@/lib/brand'

const INVOICE_W = 794
const INVOICE_H = 562

const COURSE_OPTIONS = [
  'Full Stack Developer Course - Java',
  'Full Stack Developer Course - Python',
  'Full Stack Developer Course - MERN',
  'Data Science & Machine Learning',
  'Python Programming',
  'Web Design & Development',
  'Android App Development',
  'Digital Marketing',
]

const PAYMENT_TYPES = [
  '1st Part Fees Payment',
  '2nd Part Fees Payment',
  '3rd Part Fees Payment',
  '4th Part Fees Payment',
  'Full Course Fees Payment',
  'Registration Fees',
]

const PAYMENT_MODES = ['Cash', 'Online Transfer', 'UPI', 'Cheque', 'Card']

function genInvSuffix() {
  const now = new Date()
  const mm = String(now.getMonth() + 1).padStart(2, '0')
  const dd = String(now.getDate()).padStart(2, '0')
  const hh = String(now.getHours()).padStart(2, '0')
  const mi = String(now.getMinutes()).padStart(2, '0')
  return mm + dd + hh + mi
}

function todayISO() {
  const today = new Date()
  return (
    today.getFullYear() +
    '-' +
    String(today.getMonth() + 1).padStart(2, '0') +
    '-' +
    String(today.getDate()).padStart(2, '0')
  )
}

function fmtDate(d: string) {
  if (!d) return '—'
  const [y, m, day] = d.split('-')
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
  return day + '-' + months[parseInt(m) - 1] + '-' + y
}

type InvoiceFormState = {
  invoiceNumber: string
  receiptId: string
  date: string
  studentName: string
  mobile: string
  studentId: string
  courseName: string
  courseCustom: string
  paymentType: string
  grossAmount: string
  paymentMode: string
  transactionId: string
}

export function InvoicePrint({
  payment,
  student,
  onBack,
  gstRate: currentGstRate = 18,
  gstin,
  courses,
  balanceAfter,
}: {
  payment: Payment
  student?: Student
  onBack: () => void
  gstRate?: number
  gstin: string | null
  courses?: Course[]
  /** Rupees still due after this payment (printed under the amount in words). */
  balanceAfter?: number
}) {
  const invoiceStudent = student ?? {
    registerId: payment.studentId,
    name: payment.student,
    course: 'Course fee payment',
    batch: payment.date,
    total: payment.amount,
    paid: payment.amount,
    phone: '—',
    status: 'Fully Paid' as const,
  }

  const [form, setForm] = useState<InvoiceFormState>(() => {
    const suff = genInvSuffix()
    const y = new Date().getFullYear()
    return {
      invoiceNumber: payment.invoice || `${brand.invoicePrefix}/${y}/INV${suff}`,
      receiptId: payment.id || `${y}${suff}`,
      date: payment.paymentDate || todayISO(),
      studentName: invoiceStudent.name,
      mobile: invoiceStudent.phone && invoiceStudent.phone !== '—' ? invoiceStudent.phone : '',
      studentId: `TAI-${invoiceStudent.registerId}`,
      courseName: COURSE_OPTIONS.includes(invoiceStudent.course) ? invoiceStudent.course : 'custom',
      courseCustom: COURSE_OPTIONS.includes(invoiceStudent.course) ? '' : invoiceStudent.course,
      paymentType: payment.paymentType || PAYMENT_TYPES[0],
      grossAmount: String(payment.amount),
      paymentMode: PAYMENT_MODES.includes(payment.method) ? payment.method : 'UPI',
      transactionId: '',
    }
  })

  const matchedCourse = courses?.find((c) => c.name === effectiveCourse(form))
  // F-07: a recorded payment carries its own tax treatment and amounts. Use them while the amount
  // is unchanged, so later course or GST-setting edits never alter an issued invoice.
  const usesStoredTax =
    payment.gstInclusive !== undefined &&
    payment.taxableValue !== undefined &&
    payment.grandTotal !== undefined &&
    form.grossAmount === String(payment.amount)
  const isInclusive = usesStoredTax ? Boolean(payment.gstInclusive) : Boolean(matchedCourse?.gstInclusive)

  const gross = parseFloat(form.grossAmount) || 0
  const grossPaise = rupeesToPaise(gross)
  const breakdown = isInclusive
    ? calculateGstInclusive(grossPaise, currentGstRate)
    : calculateGstExclusive(grossPaise, currentGstRate)
  const taxableValue = usesStoredTax ? Number(payment.taxableValue) : paiseToRupees(breakdown.taxablePaise)
  const gstAmount = usesStoredTax
    ? paiseToRupees(rupeesToPaise(payment.cgst ?? 0) + rupeesToPaise(payment.sgst ?? 0))
    : paiseToRupees(breakdown.gstPaise)
  const halfGst = usesStoredTax ? Number(payment.cgst ?? 0) : paiseToRupees(breakdown.cgstPaise)
  const grandTotal = usesStoredTax ? Number(payment.grandTotal) : paiseToRupees(breakdown.totalPaise)
  const gstRate = usesStoredTax ? (payment.gstRate ?? 0) : currentGstRate

  const containerRef = useRef<HTMLElement>(null)
  const [scale, setScale] = useState(1)
  const [qrCode, setQrCode] = useState<string | null>(null)

  useEffect(() => {
    const container = containerRef.current
    if (!container) return
    const observer = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const { width, height } = entry.contentRect
        const scaleX = width / INVOICE_W
        const scaleY = height / INVOICE_H
        setScale(Math.min(scaleX, scaleY, 1))
      }
    })
    observer.observe(container)
    return () => observer.disconnect()
  }, [])

  // Generate QR code when payment verification code changes
  useEffect(() => {
    const generateQRCode = async () => {
      try {
        // For invoices, we need to get the verification code from the payment data
        // Since the InvoicePrint component receives a payment prop, we should check if it has verification_code
        if (payment.verification_code) {
          const verificationUrl = `${brand.verifyBaseUrl}/verify/${payment.verification_code}`
          const QRCode = (await import('qrcode')).default
          const qrCodeDataUrl = await QRCode.toDataURL(verificationUrl, {
            width: 120,
            margin: 1,
          })
          setQrCode(qrCodeDataUrl)
        } else {
          setQrCode(null)
        }
      } catch (err) {
        console.error('Invoice QR generation failed.')
        setQrCode(null)
      }
    }

    generateQRCode()
  }, [payment.verification_code])

  const set = <K extends keyof InvoiceFormState>(key: K, value: InvoiceFormState[K]) =>
    setForm((prev) => ({ ...prev, [key]: value }))

  const resetForm = () => {
    const y = new Date().getFullYear()
    const suff = genInvSuffix()
    setForm((prev) => ({
      ...prev,
      studentName: '',
      mobile: '',
      courseName: COURSE_OPTIONS[0],
      courseCustom: '',
      paymentType: PAYMENT_TYPES[0],
      grossAmount: '',
      transactionId: '',
    }))
  }

  const newInvoice = () => {
    const suff = genInvSuffix()
    const y = new Date().getFullYear()
    setForm({
      invoiceNumber: `${brand.invoicePrefix}/${y}/INV${suff}`,
      receiptId: `${y}${suff}`,
      date: todayISO(),
      studentName: '',
      mobile: '',
      studentId: `${y}/TTK01/CUS${suff}`,
      courseName: COURSE_OPTIONS[0],
      courseCustom: '',
      paymentType: PAYMENT_TYPES[0],
      grossAmount: '',
      paymentMode: 'UPI',
      transactionId: '',
    })
  }

  return (
    <div className="preview-page">
      <div className="preview-layout">
        <aside className="edit-sidebar edit-sidebar-light">
          {/* Back sits in the header row (not above the layout) so the whole form fits without scrolling. */}
          <div className="edit-sidebar-header edit-sidebar-header-light invoice-editor-header">
            <Button variant="secondary" size="sm" onClick={onBack}>
              <ArrowLeft size={16} />
              Back
            </Button>
            <h2 className="edit-form-heading">Invoice Details</h2>
          </div>

          <div className="edit-sidebar-body invoice-editor-body">
            {/* No "Invoice Details" section title: the header above already says it. */}
            <div className="edit-section">
              <div className="edit-row2">
                <label className="edit-label">
                  Invoice Number
                  <input
                    type="text"
                    value={form.invoiceNumber}
                    onChange={(e) => set('invoiceNumber', e.target.value)}
                    className="edit-input edit-input-light"
                  />
                </label>
                <label className="edit-label">
                  Receipt ID
                  <input
                    type="text"
                    value={form.receiptId}
                    onChange={(e) => set('receiptId', e.target.value)}
                    className="edit-input edit-input-light"
                  />
                </label>
              </div>
              <div className="edit-row2">
                <label className="edit-label">
                  Date
                  <input
                    type="date"
                    value={form.date}
                    onChange={(e) => set('date', e.target.value)}
                    className="edit-input edit-input-light"
                  />
                </label>
                <div className="edit-label">
                  GSTIN
                  <div className="edit-input edit-input-light" aria-live="polite">
                    {gstin || 'GSTIN not configured'}
                  </div>
                </div>
              </div>
            </div>

            <div className="edit-section">
              <div className="edit-section-title">Student Details</div>
              <label className="edit-label">
                Student Name
                <input
                  type="text"
                  placeholder="e.g. Bala Dinisha B"
                  value={form.studentName}
                  onChange={(e) => set('studentName', e.target.value)}
                  className="edit-input edit-input-light"
                />
              </label>
              <div className="edit-row2">
                <label className="edit-label">
                  Mobile Number
                  <input
                    type="text"
                    placeholder="9XXXXXXXXX"
                    value={form.mobile}
                    onChange={(e) => set('mobile', e.target.value)}
                    className="edit-input edit-input-light"
                  />
                </label>
                <label className="edit-label">
                  Student ID
                  <input
                    type="text"
                    placeholder="2026/TTK01/CUS06241435"
                    value={form.studentId}
                    onChange={(e) => set('studentId', e.target.value)}
                    className="edit-input edit-input-light"
                  />
                </label>
              </div>
              <div className={form.courseName === 'custom' ? 'edit-row2' : undefined}>
                <label className="edit-label">
                  Course Name
                  <select
                    value={form.courseName}
                    onChange={(e) => set('courseName', e.target.value)}
                    className="edit-input edit-input-light"
                  >
                    {COURSE_OPTIONS.map((c) => (
                      <option key={c} value={c}>
                        {c}
                      </option>
                    ))}
                    <option value="custom">— Type custom course —</option>
                  </select>
                </label>
                {form.courseName === 'custom' && (
                  <label className="edit-label">
                    Custom Course
                    <input
                      type="text"
                      placeholder="Enter course name"
                      value={form.courseCustom}
                      onChange={(e) => set('courseCustom', e.target.value)}
                      className="edit-input edit-input-light"
                    />
                  </label>
                )}
              </div>
            </div>

            <div className="edit-section">
              <div className="edit-section-title">Payment Details</div>
              <div className="edit-row2">
                <label className="edit-label">
                  Payment Type
                  <select
                    value={form.paymentType}
                    onChange={(e) => set('paymentType', e.target.value)}
                    className="edit-input edit-input-light"
                  >
                    {[...new Set([form.paymentType, ...PAYMENT_TYPES])].filter(Boolean).map((t) => (
                      <option key={t} value={t}>
                        {t}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="edit-label">
                  Amount ₹
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    placeholder="5000"
                    value={form.grossAmount}
                    onChange={(e) => set('grossAmount', e.target.value)}
                    className="edit-input edit-input-light"
                  />
                </label>
              </div>
              {gross > 0 && (
                <div className="edit-amount-display edit-amount-inline">
                  <div className="edit-amount-row">
                    <span>{isInclusive ? 'Total (incl. GST)' : 'Gross Amount'}</span>
                    <span>{money(taxableValue)}</span>
                  </div>
                  {gstRate > 0 && (
                    <div className="edit-amount-row">
                      <span>GST ({gstRate}%)</span>
                      <span>{money(gstAmount)}</span>
                    </div>
                  )}
                  <div className="edit-amount-row total">
                    <span>Grand Total</span>
                    <span>{money(grandTotal)}</span>
                  </div>
                </div>
              )}
              <div className="edit-row2">
                <label className="edit-label">
                  Payment Mode
                  <select
                    value={form.paymentMode}
                    onChange={(e) => set('paymentMode', e.target.value)}
                    className="edit-input edit-input-light"
                  >
                    {PAYMENT_MODES.map((m) => (
                      <option key={m} value={m}>
                        {m}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="edit-label">
                  Transaction ID
                  <input
                    type="text"
                    placeholder="(optional)"
                    value={form.transactionId}
                    onChange={(e) => set('transactionId', e.target.value)}
                    className="edit-input edit-input-light"
                  />
                </label>
              </div>
            </div>
          </div>

          <div className="edit-sidebar-actions">
            <div className="edit-actions-row">
              <Button variant="default" className="edit-btn" onClick={() => window.print()}>
                <Printer size={16} className="mr-2" /> Print / PDF
              </Button>
              <Button variant="secondary" className="edit-btn" onClick={newInvoice}>
                <Plus size={16} className="mr-2" /> New
              </Button>
              <Button variant="ghost" className="edit-btn edit-btn-cert-reset" onClick={resetForm}>
                <RefreshCw size={16} className="mr-2" /> Reset
              </Button>
            </div>
            <CancelInvoiceControl payment={payment} />
          </div>
        </aside>

        <main
          className="preview-document-container"
          ref={containerRef}
          style={{ '--scale': scale } as React.CSSProperties}
        >
          <div className="preview-scaler-wrapper ttk-invoice-scaler">
            <div className="preview-scaler-content ttk-invoice-scaler-content">
              <article className="ttk-invoice-paper" id="invoice-paper">
                <InvoiceCopy
                  form={form}
                  taxableValue={taxableValue}
                  gstAmount={gstAmount}
                  halfGst={halfGst}
                  grandTotal={grandTotal}
                  gstRate={gstRate}
                  isInclusive={isInclusive}
                  gstin={gstin}
                  verificationCode={payment.verification_code}
                  qrCode={qrCode}
                  balanceAfter={balanceAfter}
                  cancelled={Boolean(payment.cancelledAt)}
                  copy="Customer Copy"
                />
                <InvoiceCopy
                  form={form}
                  taxableValue={taxableValue}
                  gstAmount={gstAmount}
                  halfGst={halfGst}
                  grandTotal={grandTotal}
                  gstRate={gstRate}
                  isInclusive={isInclusive}
                  gstin={gstin}
                  verificationCode={payment.verification_code}
                  qrCode={qrCode}
                  balanceAfter={balanceAfter}
                  cancelled={Boolean(payment.cancelledAt)}
                  copy="Office Copy"
                />
              </article>
            </div>
          </div>
        </main>
      </div>
    </div>
  )
}

/** Imported opening balances (OPENING-<register id>) were never GST invoices: they print as receipts. */
export function isPaymentReceipt(documentNumber: string) {
  return documentNumber.startsWith('OPENING-')
}

function effectiveCourse(form: InvoiceFormState) {
  return form.courseName === 'custom' ? form.courseCustom : form.courseName
}

function InvoiceCopy({
  form,
  taxableValue,
  gstAmount,
  halfGst,
  grandTotal,
  gstRate,
  isInclusive,
  gstin,
  verificationCode,
  qrCode,
  copy,
  balanceAfter,
  cancelled = false,
}: {
  form: InvoiceFormState
  taxableValue: number
  gstAmount: number
  halfGst: number
  grandTotal: number
  gstRate: number
  isInclusive: boolean
  gstin: string | null
  verificationCode?: string
  qrCode: string | null
  copy: string
  balanceAfter?: number
  cancelled?: boolean
}) {
  const course = effectiveCourse(form) || '—'
  return (
    <section className="ttk-invoice-copy" style={cancelled ? { position: 'relative' } : undefined}>
      {cancelled && (
        <div
          aria-label="This invoice is cancelled"
          style={{
            position: 'absolute',
            inset: 0,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            pointerEvents: 'none',
            zIndex: 5,
          }}
        >
          <span
            style={{
              transform: 'rotate(-18deg)',
              border: '4px solid #b91c1c',
              color: '#b91c1c',
              padding: '4px 18px',
              fontSize: 44,
              fontWeight: 800,
              letterSpacing: 6,
              opacity: 0.55,
            }}
          >
            CANCELLED
          </span>
        </div>
      )}
      <div className="ttk-invoice-top">
        <div>
          <h2>
            {isPaymentReceipt(form.invoiceNumber) ? 'PAYMENT RECEIPT' : 'INVOICE'} - {form.invoiceNumber || '—'}
            {cancelled ? ' (CANCELLED)' : ''}
          </h2>
          <span>Receipt ID - [ {form.receiptId || '—'} ]</span>
        </div>
        {/* Copy label with the verification QR centred below it, out of the flow so it adds no height. */}
        <div className="ttk-copy-col">
          <b>{copy}</b>
          {verificationCode &&
            (qrCode ? (
              <img className="ttk-invoice-qr" src={qrCode} alt="Verification QR code for this invoice" />
            ) : (
              <div className="ttk-invoice-qr" />
            ))}
        </div>
      </div>
      <header className="ttk-invoice-brand">
        <div className="ttk-invoice-logo">
          <img src={brand.logoPath} alt={brand.shortName} />
        </div>
        <div>
          <h1>{brand.legalName}</h1>
          <p>127, Ettayapuram Road, Melur Tuticorin, Tamil Nadu - 628002</p>
          <p>Phone: 9244575008 | {brand.tagline}</p>
          <strong>GST No: {gstin || 'GSTIN not configured'}</strong>
        </div>
      </header>
      <div className="ttk-invoice-meta">
        <span>
          <b>Customer:</b> {form.studentName || '—'}
        </span>
        <span>
          <b>Mobile:</b> {form.mobile || '—'}
        </span>
        <span>
          <b>ID:</b> {form.studentId || '—'}
        </span>
        <span>
          <b>Date:</b> {fmtDate(form.date)}
        </span>
      </div>
      <p className="ttk-course-line">
        <b>Course:</b> {course}
      </p>
      <div className="ttk-invoice-grid">
        <table>
          <thead>
            <tr>
              <th>S.No</th>
              <th>Particular</th>
              <th>Amount</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>1</td>
              <td>{form.paymentType || 'Course fee payment'}</td>
              <td>{money(taxableValue)}</td>
            </tr>
            {gstRate > 0 && (
              <>
                <tr className="ttk-gst-row">
                  <td />
                  <td>CGST ({gstRate / 2}%)</td>
                  <td>{money(halfGst)}</td>
                </tr>
                <tr className="ttk-gst-row">
                  <td />
                  <td>SGST ({gstRate / 2}%)</td>
                  <td>{money(gstAmount - halfGst)}</td>
                </tr>
              </>
            )}
            <tr className="ttk-total-row">
              <td />
              <td>Grand Total</td>
              <td>{money(grandTotal)}</td>
            </tr>
          </tbody>
        </table>
        <div className="ttk-payment-aside">
          <span>Payment Mode</span>
          <strong>{form.paymentMode || '—'}</strong>
          <span>Transaction ID</span>
          <strong>{form.transactionId || form.receiptId || '—'}</strong>
        </div>
      </div>
      <p className="ttk-amount-words">{grandTotal > 0 ? amountInWords(rupeesToPaise(grandTotal)) : '—'}</p>
      {balanceAfter !== undefined && (
        <p className="ttk-balance-due">
          Balance to be paid: <b>{balanceAfter > 0 ? money(balanceAfter) : 'Nil (course fees fully paid)'}</b>
        </p>
      )}
      <div className="ttk-invoice-footer">
        <div className="ttk-invoice-terms">
          <b>Terms &amp; Conditions</b>
          <ol>
            {gstRate > 0 ? (
              isInclusive ? (
                <li>Course fee is inclusive of GST ({gstRate}%).</li>
              ) : (
                <li>GST ({gstRate}%) is charged on top of the base course fee.</li>
              )
            ) : (
              <li>No GST applicable on this {isPaymentReceipt(form.invoiceNumber) ? 'receipt' : 'invoice'}.</li>
            )}
            <li>Students must pay the full fees before completing the course.</li>
            <li>Agreed instalment dates help students complete the course on schedule.</li>
            <li>Registration fees are non-refundable once paid.</li>
            <li>Refunds are not allowed under normal circumstances.</li>
          </ol>
        </div>
        <div className="ttk-authorized">Authorized Signature</div>
      </div>
    </section>
  )
}

/** Cancelling keeps the invoice number on record; it stops counting toward paid and revenue. */
function CancelInvoiceControl({ payment }: { payment: Payment }) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [reason, setReason] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  if (!payment.id || !payment.invoice) return null
  if (payment.cancelledAt) {
    return (
      <p role="status" className="mt-2 text-xs font-semibold text-red-700">
        Cancelled on{' '}
        {new Date(payment.cancelledAt).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}
        {payment.cancelReason ? `: ${payment.cancelReason}` : ''}
      </p>
    )
  }
  if (!open) {
    return (
      <Button variant="ghost" size="sm" className="mt-2 text-red-700" onClick={() => setOpen(true)}>
        <Ban size={14} className="mr-1" /> Cancel this invoice
      </Button>
    )
  }

  const submit = async () => {
    setBusy(true)
    setError(null)
    try {
      const res = await fetch('/api/payments/cancel', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ paymentId: payment.id, reason }),
      })
      if (!res.ok) throw new Error(apiErrorMessage(await res.json().catch(() => null), 'Could not cancel the invoice.'))
      setOpen(false)
      router.refresh()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not cancel the invoice.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="mt-2 space-y-2">
      <label className="edit-label">
        Reason for cancelling
        <textarea
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          rows={2}
          maxLength={500}
          className="edit-input edit-input-light"
          placeholder="e.g. Entered twice"
        />
      </label>
      <p className="text-[11px] text-gray-500">
        The invoice keeps its number and stays on record marked cancelled. It no longer counts toward the student&apos;s
        paid amount or revenue, and its QR code stops verifying. This cannot be undone.
      </p>
      {error && (
        <p role="alert" className="text-xs text-red-700">
          {error}
        </p>
      )}
      <div className="flex gap-2">
        <Button variant="default" size="sm" disabled={busy || reason.trim().length < 3} onClick={submit}>
          {busy ? 'Cancelling…' : 'Confirm cancel'}
        </Button>
        <Button variant="secondary" size="sm" disabled={busy} onClick={() => setOpen(false)}>
          Keep invoice
        </Button>
      </div>
    </div>
  )
}
