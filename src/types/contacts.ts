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

export interface ExpInfo {
  pct: number
  tier: 'excellent' | 'good' | 'fair' | 'low' | 'dead'
  daysAgo: number | null
  barColor: string
}
