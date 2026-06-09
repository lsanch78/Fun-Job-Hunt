import {
  readCache, writeCache,
  fetchJobs, fetchJobDetails, fetchJobsForExport,
  insertJob, updateJob, updateJobDetails,
  linkTailoredResumeToJob, linkCoverLetterToJob,
  deleteJobs, deleteAllJobs,
  runAutoGhost,
  writeAutoGhostSetting,
  JOB_CAP,
} from '@/services/jobService'
import type { Job } from '@/types'
import { JOB_LIMITS } from '@/config/jobLimits'

jest.mock('@/lib/supabase', () => ({
  supabase: { from: jest.fn() },
}))

import { supabase } from '@/lib/supabase'
const mockFrom = supabase.from as jest.Mock

// Fluent chain builder — mirrors the pattern used in contactService.test.ts
function makeChain(terminal: Record<string, unknown> = {}) {
  const chain: Record<string, jest.Mock> = {}
  const methods = ['select', 'insert', 'update', 'delete', 'eq', 'in', 'order', 'single', 'maybeSingle']
  methods.forEach((m) => { chain[m] = jest.fn(() => chain) })
  Object.assign(chain, terminal)
  mockFrom.mockReturnValue(chain)
  return chain
}

beforeEach(() => {
  localStorage.clear()
  jest.clearAllMocks()
})

// ── Helpers ───────────────────────────────────────────────────────────────────

function makeJob(overrides: Partial<Job> = {}): Job {
  return {
    id: 'job-1',
    company: 'Acme',
    title: 'Engineer',
    status: 'APPLIED',
    postingUrl: '',
    applicationDate: '2025-01-01T00:00:00.000Z',
    rating: 0,
    salary: '',
    location: '',
    committed: true,
    saving: false,
    ...overrides,
  }
}

const DB_ROW = {
  id: 'job-1',
  user_id: 'u1',
  company: 'Acme',
  title: 'Engineer',
  status: 'APPLIED',
  posting_url: null,
  applied_at: '2025-01-01T00:00:00.000Z',
  rating: 0,
  salary: null,
  tailored_resume_id: null,
  cover_letter_id: null,
}

const USER_ID = 'u1'

// ── readCache / writeCache ────────────────────────────────────────────────────

describe('readCache', () => {
  // Returns a stable empty array when nothing is stored yet.
  it('returns [] when localStorage has no entry', () => {
    expect(readCache(USER_ID)).toEqual([])
  })

  // Committed jobs round-trip correctly through JSON serialisation.
  it('returns stored jobs', () => {
    const job = makeJob()
    writeCache(USER_ID, [job])
    expect(readCache(USER_ID)).toEqual([job])
  })

  // Corrupt storage must not throw — callers depend on always getting an array.
  it('returns [] when stored value is not an array', () => {
    localStorage.setItem(`fjobhunt:jobs:${USER_ID}`, JSON.stringify({ bad: true }))
    expect(readCache(USER_ID)).toEqual([])
  })
})

describe('writeCache', () => {
  // Draft rows are UI-only and must never be persisted to localStorage.
  it('excludes draft (uncommitted) jobs', () => {
    const draft = makeJob({ committed: false })
    const committed = makeJob({ id: 'job-2' })
    writeCache(USER_ID, [draft, committed])
    expect(readCache(USER_ID)).toEqual([committed])
  })

  // Writing an empty list is valid — clears the cache without error.
  it('writes an empty array when all jobs are drafts', () => {
    writeCache(USER_ID, [makeJob({ committed: false })])
    expect(readCache(USER_ID)).toEqual([])
  })
})

// ── fetchJobs ─────────────────────────────────────────────────────────────────

describe('fetchJobs', () => {
  // Happy path: DB row is mapped to the frontend Job shape (camelCase, nulls defaulted).
  it('maps DB rows to Job objects', async () => {
    makeChain({ order: jest.fn().mockResolvedValue({ data: [DB_ROW], error: null }) })

    const jobs = await fetchJobs(USER_ID)

    expect(jobs).toHaveLength(1)
    expect(jobs[0]).toMatchObject({
      id: 'job-1',
      company: 'Acme',
      postingUrl: '',
      salary: '',
      committed: true,
      saving: false,
    })
  })

  // DB failure must not throw — callers expect an empty array, not a rejection.
  it('returns [] on DB error', async () => {
    makeChain({ order: jest.fn().mockResolvedValue({ data: null, error: { message: 'oops' } }) })

    const jobs = await fetchJobs(USER_ID)
    expect(jobs).toEqual([])
  })
})

// ── fetchJobDetails ───────────────────────────────────────────────────────────

describe('fetchJobDetails', () => {
  // Lazy-load columns are returned as-is for the modal to consume.
  it('returns detail columns on success', async () => {
    makeChain({ single: jest.fn().mockResolvedValue({ data: { description: 'JD', notes: 'note', tailored_resume_id: null, cover_letter_id: null }, error: null }) })

    const result = await fetchJobDetails('job-1')
    expect(result).toEqual({ description: 'JD', notes: 'note', tailored_resume_id: null, cover_letter_id: null })
  })

  // Returning null (not throwing) lets the modal stay open with existing data.
  it('returns null on DB error', async () => {
    makeChain({ single: jest.fn().mockResolvedValue({ data: null, error: { message: 'not found' } }) })

    const result = await fetchJobDetails('job-1')
    expect(result).toBeNull()
  })
})

// ── fetchJobsForExport ────────────────────────────────────────────────────────

describe('fetchJobsForExport', () => {
  // Export includes description and notes — unlike fetchJobs which lazy-loads them.
  it('includes description and notes in mapped jobs', async () => {
    const exportRow = { ...DB_ROW, description: 'full JD', notes: 'my notes' }
    makeChain({ order: jest.fn().mockResolvedValue({ data: [exportRow], error: null }) })

    const jobs = await fetchJobsForExport(USER_ID)
    expect(jobs[0].description).toBe('full JD')
    expect(jobs[0].notes).toBe('my notes')
  })

  it('returns [] on DB error', async () => {
    makeChain({ order: jest.fn().mockResolvedValue({ data: null, error: { message: 'fail' } }) })
    expect(await fetchJobsForExport(USER_ID)).toEqual([])
  })
})

// ── insertJob — validation ────────────────────────────────────────────────────

describe('insertJob — validation', () => {
  // Validation runs before any DB call, so no Supabase mock needed here.

  it('rejects when company exceeds limit', async () => {
    const job = makeJob({ company: 'A'.repeat(JOB_LIMITS.company + 1) })
    const { error } = await insertJob(job, USER_ID)
    expect(error).toMatch(/company/i)
    expect(mockFrom).not.toHaveBeenCalled()
  })

  it('rejects when title exceeds limit', async () => {
    const job = makeJob({ title: 'T'.repeat(JOB_LIMITS.title + 1) })
    const { error } = await insertJob(job, USER_ID)
    expect(error).toMatch(/title/i)
  })

  it('rejects when postingUrl exceeds limit', async () => {
    const job = makeJob({ postingUrl: 'x'.repeat(JOB_LIMITS.postingUrl + 1) })
    const { error } = await insertJob(job, USER_ID)
    expect(error).toMatch(/url/i)
  })

  it('rejects when salary exceeds limit', async () => {
    const job = makeJob({ salary: '$'.repeat(JOB_LIMITS.salary + 1) })
    const { error } = await insertJob(job, USER_ID)
    expect(error).toMatch(/salary/i)
  })
})

// ── insertJob — cap + DB ──────────────────────────────────────────────────────

describe('insertJob — cap and DB', () => {
  // countJobs is called internally — we simulate it via the select chain.
  function mockCountAndInsert(count: number, insertError: string | null = null) {
    mockFrom
      .mockReturnValueOnce((() => {
        // First call: countJobs select
        const countChain: Record<string, jest.Mock> = {}
        const methods = ['select', 'eq']
        methods.forEach((m) => { countChain[m] = jest.fn(() => countChain) })
        countChain['eq'] = jest.fn().mockResolvedValue({ count, error: null })
        return countChain
      })())
      .mockReturnValueOnce((() => {
        // Second call: insert
        const insertChain: Record<string, jest.Mock> = {}
        insertChain['insert'] = jest.fn().mockResolvedValue({ error: insertError ? { message: insertError } : null })
        return insertChain
      })())
  }

  // Job cap check happens after validation, before insert.
  it('returns job_cap_reached when at cap', async () => {
    mockFrom.mockReturnValueOnce((() => {
      const c: Record<string, jest.Mock> = {}
      c['select'] = jest.fn(() => c)
      c['eq'] = jest.fn().mockResolvedValue({ count: JOB_CAP, error: null })
      return c
    })())

    const { error } = await insertJob(makeJob(), USER_ID)
    expect(error).toBe('job_cap_reached')
  })

  // Happy path: below cap, insert succeeds.
  it('inserts successfully when below cap', async () => {
    mockCountAndInsert(0)
    const { error } = await insertJob(makeJob(), USER_ID)
    expect(error).toBeNull()
  })

  // DB insert failure is surfaced as an error string, not a thrown exception.
  it('returns error string when DB insert fails', async () => {
    mockCountAndInsert(0, 'duplicate key')
    const { error } = await insertJob(makeJob(), USER_ID)
    expect(error).toBe('duplicate key')
  })
})

// ── updateJob ─────────────────────────────────────────────────────────────────

describe('updateJob', () => {
  // Validation runs before the DB call — same rules as insertJob.
  it('rejects when company exceeds limit', async () => {
    const { error } = await updateJob(makeJob({ company: 'A'.repeat(JOB_LIMITS.company + 1) }))
    expect(error).toMatch(/company/i)
    expect(mockFrom).not.toHaveBeenCalled()
  })

  it('updates successfully on valid job', async () => {
    makeChain({ eq: jest.fn().mockResolvedValue({ error: null }) })
    const { error } = await updateJob(makeJob())
    expect(error).toBeNull()
  })

  it('returns error string when DB update fails', async () => {
    makeChain({ eq: jest.fn().mockResolvedValue({ error: { message: 'constraint violation' } }) })
    const { error } = await updateJob(makeJob())
    expect(error).toBe('constraint violation')
  })
})

// ── updateJobDetails ──────────────────────────────────────────────────────────

describe('updateJobDetails', () => {
  // Detail fields have their own, larger limits.
  it('rejects when description exceeds limit', async () => {
    const { error } = await updateJobDetails('job-1', { description: 'x'.repeat(JOB_LIMITS.description + 1), notes: null })
    expect(error).toMatch(/description/i)
    expect(mockFrom).not.toHaveBeenCalled()
  })

  it('rejects when notes exceed limit', async () => {
    const { error } = await updateJobDetails('job-1', { description: null, notes: 'n'.repeat(JOB_LIMITS.notes + 1) })
    expect(error).toMatch(/notes/i)
  })

  it('saves successfully with valid content', async () => {
    makeChain({ eq: jest.fn().mockResolvedValue({ error: null }) })
    const { error } = await updateJobDetails('job-1', { description: 'Valid JD', notes: null })
    expect(error).toBeNull()
  })

  // Null fields are valid — user may clear description or notes.
  it('accepts null description and notes', async () => {
    makeChain({ eq: jest.fn().mockResolvedValue({ error: null }) })
    const { error } = await updateJobDetails('job-1', { description: null, notes: null })
    expect(error).toBeNull()
  })
})

// ── linkTailoredResumeToJob / linkCoverLetterToJob ────────────────────────────

describe('linkTailoredResumeToJob', () => {
  // FK is set or cleared (null = unlink).
  it('sets the tailored_resume_id FK', async () => {
    makeChain({ eq: jest.fn().mockResolvedValue({ error: null }) })
    const { error } = await linkTailoredResumeToJob('job-1', 'resume-99')
    expect(error).toBeNull()
  })

  it('clears the FK when passed null', async () => {
    makeChain({ eq: jest.fn().mockResolvedValue({ error: null }) })
    const { error } = await linkTailoredResumeToJob('job-1', null)
    expect(error).toBeNull()
  })
})

describe('linkCoverLetterToJob', () => {
  it('sets the cover_letter_id FK', async () => {
    makeChain({ eq: jest.fn().mockResolvedValue({ error: null }) })
    const { error } = await linkCoverLetterToJob('job-1', 'cl-42')
    expect(error).toBeNull()
  })
})

// ── deleteJobs ────────────────────────────────────────────────────────────────

describe('deleteJobs', () => {
  // Empty array is a valid call — must not hit the DB (no .from() needed).
  it('short-circuits on empty ids array', async () => {
    await deleteJobs([])
    expect(mockFrom).not.toHaveBeenCalled()
  })

  it('deletes the given ids', async () => {
    makeChain({ in: jest.fn().mockResolvedValue({ error: null }) })
    await deleteJobs(['job-1', 'job-2'])
    expect(mockFrom).toHaveBeenCalledWith('jobs')
  })
})

describe('deleteAllJobs', () => {
  it('deletes all jobs for the user', async () => {
    makeChain({ eq: jest.fn().mockResolvedValue({ error: null }) })
    const { error } = await deleteAllJobs(USER_ID)
    expect(error).toBeNull()
  })

  it('returns error string on failure', async () => {
    makeChain({ eq: jest.fn().mockResolvedValue({ error: { message: 'permission denied' } }) })
    const { error } = await deleteAllJobs(USER_ID)
    expect(error).toBe('permission denied')
  })
})

// ── runAutoGhost ──────────────────────────────────────────────────────────────

describe('runAutoGhost', () => {
  // Setting must be explicitly enabled — off by default.
  it('no-ops when auto-ghost is disabled', async () => {
    writeAutoGhostSetting({ enabled: false, days: 60 })
    const jobs = [makeJob({ status: 'APPLIED', applicationDate: '2020-01-01T00:00:00.000Z' })]
    const result = await runAutoGhost(jobs)
    expect(result).toEqual(jobs)
    expect(mockFrom).not.toHaveBeenCalled()
  })

  // Jobs older than the threshold in a ghostable status get flipped to GHOSTED.
  it('ghosts stale APPLIED jobs when enabled', async () => {
    writeAutoGhostSetting({ enabled: true, days: 60 })
    makeChain({ eq: jest.fn().mockResolvedValue({ error: null }) })

    const staleDate = new Date()
    staleDate.setDate(staleDate.getDate() - 90)
    const job = makeJob({ status: 'APPLIED', applicationDate: staleDate.toISOString() })

    const result = await runAutoGhost([job])
    expect(result[0].status).toBe('GHOSTED')
  })

  // OFFER and REJECTED are terminal — auto-ghost must not touch them.
  it('does not ghost OFFER or REJECTED jobs', async () => {
    writeAutoGhostSetting({ enabled: true, days: 60 })

    const staleDate = new Date()
    staleDate.setDate(staleDate.getDate() - 90)

    const offer    = makeJob({ id: 'j1', status: 'OFFER',    applicationDate: staleDate.toISOString() })
    const rejected = makeJob({ id: 'j2', status: 'REJECTED', applicationDate: staleDate.toISOString() })

    const result = await runAutoGhost([offer, rejected])
    expect(result[0].status).toBe('OFFER')
    expect(result[1].status).toBe('REJECTED')
    expect(mockFrom).not.toHaveBeenCalled()
  })

  // A recent job in a ghostable status must not be touched, even if enabled.
  it('does not ghost jobs newer than the threshold', async () => {
    writeAutoGhostSetting({ enabled: true, days: 60 })

    const recentDate = new Date()
    recentDate.setDate(recentDate.getDate() - 10)
    const job = makeJob({ status: 'APPLIED', applicationDate: recentDate.toISOString() })

    const result = await runAutoGhost([job])
    expect(result[0].status).toBe('APPLIED')
    expect(mockFrom).not.toHaveBeenCalled()
  })

  // PHONE_SCREEN and INTERVIEW are also ghostable statuses.
  it('ghosts stale PHONE_SCREEN and INTERVIEW jobs', async () => {
    writeAutoGhostSetting({ enabled: true, days: 30 })
    // Two DB updates fire in parallel — mock two sequential calls
    makeChain({ eq: jest.fn().mockResolvedValue({ error: null }) })
    makeChain({ eq: jest.fn().mockResolvedValue({ error: null }) })

    const staleDate = new Date()
    staleDate.setDate(staleDate.getDate() - 60)

    const phone    = makeJob({ id: 'j1', status: 'PHONE_SCREEN', applicationDate: staleDate.toISOString() })
    const interview = makeJob({ id: 'j2', status: 'INTERVIEW',   applicationDate: staleDate.toISOString() })

    const result = await runAutoGhost([phone, interview])
    expect(result[0].status).toBe('GHOSTED')
    expect(result[1].status).toBe('GHOSTED')
  })

  // Empty list is a valid input — must return immediately without hitting the DB.
  it('returns empty array unchanged', async () => {
    writeAutoGhostSetting({ enabled: true, days: 60 })
    const result = await runAutoGhost([])
    expect(result).toEqual([])
    expect(mockFrom).not.toHaveBeenCalled()
  })
})
