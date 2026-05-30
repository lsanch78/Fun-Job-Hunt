import { supabase } from '@/lib/supabase'

export const FEEDBACK_TOPICS = [
  'User Interface',
  'User Experience',
  'Bug',
  'Feature Idea',
  'Other',
] as const

export type FeedbackTopic = typeof FEEDBACK_TOPICS[number]

export const MESSAGE_LIMIT = 2000
export const CONTACT_LIMIT = 100

export interface FeedbackEntry {
  id: string
  user_id: string | null
  topic: FeedbackTopic
  contact: string | null
  message: string
  created_at: string
}

export type SubmitFeedbackResult = 'ok' | 'rate_limited' | 'error'

export async function submitFeedback(payload: {
  userId: string
  topic: FeedbackTopic
  contact: string
  message: string
}): Promise<SubmitFeedbackResult> {
  const { error } = await supabase.from('feedback').insert({
    user_id: payload.userId,
    topic: payload.topic,
    contact: payload.contact.trim() || null,
    message: payload.message.trim(),
  })
  if (error) {
    console.error('[feedback] submit:', error.message)
    // RLS WITH CHECK failure = policy violation, most likely rate limit
    if (error.code === '42501') return 'rate_limited'
    return 'error'
  }
  return 'ok'
}

export async function fetchAllFeedback(): Promise<FeedbackEntry[]> {
  const { data, error } = await supabase
    .from('feedback')
    .select('*')
    .order('created_at', { ascending: false })
  if (error) {
    console.error('[feedback] fetch:', error.message)
    return []
  }
  return (data ?? []) as FeedbackEntry[]
}
