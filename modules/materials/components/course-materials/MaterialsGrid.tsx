import { Download, ExternalLink, Trash2, Eye, Clock } from 'lucide-react'
import type { CourseMaterial } from '@/modules/materials/types'
import { fileTypeTheme, formatMaterialDate } from './model'

export function MaterialsGrid({
  materials,
  canDelete,
  onDelete,
}: {
  materials: CourseMaterial[]
  canDelete: boolean
  onDelete: (material: CourseMaterial) => void
}) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
      {materials.map((material) => {
        const theme = fileTypeTheme(material.type)
        const Icon = theme.icon

        return (
          <div
            key={material.id}
            className="bg-[var(--card)] border border-[var(--border)] rounded-[22px] overflow-hidden shadow-xs hover:border-[var(--g1)] transition-all group flex flex-col justify-between"
          >
            {/* Visual Banner Header */}
            <div className={`p-4 relative ${theme.heroBg} flex items-center justify-between`}>
              <div className="flex items-center gap-3">
                <div className={`w-10 h-10 rounded-xl ${theme.iconBg} flex items-center justify-center shadow-xs`}>
                  <Icon size={20} />
                </div>
                <div>
                  <span
                    className={`text-[10px] font-bold tracking-wider uppercase px-2 py-0.5 rounded-full border ${theme.badge}`}
                  >
                    {theme.tag}
                  </span>
                  <div className="text-[11px] text-[var(--mute)] font-medium mt-0.5">{theme.label}</div>
                </div>
              </div>

              {material.signedUrl && (
                <a
                  href={material.signedUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="p-1.5 rounded-full bg-white/80 hover:bg-white text-[var(--text)] shadow-2xs transition-colors"
                  title="Open in new window"
                >
                  <ExternalLink size={14} />
                </a>
              )}
            </div>

            {/* Body Details */}
            <div className="p-4 flex-1 flex flex-col justify-between">
              <div>
                <h3
                  className="font-bold text-[var(--text)] text-sm line-clamp-2 leading-snug transition-colors"
                  title={material.title}
                >
                  {material.title}
                </h3>
                <p className="text-[11px] text-[var(--mute)] font-mono mt-1 truncate" title={material.storagePath}>
                  {material.storagePath.split('/').pop() || material.storagePath}
                </p>
              </div>

              {/* Uploader & Date Metadata */}
              <div className="mt-4 pt-3 border-t border-[var(--border)] flex items-center justify-between text-xs text-[var(--mute)]">
                <div className="flex items-center gap-1.5 truncate max-w-[65%]">
                  <div className="w-5 h-5 rounded-full bg-[var(--panel)] text-[var(--text)] flex items-center justify-center text-[10px] font-bold shrink-0">
                    {material.uploadedBy?.fullName?.[0] || 'U'}
                  </div>
                  <span className="truncate text-[var(--text)] font-semibold">
                    {material.uploadedBy?.fullName || 'Staff'}
                  </span>
                </div>
                <div className="flex items-center gap-1 text-[11px] text-[var(--mute)] shrink-0">
                  <Clock size={11} />
                  <span>{formatMaterialDate(material.createdAt)}</span>
                </div>
              </div>
            </div>

            {/* Card Bottom Actions Toolbar */}
            <div className="px-4 py-2.5 bg-[var(--panel)] border-t border-[var(--border)] flex items-center justify-between gap-1.5">
              <div className="flex items-center gap-1.5">
                {material.signedUrl ? (
                  <>
                    <a
                      href={material.signedUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-semibold text-[var(--text)] bg-[var(--card)] border border-[var(--border)] hover:bg-[var(--panel)] transition-colors shadow-2xs"
                    >
                      <Eye size={13} className="text-[var(--mute)]" />
                      View
                    </a>
                    <a
                      href={material.signedUrl}
                      download
                      className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-bold text-white shadow-2xs transition-opacity hover:opacity-90"
                      style={{ background: 'linear-gradient(135deg, var(--g1), var(--g1b))' }}
                    >
                      <Download size={13} />
                      Download
                    </a>
                  </>
                ) : (
                  <span className="text-[11px] text-[var(--mute)] italic">Cloud link pending</span>
                )}
              </div>

              {canDelete && (
                <button
                  type="button"
                  onClick={() => onDelete(material)}
                  className="p-1.5 rounded-full text-[var(--mute)] hover:text-[#b53c37] hover:bg-rose-500/10 transition-colors cursor-pointer"
                  title="Delete material"
                >
                  <Trash2 size={14} />
                </button>
              )}
            </div>
          </div>
        )
      })}
    </div>
  )
}
