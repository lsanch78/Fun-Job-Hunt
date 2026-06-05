import { supabase } from '@/lib/supabase'
import type { CuratedResume } from '@/types'
import type { CVContent } from '@/services/cvService'

export const CURATED_RESUME_LIMITS = {
  label: 100,
} as const

// ── Mappers ───────────────────────────────────────────────────────────────────

interface DbCuratedResume {
  id: string
  user_id: string
  label: string
  content: CVContent
  section_order: string[]
  matched_keywords: string[]
  created_at: string
}

function dbToCuratedResume(row: DbCuratedResume): CuratedResume {
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

export async function fetchCuratedResume(id: string): Promise<CuratedResume | null> {
  const { data, error } = await supabase
    .from('curated_resumes')
    .select('id,user_id,label,content,section_order,matched_keywords,created_at')
    .eq('id', id)
    .single()

  if (error) {
    console.error('[curatedResumeService] fetchCuratedResume:', error.message, id)
    return null
  }
  return dbToCuratedResume(data as DbCuratedResume)
}

export async function fetchCuratedResumes(userId: string): Promise<CuratedResume[]> {
  const { data, error } = await supabase
    .from('curated_resumes')
    .select('id,user_id,label,content,section_order,matched_keywords,created_at')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })

  if (error) {
    console.error('[curatedResumeService] fetchCuratedResumes:', error.message)
    return []
  }
  return (data as DbCuratedResume[]).map(dbToCuratedResume)
}

// ── DB writes ─────────────────────────────────────────────────────────────────

export async function insertCuratedResume(
  userId: string,
  label: string,
  content: CVContent,
  sectionOrder: string[],
  matchedKeywords: string[],
): Promise<{ data: CuratedResume | null; error: string | null }> {
  const trimmedLabel = label.trim().slice(0, CURATED_RESUME_LIMITS.label) || 'Untitled'

  const { data, error } = await supabase
    .from('curated_resumes')
    .insert({ user_id: userId, label: trimmedLabel, content, section_order: sectionOrder, matched_keywords: matchedKeywords })
    .select('id,user_id,label,content,section_order,matched_keywords,created_at')
    .single()

  if (error) {
    console.error('[curatedResumeService] insertCuratedResume:', error.message)
    return { data: null, error: error.message }
  }
  return { data: dbToCuratedResume(data as DbCuratedResume), error: null }
}

export async function updateCuratedResumeLabel(id: string, label: string): Promise<{ error: string | null }> {
  const trimmedLabel = label.trim().slice(0, CURATED_RESUME_LIMITS.label) || 'Untitled'
  const { error } = await supabase.from('curated_resumes').update({ label: trimmedLabel }).eq('id', id)
  if (error) console.error('[curatedResumeService] updateCuratedResumeLabel:', error.message)
  return { error: error?.message ?? null }
}

export async function deleteCuratedResume(id: string): Promise<{ error: string | null }> {
  const { error } = await supabase.from('curated_resumes').delete().eq('id', id)
  if (error) console.error('[curatedResumeService] deleteCuratedResume:', error.message)
  return { error: error?.message ?? null }
}

export async function deleteAllCuratedResumes(userId: string): Promise<{ error: string | null }> {
  const { error } = await supabase.from('curated_resumes').delete().eq('user_id', userId)
  if (error) console.error('[curatedResumeService] deleteAllCuratedResumes:', error.message)
  return { error: error?.message ?? null }
}
