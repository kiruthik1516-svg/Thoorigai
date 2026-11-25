'use client'

import { useCallback, useEffect, useState } from 'react'
import type { Student } from '@/lib/types'
import { apiErrorMessage } from '@/lib/api/error-message'
import type { StudentOption } from '../../utils/google-form-parser'
import { bulkScoreEntries, scoresByStudent, type Assessment, type AssessmentResult } from './model'

type Notify = { onError: (message: string | null) => void; onNotice: (message: string) => void }

const PAGE_SIZE = 100

/** Reads every page of a list endpoint (the API returns at most 100 rows per page). */
async function fetchAllPages<T>(url: (page: number) => string, failure: string): Promise<T[]> {
  const rows: T[] = []
  for (let page = 1; page <= 100; page += 1) {
    const response = await fetch(url(page))
    const body = await response.json().catch(() => null)
    if (!response.ok) throw new Error(apiErrorMessage(body, failure))
    const data = ((body?.data ?? []) as T[]) || []
    rows.push(...data)
    if (data.length < PAGE_SIZE) break
  }
  return rows
}

/** Roster, results and score inputs for the assessment open in the Grading Studio. */
export function useGradingStudio(assessment: Assessment | null, { onError, onNotice }: Notify) {
  const [students, setStudents] = useState<StudentOption[]>([])
  const [results, setResults] = useState<AssessmentResult[]>([])
  const [bulkScores, setBulkScores] = useState<Record<string, string>>({})
  const [saving, setSaving] = useState(false)
  const assessmentId = assessment?.id ?? null
  const courseId = assessment?.courseId ?? null

  const loadResults = useCallback(
    async (id: string) => {
      try {
        const list = await fetchAllPages<AssessmentResult>(
          (page) => `/api/assessments/${id}/results?page=${page}&pageSize=${PAGE_SIZE}`,
          'Failed to fetch assessment results',
        )
        setResults(list)
        setBulkScores(scoresByStudent(list))
      } catch (error) {
        setResults([])
        onError(error instanceof Error ? error.message : 'Failed to fetch assessment results')
      }
    },
    [onError],
  )

  useEffect(() => {
    if (!assessmentId || !courseId) {
      setResults([])
      setStudents([])
      setBulkScores({})
      return
    }
    const loadRoster = async () => {
      try {
        const roster = await fetchAllPages<Student>(
          (page) => `/api/students?course=${encodeURIComponent(courseId)}&page=${page}&pageSize=${PAGE_SIZE}`,
          'Failed to fetch students',
        )
        // /api/students returns camelCase students; the grading table and Google Forms import key on register_id.
        setStudents(
          roster.map((student) => ({
            id: student.id ?? String(student.registerId),
            register_id: student.registerId,
            name: student.name,
          })),
        )
      } catch (error) {
        setStudents([])
        onError(error instanceof Error ? error.message : 'Failed to fetch students')
      }
    }
    void loadRoster()
    void loadResults(assessmentId)
  }, [assessmentId, courseId, loadResults, onError])

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
