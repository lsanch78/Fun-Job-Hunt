import { supabase } from '@/lib/supabase'

export interface AiSettings {
  user_id: string
  cover_letter_prompt: string
  why_good_fit_prompt: string
  custom_prompt: string
}

export const DEFAULT_PROMPTS = {
  cover_letter:
    'You are an expert job application writer. Write a formal, professional cover letter in 3 paragraphs. Paragraph 1: introduce the candidate and the role. Paragraph 2: match the candidate\'s specific experience to the job description requirements. Paragraph 3: closing with a call to action. Do not include addresses or dates. Output only the letter body.',
  why_good_fit:
    'You are a recruiter reviewing a candidate\'s resume against a job description. Write a concise 3-5 sentence analysis explaining why this candidate is a strong fit for the role. Reference specific skills, experiences, and requirements by name. Be direct and factual. Output only the analysis, no preamble.',
  custom:
    'You are a helpful career assistant. Using the resume and job description provided, complete the following task:',
} as const

export async function fetchAiSettings(userId: string): Promise<AiSettings | null> {
  const { data, error } = await supabase
    .from('ai_settings')
    .select('*')
    .eq('user_id', userId)
    .single()
  if (error || !data) return null
  return data as AiSettings
}

export async function upsertAiSettings(
  settings: AiSettings,
): Promise<{ error: string | null }> {
  const { error } = await supabase
    .from('ai_settings')
    .upsert({ ...settings, updated_at: new Date().toISOString() }, { onConflict: 'user_id' })
  if (error) {
    console.error('[aiSettingsService] upsertAiSettings:', error.message)
    return { error: error.message }
  }
  return { error: null }
}
