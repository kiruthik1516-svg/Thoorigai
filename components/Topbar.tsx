'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import {
  ChevronRight,
  FileCheck2,
  FileText,
  LogOut,
  Menu,
  Receipt,
  Search,
  UserCog,
  UserRound,
  Users,
  X,
  Palette,
} from 'lucide-react'
import type { Payment, Role, Student } from '@/lib/types'
import { money } from '@/lib/formatters'
import { NotificationPanel } from '@/components/NotificationPanel'
import { useTheme } from '@/lib/ThemeContext'

type BreadcrumbSegment = {
  label: string
  href?: string
  icon?: React.ReactNode
  bold?: boolean
}

export function Topbar({ onMenu, role }: { onMenu: () => void; role: Role }) {
  const router = useRouter()
  const pathname = usePathname()
  const { openSettings } = useTheme()

  const [query, setQuery] = useState('')
  const [open, setOpen] = useState(false)
  // On phones the search starts as an icon and expands over the header (mobile audit).
  const [searchExpanded, setSearchExpanded] = useState(false)
  const wrapRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  const [students, setStudents] = useState<Student[]>([])
  const [payments, setPayments] = useState<Payment[]>([])
  const [resolvedStudentNames, setResolvedStudentNames] = useState<Record<string, string>>({})
  const [loadingSearch, setLoadingSearch] = useState(false)

  // F-39: search on the server as the user types (debounced) instead of downloading the first
  // 100 students and payments on every page load and searching only those.
  const canReadPayments = role === 'admin'
  useEffect(() => {
    const q = query.trim()
    if (q.length < 2) {
      setStudents([])
      setPayments([])
      return
    }
    const controller = new AbortController()
    const timer = setTimeout(async () => {
      setLoadingSearch(true)
      try {
        const term = q.replace(/^tai-/i, '')
        const studentsRes = await fetch(`/api/students?page=1&pageSize=8&search=${encodeURIComponent(term)}`, {
          signal: controller.signal,
        })
        const found: Student[] = studentsRes.ok ? ((await studentsRes.json()).data ?? []) : []
        setStudents(found)
        if (canReadPayments && found.length > 0) {
          const invoiceLists = await Promise.all(
            found.slice(0, 3).map(async (student) => {
              const res = await fetch(
                `/api/payments?page=1&pageSize=5&search=${encodeURIComponent(String(student.registerId))}`,
                { signal: controller.signal },
              )
              return res.ok ? (((await res.json()).data ?? []) as Payment[]) : []
            }),
          )
          setPayments(invoiceLists.flat())
        } else {
          setPayments([])
        }
      } catch (err) {
        if (!(err instanceof DOMException && err.name === 'AbortError')) setPayments([])
      } finally {
        if (!controller.signal.aborted) setLoadingSearch(false)
      }
    }, 250)
    return () => {
      clearTimeout(timer)
      controller.abort()
    }
  }, [query, canReadPayments])

  useEffect(() => {
    const parts = (pathname || '').split('/').filter(Boolean)
    if (parts[0] === 'students' && parts[1] && parts[1] !== 'new') {
      const studentId = parts[1]
      const existing = students.find((s) => String(s.registerId) === studentId)?.name || resolvedStudentNames[studentId]
      if (!existing) {
        fetch(`/api/students?search=${encodeURIComponent(studentId)}`)
          .then((res) => (res.ok ? res.json() : null))
          .then((resData) => {
            const list = (resData?.data || []) as Student[]
            const match = list.find((s) => String(s.registerId) === studentId) || list[0]
            if (match?.name) {
              setResolvedStudentNames((prev) => ({ ...prev, [studentId]: match.name }))
            }
          })
          .catch(() => {})
      }
    }
  }, [pathname, students, resolvedStudentNames])

  const matches = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return []
    return students
      .filter((s) => {
        const id = `tai-${s.registerId}`
        return (
          s.name.toLowerCase().includes(q) ||
          id.includes(q) ||
          String(s.registerId).includes(q) ||
          s.course.toLowerCase().includes(q) ||
          (s.phone && s.phone.includes(q))
        )
      })
      .slice(0, 8)
  }, [query, students])

  useEffect(() => {
    const onPointer = (e: MouseEvent) => {
      if (!wrapRef.current?.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setOpen(false)
        setQuery('')
        setSearchExpanded(false)
      }
    }
    document.addEventListener('mousedown', onPointer)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onPointer)
      document.removeEventListener('keydown', onKey)
    }
  }, [])

  const invoicesFor = (student: Student) => payments.filter((p) => p.studentId === student.registerId)

  const choose = (action: () => void) => {
    action()
    setOpen(false)
    setQuery('')
    setSearchExpanded(false)
  }

  const collapseSearch = () => {
    setSearchExpanded(false)
    setOpen(false)
    setQuery('')
  }

  // Dynamic breadcrumbs based on pathname
  const segments = useMemo<BreadcrumbSegment[]>(() => {
    const base: BreadcrumbSegment[] = [{ label: 'Workspace', href: '/' }]

    if (!pathname || pathname === '/') {
      return [...base, { label: 'Dashboard', bold: true }]
    }

    const parts = pathname.split('/').filter(Boolean)

    if (parts[0] === 'students') {
      if (parts.length === 1) {
        return [...base, { label: 'Students', bold: true }]
      }
      if (parts[1] === 'new') {
        return [...base, { label: 'Students', href: '/students' }, { label: 'Add student', bold: true }]
      }
      const studentId = parts[1]
      const studentObj = students.find((s) => String(s.registerId) === studentId)
      const studentLabel = studentObj?.name || resolvedStudentNames[studentId] || `Student #${studentId}`

      if (parts[2] === 'certificate') {
        return [
          ...base,
          { label: 'Students', href: '/students' },
          { label: studentLabel, href: `/students/${studentId}`, icon: <UserRound size={12} /> },
          { label: 'Certificate', icon: <FileCheck2 size={12} />, bold: true },
        ]
      }
      return [
        ...base,
        { label: 'Students', href: '/students' },
        { label: studentLabel, icon: <UserRound size={12} />, bold: true },
      ]
    }

    if (parts[0] === 'invoices') {
      if (parts.length === 1) {
        return [...base, { label: 'Invoices', bold: true }]
      }
      const invoiceNo = decodeURIComponent(parts[1])
      return [
        ...base,
        { label: 'Invoices', href: '/invoices' },
        { label: `Receipt ${invoiceNo}`, icon: <Receipt size={12} />, bold: true },
      ]
    }

    if (parts[0] === 'courses') {
      if (parts.length === 1) {
        return [...base, { label: 'Courses', bold: true }]
      }
      return [...base, { label: 'Courses', href: '/courses' }, { label: 'Course details', bold: true }]
    }

    if (parts[0] === 'materials') {
      return [...base, { label: 'Course materials', bold: true }]
    }

    if (parts[0] === 'certificates') {
      return [...base, { label: 'Certificates', bold: true }]
    }

    if (parts[0] === 'attendance') {
      return [...base, { label: 'Attendance', bold: true }]
    }

    if (parts[0] === 'assessments') {
      return [...base, { label: 'Assessments', bold: true }]
    }

    if (parts[0] === 'reports') {
      return [...base, { label: 'Reports', bold: true }]
    }

    if (parts[0] === 'audit-log') {
      return [...base, { label: 'Audit Log', bold: true }]
    }

    if (parts[0] === 'settings') {
      if (parts[1] === 'gst') {
        return [...base, { label: 'Settings', href: '/settings/gst' }, { label: 'GST Settings', bold: true }]
      }
      if (parts[1] === 'users') {
        return [...base, { label: 'Settings', href: '/settings/users' }, { label: 'Users and roles', bold: true }]
      }
      if (parts[1] === 'trainers') {
        return [
          ...base,
          { label: 'Settings', href: '/settings/trainers' },
          { label: 'Trainer assignments', bold: true },
        ]
      }
      if (parts[1] === 'brand') {
        return [...base, { label: 'Settings', href: '/settings/brand' }, { label: 'Brand information', bold: true }]
      }
      if (parts[1] === 'user' || parts[1] === 'profile') {
        return [...base, { label: 'Settings', href: '/settings/user' }, { label: 'User settings', bold: true }]
      }
      return [...base, { label: 'Settings', bold: true }]
    }

    const title = parts[0].charAt(0).toUpperCase() + parts[0].slice(1)
    return [...base, { label: title, bold: true }]
  }, [pathname, students])

  async function handleSignOut() {
    try {
      await fetch('/api/auth/logout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      })
      router.replace('/login')
      router.refresh()
    } catch {
      router.replace('/login')
    }
  }

  const roleInitials = (role || 'admin').slice(0, 2).toUpperCase()

  return (
    <header className={'topbar' + (searchExpanded ? ' is-searching' : '')}>
      <button type="button" onClick={onMenu} aria-label="Toggle navigation" className="top-menu-btn">
        <Menu size={18} />
      </button>

      <nav className="breadcrumb-nav hidden md:flex" aria-label="Breadcrumb">
        <ol className="breadcrumb">
          {segments.map((seg, i) => (
            <li key={i} className="breadcrumb-item">
              {i > 0 && (
                <span className="breadcrumb-sep" aria-hidden="true">
                  <ChevronRight size={12} />
                </span>
              )}
              {seg.href ? (
                <Link href={seg.href} className={'breadcrumb-link' + (seg.bold ? ' breadcrumb-current' : '')}>
                  {seg.icon && <span className="breadcrumb-icon mr-1">{seg.icon}</span>}
                  <span>{seg.label}</span>
                </Link>
              ) : (
                <span className={'breadcrumb-static' + (seg.bold ? ' breadcrumb-current' : '')}>
                  {seg.icon && <span className="breadcrumb-icon mr-1">{seg.icon}</span>}
                  <span>{seg.label}</span>
                </span>
              )}
            </li>
          ))}
        </ol>
      </nav>

      <div className="top-actions">
        <button
          type="button"
          className="top-search-toggle top-icon-btn"
          aria-label="Search students"
          aria-expanded={searchExpanded}
          onClick={() => {
            setSearchExpanded(true)
            window.setTimeout(() => inputRef.current?.focus(), 0)
          }}
        >
          <Search size={18} />
        </button>
        <div className="top-search-wrap" ref={wrapRef}>
          <div className={'top-search' + (open ? ' is-open' : '')}>
            <Search size={14} />
            <input
              ref={inputRef}
              type="search"
              enterKeyHint="search"
              role="combobox"
              aria-autocomplete="list"
              value={query}
              onChange={(e) => {
                setQuery(e.target.value)
                setOpen(true)
              }}
              onFocus={() => {
                setOpen(true)
              }}
              placeholder="Search students…"
              aria-label="Search students"
              aria-expanded={open}
              aria-controls={open && query.trim() ? 'student-search-results' : undefined}
            />
            {query && (
              <button
                type="button"
                className="top-search-clear"
                aria-label="Clear search"
                onClick={() => {
                  setQuery('')
                  setOpen(false)
                }}
              >
                <X size={14} />
              </button>
            )}
          </div>
          <button type="button" className="top-search-close" aria-label="Close search" onClick={collapseSearch}>
            Cancel
          </button>

          {open && query.trim() && (
            <div className="student-search-panel" id="student-search-results" role="listbox">
              {loadingSearch ? (
                <div className="student-search-empty">Loading student records…</div>
              ) : matches.length === 0 ? (
                <div className="student-search-empty">No student matches “{query.trim()}”.</div>
              ) : (
                matches.map((student) => {
                  const studentInvoices = invoicesFor(student)
                  const eligible = student.status === 'Fully Paid'
                  const outstanding = student.total - student.paid

                  return (
                    <article key={student.registerId} className="student-search-card">
                      <header className="student-search-head">
                        <div>
                          <strong>{student.name}</strong>
                          <p>
                            TAI-{student.registerId} · {student.course}
                          </p>
                        </div>
                        <span className={'student-search-chip' + (eligible ? ' is-ready' : '')}>
                          {eligible ? 'Certificate eligible' : 'Certificate pending'}
                        </span>
                      </header>

                      <div className="student-search-actions">
                        <button
                          type="button"
                          onClick={() => choose(() => router.push(`/students/${student.registerId}`))}
                        >
                          <UserRound size={14} />
                          View student
                        </button>
                        <button
                          type="button"
                          disabled={!eligible}
                          title={eligible ? 'Generate certificate' : `Balance remaining: ${money(outstanding)}`}
                          onClick={() =>
                            eligible && choose(() => router.push(`/students/${student.registerId}/certificate`))
                          }
                        >
                          <FileCheck2 size={14} />
                          {eligible ? 'Generate certificate' : `Not eligible · ${money(outstanding)} due`}
                        </button>
                      </div>

                      <div className="student-search-invoices">
                        <span>
                          <FileText size={13} />
                          Invoices
                        </span>
                        {studentInvoices.length === 0 ? (
                          <p>No invoices yet</p>
                        ) : (
                          <ul>
                            {studentInvoices.map((payment) => (
                              <li key={payment.id}>
                                <button
                                  type="button"
                                  onClick={() =>
                                    choose(() => router.push(`/invoices/${encodeURIComponent(payment.invoice)}`))
                                  }
                                >
                                  <span>{payment.invoice}</span>
                                  <em>
                                    {payment.date} · {money(payment.amount)}
                                  </em>
                                </button>
                              </li>
                            ))}
                          </ul>
                        )}
                      </div>
                    </article>
                  )
                })
              )}
            </div>
          )}
        </div>

        <NotificationPanel role={role} />

        <button
          type="button"
          onClick={openSettings}
          title="Theme & Appearance"
          aria-label="Theme and appearance"
          className="top-secondary inline-flex items-center justify-center w-8 h-8 rounded-full border border-[var(--border)] bg-[var(--panel)] text-[var(--mute)] hover:text-[var(--g1)] hover:bg-[var(--hover-bg)] transition-all cursor-pointer"
        >
          <Palette size={14} />
        </button>

        <Link
          href="/settings/user"
          title="User settings"
          aria-label="User settings"
          className="top-secondary inline-flex items-center justify-center w-8 h-8 rounded-full border border-[var(--border)] bg-[var(--panel)] text-[var(--mute)] hover:text-[var(--text)] hover:bg-[var(--hover-bg)] transition-all"
        >
          <UserCog size={14} />
        </Link>

        <button
          type="button"
          onClick={() => void handleSignOut()}
          title="Sign out"
          aria-label="Sign out"
          className="top-secondary inline-flex items-center justify-center w-8 h-8 rounded-full border border-[var(--border)] bg-[var(--panel)] text-[var(--mute)] hover:text-rose-500 hover:bg-rose-50/50 transition-all cursor-pointer"
        >
          <LogOut size={14} />
        </button>
      </div>
    </header>
  )
}
