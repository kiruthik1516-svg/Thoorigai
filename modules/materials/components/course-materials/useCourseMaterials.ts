'use client'

import { useCallback, useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import type { CourseMaterial } from '@/modules/materials/types'
import { apiErrorMessage } from '@/lib/api/error-message'

export type UploadInput = { file: File; title: string; type: string }

function uploadWithProgress(formData: FormData, onProgress: (percent: number) => void) {
  return new Promise<void>((resolve, reject) => {
    const xhr = new XMLHttpRequest()
    xhr.open('POST', '/api/course-materials')
    xhr.upload.onprogress = (evt) => {
      if (evt.lengthComputable) onProgress(Math.round((evt.loaded / evt.total) * 100))
    }
    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        resolve()
        return
      }
      try {
        reject(new Error(apiErrorMessage(JSON.parse(xhr.responseText), 'Upload failed. Check format and permissions.')))
      } catch {
        reject(new Error('Upload failed. Check format and permissions.'))
      }
    }
    xhr.onerror = () => reject(new Error('Network error during upload.'))
    xhr.send(formData)
  })
}

/** Materials for one course: load, upload (with progress) and delete through /api/course-materials. */
export function useCourseMaterials(courseId: string, initialMaterials: CourseMaterial[], serverLoaded: boolean) {
  const router = useRouter()
  const [materials, setMaterials] = useState<CourseMaterial[]>(initialMaterials)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [successMessage, setSuccessMessage] = useState<string | null>(null)
  const [uploadProgress, setUploadProgress] = useState(0)

  const flashSuccess = (message: string, durationMs: number) => {
    setSuccessMessage(message)
    setTimeout(() => setSuccessMessage(null), durationMs)
  }

  const refresh = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const response = await fetch(`/api/course-materials?courseId=${encodeURIComponent(courseId)}`)
      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(apiErrorMessage(errorData, 'Failed to fetch course materials'))
      }
      const data = await response.json()
      setMaterials(data.data || [])
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An unknown error occurred')
    } finally {
      setLoading(false)
    }
  }, [courseId])

  useEffect(() => {
    if (!serverLoaded) void refresh()
  }, [serverLoaded, refresh])

  /** Resolves to true once the file is stored and the list is reloaded. */
  const upload = async ({ file, title, type }: UploadInput) => {
    setError(null)
    setUploadProgress(0)
    try {
      const formData = new FormData()
      formData.append('file', file)
      formData.append('courseId', courseId)
      formData.append('title', title.trim())
      formData.append('type', type)
      await uploadWithProgress(formData, setUploadProgress)
      flashSuccess('Course material uploaded successfully.', 3500)
      // The list is client state seeded from the server render, so reload it here; refreshing the
      // route alone left a server-rendered list without the new file.
      await refresh()
      if (serverLoaded) router.refresh()
      return true
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Upload failed.')
      return false
    } finally {
      setUploadProgress(0)
    }
  }

  const remove = async (id: string) => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch(`/api/course-materials?id=${encodeURIComponent(id)}`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
      })
      if (!res.ok) throw new Error('Could not delete course material.')
      setMaterials((prev) => prev.filter((m) => m.id !== id))
      flashSuccess('Course material deleted.', 3000)
      return true
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete material.')
      return false
    } finally {
      setLoading(false)
    }
  }

  return { materials, loading, error, setError, successMessage, uploadProgress, upload, remove }
}
