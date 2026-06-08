import { supabase } from '@/lib/supabase'
import type { CVContent } from '@/types'

export async function fetchCV(
  userId: string,
): Promise<{ content: CVContent; sectionOrder: string[] } | null> {
  const { data, error } = await supabase
    .from('master_cv')
    .select('content, section_order')
    .eq('user_id', userId)
    .single()
  if (error || !data) return null
  return {
    content:      data.content       as CVContent,
    sectionOrder: data.section_order as string[],
  }
}

export async function upsertCV(
  userId: string,
  content: CVContent,
  sectionOrder: string[],
): Promise<void> {
  const { error } = await supabase
    .from('master_cv')
    .upsert(
      { user_id: userId, content, section_order: sectionOrder, updated_at: new Date().toISOString() },
      { onConflict: 'user_id' },
    )
  if (error) console.error('[cvService] upsert:', error.message)
}
