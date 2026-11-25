'use client'

import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { useState } from 'react'
import { Ban, Eye, ExternalLink, ShieldCheck } from 'lucide-react'
import { apiErrorMessage } from '@/lib/api/error-message'
import { CategoryBadge } from '@/components/CategoryBadge'
import { PillButton } from '@/components/ui/PillButton'
import { Tag } from '@/components/ui/Tag'

export interface CertificateRowItem {
  id: string
  certificate_id: string
  student_register_id: number
  student_name: string
  course_name: string
  issue_date: string
  verification_code?: string | null
  revoked_at?: string | null
  revoke_reason?: string | null
}

export function CertificateTableRow({
  certificate,
  categoryName,
}: {
  certificate: CertificateRowItem
  categoryName?: string | null
}) {
  const router = useRouter()
  const [revoking, setRevoking] = useState(false)
  const revoked = Boolean(certificate.revoked_at)
  const revoke = async () => {
    const reason = window.prompt(
      `Revoke certificate ${certificate.certificate_id}? The record stays, but its QR code will stop verifying.

Reason:`,
    )
    if (reason === null) return
    if (reason.trim().length < 3) {
      window.alert('Give a reason of at least 3 characters.')
      return
    }
    setRevoking(true)
    try {
      const res = await fetch('/api/certificates', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: certificate.id, reason }),
      })
      if (!res.ok)
        throw new Error(apiErrorMessage(await res.json().catch(() => null), 'Could not revoke the certificate.'))
      router.refresh()
    } catch (err) {
      window.alert(err instanceof Error ? err.message : 'Could not revoke the certificate.')
    } finally {
      setRevoking(false)
    }
  }
  const certTargetUrl = `/certificates/${encodeURIComponent(certificate.certificate_id || certificate.id)}`

  const handleRowClick = () => {
    router.push(certTargetUrl)
  }

  return (
    <tr
      onClick={handleRowClick}
      className="cursor-pointer transition-colors group hover:bg-[var(--panel)]"
      style={{ borderBottom: '1px solid var(--border)' }}
      title={`Open certificate ${certificate.certificate_id}`}
    >
      <td className="py-3.5 px-5">
        <Link
          href={certTargetUrl}
          className="inline-flex items-center min-h-[28px] font-mono text-xs font-bold text-[var(--ink)] group-hover:text-[var(--g1)] transition-colors"
          onClick={(e) => e.stopPropagation()}
        >
          {certificate.certificate_id}
        </Link>
      </td>
      <td className="py-3.5 px-5">
        <Link
          href={`/students/${certificate.student_register_id}`}
          className="inline-flex items-center min-h-[28px] text-xs font-semibold text-[var(--ink)] hover:text-[var(--g1)] transition-colors"
          onClick={(e) => e.stopPropagation()}
        >
          {certificate.student_name}
        </Link>
      </td>
      <td className="py-3.5 px-5 text-xs font-medium text-[var(--ink)]">{certificate.course_name}</td>
      <td className="py-3.5 px-5">
        {categoryName ? (
          <CategoryBadge categoryName={categoryName} />
        ) : (
          <span className="text-xs text-[var(--mute)] italic">Unassigned</span>
        )}
      </td>
      <td className="py-3.5 px-5 text-xs text-[var(--mute)]">{certificate.issue_date}</td>
      <td className="py-3.5 px-5">
        {revoked ? (
          <span
            className="inline-flex items-center gap-1 rounded-full border border-red-200 bg-red-50 px-2 py-0.5 text-[10px] font-bold text-red-700"
            title={certificate.revoke_reason ?? 'Revoked'}
          >
            Revoked
          </span>
        ) : certificate.verification_code ? (
          <Link
            href={`/verify/${certificate.verification_code}`}
            target="_blank"
            className="inline-flex items-center gap-1 text-xs font-semibold text-[var(--g1)] hover:underline"
            onClick={(e) => e.stopPropagation()}
            title="Verify public certificate record"
          >
            <ShieldCheck size={13} />
            <span>Verify</span>
            <ExternalLink size={11} />
          </Link>
        ) : (
          <span className="text-xs text-[var(--mute)]">—</span>
        )}
      </td>
      <td className="py-3.5 px-5 text-right" onClick={(e) => e.stopPropagation()}>
        <Link href={certTargetUrl}>
          <PillButton variant="secondary" size="sm" icon={<Eye size={13} />}>
            View
          </PillButton>
        </Link>
        {!revoked && (
          <button
            type="button"
            onClick={revoke}
            disabled={revoking}
            className="ml-2 inline-flex items-center gap-1 text-[11px] font-semibold text-red-700 hover:underline disabled:opacity-50"
            title="Revoke this certificate"
          >
            <Ban size={12} /> {revoking ? 'Revoking…' : 'Revoke'}
          </button>
        )}
      </td>
    </tr>
  )
}
