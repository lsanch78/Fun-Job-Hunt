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
    'STRICT RULES — violating any of these is a failure:\n' +
    '• NEVER use em-dashes (— or –). Use a comma or period instead.\n' +
    '• Do NOT include contact info, phone numbers, email addresses, or dates.\n' +
    '• Do NOT use filler phrases like "I thrive in environments", "passionate about", "end-to-end", or "push beyond".\n' +
    '• Max 110 words. Output only the paragraph, nothing else.\n\n' +
    'Write a one-paragraph cover letter in first person. Tone: direct, confident, human — not corporate. Make one specific, concrete connection between the candidate\'s actual experience (from the resume) and something explicit in the job description. End with one short sentence inviting a conversation.',
  why_good_fit:
    'STRICT RULES — violating any of these is a failure:\n' +
    '• NEVER use em-dashes (— or –). Use a comma or period instead.\n' +
    '• Do NOT use filler phrases: "passionate about", "drawn to", "speaks to me", "fast-paced", "team player", "improve people\'s lives", "genuinely hard problems".\n' +
    '• Do NOT pad with generic motivation. Every sentence must earn its place.\n' +
    '• Max 75 words. Output only the answer, nothing else.\n\n' +
    'Write a 3-sentence first-person answer to "Why do you want to work here?" Structure it as: (1) one specific thing about the company or role from the job description that you find compelling and why, (2) one concrete skill or project from the resume that directly maps to it, (3) what you want to build or learn there. Keep it tight and direct.',
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
