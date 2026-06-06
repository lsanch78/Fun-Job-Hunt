import { supabase } from '@/lib/supabase'
import type { CoverLetter } from '@/types'

export const COVER_LETTER_LABEL_LIMIT = 100

interface DbCoverLetter {
  id: string
  user_id: string
  label: string
  body: string
  job_description: string
  created_at: string
}

function dbToCoverLetter(row: DbCoverLetter): CoverLetter {
  return {
    id:             row.id,
    userId:         row.user_id,
    label:          row.label,
    body:           row.body,
    jobDescription: row.job_description,
    createdAt:      row.created_at,
  }
}

export async function fetchCoverLetter(id: string): Promise<CoverLetter | null> {
  const { data, error } = await supabase
    .from('cover_letters')
    .select('id,user_id,label,body,job_description,created_at')
    .eq('id', id)
    .single()
  if (error) {
    console.error('[coverLetterService] fetchCoverLetter:', error.message, id)
    return null
  }
  return dbToCoverLetter(data as DbCoverLetter)
}

export async function fetchCoverLetters(userId: string): Promise<CoverLetter[]> {
  const { data, error } = await supabase
    .from('cover_letters')
    .select('id,user_id,label,body,job_description,created_at')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
  if (error) {
    console.error('[coverLetterService] fetchCoverLetters:', error.message)
    return []
  }
  return (data as DbCoverLetter[]).map(dbToCoverLetter)
}

export async function insertCoverLetter(
  userId: string,
  label: string,
  body: string,
  jobDescription: string,
): Promise<{ data: CoverLetter | null; error: string | null }> {
  const trimmedLabel = label.trim().slice(0, COVER_LETTER_LABEL_LIMIT) || 'Untitled'
  const { data, error } = await supabase
    .from('cover_letters')
    .insert({ user_id: userId, label: trimmedLabel, body, job_description: jobDescription })
    .select('id,user_id,label,body,job_description,created_at')
    .single()
  if (error) {
    console.error('[coverLetterService] insertCoverLetter:', error.message)
    return { data: null, error: error.message }
  }
  return { data: dbToCoverLetter(data as DbCoverLetter), error: null }
}

export async function updateCoverLetter(
  id: string,
  body: string,
): Promise<{ error: string | null }> {
  const { error } = await supabase
    .from('cover_letters')
    .update({ body })
    .eq('id', id)
  if (error) console.error('[coverLetterService] updateCoverLetter:', error.message)
  return { error: error?.message ?? null }
}

export async function deleteCoverLetter(id: string): Promise<{ error: string | null }> {
  const { error } = await supabase.from('cover_letters').delete().eq('id', id)
  if (error) console.error('[coverLetterService] deleteCoverLetter:', error.message)
  return { error: error?.message ?? null }
}
