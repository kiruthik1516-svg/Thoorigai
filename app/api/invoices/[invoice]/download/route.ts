import { PDFDocument, rgb } from 'pdf-lib'
import fontkit from '@pdf-lib/fontkit'
import { readFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import { NextResponse } from 'next/server'
import type { SupabaseClient } from '@supabase/supabase-js'
import { paymentFromRow, studentFromRow } from '@/lib/server-data'
import { unexpectedApiError } from '@/lib/api-response'
import QRCode from 'qrcode'
import { brand } from '@/lib/brand'
import { formatINR, rupeesToPaise } from '@/lib/money'
import { rolesFor } from '@/lib/auth/permissions'
import { withApi } from '@/lib/http/handler'
import { z } from 'zod'
import { createHash } from 'node:crypto'
import { getSupabaseAdminClient } from '@/lib/supabase/admin'
import { balanceAfterPayment } from '@/modules/payments/balance'
import { logger } from '@/lib/logger'

export const runtime = 'nodejs'
export const maxDuration = 15

// F-33: bump whenever the PDF layout or tax presentation changes, so cached copies are regenerated.
const INVOICE_TEMPLATE_VERSION = '2026-11-23.2'

async function getCachedPdf(cachePath: string): Promise<Uint8Array | null> {
  try {
    const { data, error } = await getSupabaseAdminClient().storage.from('invoice-pdf-cache').download(cachePath)
    if (error) {
      if (error.statusCode !== '404') {
        logger.warn({ operation: 'download' }, 'Invoice PDF cache unavailable')
      }
      return null
    }
    return data ? new Uint8Array(await data.arrayBuffer()) : null
  } catch {
    logger.warn({ operation: 'download' }, 'Invoice PDF cache unavailable')
    return null
  }
}

async function storeCachedPdf(cachePath: string, bytes: Uint8Array): Promise<void> {
  try {
    const { error } = await getSupabaseAdminClient().storage.from('invoice-pdf-cache').upload(cachePath, bytes, {
      contentType: 'application/pdf',
      cacheControl: '31536000',
      upsert: true,
    })
    if (error) logger.warn({ operation: 'upload' }, 'Invoice PDF cache unavailable')
  } catch {
    logger.warn({ operation: 'upload' }, 'Invoice PDF cache unavailable')
  }
}

// Admin-only invoice download (authentication and the role check happen in withApi).
// The public verification flow is the separate, deliberately minimal /api/verify route - don't merge the two.

async function getInvoicePdf(supabase: SupabaseClient, context: { params: Promise<{ invoice: string }> }) {
  const { invoice } = await context.params
  const decodedInvoice = decodeURIComponent(invoice)

  const { data: paymentRow, error: paymentError } = await supabase
    .from('payments')
    .select('*')
    .eq('invoice', decodedInvoice)
    .maybeSingle()
  if (paymentError) return unexpectedApiError(paymentError, 'Failed to load invoice payment')

  // If invoice not found, return 404 instead of generating placeholder PDF
  if (!paymentRow) {
    return new NextResponse(JSON.stringify({ error: 'Invoice not found' }), { status: 404 })
  }

  const { data: verification, error: verificationError } = await supabase
    .from('verifiable_documents')
    .select('verification_code')
    .eq('doc_type', 'invoice')
    .eq('reference_id', String(paymentRow.id))
    .maybeSingle()
  if (verificationError) return unexpectedApiError(verificationError, 'Failed to load invoice verification data')
  const payment = paymentFromRow({
    ...paymentRow,
    verification_code: verification?.verification_code,
  })
  const { data: studentRow, error: studentError } = await supabase
    .from('students')
    .select('*')
    .eq('id', paymentRow.student_id)
    .maybeSingle()
  if (studentError) return unexpectedApiError(studentError, 'Failed to load invoice student')
  const student = studentRow ? studentFromRow(studentRow) : undefined
  const { data: ledger, error: ledgerError } = await supabase
    .from('payments')
    .select('id, amount, payment_date, instance_number, created_at')
    .eq('student_id', paymentRow.student_id)
  if (ledgerError) return unexpectedApiError(ledgerError, 'Failed to load invoice balance')
  const balanceAfter = studentRow ? balanceAfterPayment(String(paymentRow.id), ledger ?? [], studentRow) : undefined

  const { data: gstSettings, error: gstError } = await supabase
    .from('gst_settings')
    .select('gstin')
    .eq('id', 'default')
    .maybeSingle()
  if (gstError) return unexpectedApiError(gstError, 'Failed to load invoice GST settings')
  const gstin = typeof gstSettings?.gstin === 'string' && gstSettings.gstin.trim() ? gstSettings.gstin.trim() : null

  // Hash the complete invoice inputs so edits to the student, payment, GSTIN, or
  // verification code create a fresh private cache object without serving stale PDFs.
  const pdfVersion = createHash('sha256')
    .update(
      JSON.stringify({
        template: INVOICE_TEMPLATE_VERSION,
        paymentRow,
        studentRow,
        gstin,
        verificationCode: verification?.verification_code ?? null,
        balanceAfter: balanceAfter ?? null,
      }),
    )
    .digest('hex')
  const paymentCacheId = createHash('sha256').update(String(paymentRow.id)).digest('hex')
  const cachePath = `${paymentCacheId}/${pdfVersion}.pdf`
  const cachedPdf = await getCachedPdf(cachePath)
  if (cachedPdf) {
    return new NextResponse(cachedPdf, {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="${decodedInvoice.replace(/[^a-zA-Z0-9_-]/g, '_')}.pdf"`,
        'Cache-Control': 'private, no-store',
        'X-Content-Type-Options': 'nosniff',
      },
    })
  }

  // F-07: print exactly what the database stored. taxable_value and grand_total are generated
  // columns that respect the payment's own gst_inclusive flag; nothing is recomputed here.
  const storedGstRate = Number(paymentRow.gst_rate ?? 0)
  const totalGstPaise = Number(paymentRow.cgst ?? 0) + Number(paymentRow.sgst ?? 0)
  const taxablePaise = Number(paymentRow.taxable_value ?? paymentRow.amount ?? 0)
  const grossPaise = Number(paymentRow.grand_total ?? Number(paymentRow.amount ?? 0) + totalGstPaise)

  const pdf = await PDFDocument.create()
  pdf.registerFontkit(fontkit)
  const page = pdf.addPage([595, 842])
  const [regularBytes, boldBytes] = await Promise.all([
    readFile(resolve(process.cwd(), 'public/fonts/NotoSans-Regular.ttf')),
    readFile(resolve(process.cwd(), 'public/fonts/NotoSans-Bold.ttf')),
  ])
  const regular = await pdf.embedFont(regularBytes, { subset: true })
  const bold = await pdf.embedFont(boldBytes, { subset: true })
  const navy = rgb(0.055, 0.11, 0.24)
  const gold = rgb(0.66, 0.51, 0.16)
  const money = formatINR

  // Generate QR code for invoice verification
  let qrCodeImage
  try {
    if (payment.verification_code) {
      const verificationUrl = `${brand.verifyBaseUrl}/verify/${payment.verification_code}`
      const qrCodeBuffer = await QRCode.toBuffer(verificationUrl, {
        width: 150,
        margin: 1,
      })
      qrCodeImage = await pdf.embedPng(qrCodeBuffer)
    }
  } catch (err) {
    console.error('Invoice PDF QR generation failed.')
    // Continue without QR code if generation fails
  }
  page.drawText(brand.legalName, { x: 48, y: 780, size: 22, font: bold, color: navy })
  page.drawText('COURSE PAYMENT TAX INVOICE', { x: 48, y: 754, size: 11, font: bold, color: gold })
  page.drawLine({ start: { x: 48, y: 740 }, end: { x: 547, y: 740 }, thickness: 1.5, color: navy })
  const rows = [
    ['Invoice', payment.invoice],
    ['Receipt', payment.id],
    ['Date', payment.date],
    ['Student', student?.name ?? payment.student],
    ['Student ID', `TAI-${payment.studentId}`],
    ['Course', student?.course ?? 'Course fee payment'],
    ['Payment mode', payment.method],
  ]
  // Verification QR at the right of the details block (the rows end before x = 460), clear of the table.
  if (qrCodeImage) {
    const qrSize = 80
    const qrX = 547 - qrSize
    const qrY = 600
    page.drawImage(qrCodeImage, { x: qrX, y: qrY, width: qrSize, height: qrSize })
    const label = 'Scan to verify'
    const labelWidth = regular.widthOfTextAtSize(label, 8)
    page.drawText(label, { x: qrX + (qrSize - labelWidth) / 2, y: qrY - 11, size: 8, font: regular, color: navy })
  }

  let y = 700
  for (const [label, value] of rows) {
    page.drawText(`${label}:`, { x: 55, y, size: 10, font: bold, color: navy })
    page.drawText(value, { x: 170, y, size: 10, font: regular })
    y -= 23
  }
  y -= 12

  page.drawRectangle({ x: 48, y: y - 26, width: 499, height: 28, color: navy })
  page.drawText('Description', { x: 60, y: y - 17, size: 10, font: bold, color: rgb(1, 1, 1) })
  page.drawText('Taxable value', { x: 300, y: y - 17, size: 10, font: bold, color: rgb(1, 1, 1) })
  page.drawText('Amount', { x: 460, y: y - 17, size: 10, font: bold, color: rgb(1, 1, 1) })
  y -= 58
  const gstLabel = totalGstPaise > 0 ? `GST (${storedGstRate}%)` : 'GST'
  const invoiceRows = [
    ['Course fee payment', money(taxablePaise), money(taxablePaise)],
    [gstLabel, money(totalGstPaise), money(totalGstPaise)],
    ['Grand Total', '', money(grossPaise)],
  ]
  for (const [label, taxableValue, total] of invoiceRows) {
    page.drawText(label, {
      x: 60,
      y,
      size: 10,
      font: label === 'Grand Total' ? bold : regular,
      color: label === 'Grand Total' ? navy : rgb(0.15, 0.15, 0.15),
    })
    page.drawText(taxableValue, { x: 300, y, size: 10, font: regular })
    page.drawText(total, { x: 460, y, size: 10, font: label === 'Grand Total' ? bold : regular })
    page.drawLine({
      start: { x: 48, y: y - 8 },
      end: { x: 547, y: y - 8 },
      thickness: 0.5,
      color: rgb(0.75, 0.75, 0.75),
    })
    y -= 28
  }
  if (balanceAfter !== undefined) {
    page.drawText('Balance to be paid:', { x: 60, y: y + 2, size: 10, font: bold, color: navy })
    page.drawText(balanceAfter > 0 ? money(rupeesToPaise(balanceAfter)) : 'Nil (course fees fully paid)', {
      x: 170,
      y: y + 2,
      size: 10,
      font: regular,
    })
  }
  page.drawText('This is a computer-generated invoice and does not require a signature.', {
    x: 48,
    y: 90,
    size: 9,
    font: regular,
    color: rgb(0.35, 0.35, 0.35),
  })
  page.drawText(`${brand.legalName} | GSTIN: ${gstin ?? 'GSTIN not configured'}`, {
    x: 48,
    y: 72,
    size: 9,
    font: regular,
    color: rgb(0.35, 0.35, 0.35),
  })
  const bytes = await pdf.save()
  await storeCachedPdf(cachePath, bytes)
  return new NextResponse(bytes, {
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="${decodedInvoice.replace(/[^a-zA-Z0-9_-]/g, '_')}.pdf"`,
      'Cache-Control': 'private, no-store',
      'X-Content-Type-Options': 'nosniff',
    },
  })
}

export const GET = withApi(
  {
    // F-03: invoices expose payment amounts; admin-only like the rest of the payments resource.
    roles: rolesFor('payments', 'read'),
    params: z.object({ invoice: z.string().min(1) }),
  },
  async ({ supabase, params }) => getInvoicePdf(supabase!, { params: Promise.resolve(params) }),
)
