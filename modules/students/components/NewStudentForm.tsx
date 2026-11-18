'use client'

import { useRef } from 'react'
import { useRouter } from 'next/navigation'
import type { Course, Role } from '@/lib/types'
import { AddStudent } from '@/modules/students/components/AddStudent'
import { useCreateStudentMutation } from '@/lib/query/mutations'

export function NewStudentForm({
  courses,
  gstRate,
  role = 'admin',
}: {
  courses: Course[]
  gstRate: number
  role?: Role
}) {
  const router = useRouter()
  const createStudent = useCreateStudentMutation()
  // F-19: retries of the same details reuse one key, so a timeout never enrols a student twice.
  const idempotencyRef = useRef<{ key: string; signature: string } | null>(null)
  return (
    <AddStudent
      courses={courses}
      gstRate={gstRate}
      role={role}
      onClose={() => router.back()}
      onSave={async (student) => {
        const signature = JSON.stringify(student)
        if (idempotencyRef.current?.signature !== signature) {
          idempotencyRef.current = { key: crypto.randomUUID(), signature }
        }
        const result = await createStudent.mutateAsync({ student, idempotencyKey: idempotencyRef.current.key })
        idempotencyRef.current = null
        router.push(result.data.data.registerId ? `/students/${result.data.data.registerId}` : '/students')
      }}
    />
  )
}
