export type JobStatus =
  | 'APPLIED'
  | 'PHONE_SCREEN'
  | 'INTERVIEW'
  | 'OFFER'
  | 'REJECTED'
  | 'GHOSTED'
  | 'WITHDRAWN'

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
  description: string | null
  notes: string | null
  curated_resume_id: string | null
  cover_letter_id: string | null
}

export interface Job {
  id: string
  company: string
  title: string
  status: JobStatus
  postingUrl: string
  applicationDate: string
  rating: number
  salary: string
  committed: boolean
  saving?: boolean
  description?: string
  notes?: string
  curatedResumeId?: string
  coverLetterId?: string
}
