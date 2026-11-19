'use client'

import { useCallback, useEffect, useState } from 'react'
import type { Student } from '@/lib/types'
import { apiErrorMessage } from '@/lib/api/error-message'
import type { StudentOption } from '../../utils/google-form-parser'
import { bulkScoreEntries, scoresByStudent, type Assessment, type AssessmentResult } from './model'

type Notify = { onError: (message: string | null) => void; onNotice: (message: string) => void }

/** Roster, results and score inputs for the assessment open in the Grading Studio. */
export function useGradingStudio(assessment: Assessment | null, { onError, onNotice }: Notify) {
  const [students, setStudents] = useState<StudentOption[]>([])
  const [results, setResults] = useState<AssessmentResult[]>([])
  const [bulkScores, setBulkScores] = useState<Record<string, string>>({})
  const [saving, setSaving] = useState(false)
  const assessmentId = assessment?.id ?? null
  const courseId = assessment?.courseId ?? null

  const loadResults = useCallback(async (id: string) => {
    try {
      const response = await fetch(`/api/assessments/${id}/results?page=1&pageSize=100`)
      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(apiErrorMessage(errorData, 'Failed to fetch assessment results'))
      }
      const data = await response.json()
      const list: AssessmentResult[] = data.data || []
      setResults(list)
      setBulkScores(scoresByStudent(list))
    } catch {
      setResults([])
    }
  }, [])

  useEffect(() => {
    if (!assessmentId || !courseId) {
      setResults([])
      setStudents([])
      setBulkScores({})
      return
    }
    const loadRoster = async () => {
      try {
        const response = await fetch(`/api/students?course=${courseId}&page=1&pageSize=100`)
        if (!response.ok) throw new Error('Failed to fetch students')
        const data = (await response.json()) as { data?: Student[] }
        // /api/students returns camelCase students; the grading table and Google Forms import key on register_id.
        setStudents(
          (data.data ?? []).map((student) => ({
            id: student.id ?? String(student.registerId),
            register_id: student.registerId,
            name: student.name,
          })),
        )
      } catch {
        setStudents([])
      }
    }
    void loadRoster()
    void loadResults(assessmentId)
  }, [assessmentId, courseId, loadResults])

  const refreshResults = () => {
    if (assessmentId) void loadResults(assessmentId)
  }

  const setScore = (registerId: number, value: string) =>
    setBulkScores((prev) => ({ ...prev, [String(registerId)]: value }))

  const saveScores = async () => {
    if (!assessmentId) return
    const entries = bulkScoreEntries(bulkScores)
    if (entries.length === 0) return

    setSaving(true)
    onError(null)
    try {
      const response = await fetch(`/api/assessments/${assessmentId}/results`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ results: entries }),
      })
      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(apiErrorMessage(errorData, 'Failed to save bulk scores'))
      }
      await loadResults(assessmentId)
      onNotice(`Saved ${entries.length} scores successfully.`)
    } catch (err) {
      onError(err instanceof Error ? err.message : 'Failed to save bulk scores')
    } finally {
      setSaving(false)
    }
  }

  const removeResult = async (resultId: string) => {
    if (!assessmentId) return false
    try {
      const response = await fetch(
        `/api/assessments/${assessmentId}/results?resultId=${encodeURIComponent(resultId)}`,
        { method: 'DELETE' },
      )
      if (!response.ok) throw new Error('Failed to delete result')
      setResults((prev) => prev.filter((r) => r.id !== resultId))
      onNotice('Assessment result deleted.')
      return true
    } catch (err) {
      onError(err instanceof Error ? err.message : 'Failed to delete result')
      return false
    }
  }

  return { students, results, bulkScores, setScore, saving, refreshResults, saveScores, removeResult }
}
