import { Download, Trash2, Eye } from 'lucide-react'
import type { CourseMaterial } from '@/modules/materials/types'
import { fileTypeTheme, formatMaterialDate } from './model'

export function MaterialsList({
  materials,
  canDelete,
  onDelete,
}: {
  materials: CourseMaterial[]
  canDelete: boolean
  onDelete: (material: CourseMaterial) => void
}) {
  return (
    <div className="bg-[var(--card)] border border-[var(--border)] rounded-xl overflow-hidden shadow-xs">
      <table className="w-full text-left text-xs">
        <thead className="bg-[var(--panel)] border-b border-[var(--border)] text-[var(--mute)] font-bold uppercase tracking-wider text-[11px]">
          <tr>
            <th className="py-3 px-4">Resource</th>
            <th className="py-3 px-4">Category Type</th>
            <th className="py-3 px-4">Uploaded By</th>
            <th className="py-3 px-4">Date Added</th>
            <th className="py-3 px-4 text-right">Actions</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-[var(--border)]">
          {materials.map((material) => {
            const theme = fileTypeTheme(material.type)
            const Icon = theme.icon

            return (
              <tr key={material.id} className="hover:bg-[var(--panel)] transition-colors group">
                <td className="py-3 px-4">
                  <div className="flex items-center gap-3">
                    <div className={`w-8 h-8 rounded-lg ${theme.iconBg} flex items-center justify-center shrink-0`}>
                      <Icon size={16} />
                    </div>
                    <div>
                      <span className="font-bold text-[var(--text)] group-hover:text-[var(--g1)] transition-colors block text-sm">
                        {material.title}
                      </span>
                      <span className="text-[11px] text-[var(--mute)] font-mono block">
                        {material.storagePath.split('/').pop() || material.storagePath}
                      </span>
                    </div>
                  </div>
                </td>
                <td className="py-3 px-4">
                  <span
                    className={`inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-bold border ${theme.badge}`}
                  >
                    {theme.tag}
                  </span>
                </td>
                <td className="py-3 px-4 text-[var(--text)]">
                  <div className="flex items-center gap-1.5">
                    <div className="w-5 h-5 rounded-full bg-[var(--panel)] text-[var(--text)] flex items-center justify-center text-[10px] font-bold">
                      {material.uploadedBy?.fullName?.[0] || 'S'}
                    </div>
                    <span className="font-medium">{material.uploadedBy?.fullName || 'Staff Member'}</span>
                  </div>
                </td>
                <td className="py-3 px-4 text-[var(--mute)] whitespace-nowrap">
                  {formatMaterialDate(material.createdAt)}
                </td>
                <td className="py-3 px-4 text-right whitespace-nowrap">
                  <div className="flex items-center justify-end gap-1.5">
                    {material.signedUrl ? (
                      <>
                        <a
                          href={material.signedUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="p-1.5 rounded-full text-[var(--mute)] hover:text-[var(--text)] hover:bg-[var(--panel)] transition-colors"
                          title="View"
                        >
                          <Eye size={15} />
                        </a>
                        <a
                          href={material.signedUrl}
                          download
                          className="p-1.5 rounded-full text-[var(--g1)] hover:bg-[var(--panel)] transition-colors"
                          title="Download"
                        >
                          <Download size={15} />
                        </a>
                      </>
                    ) : null}
                    {canDelete && (
                      <button
                        type="button"
                        onClick={() => onDelete(material)}
                        className="p-1.5 rounded-full text-[var(--mute)] hover:text-[#b53c37] hover:bg-rose-500/10 transition-colors cursor-pointer"
                        title="Delete"
                      >
                        <Trash2 size={15} />
                      </button>
                    )}
                  </div>
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}
