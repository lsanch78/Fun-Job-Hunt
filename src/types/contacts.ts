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

type ExpTier = 'excellent' | 'good' | 'fair' | 'low' | 'dead'

export interface ExpInfo {
  pct: number
  tier: ExpTier
  daysAgo: number | null
  barColor: string
}
