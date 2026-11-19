import { describe, expect, it } from 'vitest'
import type { CourseMaterial } from '@/modules/materials/types'
import {
  detectMaterialType,
  fileTypeTheme,
  filterMaterials,
  folderCounts,
  materialFolder,
  titleFromFileName,
} from './model'

const material = (id: string, type: string, title = id, uploader?: string): CourseMaterial =>
  ({
    id,
    type,
    title,
    storagePath: `course/${id}.bin`,
    uploadedBy: uploader ? { fullName: uploader } : null,
  }) as unknown as CourseMaterial

describe('materialFolder', () => {
  it('classifies known types and treats anything else as a document', () => {
    expect(materialFolder('PDF')).toBe('pdf')
    expect(materialFolder('image/jpeg')).toBe('image')
    expect(materialFolder('pptx')).toBe('presentation')
    expect(materialFolder('zip')).toBe('zip')
    expect(materialFolder('docx')).toBe('document')
    expect(materialFolder('video')).toBe('document')
  })
})

describe('folder counts and filter', () => {
  const materials = [
    material('a', 'pdf', 'Week 1 Syllabus', 'Asha'),
    material('b', 'image', 'Architecture diagram'),
    material('c', 'video', 'Recording'),
  ]

  it('counts every material in exactly one folder, matching the folder filter', () => {
    const counts = folderCounts(materials)
    expect(counts).toEqual({ all: 3, pdf: 1, image: 1, presentation: 0, document: 1, zip: 0 })
    for (const folder of ['pdf', 'image', 'presentation', 'document', 'zip'] as const) {
      expect(filterMaterials(materials, folder, '')).toHaveLength(counts[folder])
    }
  })

  it('searches title, storage path and uploader', () => {
    expect(filterMaterials(materials, 'all', 'syllabus').map((m) => m.id)).toEqual(['a'])
    expect(filterMaterials(materials, 'all', 'course/b').map((m) => m.id)).toEqual(['b'])
    expect(filterMaterials(materials, 'all', 'ASHA').map((m) => m.id)).toEqual(['a'])
    expect(filterMaterials(materials, 'pdf', 'diagram')).toEqual([])
  })
})

describe('upload helpers', () => {
  it('detects the type from the extension and builds a readable title', () => {
    expect(detectMaterialType('notes.JPEG')).toBe('image')
    expect(detectMaterialType('deck.pptx')).toBe('presentation')
    expect(detectMaterialType('syllabus.pdf')).toBe('pdf')
    expect(detectMaterialType('no-extension')).toBe('pdf')
    expect(titleFromFileName('week-3_react.state.pdf')).toBe('week 3 react.state')
  })

  it('themes cards by folder', () => {
    expect(fileTypeTheme('pdf').tag).toBe('PDF')
    expect(fileTypeTheme('png').tag).toBe('IMG')
    expect(fileTypeTheme('unknown').tag).toBe('DOC')
  })
})
