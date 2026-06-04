import { useState, useRef, useEffect, useCallback } from 'react'
import type { Job } from '@/types'
import {
  readCache, writeCache,
  fetchJobs, insertJob, updateJob, updateJobDetails as svcUpdateJobDetails,
  deleteJobs as svcDeleteJobs,
  runAutoGhost,
  JOB_CAP,
} from '@/services/jobService'
import { awardXp, xpForJob } from '@/services/xpService'

// ── Draft factory ─────────────────────────────────────────────────────────────

function today(): string {
  return new Date().toISOString()
}

function emptyJob(): Job {
  return {
    id: crypto.randomUUID(),
    company: '',
    title: '',
    status: 'APPLIED',
    postingUrl: '',
    applicationDate: today(),
    rating: 0,
    salary: '',
    committed: false,
    saving: false,
  }
}

// ── Public interface ──────────────────────────────────────────────────────────

export interface JobListState {
  /** Full list: [draftRow, ...committed]. Draft is always index 0. */
  jobs: Job[]
  /** Count of committed (persisted) jobs. */
  committedCount: number

  /**
   * Called when the user edits any field on any row (draft or committed).
   * For committed rows: debounces a DB update and writes the cache.
   * For draft rows: updates local state only.
   */
  onDraftChange: (draft: Job) => void

  /**
   * Called when a draft row is ready to commit.
   * Inserts into DB (optimistically), appends a fresh draft, and returns the
   * new committed count so the page can compute "is this a mega milestone"
   * and spawn a popup at the right pixel position.
   *
   * Returns null if the job cap is already reached (page should show error).
   */
  onCommit: (
    committed: Job,
    rowEl: HTMLTableRowElement | null,
  ) => number | null

  /**
   * Persists detail-card fields (description, notes) for a single committed job.
   * Does not touch React state — detail fields are lazy-loaded and not part of
   * the list view.
   */
  updateJobDetails: (
    jobId: string,
    details: { description: string | null; notes: string | null },
  ) => void

  /**
   * Deletes the given job IDs from DB and removes them from state + cache.
   */
  deleteJobs: (ids: string[]) => Promise<void>

  /**
   * One-shot add used by the mobile quick-add overlay (no draft row involved).
   * Inserts immediately, prepends to state, and updates cache.
   * Returns { error } — null on success, message on failure.
   */
  addJob: (company: string, title: string) => Promise<{ error: string | null }>

  /**
   * Ref that the page reads to auto-focus the first input of a newly spawned
   * draft row. The hook writes the new draft's ID here on every commit; the
   * page reads and clears it inside a `useEffect` that runs after `jobs` updates.
   */
  pendingFocusIdRef: React.MutableRefObject<string | null>
}

// ── Hook ─────────────────────────────────────────────────────────────────────

export function useJobList(userId: string | null, onXpAward?: (delta: number) => void): JobListState {
  const [jobs, setJobs] = useState<Job[]>(() => {
    const cached = userId ? readCache(userId) : []
    return [emptyJob(), ...cached]
  })

  // Tracks the true committed count independently of React state so commit
  // handlers can read it synchronously without a stale closure.
  const committedCountRef = useRef(0)

  // ID of the draft that should receive focus after the next state update.
  const pendingFocusIdRef = useRef<string | null>(null)

  // Debounced update timers keyed by job ID.
  const updateTimers = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map())

  // ── Init: hydrate from cache immediately, then DB in background ─────────────

  useEffect(() => {
    if (!userId) return
    let cancelled = false

    async function init() {
      committedCountRef.current = jobs.filter((j) => j.committed).length

      let dbJobs = await fetchJobs(userId!)
      if (cancelled) return

      // Auto-ghost stale entries — transparent to callers (see ADR 0001 context)
      dbJobs = await runAutoGhost(dbJobs)
      if (cancelled) return

      setJobs((prev) => {
        const draft = prev.find((j) => !j.committed) ?? emptyJob()
        return dbJobs.length > 0 ? [draft, ...dbJobs] : prev
      })
      writeCache(userId!, dbJobs)
      committedCountRef.current = dbJobs.length
    }

    init()
    return () => { cancelled = true }
  }, [userId]) // eslint-disable-line react-hooks/exhaustive-deps

  // ── Cleanup debounce timers on unmount ──────────────────────────────────────

  useEffect(() => {
    return () => {
      updateTimers.current.forEach((t) => clearTimeout(t))
      updateTimers.current.clear()
    }
  }, [])

  // ── onDraftChange ───────────────────────────────────────────────────────────

  const onDraftChange = useCallback((draft: Job) => {
    setJobs((prev) => {
      const idx = prev.findIndex((j) => j.id === draft.id)
      if (idx === -1) return prev
      const next = [...prev]
      next[idx] = draft
      if (draft.committed && userId) writeCache(userId, next)
      return next
    })

    if (draft.committed && userId) {
      const existing = updateTimers.current.get(draft.id)
      if (existing) clearTimeout(existing)
      const timer = setTimeout(() => {
        updateTimers.current.delete(draft.id)
        updateJob(draft)
      }, 500)
      updateTimers.current.set(draft.id, timer)
    }
  }, [userId])

  // ── onCommit ────────────────────────────────────────────────────────────────

  const onCommit = useCallback((committed: Job, _rowEl: HTMLTableRowElement | null): number | null => {
    if (committedCountRef.current >= JOB_CAP) return null

    committedCountRef.current += 1
    const newCount = committedCountRef.current

    const newDraft = emptyJob()
    const savingRow: Job = { ...committed, committed: true, saving: true }

    setJobs((prev) => {
      const without = prev.filter((j) => j.id !== committed.id)
      const next = [newDraft, savingRow, ...without.filter((j) => j.committed)]
      pendingFocusIdRef.current = newDraft.id
      if (userId) writeCache(userId, next)
      return next
    })

    if (userId) {
      insertJob(savingRow, userId).then(() => {
        setJobs((prev) => prev.map((j) => j.id === committed.id ? { ...j, saving: false } : j))
      })
      awardXp(userId, xpForJob(newCount), onXpAward)
    }

    return newCount
  }, [userId])

  // ── updateJobDetails ────────────────────────────────────────────────────────

  const updateJobDetails = useCallback((
    jobId: string,
    details: { description: string | null; notes: string | null },
  ) => {
    svcUpdateJobDetails(jobId, details)
  }, [])

  // ── deleteJobs ──────────────────────────────────────────────────────────────

  const deleteJobs = useCallback(async (ids: string[]) => {
    await svcDeleteJobs(ids)
    const idSet = new Set(ids)
    setJobs((prev) => {
      const next = prev.filter((j) => !idSet.has(j.id))
      if (userId) writeCache(userId, next.filter((j) => j.committed))
      return next
    })
    committedCountRef.current = Math.max(0, committedCountRef.current - ids.length)
  }, [userId])

  // ── addJob (mobile one-shot) ────────────────────────────────────────────────

  const addJob = useCallback(async (company: string, title: string): Promise<{ error: string | null }> => {
    if (!userId) return { error: 'Not logged in' }

    const job: Job = {
      id: crypto.randomUUID(),
      company: company.trim(),
      title: title.trim(),
      status: 'APPLIED',
      postingUrl: '',
      applicationDate: today(),
      rating: 0,
      salary: '',
      committed: true,
      saving: false,
    }

    const { error } = await insertJob(job, userId)
    if (error) return { error: error === 'job_cap_reached' ? `Job cap reached (${JOB_CAP})` : error }

    setJobs((prev) => {
      const next = [job, ...prev]
      writeCache(userId, next.filter((j) => j.committed))
      return next
    })
    committedCountRef.current += 1
    awardXp(userId, xpForJob(committedCountRef.current), onXpAward)

    return { error: null }
  }, [userId])

  // ── Derived ─────────────────────────────────────────────────────────────────

  const committedCount = jobs.filter((j) => j.committed).length

  return {
    jobs,
    committedCount,
    onDraftChange,
    onCommit,
    updateJobDetails,
    deleteJobs,
    addJob,
    pendingFocusIdRef,
  }
}
