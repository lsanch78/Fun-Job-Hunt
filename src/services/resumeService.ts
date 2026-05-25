import { supabase } from '@/lib/supabase'

export type ResumeSlot = 'a' | 'b' | 'c'

export interface ResumeSlotRecord {
  id: string
  user_id: string
  slot: ResumeSlot
  name: string
  uploaded_at: string
}

export async function fetchResumeSlots(userId: string): Promise<ResumeSlotRecord[]> {
  const { data, error } = await supabase
    .from('resume_slots')
    .select('*')
    .eq('user_id', userId)
    .order('slot')
  if (error) {
    console.error('[resumeService] fetchResumeSlots:', error.message)
    return []
  }
  return (data ?? []) as ResumeSlotRecord[]
}

export async function upsertResumeSlot(
  userId: string,
  slot: ResumeSlot,
  name: string,
): Promise<{ error: string | null }> {
  const { error } = await supabase
    .from('resume_slots')
    .upsert(
      { user_id: userId, slot, name, uploaded_at: new Date().toISOString() },
      { onConflict: 'user_id,slot' },
    )
  if (error) {
    console.error('[resumeService] upsertResumeSlot:', error.message)
    return { error: error.message }
  }
  return { error: null }
}

export async function deleteResumeSlot(
  userId: string,
  slot: ResumeSlot,
): Promise<{ error: string | null }> {
  const { error } = await supabase
    .from('resume_slots')
    .delete()
    .eq('user_id', userId)
    .eq('slot', slot)
  if (error) {
    console.error('[resumeService] deleteResumeSlot:', error.message)
    return { error: error.message }
  }
  return { error: null }
}

export function resumeStoragePath(userId: string, slot: ResumeSlot): string {
  return `${userId}/resume_${slot}.pdf`
}

export async function getResumeSignedUrl(
  userId: string,
  slot: ResumeSlot,
): Promise<string | null> {
  const path = resumeStoragePath(userId, slot)
  const { data, error } = await supabase.storage
    .from('resumes')
    .createSignedUrl(path, 3600)
  if (error || !data) {
    console.error('[resumeService] getResumeSignedUrl:', error?.message)
    return null
  }
  return data.signedUrl
}

export async function uploadResumePdf(
  userId: string,
  slot: ResumeSlot,
  file: File,
): Promise<{ error: string | null }> {
  const path = resumeStoragePath(userId, slot)
  const { error } = await supabase.storage
    .from('resumes')
    .upload(path, file, { upsert: true, contentType: 'application/pdf' })
  if (error) {
    console.error('[resumeService] uploadResumePdf:', error.message)
    return { error: error.message }
  }
  return { error: null }
}

export async function deleteResumePdf(
  userId: string,
  slot: ResumeSlot,
): Promise<{ error: string | null }> {
  const path = resumeStoragePath(userId, slot)
  const { error } = await supabase.storage
    .from('resumes')
    .remove([path])
  if (error) {
    console.error('[resumeService] deleteResumePdf:', error.message)
    return { error: error.message }
  }
  return { error: null }
}
