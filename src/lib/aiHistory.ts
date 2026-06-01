import { lsGet, lsSet } from '@/lib/storage'
import { SK } from '@/lib/storageKeys'

export type HistoryPromptType = 'cover_letter' | 'why_good_fit' | 'custom'

export interface AiHistoryEntry {
  id: string
  timestamp: string
  promptType: HistoryPromptType | null
  output: string
  jdSnippet: string
}

const MAX = 30

export function loadAiHistory(userId: string): AiHistoryEntry[] {
  const raw = lsGet<AiHistoryEntry[]>(SK.aiHistory(userId), [])
  return Array.isArray(raw) ? raw : []
}

export function saveAiHistoryEntry(
  userId: string,
  entry: Omit<AiHistoryEntry, 'id' | 'timestamp'>,
): void {
  const history = loadAiHistory(userId)
  const next: AiHistoryEntry = {
    ...entry,
    id: crypto.randomUUID(),
    timestamp: new Date().toISOString(),
  }
  lsSet(SK.aiHistory(userId), [next, ...history].slice(0, MAX))
}

export function deleteAiHistoryEntry(userId: string, id: string): void {
  lsSet(SK.aiHistory(userId), loadAiHistory(userId).filter((e) => e.id !== id))
}

export function updateAiHistoryEntry(userId: string, id: string, output: string): void {
  lsSet(
    SK.aiHistory(userId),
    loadAiHistory(userId).map((e) => (e.id === id ? { ...e, output } : e)),
  )
}

export function formatHistoryLabel(entry: AiHistoryEntry): string {
  const type =
    entry.promptType === 'cover_letter' ? 'COVER LETTER'
    : entry.promptType === 'why_good_fit' ? 'WHY FIT'
    : 'CUSTOM'
  const date = new Date(entry.timestamp).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
  return `${date} — ${type}`
}
