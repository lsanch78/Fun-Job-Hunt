import type { CVContent } from './cv'

export interface TailoredResume {
  id: string
  userId: string
  label: string
  content: CVContent
  sectionOrder: string[]
  matchedKeywords: string[]
  createdAt: string
}
