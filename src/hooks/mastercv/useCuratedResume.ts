import { useState, useEffect } from 'react'
import { insertCuratedResume, fetchCuratedResume, fetchCuratedResumes, updateCuratedResume } from '@/services/curatedResumeService'
import type { CVContent } from '@/services/cvService'
import type { CuratedResume } from '@/types'

export function useCuratedResume(userId: string | null) {
  const [resumes,      setResumes]      = useState<CuratedResume[]>([])
  const [activeResume, setActiveResume] = useState<CuratedResume | null>(null)
  const [loading,      setLoading]      = useState(true)

  useEffect(() => {
    if (!userId) { setLoading(false); return }
    fetchCuratedResumes(userId).then((list) => {
      setResumes(list)
      if (list.length > 0) setActiveResume(list[0])
      setLoading(false)
    })
  }, [userId])

  async function handleCreate(
    uid: string,
    label: string,
    content: CVContent,
    sectionOrder: string[],
    matchedKeywords: string[],
  ): Promise<CuratedResume | null> {
    const { data } = await insertCuratedResume(uid, label, content, sectionOrder, matchedKeywords)
    if (data) {
      setResumes((prev) => [data, ...prev])
      setActiveResume(data)
    }
    return data
  }

  async function handleUpdate(id: string, content: CVContent, sectionOrder: string[]): Promise<void> {
    await updateCuratedResume(id, content, sectionOrder)
    setResumes((prev) => prev.map((r) => r.id === id ? { ...r, content, sectionOrder } : r))
    if (activeResume?.id === id) setActiveResume((prev) => prev ? { ...prev, content, sectionOrder } : prev)
  }

  async function handleSelect(id: string): Promise<void> {
    const existing = resumes.find((r) => r.id === id)
    if (existing) { setActiveResume(existing); return }
    const fetched = await fetchCuratedResume(id)
    if (fetched) setActiveResume(fetched)
  }

  return {
    resumes, setResumes,
    activeResume, setActiveResume,
    loading,
    handleCreate,
    handleUpdate,
    handleSelect,
  }
}
