import type { Student } from '@/lib/types'
import { studentInitials } from './model'
import { Calendar, CircleDollarSign, Compass, Mail, MapPin, Phone, User } from 'lucide-react'
import Link from 'next/link'
import { money } from '@/lib/formatters'
import { Status } from '@/components/Status'
import { CategoryBadge } from '@/components/CategoryBadge'

export function StudentProfileHero({
  student,
  balance,
  categoryName,
  courseDuration,
  isStaff,
  canRecordPayment,
}: {
  student: Student
  balance: number
  categoryName?: string | null
  courseDuration?: string
  isStaff: boolean
  canRecordPayment: boolean
}) {
  return (
    <div className="bg-white rounded-2xl border border-slate-200/90 p-6 shadow-xs">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-5 pb-6 border-b border-slate-100">
        <div className="flex items-start sm:items-center gap-4">
          <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-indigo-600 to-indigo-800 text-white font-extrabold text-xl flex items-center justify-center shrink-0 shadow-xs tracking-wider">
            {studentInitials(student.name)}
          </div>

          <div>
            <h1 className="text-2xl font-bold text-slate-900 tracking-tight leading-tight">{student.name}</h1>

            <div className="flex items-center gap-2.5 flex-wrap text-xs text-slate-500 mt-2">
              <span className="font-mono text-xs font-bold px-2 py-0.5 rounded-md bg-slate-100 text-slate-700 border border-slate-200">
                TAI-{student.registerId}
              </span>
              <Status status={student.status} />
              <span className="text-slate-300">|</span>
              <span className="font-semibold text-slate-800">{student.course}</span>
              {categoryName && <CategoryBadge categoryName={categoryName} duration={courseDuration} />}
              <span>•</span>
              <span>Batch started {student.batch}</span>
            </div>
          </div>
        </div>

        {!isStaff && canRecordPayment && balance > 0 && (
          <Link
            href={`/invoices/record?studentId=${student.registerId}`}
            className="inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700 shadow-xs transition-colors shrink-0"
          >
            <CircleDollarSign size={16} />
            <span>Record Payment</span>
            <span className="bg-emerald-700 px-1.5 py-0.5 rounded text-[10px]">Due {money(balance)}</span>
          </Link>
        )}
      </div>

      {/* Contact & Personal Information Details Grid */}
      <div className="pt-5">
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 xl:grid-cols-7 gap-4 text-xs">
          <div>
            <span className="text-slate-500 block mb-1 font-medium flex items-center gap-1">
              <Phone size={13} className="text-slate-500" /> Primary Phone
            </span>
            <strong className="text-slate-900 font-mono text-sm block">
              {student.phone ? (
                <a
                  href={`tel:+91${student.phone}`}
                  className="tap-link justify-start! hover:text-indigo-600 transition-colors"
                >
                  +91 {student.phone}
                </a>
              ) : (
                '—'
              )}
            </strong>
          </div>

          <div>
            <span className="text-slate-500 block mb-1 font-medium flex items-center gap-1">
              <Phone size={13} className="text-slate-500" /> Alternate Phone
            </span>
            <strong className="text-slate-900 font-mono text-sm block">
              {student.altPhone ? (
                <a
                  href={`tel:+91${student.altPhone}`}
                  className="tap-link justify-start! hover:text-indigo-600 transition-colors"
                >
                  +91 {student.altPhone}
                </a>
              ) : (
                <span className="text-slate-500 font-mono font-normal">—</span>
              )}
            </strong>
          </div>

          <div>
            <span className="text-slate-500 block mb-1 font-medium flex items-center gap-1">
              <Mail size={13} className="text-slate-500" /> Email Address
            </span>
            <strong className="text-slate-900 truncate block">
              {student.email ? (
                <a
                  href={`mailto:${student.email}`}
                  className="hover:text-indigo-600 transition-colors"
                  title={student.email}
                >
                  {student.email}
                </a>
              ) : (
                <span className="text-slate-500 font-normal">—</span>
              )}
            </strong>
          </div>

          <div>
            <span className="text-slate-500 block mb-1 font-medium flex items-center gap-1">
              <Calendar size={13} className="text-slate-500" /> Date of Birth
            </span>
            <strong className="text-slate-900 block">{student.dob || '—'}</strong>
          </div>

          <div>
            <span className="text-slate-500 block mb-1 font-medium flex items-center gap-1">
              <MapPin size={13} className="text-slate-500" /> Location
            </span>
            <strong
              className="text-slate-900 block truncate"
              title={[student.area, student.city, student.state].filter(Boolean).join(', ') || 'Tamil Nadu, India'}
            >
              {[student.area, student.city, student.state].filter(Boolean).join(', ') || 'Tamil Nadu, India'}
            </strong>
          </div>

          <div>
            <span className="text-slate-500 block mb-1 font-medium flex items-center gap-1">
              <User size={13} className="text-slate-500" /> Gender / Status
            </span>
            <strong className="text-slate-900 block">
              {[student.gender, student.maritalStatus].filter(Boolean).join(' · ') || 'Student'}
            </strong>
          </div>

          {!isStaff && (
            <div>
              <span className="text-slate-500 block mb-1 font-medium flex items-center gap-1">
                <Compass size={13} className="text-slate-500" /> Source
              </span>
              <strong className="text-slate-900 block truncate" title={student.studentSource || 'Direct Walk-in'}>
                {student.studentSource || 'Direct Walk-in'}
              </strong>
            </div>
          )}
        </div>

        {((student.knowledgeTags && student.knowledgeTags.length > 0) || student.comments) && (
          <div className="mt-4 pt-4 border-t border-slate-100 flex flex-col md:flex-row gap-4 items-start justify-between text-xs">
            {student.knowledgeTags && student.knowledgeTags.length > 0 && (
              <div className="flex-1">
                <span className="text-slate-500 font-medium block mb-1.5">Knowledge & Skill Tags:</span>
                <div className="flex flex-wrap gap-1.5">
                  {student.knowledgeTags.map((tag) => (
                    <span
                      key={tag}
                      className="px-2 py-0.5 rounded-md text-[11px] bg-indigo-50 text-indigo-700 font-medium border border-indigo-100"
                    >
                      {tag}
                    </span>
                  ))}
                </div>
              </div>
            )}
            {student.comments && (
              <div className="flex-1">
                <span className="text-slate-500 font-medium block mb-1.5">Counselor Remarks:</span>
                <p className="text-slate-700 italic bg-slate-50 p-2.5 rounded-xl border border-slate-200/60">
                  &ldquo;{student.comments}&rdquo;
                </p>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
