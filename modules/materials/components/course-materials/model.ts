import { FileArchive, FileText, Image as ImageIcon, Presentation, type LucideIcon } from 'lucide-react'
import { format, parseISO } from 'date-fns'
import type { CourseMaterial } from '@/modules/materials/types'

export type MaterialFolder = 'pdf' | 'image' | 'presentation' | 'document' | 'zip'
export type FolderCategory = 'all' | MaterialFolder

/** One classification for counts, the folder filter and the card theme (unknown types are documents). */
export function materialFolder(type: string): MaterialFolder {
  const t = type.toLowerCase()
  if (t.includes('pdf')) return 'pdf'
  if (t.includes('image') || t.includes('png') || t.includes('jpg') || t.includes('jpeg')) return 'image'
  if (t.includes('presentation') || t.includes('ppt')) return 'presentation'
  if (t.includes('zip') || t.includes('archive')) return 'zip'
  return 'document'
}

export function folderCounts(materials: CourseMaterial[]): Record<FolderCategory, number> {
  const counts: Record<FolderCategory, number> = {
    all: materials.length,
    pdf: 0,
    image: 0,
    presentation: 0,
    document: 0,
    zip: 0,
  }
  materials.forEach((m) => counts[materialFolder(m.type)]++)
  return counts
}

export function filterMaterials(materials: CourseMaterial[], folder: FolderCategory, search: string) {
  const query = search.trim().toLowerCase()
  return materials.filter((item) => {
    if (folder !== 'all' && materialFolder(item.type) !== folder) return false
    if (!query) return true
    return (
      item.title.toLowerCase().includes(query) ||
      item.storagePath.toLowerCase().includes(query) ||
      Boolean(item.uploadedBy?.fullName?.toLowerCase().includes(query))
    )
  })
}

export function formatMaterialDate(dateString: string) {
  try {
    return format(parseISO(dateString), 'MMM d, yyyy')
  } catch {
    return dateString
  }
}

export type FileTypeTheme = {
  label: string
  tag: string
  heroBg: string
  badge: string
  iconBg: string
  icon: LucideIcon
}

const THEMES: Record<MaterialFolder, FileTypeTheme> = {
  pdf: {
    label: 'PDF Document',
    tag: 'PDF',
    heroBg: 'bg-gradient-to-br from-rose-50 to-red-100/60 border-b border-rose-200/80',
    badge: 'bg-rose-100 text-rose-800 border-rose-200',
    iconBg: 'bg-rose-600 text-white',
    icon: FileText,
  },
  image: {
    label: 'Image / Diagram',
    tag: 'IMG',
    heroBg: 'bg-gradient-to-br from-emerald-50 to-teal-100/60 border-b border-emerald-200/80',
    badge: 'bg-emerald-100 text-emerald-800 border-emerald-200',
    iconBg: 'bg-emerald-600 text-white',
    icon: ImageIcon,
  },
  presentation: {
    label: 'Presentation Slide',
    tag: 'PPT',
    heroBg: 'bg-gradient-to-br from-amber-50 to-orange-100/60 border-b border-amber-200/80',
    badge: 'bg-amber-100 text-amber-800 border-amber-200',
    iconBg: 'bg-amber-600 text-white',
    icon: Presentation,
  },
  zip: {
    label: 'Project Archive',
    tag: 'ZIP',
    heroBg: 'bg-gradient-to-br from-purple-50 to-violet-100/60 border-b border-purple-200/80',
    badge: 'bg-purple-100 text-purple-800 border-purple-200',
    iconBg: 'bg-purple-600 text-white',
    icon: FileArchive,
  },
  document: {
    label: 'Document / Guide',
    tag: 'DOC',
    heroBg: 'bg-gradient-to-br from-blue-50 to-indigo-100/60 border-b border-blue-200/80',
    badge: 'bg-blue-100 text-blue-800 border-blue-200',
    iconBg: 'bg-blue-600 text-white',
    icon: FileText,
  },
}

export function fileTypeTheme(type: string): FileTypeTheme {
  return THEMES[materialFolder(type)]
}

/** Material type from the file extension (the upload form's default selection). */
export function detectMaterialType(fileName: string): MaterialFolder {
  const ext = fileName.split('.').pop()?.toLowerCase()
  if (ext === 'png' || ext === 'jpg' || ext === 'jpeg') return 'image'
  if (ext === 'pptx' || ext === 'ppt') return 'presentation'
  if (ext === 'docx' || ext === 'doc' || ext === 'txt') return 'document'
  if (ext === 'zip') return 'zip'
  return 'pdf'
}

/** "week-3_slides.pdf" -> "week 3 slides". */
export function titleFromFileName(fileName: string) {
  return fileName.replace(/\.[^/.]+$/, '').replace(/[-_]/g, ' ')
}
