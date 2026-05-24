import type { Theme } from '@/config/game'

export type JobStatus =
  | 'APPLIED'
  | 'PHONE_SCREEN'
  | 'INTERVIEW'
  | 'OFFER'
  | 'REJECTED'
  | 'GHOSTED'
  | 'WITHDRAWN'

export const JOB_STATUSES: JobStatus[] = [
  'APPLIED', 'PHONE_SCREEN', 'INTERVIEW', 'OFFER', 'REJECTED', 'GHOSTED', 'WITHDRAWN',
]

// Shape of a row coming from the Supabase jobs table (after migration)
export interface DbJob {
  id: string
  user_id: string
  title: string
  company: string
  status: JobStatus
  posting_url: string | null
  date_applied: string
  rating: number
  salary: string | null
}

// Frontend-only shape. `committed` and `saving` are never persisted.
export interface Job {
  id: string
  company: string
  title: string
  status: JobStatus
  postingUrl: string
  applicationDate: string   // YYYY-MM-DD
  rating: number            // 0–5
  salary: string            // numeric string e.g. "120" = $120K
  committed: boolean        // frontend-only: has the row been committed
  saving?: boolean          // true while the DB insert is in-flight
}

export interface Profile {
  id: string
  username: string
  avatar: string
  theme: Theme
  xp: number
  rank: number
  employed: boolean
  created_at: string
}

export interface Workday {
  id: string
  user_id: string
  date: string
  punch_in: string
  punch_out: string | null
  shift_hours: number
  total_hours: number | null
}

export interface Achievement {
  id: string
  user_id: string
  type: string
  earned_at: string
}

export interface Streak {
  id: string
  user_id: string
  current_streak: number
  longest_streak: number
  last_active: string
  grace_days_used_this_week: number
}
