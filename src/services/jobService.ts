import { supabase } from '@/lib/supabase'
import { lsGet, lsSet } from '@/lib/storage'
import { SK } from '@/lib/storageKeys'
import type { Job, DbJob, AutoGhostSetting } from '@/types'
import { JOB_LIMITS } from '@/config/jobLimits'

// ── Job cap (see docs/SCALABILITY.md) ────────────────────────────────────────
export const JOB_CAP = 1000

async function countJobs(userId: string): Promise<number> {
  const { count, error } = await supabase
    .from('jobs')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', userId)
  if (error) {
    console.error('[jobService] countJobs:', error.message)
    return 0
  }
  return count ?? 0
}

function cacheKey(userId: string): string {
  return SK.jobs(userId)
}


// ── Mappers ──────────────────────────────────────────────────────────────────
function dbJobToJob(row: DbJob): Job {
  return {
    id:              row.id,
    company:         row.company,
    title:           row.title,
    status:          row.status,
    postingUrl:      row.posting_url ?? '',
    applicationDate: row.applied_at,
    rating:          row.rating ?? 0,
    salary:          row.salary ?? '',
    location:        row.location ?? '',
    committed:       true,
    saving:          false,
    hasDescription:  row.has_description,
    tailoredResumeId: row.tailored_resume_id ?? undefined,
    coverLetterId:   row.cover_letter_id   ?? undefined,
    // Description and notes are intentionally omitted here — they're lazy-loaded
  }
}

function jobToDbInsert(job: Job, userId: string): DbJob {
  return {
    id:           job.id,
    user_id:      userId,
    title:        job.title,
    company:      job.company,
    status:       job.status,
    posting_url:  job.postingUrl || null,
    applied_at:   job.applicationDate,
    rating:       job.rating,
    salary:       job.salary || null,
    location:     job.location || null,
    has_description:   !!(job.description),
    description:       job.description ?? null,
    notes:             job.notes ?? null,
    tailored_resume_id: job.tailoredResumeId ?? null,
    cover_letter_id:   job.coverLetterId   ?? null,
  }
}

function jobToDbUpdate(job: Job): Partial<Omit<DbJob, 'id' | 'user_id'>> {
  return {
    title:        job.title,
    company:      job.company,
    status:       job.status,
    posting_url:  job.postingUrl || null,
    applied_at:   job.applicationDate,
    rating:       job.rating,
    salary:       job.salary || null,
    location:     job.location || null,
  }
}

// ── Cache ─────────────────────────────────────────────────────────────────────
export function readCache(userId: string): Job[] {
  const parsed = lsGet<unknown>(cacheKey(userId), [])
  return Array.isArray(parsed) ? (parsed as Job[]) : []
}

// Only committed rows are cached — draft rows are always excluded.
export function writeCache(userId: string, jobs: Job[]): void {
  lsSet(cacheKey(userId), jobs.filter((j) => j.committed))
}

// ── DB reads ──────────────────────────────────────────────────────────────────
export async function fetchJobs(userId: string): Promise<Job[]> {
  const { data, error } = await supabase
    .from('jobs')
    .select('id,user_id,title,company,status,posting_url,applied_at,rating,salary,location,has_description,tailored_resume_id,cover_letter_id')
    .eq('user_id', userId)
    .order('applied_at', { ascending: false })

  if (error) {
    console.error('[jobService] fetchJobs:', error.message)
    return []
  }

  return (data as DbJob[]).map(dbJobToJob)
}

// ── Auto-ghost setting ────────────────────────────────────────────────────────
const DEFAULT_GHOST: AutoGhostSetting = { enabled: false, days: 60 }

export function readAutoGhostSetting(): AutoGhostSetting {
  return { ...DEFAULT_GHOST, ...lsGet<Partial<AutoGhostSetting>>(SK.autoGhost, {}) }
}

export function writeAutoGhostSetting(setting: AutoGhostSetting): void {
  lsSet(SK.autoGhost, setting)
}

// Statuses that can be auto-ghosted (still "waiting to hear back")
const GHOSTABLE: import('@/types').JobStatus[] = ['APPLIED', 'PHONE_SCREEN', 'INTERVIEW']

/**
 * Finds jobs that are older than `days` and still in a ghostable status,
 * updates them to GHOSTED in the DB, and returns the updated jobs array.
 * No-ops if the setting is disabled or no jobs qualify.
 */
export async function runAutoGhost(jobs: import('@/types').Job[]): Promise<import('@/types').Job[]> {
  const setting = readAutoGhostSetting()
  if (!setting.enabled) return jobs

  const cutoff = new Date()
  cutoff.setDate(cutoff.getDate() - setting.days)
  cutoff.setHours(23, 59, 59, 999)
  const cutoffStr = cutoff.toISOString()

  const toGhost = jobs.filter(
    (j) => j.committed && GHOSTABLE.includes(j.status) && j.applicationDate <= cutoffStr
  )
  if (toGhost.length === 0) return jobs

  // Fire DB updates in parallel (silent failure per existing pattern)
  await Promise.all(toGhost.map((j) => updateJob({ ...j, status: 'GHOSTED' })))

  return jobs.map((j) =>
    toGhost.some((g) => g.id === j.id) ? { ...j, status: 'GHOSTED' } : j
  )
}

// ── Validation ────────────────────────────────────────────────────────────────
function validateCoreFields(job: Job): string | null {
  if (job.company.length   > JOB_LIMITS.company)    return `Company name must be ${JOB_LIMITS.company} characters or less`
  if (job.title.length     > JOB_LIMITS.title)      return `Job title must be ${JOB_LIMITS.title} characters or less`
  if (job.postingUrl.length > JOB_LIMITS.postingUrl) return `Posting URL must be ${JOB_LIMITS.postingUrl} characters or less`
  if (job.salary.length    > JOB_LIMITS.salary)     return `Salary must be ${JOB_LIMITS.salary} characters or less`
  if (job.location.length  > JOB_LIMITS.location)   return `Location must be ${JOB_LIMITS.location} characters or less`
  return null
}

function validateDetailFields(details: { description: string | null; notes: string | null }): string | null {
  if ((details.description?.length ?? 0) > JOB_LIMITS.description) return `Description must be ${JOB_LIMITS.description} characters or less`
  if ((details.notes?.length       ?? 0) > JOB_LIMITS.notes)       return `Notes must be ${JOB_LIMITS.notes} characters or less`
  return null
}

// ── DB writes ─────────────────────────────────────────────────────────────────
export async function insertJob(job: Job, userId: string): Promise<{ error: string | null }> {
  const validationError = validateCoreFields(job)
  if (validationError) return { error: validationError }

  const currentCount = await countJobs(userId)
  if (currentCount >= JOB_CAP) return { error: `job_cap_reached` }

  const { error } = await supabase
    .from('jobs')
    .insert(jobToDbInsert(job, userId))

  if (error) console.error('[jobService] insertJob:', error.message, job.id)
  return { error: error?.message ?? null }
}

export async function updateJob(job: Job): Promise<{ error: string | null }> {
  const validationError = validateCoreFields(job)
  if (validationError) return { error: validationError }

  const { error } = await supabase
    .from('jobs')
    .update(jobToDbUpdate(job))
    .eq('id', job.id)

  if (error) console.error('[jobService] updateJob:', error.message, job.id)
  return { error: error?.message ?? null }
}

/** Fetches all columns for every job — used for CSV export. */
export async function fetchJobsForExport(userId: string): Promise<Job[]> {
  const { data, error } = await supabase
    .from('jobs')
    .select('id,user_id,title,company,status,posting_url,applied_at,rating,salary,location,description,notes')
    .eq('user_id', userId)
    .order('applied_at', { ascending: false })

  if (error) {
    console.error('[jobService] fetchJobsForExport:', error.message)
    return []
  }

  return (data as DbJob[]).map((row) => ({
    ...dbJobToJob(row),
    description: row.description ?? undefined,
    notes:       row.notes       ?? undefined,
  }))
}

// ── Detail-card lazy load / save ──────────────────────────────────────────────

/** Fetches only the detail columns for a single job. Returns null on error. */
export async function fetchJobDetails(jobId: string): Promise<{ description: string | null; notes: string | null; tailored_resume_id: string | null; cover_letter_id: string | null } | null> {
  const { data, error } = await supabase
    .from('jobs')
    .select('description,notes,tailored_resume_id,cover_letter_id')
    .eq('id', jobId)
    .single()

  if (error) {
    console.error('[jobService] fetchJobDetails:', error.message, jobId)
    return null
  }
  return data as { description: string | null; notes: string | null; tailored_resume_id: string | null; cover_letter_id: string | null }
}

/** Persists only the detail columns for a single job. */
export async function updateJobDetails(jobId: string, details: { description: string | null; notes: string | null }): Promise<{ error: string | null }> {
  const validationError = validateDetailFields(details)
  if (validationError) return { error: validationError }

  const { error } = await supabase
    .from('jobs')
    .update(details)
    .eq('id', jobId)

  if (error) console.error('[jobService] updateJobDetails:', error.message, jobId)
  return { error: error?.message ?? null }
}

/** Sets or clears the tailored_resume_id FK on a job. */
export async function linkTailoredResumeToJob(jobId: string, tailoredResumeId: string | null): Promise<{ error: string | null }> {
  const { error } = await supabase
    .from('jobs')
    .update({ tailored_resume_id: tailoredResumeId })
    .eq('id', jobId)

  if (error) console.error('[jobService] linkTailoredResumeToJob:', error.message, jobId)
  return { error: error?.message ?? null }
}

/** Sets or clears the cover_letter_id FK on a job. */
export async function linkCoverLetterToJob(jobId: string, coverLetterId: string | null): Promise<{ error: string | null }> {
  const { error } = await supabase
    .from('jobs')
    .update({ cover_letter_id: coverLetterId })
    .eq('id', jobId)
  if (error) console.error('[jobService] linkCoverLetterToJob:', error.message, jobId)
  return { error: error?.message ?? null }
}

export async function deleteJobs(ids: string[]): Promise<void> {
  if (ids.length === 0) return
  const { error } = await supabase.from('jobs').delete().in('id', ids)
  if (error) console.error('[jobService] deleteJobs:', error.message)
}

export async function deleteAllJobs(userId: string): Promise<{ error: string | null }> {
  const { error } = await supabase.from('jobs').delete().eq('user_id', userId)
  if (error) console.error('[jobService] deleteAllJobs:', error.message)
  return { error: error?.message ?? null }
}
