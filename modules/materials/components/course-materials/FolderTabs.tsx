import { FileArchive, FileText, Folder, Image as ImageIcon, Presentation, type LucideIcon } from 'lucide-react'
import type { FolderCategory } from './model'

const TABS: { folder: FolderCategory; label: string; icon: LucideIcon }[] = [
  { folder: 'all', label: 'All Resources', icon: Folder },
  { folder: 'pdf', label: 'PDF Documents', icon: FileText },
  { folder: 'presentation', label: 'Presentations & Slides', icon: Presentation },
  { folder: 'image', label: 'Images & Diagrams', icon: ImageIcon },
  { folder: 'document', label: 'Docs & Guides', icon: FileText },
  { folder: 'zip', label: 'Archives & Code', icon: FileArchive },
]

export function FolderTabs({
  activeFolder,
  counts,
  onChange,
}: {
  activeFolder: FolderCategory
  counts: Record<FolderCategory, number>
  onChange: (folder: FolderCategory) => void
}) {
  return (
    <div className="flex items-center gap-2 overflow-x-auto pb-1 no-scrollbar p-1.5 rounded-full bg-[var(--card)] border border-[var(--border)] shadow-xs">
      {TABS.map(({ folder, label, icon: Icon }) => {
        const active = activeFolder === folder
        return (
          <button
            key={folder}
            type="button"
            onClick={() => onChange(folder)}
            className={`inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full text-xs font-bold whitespace-nowrap transition-all cursor-pointer ${
              active ? 'text-white shadow-xs' : 'text-[var(--mute)] hover:text-[var(--text)]'
            }`}
            style={{ background: active ? 'linear-gradient(135deg, var(--g1), var(--g1b))' : 'transparent' }}
          >
            <Icon size={14} />
            <span>{label}</span>
            <span
              className={`px-1.5 py-0.2 rounded-full text-[10px] font-bold ${
                active ? 'bg-white/20 text-white' : 'bg-[var(--panel)] text-[var(--mute)]'
              }`}
            >
              {counts[folder]}
            </span>
          </button>
        )
      })}
    </div>
  )
}
