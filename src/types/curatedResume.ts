import type { CVContent } from './cv'

export interface CuratedResume {
  id: string
  userId: string
  label: string
  content: CVContent
  sectionOrder: string[]
  matchedKeywords: string[]
  createdAt: string
}
