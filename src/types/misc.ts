import type { Job } from './jobs'

// ── Job service ───────────────────────────────────────────────────────────────

export interface AutoGhostSetting {
  enabled: boolean
  days: number
}

// ── Music ─────────────────────────────────────────────────────────────────────

export interface MusicTrack {
  id: string
  url: string
  videoId: string
  title: string
  position: number
}

// ── Quick Cast ────────────────────────────────────────────────────────────────

export interface QuickCastLink {
  id: string
  label: string
  url: string
  icon: string
  position?: number
}

// ── Journal ───────────────────────────────────────────────────────────────────

export interface JournalRecord {
  notes: string
  list:  string
}

export interface CheckItem {
  id: string
  text: string
  done: boolean
}

// ── Subscription ──────────────────────────────────────────────────────────────

export interface Subscription {
  user_id: string
  stripe_customer_id: string | null
  stripe_subscription_id: string | null
  status: 'free' | 'active' | 'canceled'
  current_period_end: string | null
  cancel_at_period_end: boolean
  updated_at: string
}

// ── Workday ───────────────────────────────────────────────────────────────────

export interface WorkdayRow {
  id: string
  user_id: string
  punch_in: string
  punch_out: string | null
  date: string
}

export interface WorkdayTrackingState {
  punchIn: Date | null
  isPunchedIn: boolean
  lastActivityRef: React.RefObject<number>
  resetActivity: () => void
  doPunchOut: (at?: Date) => void
}

// ── XP / Rank ─────────────────────────────────────────────────────────────────

export interface RankInfo {
  rank: number
  title: string
  progress: number
  xp: number
  nextFloor: number
  isMax: boolean
}

// ── Global stats ──────────────────────────────────────────────────────────────

export interface GlobalStats {
  hunters:            number
  employed:           number
  interviews:         number
  avg_interview_rate: number | null
  avg_days_to_offer:  number | null
  total_apps:         number
}

// ── Feedback ──────────────────────────────────────────────────────────────────

export const FEEDBACK_TOPICS = [
  'User Interface',
  'User Experience',
  'Bug',
  'Feature Idea',
  'Other',
] as const

export type FeedbackTopic = typeof FEEDBACK_TOPICS[number]

export interface FeedbackEntry {
  id: string
  user_id: string | null
  topic: FeedbackTopic
  contact: string | null
  message: string
  created_at: string
}

export type SubmitFeedbackResult = 'ok' | 'rate_limited' | 'error'

// ── Theme ─────────────────────────────────────────────────────────────────────

export interface CustomColors {
  bg: string
  surface: string
  border: string
  primary: string
  secondary: string
  muted: string
  dim: string
  warning: string
}

// ── Contacts ──────────────────────────────────────────────────────────────────

export interface ContactJobLink {
  id: string
  title: string
  company: string
}

// ── Comm settings ─────────────────────────────────────────────────────────────

export const COMM_COOLDOWN_OPTIONS = [
  { label: 'Daily',        hours: 24  },
  { label: 'Every 3 days', hours: 72  },
  { label: 'Weekly',       hours: 168 },
  { label: 'Bi-weekly',    hours: 336 },
] as const

export type CommCooldownHours = typeof COMM_COOLDOWN_OPTIONS[number]['hours']

// ── Tutorial ──────────────────────────────────────────────────────────────────

export interface TutorialStep {
  id: string
  title: string
  subtitle: string
  body: string[]
}

// ── Job list hook ─────────────────────────────────────────────────────────────

export interface JobListState {
  jobs: Job[]
  committedCount: number
  onDraftChange: (draft: Job) => void
  onCommit: (committed: Job, rowEl: HTMLTableRowElement | null) => number | null
  updateJobDetails: (jobId: string, details: { description: string | null; notes: string | null }) => void
  patchJobTailoredResume: (jobId: string, resumeId: string) => void
  patchJobCoverLetter: (jobId: string, coverLetterId: string) => void
  deleteJobs: (ids: string[]) => Promise<void>
  addJob: (company: string, title: string) => Promise<{ error: string | null }>
  pendingFocusIdRef: React.MutableRefObject<string | null>
}
