import { supabase } from '@/lib/supabase'

// ── Field limits (see docs/SCALABILITY.md) ───────────────────────────────────
export const AI_PROMPT_LIMIT = 3000

export interface AiSettings {
  user_id: string
  cover_letter_prompt: string
  why_good_fit_prompt: string
  custom_prompt: string
}

export const DEFAULT_PROMPTS = {
  cover_letter:
    'Write a one-paragraph cover letter in first person for the candidate applying to this role. Keep it friendly and human, not stiff or corporate. Make at least one specific connection between the candidate\'s experience and the job description. End with a brief, natural call to action. Output only the paragraph. No em-dashes, no addresses, no dates.',
  why_good_fit:
    'Write a short answer (3-4 sentences, first person) to the job application question "Why do you want to work here?" using the candidate\'s resume and the job description. The answer should explain why the candidate is a good fit for this specific role, referencing concrete skills or experience from their resume. Sound genuine and enthusiastic, not generic. No em-dashes.',
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
