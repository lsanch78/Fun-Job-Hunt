/**
 * Integration: job add / edit flow
 *
 * Tests the chain: useJobList (draft → commit → insertJob) and
 * useJobDetail (lazy load → field update → save) with all external
 * dependencies mocked at the service boundary.
 */

import { renderHook, act, waitFor } from '@testing-library/react'
import { useJobList } from '@/hooks/joblog/useJobList'
import { useJobDetail } from '@/hooks/joblog/useJobDetail'

// ── Mock external dependencies ────────────────────────────────────────────────

jest.mock('@/services/jobService', () => ({
  readCache:        jest.fn(() => []),
  writeCache:       jest.fn(),
  fetchJobs:        jest.fn(async () => []),
  insertJob:        jest.fn(async () => ({ error: null })),
  updateJob:        jest.fn(async () => ({ error: null })),
  updateJobDetails: jest.fn(async () => ({ error: null })),
  fetchJobDetails:  jest.fn(async () => ({ description: 'JD text', notes: 'some notes', tailored_resume_id: null, cover_letter_id: null })),
  deleteJobs:       jest.fn(async () => {}),
  linkTailoredResumeToJob: jest.fn(async () => ({ error: null })),
  linkCoverLetterToJob:    jest.fn(async () => ({ error: null })),
  runAutoGhost:     jest.fn(async (jobs) => jobs),
  JOB_CAP:         1000,
}))

jest.mock('@/services/xpService', () => ({
  awardXp:  jest.fn(),
  xpForJob: jest.fn(() => 10),
}))

// Silence localStorage in jsdom
beforeEach(() => {
  localStorage.clear()
  jest.clearAllMocks()
})

import {
  readCache, writeCache,
  fetchJobs, insertJob,
  updateJob, updateJobDetails as svcUpdateJobDetails,
  fetchJobDetails,
} from '@/services/jobService'
import { awardXp } from '@/services/xpService'

const USER_ID = 'test-user-123'

// ── Helpers ───────────────────────────────────────────────────────────────────

function makeCommittedJob(overrides = {}) {
  return {
    id: 'job-abc',
    company: 'Acme',
    title: 'Engineer',
    status: 'APPLIED' as const,
    postingUrl: '',
    applicationDate: new Date().toISOString(),
    rating: 0,
    salary: '',
    committed: true,
    saving: false,
    ...overrides,
  }
}

// ── useJobList ────────────────────────────────────────────────────────────────

describe('useJobList — add flow', () => {
  it('initialises with one empty draft and cached jobs', () => {
    ;(readCache as jest.Mock).mockReturnValueOnce([makeCommittedJob()])

    const { result } = renderHook(() => useJobList(USER_ID))
    const [draft, ...committed] = result.current.jobs

    expect(draft.committed).toBe(false)
    expect(committed).toHaveLength(1)
    expect(committed[0].company).toBe('Acme')
  })

  it('hydrates from DB after mount, replacing cache', async () => {
    const dbJob = makeCommittedJob({ id: 'db-job', company: 'DB Corp' })
    ;(fetchJobs as jest.Mock).mockResolvedValueOnce([dbJob])

    const { result } = renderHook(() => useJobList(USER_ID))

    await waitFor(() => {
      expect(result.current.jobs.some((j) => j.company === 'DB Corp')).toBe(true)
    })
    expect(writeCache).toHaveBeenCalled()
  })

  it('onCommit inserts the job, awards XP, and prepends a new draft', async () => {
    const { result } = renderHook(() => useJobList(USER_ID))

    const draft = result.current.jobs[0]
    const filledDraft = { ...draft, company: 'NewCo', title: 'Dev' }

    act(() => { result.current.onDraftChange(filledDraft) })
    act(() => { result.current.onCommit(filledDraft, null) })

    await waitFor(() => {
      expect(insertJob).toHaveBeenCalledWith(
        expect.objectContaining({ company: 'NewCo', title: 'Dev', committed: true }),
        USER_ID,
      )
    })

    expect(awardXp).toHaveBeenCalledWith(USER_ID, 10, undefined)

    const [newDraft, savedJob] = result.current.jobs
    expect(newDraft.committed).toBe(false)
    expect(savedJob.company).toBe('NewCo')
  })

  it('does not insert when userId is null', () => {
    const { result } = renderHook(() => useJobList(null))

    const draft = result.current.jobs[0]
    act(() => { result.current.onCommit({ ...draft, company: 'X', title: 'Y' }, null) })

    expect(insertJob).not.toHaveBeenCalled()
    expect(awardXp).not.toHaveBeenCalled()
  })

  it('onDraftChange debounces updateJob for committed jobs', async () => {
    jest.useFakeTimers()
    const { result } = renderHook(() => useJobList(USER_ID))

    const job = makeCommittedJob()
    act(() => { result.current.onDraftChange(job) })
    expect(updateJob).not.toHaveBeenCalled()

    act(() => { jest.advanceTimersByTime(500) })
    expect(updateJob).toHaveBeenCalledWith(expect.objectContaining({ id: 'job-abc' }))

    jest.useRealTimers()
  })

  it('addJob inserts directly and updates state', async () => {
    const { result } = renderHook(() => useJobList(USER_ID))

    let res: { error: string | null }
    await act(async () => {
      res = await result.current.addJob('Startup', 'CTO')
    })

    expect(res!.error).toBeNull()
    expect(insertJob).toHaveBeenCalledWith(
      expect.objectContaining({ company: 'Startup', title: 'CTO', committed: true }),
      USER_ID,
    )
    expect(result.current.jobs.some((j) => j.company === 'Startup')).toBe(true)
  })

  it('addJob returns error when insertJob fails', async () => {
    ;(insertJob as jest.Mock).mockResolvedValueOnce({ error: 'DB down' })

    const { result } = renderHook(() => useJobList(USER_ID))

    let res: { error: string | null }
    await act(async () => {
      res = await result.current.addJob('Failing Co', 'Dev')
    })

    expect(res!.error).toBe('DB down')
    expect(result.current.jobs.some((j) => j.company === 'Failing Co')).toBe(false)
  })
})

// ── useJobDetail ──────────────────────────────────────────────────────────────

describe('useJobDetail — edit flow', () => {
  const baseJob = makeCommittedJob()

  it('lazy-loads description and notes on open', async () => {
    const onChange = jest.fn()
    renderHook(() => useJobDetail([baseJob], baseJob.id, onChange))

    await waitFor(() => {
      expect(fetchJobDetails).toHaveBeenCalledWith(baseJob.id)
      expect(onChange).toHaveBeenCalledWith(
        expect.objectContaining({ description: 'JD text', notes: 'some notes' }),
      )
    })
  })

  it('skips fetch if description and notes are already loaded', async () => {
    const loadedJob = { ...baseJob, description: 'cached', notes: 'cached notes' }
    const onChange = jest.fn()
    renderHook(() => useJobDetail([loadedJob], loadedJob.id, onChange))

    await waitFor(() => { /* let effects flush */ })
    expect(fetchJobDetails).not.toHaveBeenCalled()
  })

  it('update() calls onChange with the patched field', () => {
    const onChange = jest.fn()
    const loadedJob = { ...baseJob, description: '', notes: '' }
    const { result } = renderHook(() => useJobDetail([loadedJob], loadedJob.id, onChange))

    act(() => { result.current.update('title', 'Senior Dev') })

    expect(onChange).toHaveBeenCalledWith(
      expect.objectContaining({ title: 'Senior Dev' }),
    )
  })

  it('handleSave transitions saveState to saved on success', async () => {
    jest.useFakeTimers()
    const loadedJob = { ...baseJob, description: 'text', notes: '' }
    const { result } = renderHook(() => useJobDetail([loadedJob], loadedJob.id, jest.fn()))

    await act(async () => { await result.current.handleSave() })
    expect(result.current.saveState).toBe('saved')
    expect(svcUpdateJobDetails).toHaveBeenCalledWith(
      loadedJob.id,
      { description: 'text', notes: '' },
    )

    act(() => { jest.advanceTimersByTime(1200) })
    expect(result.current.saveState).toBe('idle')
    jest.useRealTimers()
  })

  it('handleSave transitions saveState to error on failure', async () => {
    jest.useFakeTimers()
    ;(svcUpdateJobDetails as jest.Mock).mockResolvedValueOnce({ error: 'save failed' })

    const loadedJob = { ...baseJob, description: '', notes: '' }
    const { result } = renderHook(() => useJobDetail([loadedJob], loadedJob.id, jest.fn()))

    await act(async () => { await result.current.handleSave() })
    expect(result.current.saveState).toBe('error')
    expect(result.current.saveError).toBe('save failed')

    act(() => { jest.advanceTimersByTime(2000) })
    expect(result.current.saveState).toBe('idle')
    jest.useRealTimers()
  })

  it('goJob navigates between jobs', () => {
    const jobs = [
      makeCommittedJob({ id: 'j1', company: 'A' }),
      makeCommittedJob({ id: 'j2', company: 'B' }),
    ]
    const { result } = renderHook(() => useJobDetail(jobs, 'j1', jest.fn()))

    expect(result.current.job.id).toBe('j1')
    act(() => { result.current.goJob(1) })
    expect(result.current.job.id).toBe('j2')
    act(() => { result.current.goJob(-1) })
    expect(result.current.job.id).toBe('j1')
  })
})
