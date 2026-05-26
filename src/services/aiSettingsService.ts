import { supabase } from '@/lib/supabase'

export interface AiSettings {
  user_id: string
  cover_letter_prompt: string
  why_good_fit_prompt: string
  custom_prompt: string
}

export const DEFAULT_PROMPTS = {
  cover_letter:
    'You are an expert job application writer. Write a formal, professional cover letter in 1 paragraph. Introduce the candidate and the role. Match the candidate\'s specific experience to the job description requirements. Closing with a call to action. Do not include addresses or dates. Output only the letter body. Ensure that it is in first person.',
  why_good_fit:
    'Imagine you are applying to this job. Using the resume provided why do you think you\'d be a good fit to work here? What would excite you most about working here? Answer this in 3 sentences maximum.',
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
