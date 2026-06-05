import type { Theme } from '@/config/game'
import type { CVContent } from '@/services/cvService'

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
  applied_at: string
  rating: number
  salary: string | null
  // Detail-card columns — nullable, lazy-loaded when the card opens
  description: string | null
  notes: string | null
  curated_resume_id: string | null
}

// Frontend-only shape. `committed` and `saving` are never persisted.
export interface Job {
  id: string
  company: string
  title: string
  status: JobStatus
  postingUrl: string
  applicationDate: string   // ISO 8601 timestamp
  rating: number            // 0–5
  salary: string            // numeric string e.g. "120" = $120K
  committed: boolean        // frontend-only: has the row been committed
  saving?: boolean          // true while the DB insert is in-flight
  // Detail-card fields — lazy-loaded from DB when the card opens
  description?: string
  notes?: string
  curatedResumeId?: string
}

export interface CuratedResume {
  id: string
  userId: string
  label: string
  content: CVContent
  sectionOrder: string[]
  matchedKeywords: string[]
  createdAt: string
}

export interface Contact {
  id: string
  userId: string
  name: string
  company?: string
  linkedin?: string
  github?: string
  twitter?: string
  discord?: string
  email?: string
  notes?: string
  lastInteractionAt: string | null
  commExp: number
  lastCommAt: string | null
  createdAt: string
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
