import { useState, useEffect, useRef } from 'react'
import { fetchJobDetails, updateJobDetails } from '@/services/jobService'
import type { Job } from '@/types'

export function useJobDetail(
  jobs: Job[],
  jobId: string,
  onChange: (updated: Job) => void,
) {
  const currentIdx = jobs.findIndex((j) => j.id === jobId)
  const [localIdx,       setLocalIdx]       = useState(currentIdx === -1 ? 0 : currentIdx)
  const [detailsLoading, setDetailsLoading] = useState(false)
  const [saveState,      setSaveState]      = useState<'idle' | 'saving' | 'saved' | 'error'>('idle')
  const [saveError,      setSaveError]      = useState<string | null>(null)
  const loadedIds = useRef<Set<string>>(new Set())

  const job = jobs[localIdx] ?? jobs[0]

  useEffect(() => {
    if (!job || loadedIds.current.has(job.id)) return
    if (job.description !== undefined && job.notes !== undefined) {
      loadedIds.current.add(job.id)
      return
    }
    setDetailsLoading(true)
    fetchJobDetails(job.id).then((details) => {
      setDetailsLoading(false)
      if (!details) return
      loadedIds.current.add(job.id)
      onChange({
        ...job,
        description:     details.description      ?? '',
        notes:           details.notes            ?? '',
        curatedResumeId: details.curated_resume_id ?? undefined,
        coverLetterId:   details.cover_letter_id   ?? undefined,
      })
    })
  }, [job?.id]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => { setSaveState('idle'); setSaveError(null) }, [localIdx])

  function goJob(dir: -1 | 1) {
    setLocalIdx((prev) => Math.max(0, Math.min(jobs.length - 1, prev + dir)))
  }

  function update<K extends keyof Job>(key: K, val: Job[K]) {
    if (!job) return
    onChange({ ...job, [key]: val })
  }

  async function handleSave(): Promise<{ error: string | null }> {
    if (!job || saveState === 'saving') return { error: null }
    setSaveState('saving')
    setSaveError(null)
    const { error } = await updateJobDetails(job.id, {
      description: job.description ?? null,
      notes:       job.notes       ?? null,
    })
    if (error) {
      setSaveError(error)
      setSaveState('error')
      setTimeout(() => setSaveState('idle'), 2000)
    } else {
      setSaveState('saved')
      setTimeout(() => setSaveState('idle'), 1200)
    }
    return { error: error ?? null }
  }

  return {
    job,
    localIdx,
    setLocalIdx,
    detailsLoading,
    saveState,
    saveError,
    goJob,
    update,
    handleSave,
  }
}
