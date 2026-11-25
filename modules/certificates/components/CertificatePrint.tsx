'use client'

import { ArrowLeft, CheckCircle2, Printer, RefreshCw, Save as SaveIcon } from 'lucide-react'
import { Button } from '@/components/ui/button'
import type { CertificateRecord, Student } from '@/lib/types'
import { useEffect, useRef, useState, cloneElement } from 'react'
import { createPortal } from 'react-dom'
import { brand } from '@/lib/brand'
import { apiErrorMessage } from '@/lib/api/error-message'

const CERT_W = 620
const CERT_H = 877

const DEFAULT_SKILLS = ['Project Development', 'Data Analysis', 'Team Collaboration', 'Problem Solving']

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

function fmtDate(v: string) {
  if (!v) return '—'
  const d = new Date(v + 'T00:00:00')
  if (isNaN(d.getTime())) return '—'
  return d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })
}

/** Placeholder shown until the certificate is issued; the database assigns the real number. */
function genCertId() {
  return `TAI-${new Date().getFullYear()}-XXXX`
}

function parseBatchToISO(batch: string) {
  if (!batch) return ''
  const d = new Date(batch)
  if (!isNaN(d.getTime())) {
    return (
      d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0')
    )
  }
  return ''
}

type CertFormState = {
  studentName: string
  courseName: string
  startDate: string
  endDate: string
  issueDate: string
  certId: string
  skills: string
  director: string
  trainer: string
}

export function CertificatePrint({
  student,
  onBack,
  className,
  certificateRecord,
}: {
  student: Student
  onBack: () => void
  className?: string
  certificateRecord?: CertificateRecord
}) {
  const [form, setForm] = useState<CertFormState>(() => {
    // If we have certificate record data (for viewing existing certificates), use it
    if (certificateRecord) {
      return {
        studentName: certificateRecord.studentName,
        courseName: certificateRecord.courseName,
        startDate: certificateRecord.startDate ?? parseBatchToISO(student.batch),
        endDate: certificateRecord.endDate ?? todayISO(),
        issueDate: certificateRecord.issueDate ?? todayISO(),
        certId:
          certificateRecord.certificateId ??
          `TAI-${new Date().getFullYear()}-${String(student.registerId).padStart(4, '0')}`,
        skills: certificateRecord.skills ? certificateRecord.skills.join('\n') : DEFAULT_SKILLS.join('\n'),
        director: certificateRecord.directorName ?? 'Dr. K. Subramanian',
        trainer: certificateRecord.trainerName ?? 'A. Ravichandran',
      }
    }

    // Otherwise, use student data for preview mode
    return {
      studentName: student.name,
      courseName: student.course,
      startDate: parseBatchToISO(student.batch),
      endDate: todayISO(),
      issueDate: todayISO(),
      certId: `TAI-${new Date().getFullYear()}-${String(student.registerId).padStart(4, '0')}`,
      skills: DEFAULT_SKILLS.join('\n'),
      director: 'Dr. K. Subramanian',
      trainer: 'A. Ravichandran',
    }
  })

  const skillsArray = form.skills
    .split('\n')
    .map((s) => s.trim())
    .filter(Boolean)

  const containerRef = useRef<HTMLElement>(null)
  const [scale, setScale] = useState(1)
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle')
  const [saveError, setSaveError] = useState<string | null>(null)
  const [qrCode, setQrCode] = useState<string | null>(null)
  // Set when the certificate is issued (passed in, or returned by Save). Only issued certificates get a QR.
  const [verificationCode, setVerificationCode] = useState<string | null>(certificateRecord?.verificationCode ?? null)
  const [printAfterSave, setPrintAfterSave] = useState(false)

  useEffect(() => {
    const container = containerRef.current
    if (!container) return
    const observer = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const { width, height } = entry.contentRect
        const scaleX = width / CERT_W
        const scaleY = height / CERT_H
        setScale(Math.min(scaleX, scaleY, 1))
      }
    })
    observer.observe(container)
    return () => observer.disconnect()
  }, [])

  // Generate QR code when verification code changes
  useEffect(() => {
    const generateQRCode = async () => {
      try {
        if (verificationCode) {
          const verificationUrl = `${brand.verifyBaseUrl}/verify/${verificationCode}`
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
        console.error('Certificate QR generation failed.')
        setQrCode(null)
      }
    }

    generateQRCode()
  }, [verificationCode])

  // Print once the QR of a certificate that was just issued is on the page.
  useEffect(() => {
    if (!printAfterSave || !qrCode) return
    setPrintAfterSave(false)
    window.print()
  }, [printAfterSave, qrCode])

  const set = <K extends keyof CertFormState>(key: K, value: CertFormState[K]) =>
    setForm((prev) => ({ ...prev, [key]: value }))

  const regenId = () => set('certId', genCertId())

  const resetForm = () => {
    setForm({
      studentName: '',
      courseName: '',
      startDate: '',
      endDate: '',
      issueDate: todayISO(),
      certId: genCertId(),
      skills: '',
      director: '',
      trainer: '',
    })
    setSaveStatus('idle')
    setSaveError(null)
  }

  const persistCertificate = async (): Promise<boolean> => {
    if (verificationCode) return true
    try {
      setSaveStatus('saving')
      setSaveError(null)
      const res = await fetch('/api/certificates', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          certificateId: form.certId,
          studentRowId: student.id ?? null,
          studentRegisterId: student.registerId,
          courseName: form.courseName,
          studentName: form.studentName,
          startDate: form.startDate || null,
          endDate: form.endDate || null,
          issueDate: form.issueDate,
          skills: skillsArray,
          directorName: form.director || null,
          trainerName: form.trainer || null,
        }),
      })
      if (!res.ok) {
        const body = await res.json().catch(() => ({ error: 'Failed to save certificate' }))
        throw new Error(apiErrorMessage(body, `Request failed (${res.status})`))
      }
      const saved = (await res.json().catch(() => null)) as { data?: CertificateRecord } | null
      setVerificationCode(saved?.data?.verificationCode ?? null)
      // The database numbers certificates; show the issued number instead of the draft one.
      const issuedId = saved?.data?.certificateId
      if (issuedId) setForm((current) => ({ ...current, certId: issuedId }))
      setSaveStatus('saved')
      setTimeout(() => setSaveStatus('idle'), 4000)
      return true
    } catch (err) {
      setSaveStatus('error')
      setSaveError(err instanceof Error ? err.message : 'Unknown error')
      return false
    }
  }

  // A printed certificate must be verifiable, so printing issues it first (once).
  const printCertificate = async () => {
    if (verificationCode) {
      window.print()
      return
    }
    if (await persistCertificate()) setPrintAfterSave(true)
  }

  const certificate = (
    <article className="ttk-certificate">
      <div className="corner-tri tl" />
      <div className="corner-tri tr" />
      <div className="corner-tri bl" />
      <div className="corner-tri br" />
      <div className="corner-gold tl" />
      <div className="corner-gold tr" />
      <div className="corner-gold bl" />
      <div className="corner-gold br" />
      <div className="frame-border" />
      <div className="frame-gold" />

      <div className="cert-inner">
        <div className="cert-logo">
          <img src={brand.logoPath} alt={brand.shortName} />
        </div>

        <div className="cert-title">
          CERTIFICATE OF
          <br />
          COMPLETION
        </div>
        <div className="divider">
          <span className="ln" />
          <span className="star">★</span>
          <span className="ln" />
        </div>

        <div className="cert-lead">This is to certify that</div>
        <div className="cert-name">{form.studentName || 'Student Name'}</div>
        <div className="cert-name-rule" />

        <div className="cert-body">
          has successfully completed the <b>{form.courseName || 'Course Name'}</b> Program at <b>{brand.legalName}</b>
          {form.startDate && form.endDate ? (
            <>
              , from <b>{fmtDate(form.startDate)}</b> to <b>{fmtDate(form.endDate)}</b>
            </>
          ) : form.endDate ? (
            <>
              , on <b>{fmtDate(form.endDate)}</b>
            </>
          ) : null}
          .
        </div>

        <div className="cert-note">
          During the Course, the candidate demonstrated dedication, professionalism, and technical proficiency in:
        </div>
        <ul className="skills-list">
          {skillsArray.length > 0
            ? skillsArray.map((skill, i) => <li key={i}>{skill}</li>)
            : DEFAULT_SKILLS.map((skill) => <li key={skill}>{skill}</li>)}
        </ul>

        <div className="cert-footer-strip">
          <div className="idrow">
            <div className="id-block">
              <div className="lbl">Certificate ID</div>
              <div className="val">{form.certId || genCertId()}</div>
            </div>
            {verificationCode ? (
              <div className="cert-qr">
                {qrCode ? (
                  <img src={qrCode} alt="Scan to verify this certificate" />
                ) : (
                  <div className="cert-qr-blank" />
                )}
                <span>Scan to verify</span>
              </div>
            ) : null}
            <div className="id-block" style={{ textAlign: 'right' }}>
              <div className="lbl">Date Issued</div>
              <div className="val">{fmtDate(form.issueDate)}</div>
            </div>
          </div>

          <div className="sig-row">
            <div className="sig-block">
              <div className="sig-mark" />
              <div className="sig-line" />
              <div className="sig-name">{form.director || 'Director'}</div>
              <div className="sig-role">Director</div>
            </div>

            <div className="seal">
              <svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg">
                <circle cx="50" cy="50" r="46" fill="#0e1c3d" />
                <circle cx="50" cy="50" r="46" fill="none" stroke="#d4af37" strokeWidth="3" />
                <circle cx="50" cy="50" r="36" fill="none" stroke="#d4af37" strokeWidth="1" />
                <polygon points="50,28 54,40 66,40 56,48 60,60 50,52 40,60 44,48 34,40 46,40" fill="#d4af37" />
                <text
                  x="50"
                  y="82"
                  textAnchor="middle"
                  fill="#f2d375"
                  fontSize="7"
                  fontFamily="Poppins,sans-serif"
                  letterSpacing="1"
                >
                  CERTIFIED
                </text>
              </svg>
            </div>

            <div className="sig-block">
              <div className="sig-mark" />
              <div className="sig-line" />
              <div className="sig-name">{form.trainer || 'Trainer'}</div>
              <div className="sig-role">Trainer</div>
            </div>
          </div>
        </div>
      </div>
    </article>
  )

  return (
    <>
      <div className={className ? `preview-page ${className}` : 'preview-page'}>
        <div className="back-row">
          <Button variant="secondary" onClick={onBack}>
            <ArrowLeft size={16} className="mr-2" />
            Back
          </Button>
        </div>
        <div className="preview-layout">
          <aside className="edit-sidebar edit-sidebar-light">
            <div className="edit-sidebar-header edit-sidebar-header-light">
              <h2 className="edit-form-heading">Certificate Details</h2>
              <p className="edit-form-sub">
                Fill in the fields below — the certificate on the right updates instantly.
              </p>
            </div>

            <div className="edit-sidebar-body">
              <div className="edit-section">
                <div className="edit-section-title">Recipient</div>
                <label className="edit-label">
                  Student Name
                  <span className="edit-req">*</span>
                  <input
                    type="text"
                    placeholder="e.g., Priya Ramesh"
                    value={form.studentName}
                    onChange={(e) => set('studentName', e.target.value)}
                    className="edit-input edit-input-light"
                  />
                </label>
              </div>

              <div className="edit-section">
                <div className="edit-section-title">Course</div>
                <label className="edit-label">
                  Course Name
                  <span className="edit-req">*</span>
                  <input
                    type="text"
                    placeholder="e.g., Digital Marketing"
                    value={form.courseName}
                    onChange={(e) => set('courseName', e.target.value)}
                    className="edit-input edit-input-light"
                  />
                </label>
                <div className="edit-row2">
                  <label className="edit-label">
                    Start Date
                    <input
                      type="date"
                      value={form.startDate}
                      onChange={(e) => set('startDate', e.target.value)}
                      className="edit-input edit-input-light"
                    />
                  </label>
                  <label className="edit-label">
                    End Date
                    <span className="edit-req">*</span>
                    <input
                      type="date"
                      value={form.endDate}
                      onChange={(e) => set('endDate', e.target.value)}
                      className="edit-input edit-input-light"
                    />
                  </label>
                </div>
              </div>

              <div className="edit-section">
                <div className="edit-section-title">Issuance</div>
                <label className="edit-label">
                  Certificate Issued Date
                  <input
                    type="date"
                    value={form.issueDate}
                    onChange={(e) => set('issueDate', e.target.value)}
                    className="edit-input edit-input-light"
                  />
                </label>
                <label className="edit-label">
                  Certificate ID
                  <div className="edit-id-field">
                    <input
                      type="text"
                      value={form.certId}
                      onChange={(e) => set('certId', e.target.value)}
                      className="edit-input edit-input-light"
                      style={{ paddingRight: 40 }}
                    />
                    <button type="button" onClick={regenId} className="edit-id-regen" title="Regenerate ID">
                      ↻
                    </button>
                  </div>
                </label>
              </div>

              <div className="edit-section">
                <div className="edit-section-title">Skills Highlighted</div>
                <label className="edit-label">
                  One per line
                  <textarea
                    rows={4}
                    value={form.skills}
                    onChange={(e) => set('skills', e.target.value)}
                    className="edit-input edit-input-light"
                    placeholder="Project Development&#10;Data Analysis&#10;Team Collaboration&#10;Problem Solving"
                  />
                </label>
              </div>

              <div className="edit-section">
                <div className="edit-section-title">Signatories</div>
                <div className="edit-row2">
                  <label className="edit-label">
                    Director
                    <input
                      type="text"
                      value={form.director}
                      onChange={(e) => set('director', e.target.value)}
                      placeholder="Dr. K. Subramanian"
                      className="edit-input edit-input-light"
                    />
                  </label>
                  <label className="edit-label">
                    Trainer
                    <input
                      type="text"
                      value={form.trainer}
                      onChange={(e) => set('trainer', e.target.value)}
                      placeholder="A. Ravichandran"
                      className="edit-input edit-input-light"
                    />
                  </label>
                </div>
              </div>
            </div>

            <div className="edit-sidebar-actions">
              {saveStatus === 'saved' && (
                <div className="edit-status edit-status-success">
                  <CheckCircle2 size={14} className="mr-2" /> Certificate saved to records.
                </div>
              )}
              {saveStatus === 'error' && saveError && (
                <div className="edit-status edit-status-error">Save failed: {saveError}</div>
              )}
              <div className="edit-actions-row">
                <Button
                  variant="default"
                  className="edit-btn edit-btn-cert-primary"
                  onClick={() => void persistCertificate()}
                  disabled={saveStatus === 'saving' || Boolean(verificationCode)}
                >
                  <SaveIcon size={16} className="mr-2" />
                  {saveStatus === 'saving' ? 'Saving…' : verificationCode ? 'Saved' : 'Save Certificate'}
                </Button>
                <Button
                  variant="default"
                  className="edit-btn"
                  onClick={() => void printCertificate()}
                  disabled={saveStatus === 'saving'}
                  title={
                    verificationCode
                      ? undefined
                      : 'Saves the certificate first, so the print carries its verification QR'
                  }
                >
                  <Printer size={16} className="mr-2" /> {verificationCode ? 'Print' : 'Save & Print'}
                </Button>
                <Button
                  variant="ghost"
                  className="edit-btn edit-btn-cert-reset"
                  onClick={resetForm}
                  disabled={saveStatus === 'saving'}
                >
                  <RefreshCw size={16} className="mr-2" /> Reset Form
                </Button>
              </div>
            </div>
          </aside>

          <main
            className="preview-document-container"
            ref={containerRef}
            style={{ '--scale': scale } as React.CSSProperties}
          >
            <div className="preview-scaler-wrapper ttk-cert-scale">
              <div className="preview-scaler-content ttk-cert-scale">{cloneElement(certificate)}</div>
            </div>
          </main>
        </div>
      </div>
      {typeof document !== 'undefined' &&
        createPortal(<div className="cert-print-root">{cloneElement(certificate)}</div>, document.body)}
    </>
  )
}
