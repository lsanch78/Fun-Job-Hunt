import { supabase } from '@/lib/supabase'
import type { TailoredResume } from '@/types'
import type { CVContent } from '@/types'

const TAILORED_RESUME_LIMITS = {
  label: 100,
} as const

// ── Mappers ───────────────────────────────────────────────────────────────────

interface DbTailoredResume {
  id: string
  user_id: string
  label: string
  content: CVContent
  section_order: string[]
  matched_keywords: string[]
  created_at: string
}

function dbToTailoredResume(row: DbTailoredResume): TailoredResume {
  return {
    id:              row.id,
    userId:          row.user_id,
    label:           row.label,
    content:         row.content,
    sectionOrder:    row.section_order,
    matchedKeywords: row.matched_keywords,
    createdAt:       row.created_at,
  }
}

// ── DB reads ──────────────────────────────────────────────────────────────────

export async function fetchTailoredResume(id: string): Promise<TailoredResume | null> {
  const { data, error } = await supabase
    .from('tailored_resumes')
    .select('id,user_id,label,content,section_order,matched_keywords,created_at')
    .eq('id', id)
    .single()

  if (error) {
    console.error('[tailoredResumeService] fetchTailoredResume:', error.message, id)
    return null
  }
  return dbToTailoredResume(data as DbTailoredResume)
}

export async function fetchTailoredResumes(userId: string): Promise<TailoredResume[]> {
  const { data, error } = await supabase
    .from('tailored_resumes')
    .select('id,user_id,label,content,section_order,matched_keywords,created_at')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })

  if (error) {
    console.error('[tailoredResumeService] fetchTailoredResumes:', error.message)
    return []
  }
  return (data as DbTailoredResume[]).map(dbToTailoredResume)
}

// ── DB writes ─────────────────────────────────────────────────────────────────

export async function insertTailoredResume(
  userId: string,
  label: string,
  content: CVContent,
  sectionOrder: string[],
  matchedKeywords: string[],
): Promise<{ data: TailoredResume | null; error: string | null }> {
  const trimmedLabel = label.trim().slice(0, TAILORED_RESUME_LIMITS.label) || 'Untitled'

  const { data, error } = await supabase
    .from('tailored_resumes')
    .insert({ user_id: userId, label: trimmedLabel, content, section_order: sectionOrder, matched_keywords: matchedKeywords })
    .select('id,user_id,label,content,section_order,matched_keywords,created_at')
    .single()

  if (error) {
    console.error('[tailoredResumeService] insertTailoredResume:', error.message)
    return { data: null, error: error.message }
  }
  return { data: dbToTailoredResume(data as DbTailoredResume), error: null }
}

export async function updateTailoredResume(
  id: string,
  content: CVContent,
  sectionOrder: string[],
): Promise<{ error: string | null }> {
  const { error } = await supabase
    .from('tailored_resumes')
    .update({ content, section_order: sectionOrder })
    .eq('id', id)
  if (error) console.error('[tailoredResumeService] updateTailoredResume:', error.message)
  return { error: error?.message ?? null }
}

export async function updateTailoredResumeLabel(id: string, label: string): Promise<{ error: string | null }> {
  const trimmedLabel = label.trim().slice(0, TAILORED_RESUME_LIMITS.label) || 'Untitled'
  const { error } = await supabase.from('tailored_resumes').update({ label: trimmedLabel }).eq('id', id)
  if (error) console.error('[tailoredResumeService] updateTailoredResumeLabel:', error.message)
  return { error: error?.message ?? null }
}

export async function deleteTailoredResume(id: string): Promise<{ error: string | null }> {
  const { error } = await supabase.from('tailored_resumes').delete().eq('id', id)
  if (error) console.error('[tailoredResumeService] deleteTailoredResume:', error.message, id)
  return { error: error?.message ?? null }
}

export async function deleteTailoredResumes(ids: string[]): Promise<{ error: string | null }> {
  if (ids.length === 0) return { error: null }
  const { error } = await supabase.from('tailored_resumes').delete().in('id', ids)
  if (error) console.error('[tailoredResumeService] deleteTailoredResumes:', error.message)
  return { error: error?.message ?? null }
}

export async function deleteAllTailoredResumes(userId: string): Promise<{ error: string | null }> {
  const { error } = await supabase.from('tailored_resumes').delete().eq('user_id', userId)
  if (error) console.error('[tailoredResumeService] deleteAllTailoredResumes:', error.message)
  return { error: error?.message ?? null }
}
