import { useState, useEffect } from 'react'
import { insertTailoredResume, fetchTailoredResume, fetchTailoredResumes, updateTailoredResume } from '@/services/tailoredResumeService'
import type { CVContent, TailoredResume } from '@/types'

export function useTailoredResume(userId: string | null) {
  const [resumes,      setResumes]      = useState<TailoredResume[]>([])
  const [activeResume, setActiveResume] = useState<TailoredResume | null>(null)
  const [loading,      setLoading]      = useState(true)

  useEffect(() => {
    if (!userId) { setLoading(false); return }
    fetchTailoredResumes(userId).then((list) => {
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
  ): Promise<TailoredResume | null> {
    const { data } = await insertTailoredResume(uid, label, content, sectionOrder, matchedKeywords)
    if (data) {
      setResumes((prev) => [data, ...prev])
      setActiveResume(data)
    }
    return data
  }

  async function handleUpdate(id: string, content: CVContent, sectionOrder: string[]): Promise<void> {
    await updateTailoredResume(id, content, sectionOrder)
    setResumes((prev) => prev.map((r) => r.id === id ? { ...r, content, sectionOrder } : r))
    if (activeResume?.id === id) setActiveResume((prev) => prev ? { ...prev, content, sectionOrder } : prev)
  }

  async function handleSelect(id: string): Promise<void> {
    const existing = resumes.find((r) => r.id === id)
    if (existing) { setActiveResume(existing); return }
    const fetched = await fetchTailoredResume(id)
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
