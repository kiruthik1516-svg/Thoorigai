'use client'

import { useMemo, useState } from 'react'
import Link from 'next/link'
import {
  AlertCircle,
  ArrowLeft,
  CheckCircle2,
  FolderOpen,
  LayoutGrid,
  List as ListIcon,
  Search,
  UploadCloud,
  X,
} from 'lucide-react'
import { ConfirmDialog } from '@/components/ui/ConfirmDialog'
import type { CourseMaterial } from '@/modules/materials/types'
import { filterMaterials, folderCounts, type FolderCategory } from './course-materials/model'
import { useCourseMaterials } from './course-materials/useCourseMaterials'
import { FolderTabs } from './course-materials/FolderTabs'
import { MaterialsGrid } from './course-materials/MaterialsGrid'
import { MaterialsList } from './course-materials/MaterialsList'
import { UploadMaterialModal } from './course-materials/UploadMaterialModal'

interface CourseMaterialsProps {
  courseId: string
  courseName?: string
  initialMaterials?: CourseMaterial[]
  serverLoaded?: boolean
  canUpload?: boolean
}

export function CourseMaterials({
  courseId,
  courseName = 'Course',
  initialMaterials = [],
  serverLoaded = false,
  canUpload = true,
}: CourseMaterialsProps) {
  const { materials, error, setError, successMessage, uploadProgress, upload, remove } = useCourseMaterials(
    courseId,
    initialMaterials,
    serverLoaded,
  )
  const [search, setSearch] = useState('')
  const [activeFolder, setActiveFolder] = useState<FolderCategory>('all')
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid')
  const [uploadModalOpen, setUploadModalOpen] = useState(false)
  const [pendingDelete, setPendingDelete] = useState<CourseMaterial | null>(null)

  const counts = useMemo(() => folderCounts(materials), [materials])
  const filteredMaterials = useMemo(
    () => filterMaterials(materials, activeFolder, search),
    [materials, activeFolder, search],
  )
  const openUpload = () => {
    setError(null)
    setUploadModalOpen(true)
  }

  const handleDeleteConfirmed = async () => {
    if (pendingDelete && (await remove(pendingDelete.id))) setPendingDelete(null)
  }

  return (
    <div className="space-y-5">
      {/* Android Tablet File Manager Header Bar */}
      <div className="bg-white border border-gray-200/90 rounded-2xl p-5 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          {/* Breadcrumb row */}
          <div className="flex items-center gap-2 text-xs text-gray-500 mb-1.5 font-medium">
            <Link href="/courses" className="hover:text-blue-600 flex items-center gap-1 transition-colors">
              <ArrowLeft size={13} />
              Courses
            </Link>
            <span>/</span>
            <span className="text-gray-700 font-semibold">{courseName}</span>
            <span>/</span>
            <span className="text-blue-600 font-medium">Curriculum Files</span>
          </div>

          <div className="flex items-center gap-3">
            <div
              className="w-10 h-10 rounded-full flex items-center justify-center shadow-xs"
              style={{ background: 'var(--g4)', color: 'var(--g1)' }}
            >
              <FolderOpen size={20} />
            </div>
            <div>
              <h1 className="text-xl font-extrabold text-[var(--text-heading)] tracking-tight leading-none flex items-center gap-2.5">
                {courseName} Materials
                <span className="text-xs px-2.5 py-0.5 rounded-full bg-[var(--g4)] text-[var(--g1)] font-bold border border-[var(--g3)]">
                  {materials.length} {materials.length === 1 ? 'file' : 'files'}
                </span>
              </h1>
              <p className="text-xs text-[var(--mute)] mt-1">
                Syllabus, presentation slide decks, worksheets, and downloadable references
              </p>
            </div>
          </div>
        </div>

        {/* Top Controls: Search, View Mode, Upload Action */}
        <div className="flex items-center flex-wrap gap-2.5">
          {/* Real-time Search */}
          <div className="relative min-w-[200px] flex-1 sm:flex-initial">
            <Search size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[var(--mute)]" />
            <input
              aria-label="Search files"
              type="text"
              placeholder="Search files..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-9 pr-8 py-2 border border-[var(--border)] rounded-full text-xs text-[var(--text)] focus:outline-none focus:ring-2 focus:ring-[var(--g1)] bg-[var(--card)] placeholder:text-[var(--mute)]"
            />
            {search && (
              <button
                type="button"
                onClick={() => setSearch('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-[var(--mute)] hover:text-[var(--text)] p-0.5"
              >
                <X size={13} />
              </button>
            )}
          </div>

          {/* View Mode Switcher */}
          <div className="flex items-center bg-[var(--card)] p-1 rounded-full border border-[var(--border)] shadow-xs">
            <button
              type="button"
              onClick={() => setViewMode('grid')}
              className={`p-1.5 px-2.5 rounded-full text-xs font-semibold transition-all cursor-pointer flex items-center gap-1 ${
                viewMode === 'grid'
                  ? 'bg-[var(--g1)] text-white shadow-xs'
                  : 'text-[var(--mute)] hover:text-[var(--text)]'
              }`}
              title="Grid View"
            >
              <LayoutGrid size={14} />
              <span className="hidden sm:inline">Grid</span>
            </button>
            <button
              type="button"
              onClick={() => setViewMode('list')}
              className={`p-1.5 px-2.5 rounded-full text-xs font-semibold transition-all cursor-pointer flex items-center gap-1 ${
                viewMode === 'list'
                  ? 'bg-[var(--g1)] text-white shadow-xs'
                  : 'text-[var(--mute)] hover:text-[var(--text)]'
              }`}
              title="List View"
            >
              <ListIcon size={14} />
              <span className="hidden sm:inline">List</span>
            </button>
          </div>

          {/* Upload Button */}
          {canUpload && (
            <button type="button" onClick={openUpload} className="btn-primary">
              <UploadCloud size={14} />
              <span>Upload Material</span>
            </button>
          )}
        </div>
      </div>

      {/* Notifications / Feedback */}
      {successMessage && (
        <div className="p-3 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-xl text-xs flex items-center gap-2 animate-in fade-in duration-200">
          <CheckCircle2 size={16} className="text-emerald-600 shrink-0" />
          <span>{successMessage}</span>
        </div>
      )}

      {error && (
        <div className="p-3 bg-red-50 border border-red-200 text-red-800 rounded-xl text-xs flex items-center gap-2 animate-in fade-in duration-200">
          <AlertCircle size={16} className="text-red-600 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Folder Tabs Strip */}
      <FolderTabs activeFolder={activeFolder} counts={counts} onChange={setActiveFolder} />

      {/* Main Content Area */}
      {filteredMaterials.length === 0 ? (
        <div className="bg-[var(--card)] border border-dashed border-[var(--border)] rounded-[22px] p-12 text-center shadow-xs">
          <div
            className="w-14 h-14 rounded-2xl mx-auto flex items-center justify-center mb-3"
            style={{ background: 'var(--panel)', color: 'var(--g1)' }}
          >
            <FolderOpen size={28} />
          </div>
          <h3 className="text-base font-bold text-[var(--text)] mb-1">
            {search ? 'No materials match your search' : 'No materials in this folder'}
          </h3>
          <p className="text-xs text-[var(--mute)] max-w-sm mx-auto mb-4">
            {search
              ? `No curriculum files matching "${search}" were found. Try clearing your search term.`
              : `Upload syllabus documents, lesson slides, and reference files for ${courseName}.`}
          </p>
          {canUpload && (
            <button
              type="button"
              onClick={openUpload}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-full text-xs font-bold text-white shadow-xs transition-opacity hover:opacity-90 cursor-pointer"
              style={{ background: 'linear-gradient(135deg, var(--g1), var(--g1b))' }}
            >
              <UploadCloud size={14} className="mr-0.5" />
              Upload First File
            </button>
          )}
        </div>
      ) : viewMode === 'grid' ? (
        <MaterialsGrid materials={filteredMaterials} canDelete={canUpload} onDelete={setPendingDelete} />
      ) : (
        <MaterialsList materials={filteredMaterials} canDelete={canUpload} onDelete={setPendingDelete} />
      )}

      {/* Upload Material Modal */}
      {uploadModalOpen && (
        <UploadMaterialModal
          courseName={courseName}
          error={error}
          uploadProgress={uploadProgress}
          onError={setError}
          onUpload={upload}
          onClose={() => setUploadModalOpen(false)}
        />
      )}

      {/* Delete Confirmation Dialog */}
      <ConfirmDialog
        isOpen={pendingDelete !== null}
        title={`Delete "${pendingDelete?.title || 'Course Material'}"?`}
        description="Are you sure you want to delete this file? It will be removed from the course curriculum and storage."
        confirmText="Delete Material"
        destructive
        onConfirm={handleDeleteConfirmed}
        onCancel={() => setPendingDelete(null)}
      />
    </div>
  )
}
