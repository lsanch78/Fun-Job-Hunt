import { supabase } from '@/lib/supabase'
import { PROMPT_COVER_LETTER, PROMPT_WHY_GOOD_FIT, PROMPT_CUSTOM } from '@/config/aiPrompts'

// ── Field limits (see docs/SCALABILITY.md) ───────────────────────────────────
export const AI_PROMPT_LIMIT = 3000

export interface AiSettings {
  user_id: string
  cover_letter_prompt: string
  why_good_fit_prompt: string
  custom_prompt: string
}

export const DEFAULT_PROMPTS = {
  cover_letter: PROMPT_COVER_LETTER,
  why_good_fit: PROMPT_WHY_GOOD_FIT,
  custom:       PROMPT_CUSTOM,
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
