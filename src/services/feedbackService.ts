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

export async function submitFeedback(payload: {
  userId: string
  topic: FeedbackTopic
  contact: string
  message: string
}): Promise<boolean> {
  const { error } = await supabase.from('feedback').insert({
    user_id: payload.userId,
    topic: payload.topic,
    contact: payload.contact.trim() || null,
    message: payload.message.trim(),
  })
  if (error) {
    console.error('[feedback] submit:', error.message)
    return false
  }
  return true
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
