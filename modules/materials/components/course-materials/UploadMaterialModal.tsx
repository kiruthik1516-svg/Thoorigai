'use client'

import { useRef, useState } from 'react'
import { useDialog } from '@/lib/hooks/useDialog'
import { AlertCircle, Check, FileText, Image as ImageIcon, UploadCloud, X } from 'lucide-react'
import { MAX_COURSE_MATERIAL_BYTES } from '@/lib/security/uploads'
import { detectMaterialType, titleFromFileName } from './model'
import type { UploadInput } from './useCourseMaterials'

type Draft = { title: string; type: string; file: File | null }

export function UploadMaterialModal({
  courseName,
  error,
  uploadProgress,
  onError,
  onUpload,
  onClose,
}: {
  courseName: string
  error: string | null
  uploadProgress: number
  onError: (message: string | null) => void
  /** Resolves to true when the file was stored (the modal then closes). */
  onUpload: (input: UploadInput) => Promise<boolean>
  onClose: () => void
}) {
  const dialogRef = useRef<HTMLDivElement>(null)
  useDialog(true, onClose, dialogRef)
  const [newMaterial, setNewMaterial] = useState<Draft>({ title: '', type: 'pdf', file: null })
  const [uploading, setUploading] = useState(false)
  const [isDragOver, setIsDragOver] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  // Picking a file fills in its type and, when the title is still empty, a title from the file name.
  const handleSelectFile = (file: File) => {
    if (file.size > MAX_COURSE_MATERIAL_BYTES) {
      onError('File must be 4 MB or smaller.')
      return
    }
    setNewMaterial((prev) => ({
      ...prev,
      file,
      type: detectMaterialType(file.name),
      title: prev.title.trim() ? prev.title : titleFromFileName(file.name),
    }))
    onError(null)
  }

  const handleUploadSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!newMaterial.file) {
      onError('Please select or drop a file to upload.')
      return
    }
    if (!newMaterial.title.trim()) {
      onError('Please provide a title for the material.')
      return
    }
    setUploading(true)
    try {
      if (await onUpload({ file: newMaterial.file, title: newMaterial.title, type: newMaterial.type })) onClose()
    } finally {
      setUploading(false)
    }
  }

  return (
    <div
      ref={dialogRef}
      role="dialog"
      aria-modal="true"
      aria-label="Upload learning material"
      className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-in fade-in duration-150"
    >
      <div className="bg-[var(--card)] rounded-[26px] shadow-xl border border-[var(--border)] w-full max-w-lg overflow-hidden animate-in zoom-in-95 duration-150">
        {/* Modal Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-[var(--border)]">
          <div className="flex items-center gap-2.5">
            <div
              className="w-9 h-9 rounded-full flex items-center justify-center font-bold"
              style={{ background: 'var(--panel)', color: 'var(--g1)' }}
            >
              <UploadCloud size={18} />
            </div>
            <div>
              <h3 className="text-base font-bold text-[var(--text)]">Upload Learning Material</h3>
              <p className="text-xs text-[var(--mute)]">Adding resource for {courseName}</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={uploading}
            className="text-[var(--mute)] hover:text-[var(--text)] p-1.5 rounded-full hover:bg-[var(--panel)] transition-colors cursor-pointer"
          >
            <X size={18} />
          </button>
        </div>

        {/* Modal Body */}
        <form onSubmit={handleUploadSubmit} className="p-6 space-y-4">
          {/* Drag and Drop Box */}
          <div
            onDragOver={(e) => {
              e.preventDefault()
              setIsDragOver(true)
            }}
            onDragLeave={() => setIsDragOver(false)}
            onDrop={(e) => {
              e.preventDefault()
              setIsDragOver(false)
              if (e.dataTransfer.files && e.dataTransfer.files[0]) {
                handleSelectFile(e.dataTransfer.files[0])
              }
            }}
            role="button"
            tabIndex={0}
            aria-label="Choose a file to upload"
            onClick={() => fileInputRef.current?.click()}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault()
                fileInputRef.current?.click()
              }
            }}
            className={`border-2 border-dashed rounded-[22px] p-6 text-center cursor-pointer transition-all ${
              isDragOver
                ? 'border-[var(--g1)] bg-[var(--panel)]'
                : newMaterial.file
                  ? 'border-[#1b7a4b] bg-emerald-500/10'
                  : 'border-[var(--border)] hover:border-[var(--g1)] bg-[var(--panel)]'
            }`}
          >
            <input
              ref={fileInputRef}
              type="file"
              accept=".pdf,.png,.jpg,.jpeg,application/pdf,image/png,image/jpeg"
              className="hidden"
              onChange={(e) => {
                if (e.target.files && e.target.files[0]) {
                  handleSelectFile(e.target.files[0])
                }
              }}
            />

            {newMaterial.file ? (
              <div className="flex flex-col items-center">
                <div className="w-10 h-10 rounded-full bg-emerald-500/20 text-[#1b7a4b] flex items-center justify-center mb-2">
                  <Check size={20} />
                </div>
                <span className="text-sm font-bold text-[var(--text)] truncate max-w-xs block">
                  {newMaterial.file.name}
                </span>
                <span className="text-xs text-[var(--mute)] mt-0.5">
                  {(newMaterial.file.size / (1024 * 1024)).toFixed(2)} MB · Click to change file
                </span>
              </div>
            ) : (
              <div className="flex flex-col items-center">
                <div
                  className="w-10 h-10 rounded-full flex items-center justify-center mb-2"
                  style={{ background: 'var(--card)', color: 'var(--g1)' }}
                >
                  <UploadCloud size={22} />
                </div>
                <p className="text-sm font-semibold text-[var(--text)]">
                  Drag and drop your file here, or{' '}
                  <span style={{ color: 'var(--g1)' }} className="underline">
                    browse
                  </span>
                </p>
                <p className="text-xs text-[var(--mute)] mt-1">
                  Supports PDF documents, PNG, and JPEG files up to 4 MB
                </p>
              </div>
            )}
          </div>

          {/* Title Field */}
          <div>
            <label htmlFor="material-title" className="block text-xs font-bold text-[var(--text)] mb-1">
              Material Title <span className="text-[#b53c37]">*</span>
            </label>
            <input
              id="material-title"
              type="text"
              required
              placeholder="e.g. Module 3: React State Management Guide"
              value={newMaterial.title}
              onChange={(e) => setNewMaterial((prev) => ({ ...prev, title: e.target.value }))}
              className="w-full px-3.5 py-2.5 border border-[var(--border)] rounded-full text-sm bg-[var(--card)] text-[var(--text)] placeholder-[var(--mute)] focus:outline-none focus:ring-2 focus:ring-[var(--g1)]"
            />
          </div>

          {/* Type Category */}
          <div>
            <p id="material-type-label" className="block text-xs font-bold text-[var(--text)] mb-1">
              Resource Category <span className="text-[#b53c37]">*</span>
            </p>
            <div role="group" aria-labelledby="material-type-label" className="grid grid-cols-2 gap-2.5">
              <button
                type="button"
                onClick={() => setNewMaterial((prev) => ({ ...prev, type: 'pdf' }))}
                className={`p-2.5 rounded-full border text-left text-xs font-medium flex items-center justify-center gap-2 transition-all cursor-pointer ${
                  newMaterial.type === 'pdf'
                    ? 'border-transparent text-white font-bold'
                    : 'border-[var(--border)] text-[var(--text)] bg-[var(--panel)]'
                }`}
                style={
                  newMaterial.type === 'pdf' ? { background: 'linear-gradient(135deg, var(--g1), var(--g1b))' } : {}
                }
              >
                <FileText size={16} />
                <span>PDF Document</span>
              </button>

              <button
                type="button"
                onClick={() => setNewMaterial((prev) => ({ ...prev, type: 'image' }))}
                className={`p-2.5 rounded-full border text-left text-xs font-medium flex items-center justify-center gap-2 transition-all cursor-pointer ${
                  newMaterial.type === 'image'
                    ? 'border-transparent text-white font-bold'
                    : 'border-[var(--border)] text-[var(--text)] bg-[var(--panel)]'
                }`}
                style={
                  newMaterial.type === 'image' ? { background: 'linear-gradient(135deg, var(--g1), var(--g1b))' } : {}
                }
              >
                <ImageIcon size={16} />
                <span>Diagram / Image</span>
              </button>
            </div>
          </div>

          {error && (
            <div
              role="alert"
              className="p-3 bg-red-50 border border-red-200 text-red-800 rounded-xl text-xs flex items-center gap-2"
            >
              <AlertCircle size={16} className="text-red-600 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {/* Upload Progress */}
          {uploading && (
            <div className="space-y-1.5 pt-2">
              <div className="flex justify-between text-xs text-[var(--mute)] font-medium">
                <span>Uploading file...</span>
                <span>{uploadProgress}%</span>
              </div>
              <div className="w-full bg-[var(--panel)] rounded-full h-2 overflow-hidden">
                <div
                  className="h-full rounded-full transition-all duration-150"
                  style={{
                    width: `${uploadProgress}%`,
                    background: 'linear-gradient(90deg, var(--g1), var(--g1b))',
                  }}
                />
              </div>
            </div>
          )}

          {/* Modal Footer */}
          <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-[var(--border)]">
            <button
              type="button"
              onClick={onClose}
              disabled={uploading}
              className="px-4 py-2 rounded-full text-xs font-semibold text-[var(--text)] bg-[var(--panel)] hover:bg-[var(--card)] border border-[var(--border)] transition-colors cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={uploading || !newMaterial.file}
              className="px-5 py-2 rounded-full text-xs font-bold text-white shadow-xs transition-opacity hover:opacity-90 disabled:opacity-50 cursor-pointer"
              style={{ background: 'linear-gradient(135deg, var(--g1), var(--g1b))' }}
            >
              {uploading ? `Uploading ${uploadProgress}%` : 'Upload File'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
