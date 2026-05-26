import { supabase } from '@/lib/supabase'
import type { Job, DbJob } from '@/types'

// ── Cache key ────────────────────────────────────────────────────────────────
export function cacheKey(userId: string): string {
  return `fjobhunt:jobs:${userId}`
}

// ── Mappers ──────────────────────────────────────────────────────────────────
function dbJobToJob(row: DbJob): Job {
  return {
    id:              row.id,
    company:         row.company,
    title:           row.title,
    status:          row.status,
    postingUrl:      row.posting_url ?? '',
    applicationDate: row.date_applied,
    rating:          row.rating ?? 0,
    salary:          row.salary ?? '',
    committed:       true,
    saving:          false,
    // Detail fields are intentionally omitted here — they're lazy-loaded
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
    date_applied: job.applicationDate,
    rating:       job.rating,
    salary:       job.salary || null,
    description:  job.description ?? null,
    contacts:     job.contacts ?? null,
    notes:        job.notes ?? null,
  }
}

function jobToDbUpdate(job: Job): Partial<Omit<DbJob, 'id' | 'user_id'>> {
  return {
    title:        job.title,
    company:      job.company,
    status:       job.status,
    posting_url:  job.postingUrl || null,
    date_applied: job.applicationDate,
    rating:       job.rating,
    salary:       job.salary || null,
  }
}

// ── Cache ─────────────────────────────────────────────────────────────────────
export function readCache(userId: string): Job[] {
  try {
    const raw = localStorage.getItem(cacheKey(userId))
    if (!raw) return []
    const parsed = JSON.parse(raw)
    return Array.isArray(parsed) ? (parsed as Job[]) : []
  } catch {
    return []
  }
}

// Only committed rows are cached — draft rows are always excluded.
export function writeCache(userId: string, jobs: Job[]): void {
  try {
    localStorage.setItem(cacheKey(userId), JSON.stringify(jobs.filter((j) => j.committed)))
  } catch {
    console.error('[jobService] writeCache failed')
  }
}

// ── DB reads ──────────────────────────────────────────────────────────────────
export async function fetchJobs(userId: string): Promise<Job[]> {
  const { data, error } = await supabase
    .from('jobs')
    .select('id,user_id,title,company,status,posting_url,date_applied,rating,salary')
    .eq('user_id', userId)
    .order('date_applied', { ascending: false })

  if (error) {
    console.error('[jobService] fetchJobs:', error.message)
    return []
  }

  return (data as DbJob[]).map(dbJobToJob)
}

// ── Auto-ghost setting ────────────────────────────────────────────────────────
const GHOST_SETTING_KEY = 'fjobhunt:autoghost'

export interface AutoGhostSetting {
  enabled: boolean
  days: number  // default 60 (2 months)
}

export function readAutoGhostSetting(): AutoGhostSetting {
  try {
    const raw = localStorage.getItem(GHOST_SETTING_KEY)
    if (!raw) return { enabled: false, days: 60 }
    return { ...{ enabled: false, days: 60 }, ...JSON.parse(raw) }
  } catch {
    return { enabled: false, days: 60 }
  }
}

export function writeAutoGhostSetting(setting: AutoGhostSetting): void {
  localStorage.setItem(GHOST_SETTING_KEY, JSON.stringify(setting))
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
  const cutoffStr = cutoff.toISOString().slice(0, 10)

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

// ── DB writes ─────────────────────────────────────────────────────────────────
export async function insertJob(job: Job, userId: string): Promise<{ error: string | null }> {
  const { error } = await supabase
    .from('jobs')
    .insert(jobToDbInsert(job, userId))

  if (error) console.error('[jobService] insertJob:', error.message, job.id)
  return { error: error?.message ?? null }
}

export async function updateJob(job: Job): Promise<void> {
  const { error } = await supabase
    .from('jobs')
    .update(jobToDbUpdate(job))
    .eq('id', job.id)

  if (error) console.error('[jobService] updateJob:', error.message, job.id)
}

/** Fetches all columns for every job — used for CSV export. */
export async function fetchJobsForExport(userId: string): Promise<Job[]> {
  const { data, error } = await supabase
    .from('jobs')
    .select('id,user_id,title,company,status,posting_url,date_applied,rating,salary,description,contacts,notes')
    .eq('user_id', userId)
    .order('date_applied', { ascending: false })

  if (error) {
    console.error('[jobService] fetchJobsForExport:', error.message)
    return []
  }

  return (data as DbJob[]).map((row) => ({
    ...dbJobToJob(row),
    description: row.description ?? undefined,
    contacts:    row.contacts    ?? undefined,
    notes:       row.notes       ?? undefined,
  }))
}

// ── Detail-card lazy load / save ──────────────────────────────────────────────

/** Fetches only the detail columns for a single job. Returns null on error. */
export async function fetchJobDetails(jobId: string): Promise<{ description: string | null; contacts: string | null; notes: string | null } | null> {
  const { data, error } = await supabase
    .from('jobs')
    .select('description,contacts,notes')
    .eq('id', jobId)
    .single()

  if (error) {
    console.error('[jobService] fetchJobDetails:', error.message, jobId)
    return null
  }
  return data as { description: string | null; contacts: string | null; notes: string | null }
}

/** Persists only the detail columns for a single job. */
export async function updateJobDetails(jobId: string, details: { description: string | null; contacts: string | null; notes: string | null }): Promise<{ error: string | null }> {
  const { error } = await supabase
    .from('jobs')
    .update(details)
    .eq('id', jobId)

  if (error) console.error('[jobService] updateJobDetails:', error.message, jobId)
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
