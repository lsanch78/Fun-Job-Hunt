import { supabase } from '@/lib/supabase'
import type { CVContent } from '@/types'

export async function fetchCV(
  userId: string,
): Promise<{ content: CVContent; sectionOrder: string[] } | null> {
  const { data, error } = await supabase
    .from('cv')
    .select('content, section_order')
    .eq('user_id', userId)
    .single()
  if (error || !data) return null
  return {
    content:      data.content       as CVContent,
    sectionOrder: data.section_order as string[],
  }
}

export async function fetchCvIsEmpty(userId: string): Promise<boolean> {
  const result = await fetchCV(userId)
  if (!result) return true
  const { content: c } = result
  return (
    !c.mainInfo.fullName?.trim() &&
    c.experiences.length    === 0 &&
    c.educations.length     === 0 &&
    c.projects.length       === 0 &&
    c.summaries.length      === 0 &&
    c.certifications.length === 0 &&
    c.awards.length         === 0 &&
    c.skills                === null
  )
}

export async function upsertCV(
  userId: string,
  content: CVContent,
  sectionOrder: string[],
): Promise<void> {
  const { error } = await supabase
    .from('cv')
    .upsert(
      { user_id: userId, content, section_order: sectionOrder, updated_at: new Date().toISOString() },
      { onConflict: 'user_id' },
    )
  if (error) console.error('[cvService] upsert:', error.message)
}

export async function deleteCV(userId: string): Promise<{ error: string | null }> {
  const { error } = await supabase
    .from('cv')
    .delete()
    .eq('user_id', userId)
  if (error) console.error('[cvService] deleteCV:', error.message)
  return { error: error?.message ?? null }
}
