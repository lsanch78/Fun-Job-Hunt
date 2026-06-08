import { supabase } from '@/lib/supabase'
import type { JournalRecord } from '@/types'

export const JOURNAL_LIMIT = 8000

export async function fetchJournal(userId: string): Promise<JournalRecord | null> {
  const { data, error } = await supabase
    .from('scratch_pad')
    .select('notes, list')
    .eq('user_id', userId)
    .single()
  if (error || !data) return null
  return { notes: data.notes ?? '', list: data.list ?? '' }
}

export async function upsertJournal(
  userId: string,
  record: Partial<JournalRecord>,
): Promise<void> {
  const { error } = await supabase
    .from('scratch_pad')
    .upsert(
      { user_id: userId, ...record, updated_at: new Date().toISOString() },
      { onConflict: 'user_id' },
    )
  if (error) console.error('[journalService] upsert:', error.message)
}
