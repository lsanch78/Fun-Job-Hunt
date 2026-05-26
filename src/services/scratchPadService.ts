import { supabase } from '@/lib/supabase'

export const SCRATCH_PAD_LIMIT  = 8000
export const SCRATCH_LIST_LIMIT = 8000

export interface ScratchPadRecord {
  notes: string
  list:  string
}

export async function fetchScratchPad(userId: string): Promise<ScratchPadRecord | null> {
  const { data, error } = await supabase
    .from('scratch_pad')
    .select('notes, list')
    .eq('user_id', userId)
    .single()
  if (error || !data) return null
  return { notes: data.notes ?? '', list: data.list ?? '' }
}

export async function upsertScratchPad(
  userId: string,
  record: Partial<ScratchPadRecord>,
): Promise<void> {
  const { error } = await supabase
    .from('scratch_pad')
    .upsert(
      { user_id: userId, ...record, updated_at: new Date().toISOString() },
      { onConflict: 'user_id' },
    )
  if (error) console.error('[scratchPadService] upsert:', error.message)
}
